import { pool } from "./dbService.js";
import { dbService } from "./dbService.js";
import { baseTemplate, backupEmailContent } from "./emailTemplates.js";
import { createChildLogger } from "../lib/logger.js";
import fs from "fs";
import path from "path";

const log = createChildLogger("backup");

const BACKUPS_DIR = path.resolve(process.cwd(), "backups");
const MAX_BACKUPS = 7;

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BACKUP_BUCKET = process.env.BACKUP_BUCKET || "backups";

function ensureBackupDir() {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    log.info({ dir: BACKUPS_DIR }, "Created backups directory");
  }
}

async function getTableNames(): Promise<string[]> {
  const result = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
  );
  return result.rows.map((r: any) => r.table_name);
}

async function exportTable(tableName: string): Promise<{ rows: number; filePath: string }> {
  const result = await pool.query(`SELECT * FROM "${tableName}"`);
  const filePath = path.join(BACKUPS_DIR, `${tableName}.json`);
  fs.writeFileSync(filePath, JSON.stringify(result.rows, null, 2), "utf-8");
  return { rows: result.rows.length, filePath };
}

function writeManifest(manifest: any) {
  const filePath = path.join(BACKUPS_DIR, "manifest.json");
  fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2), "utf-8");
}

function getBackupDirs(): string[] {
  ensureBackupDir();
  return fs.readdirSync(BACKUPS_DIR)
    .filter(name => /^\d{4}-\d{2}-\d{2}T/.test(name))
    .map(name => path.join(BACKUPS_DIR, name))
    .sort();
}

async function sendBackupNotification(adminId: string, manifest: any) {
  try {
    const settings = await dbService.getSettings(adminId);
    const superSettings = await dbService.getSettings("default-admin");
    const notificationEmail = settings.notificationEmail || settings.email;
    const smtpHost = superSettings.smtpHost;
    const smtpPort = superSettings.smtpPort || 587;
    const smtpUser = superSettings.smtpUser;
    const smtpPass = superSettings.smtpPass;

    if (!notificationEmail || !smtpHost || !smtpUser || !smtpPass) {
      log.info({}, "Email notification skipped - SMTP or notification email not configured");
      return;
    }

    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.default.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: `"${settings.storeName || "Sales Agent"}" <${smtpUser}>`,
      to: notificationEmail,
      subject: `Database Backup Complete - ${manifest.timestamp}`,
      html: baseTemplate(backupEmailContent(manifest), settings.storeName || "Sales Agent"),
    });
    log.info({ email: notificationEmail }, "Backup notification email sent");
  } catch (err: any) {
    log.error({ err: err.message }, "Failed to send backup notification email");
  }
}

async function uploadToCloud(backupDir: string, timestamp: string, manifest: any): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    log.info({}, "Cloud backup skipped — cloud storage not configured");
    return false;
  }
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: existingBucket } = await supabase.storage.getBucket(BACKUP_BUCKET);
    if (!existingBucket) {
      await supabase.storage.createBucket(BACKUP_BUCKET, { public: false });
      log.info({ bucket: BACKUP_BUCKET }, "Created storage bucket");
    }

    const prefix = timestamp;
    const files = fs.readdirSync(backupDir);

    for (const file of files) {
      const filePath = path.join(backupDir, file);
      if (!fs.statSync(filePath).isFile()) continue;
      const fileBuf = fs.readFileSync(filePath);
      const { error } = await supabase.storage
        .from(BACKUP_BUCKET)
        .upload(`${prefix}/${file}`, fileBuf, {
          contentType: "application/json",
          upsert: true,
        });
      if (error) {
        log.warn({ file, err: error.message }, "Failed to upload file to cloud");
      } else {
        log.info({ file, path: `${BACKUP_BUCKET}/${prefix}/${file}` }, "Uploaded file to cloud");
      }
    }

    // Upload manifest
    const manifestBuf = Buffer.from(JSON.stringify(manifest, null, 2));
    await supabase.storage
      .from(BACKUP_BUCKET)
      .upload(`${prefix}/manifest.json`, manifestBuf, {
        contentType: "application/json",
        upsert: true,
      });

    // Clean old cloud backups (keep last 7)
    const { data: objects } = await supabase.storage.from(BACKUP_BUCKET).list("", { sortBy: { column: "created_at", order: "desc" } });
    if (objects) {
      const dirs = new Set(objects.map((o: any) => o.name?.split("/")[0]).filter(Boolean));
      const sortedDirs = Array.from(dirs).sort();
      while (sortedDirs.length >= MAX_BACKUPS) {
        const oldest = sortedDirs.shift()!;
        if (oldest === timestamp) continue;
        const { data: oldFiles } = await supabase.storage.from(BACKUP_BUCKET).list(oldest);
        if (oldFiles) {
          const paths = oldFiles.map((f: any) => `${oldest}/${f.name}`);
          await supabase.storage.from(BACKUP_BUCKET).remove(paths);
          log.info({ backup: oldest }, "Removed old cloud backup");
        }
      }
    }

    log.info({ fileCount: files.length + 1, bucket: BACKUP_BUCKET }, "Cloud backup complete");
    return true;
  } catch (err: any) {
    log.error({ err: err.message }, "Cloud backup failed");
    return false;
  }
}

function cleanOldBackups(timestamp: string) {
  const backupDirs = getBackupDirs();
  while (backupDirs.length >= MAX_BACKUPS) {
    const oldest = backupDirs.shift()!;
    if (oldest.includes(timestamp)) continue;
    try {
      fs.rmSync(oldest, { recursive: true, force: true });
      log.info({ backup: oldest }, "Removed old backup");
    } catch (err: any) {
      log.warn({ backup: oldest, err: err.message }, "Failed to remove old backup");
    }
  }
}

export async function runBackup(adminId: string = "default-admin"): Promise<{ success: boolean; tables: number; totalRows: number; error?: string }> {
  try {
    ensureBackupDir();

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupDir = path.join(BACKUPS_DIR, timestamp);
    fs.mkdirSync(backupDir, { recursive: true });

    const tableNames = await getTableNames();
    log.info({ tableCount: tableNames.length }, "Found tables to back up");

    const tableExports: { name: string; rows: number; file: string }[] = [];
    let totalRows = 0;

    for (const tableName of tableNames) {
      try {
        const { rows, filePath } = await exportTable(tableName);
        const destPath = path.join(backupDir, `${tableName}.json`);
        fs.renameSync(filePath, destPath);
        tableExports.push({ name: tableName, rows, file: `${tableName}.json` });
        totalRows += rows;
        log.info({ table: tableName, rows }, "Exported table");
      } catch (err: any) {
        log.warn({ table: tableName, err: err.message }, "Failed to export table");
      }
    }

    const manifest = {
      timestamp,
      tableCount: tableExports.length,
      totalRows,
      tables: tableExports,
    };

    writeManifest(manifest);

    await sendBackupNotification(adminId, manifest);

    cleanOldBackups(timestamp);

    const cloudResult = await uploadToCloud(backupDir, timestamp, manifest);
    if (cloudResult) {
      log.info({}, "Backup also uploaded to cloud storage");
    }

    log.info({ tableCount: tableExports.length, totalRows }, "Backup complete");
    return { success: true, tables: tableExports.length, totalRows };
  } catch (err: any) {
    log.error({ err: err.message }, "Backup failed");
    return { success: false, tables: 0, totalRows: 0, error: err.message };
  }
}

let scheduled = false;

export function scheduleBackup(adminId: string = "default-admin") {
  if (scheduled) {
    log.info({}, "Backup scheduler already running");
    return;
  }
  scheduled = true;
  const INTERVAL_MS = 24 * 60 * 60 * 1000;
  log.info({ intervalMs: INTERVAL_MS }, "Backup scheduler started");
  runBackup(adminId);
  setInterval(() => runBackup(adminId), INTERVAL_MS);
}

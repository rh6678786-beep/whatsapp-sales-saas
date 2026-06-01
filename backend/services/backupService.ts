import { pool } from "./dbService.js";
import { dbService } from "./dbService.js";
import { baseTemplate, backupEmailContent } from "./emailTemplates.js";
import fs from "fs";
import path from "path";

const BACKUPS_DIR = path.resolve(process.cwd(), "backups");
const MAX_BACKUPS = 7;

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BACKUP_BUCKET = process.env.BACKUP_BUCKET || "backups";

function log(msg: string) {
  console.log(`[BACKUP] ${msg}`);
}

function ensureBackupDir() {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    log(`Created backups directory: ${BACKUPS_DIR}`);
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
      log("Email notification skipped - SMTP or notification email not configured");
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
    log(`Backup notification email sent to ${notificationEmail}`);
  } catch (err: any) {
    log(`Failed to send backup notification email: ${err.message}`);
  }
}

async function uploadToCloud(backupDir: string, timestamp: string, manifest: any): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    log("Cloud backup skipped — SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set");
    return false;
  }
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: existingBucket } = await supabase.storage.getBucket(BACKUP_BUCKET);
    if (!existingBucket) {
      await supabase.storage.createBucket(BACKUP_BUCKET, { public: false });
      log(`Created storage bucket: ${BACKUP_BUCKET}`);
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
        log(`Failed to upload ${file}: ${error.message}`);
      } else {
        log(`Uploaded ${file} to ${BACKUP_BUCKET}/${prefix}/${file}`);
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
          log(`Removed old cloud backup: ${oldest}`);
        }
      }
    }

    log(`Cloud backup complete: ${files.length + 1} files uploaded to ${BACKUP_BUCKET}`);
    return true;
  } catch (err: any) {
    log(`Cloud backup failed: ${err.message}`);
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
      log(`Removed old backup: ${oldest}`);
    } catch (err: any) {
      log(`Failed to remove old backup ${oldest}: ${err.message}`);
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
    log(`Found ${tableNames.length} tables to back up`);

    const tableExports: { name: string; rows: number; file: string }[] = [];
    let totalRows = 0;

    for (const tableName of tableNames) {
      try {
        const { rows, filePath } = await exportTable(tableName);
        const destPath = path.join(backupDir, `${tableName}.json`);
        fs.renameSync(filePath, destPath);
        tableExports.push({ name: tableName, rows, file: `${tableName}.json` });
        totalRows += rows;
        log(`  Exported ${tableName}: ${rows} rows`);
      } catch (err: any) {
        log(`  Failed to export ${tableName}: ${err.message}`);
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
      log("Backup also uploaded to cloud storage");
    }

    log(`Backup complete: ${tableExports.length} tables, ${totalRows} total rows`);
    return { success: true, tables: tableExports.length, totalRows };
  } catch (err: any) {
    log(`Backup failed: ${err.message}`);
    return { success: false, tables: 0, totalRows: 0, error: err.message };
  }
}

let scheduled = false;

export function scheduleBackup(adminId: string = "default-admin") {
  if (scheduled) {
    log("Backup scheduler already running");
    return;
  }
  scheduled = true;
  const INTERVAL_MS = 24 * 60 * 60 * 1000;
  log(`Backup scheduler started (interval: 24h)`);
  runBackup(adminId);
  setInterval(() => runBackup(adminId), INTERVAL_MS);
}

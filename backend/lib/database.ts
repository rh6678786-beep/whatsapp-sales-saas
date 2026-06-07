import { execSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import { pool } from "../services/dbService.js";
import { env } from "./env.js";
import { createChildLogger } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const log = createChildLogger("database");

// Migration lock — prevents concurrent migration execution
const MIGRATION_LOCK_KEY = "migration_lock";
const MIGRATION_LOCK_TIMEOUT = 120000; // 2 minutes

/**
 * Acquire a database-level migration lock using pg_try_advisory_lock.
 * Returns true if lock acquired, false if another process holds it.
 */
/**
 * Generate a deterministic 32-bit integer from a string for use with
 * PostgreSQL advisory locks. Uses a simple djb2 hash to avoid collisions.
 */
function lockHash(key: string): number {
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) + hash + key.charCodeAt(i)) | 0; // djb2
  }
  return hash >>> 0; // Convert to unsigned 32-bit
}

async function acquireMigrationLock(): Promise<boolean> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT pg_try_advisory_lock($1) as locked",
      [lockHash(MIGRATION_LOCK_KEY)]
    );
    return result.rows[0]?.locked === true;
  } catch {
    return false; // Lock mechanism failed — proceed cautiously
  } finally {
    client.release();
  }
}

/**
 * Release the advisory lock.
 */
async function releaseMigrationLock(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      "SELECT pg_advisory_unlock($1)",
      [lockHash(MIGRATION_LOCK_KEY)]
    );
  } catch {
    // Non-critical
  } finally {
    client.release();
  }
}

export async function setupDatabase(): Promise<void> {
  log.info("Setting up database...");

  // Verify connectivity
  try {
    const client = await pool.connect();
    const result = await client.query("SELECT 1 as ok");
    client.release();
    log.info("PostgreSQL connection verified");
  } catch (err) {
    log.error({ err }, "Failed to connect to PostgreSQL");
    throw err;
  }

  // Check if tables exist
  let tablesExist = false;
  try {
    const client = await pool.connect();
    const tableCheck = await client.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'Admin')"
    );
    tablesExist = tableCheck.rows[0].exists;
    client.release();
  } catch (err) {
    log.warn({ err }, "Could not check table existence — proceeding with schema setup");
  }

  // Acquire migration lock to prevent concurrent runs
  const lockAcquired = await acquireMigrationLock();
  if (!lockAcquired) {
    log.warn("Another process is currently running migrations — skipping schema setup");
    return;
  }

  try {
    if (!tablesExist) {
      log.info("No existing tables found — running initial schema setup");
      // First try proper migrations (safe path)
      try {
        execSync("npx prisma migrate deploy", {
          stdio: "inherit",
          cwd: path.join(__dirname, "..", ".."),
          env: { ...process.env },
          timeout: MIGRATION_LOCK_TIMEOUT,
        });
        log.info("Migrations deployed successfully");
      } catch (migrateErr: unknown) {
        const migrateMsg = (migrateErr as Error).message?.slice(0, 200);
        log.warn({ err: migrateMsg }, "migrate deploy failed — falling back to safe schema push");
        // Fallback: push schema safely (no --accept-data-loss to prevent destructive changes)
        try {
          execSync("npx prisma db push", {
            stdio: "inherit",
            cwd: path.join(__dirname, "..", ".."),
            env: { ...process.env },
            timeout: MIGRATION_LOCK_TIMEOUT,
          });
          log.info("Schema synced with database (safe db push)");
        } catch (schemaErr: unknown) {
          const msg = (schemaErr as Error).message?.slice(0, 200);
          log.warn({ err: msg }, "Safe schema push failed — manual migration may be needed");
        }
      }
    } else {
      log.info("Tables already exist — applying pending migrations");
      try {
        execSync("npx prisma migrate deploy", {
          stdio: "inherit",
          cwd: path.join(__dirname, "..", ".."),
          env: { ...process.env },
          timeout: MIGRATION_LOCK_TIMEOUT,
        });
        log.info("Migrations deployed successfully");
      } catch (migrateErr: unknown) {
        const migrateMsg = (migrateErr as Error).message?.slice(0, 200);
        log.warn({ err: migrateMsg }, "migrate deploy failed on existing tables — manual migration required");
      }
    }

    // Run seed if needed
    try {
      const { seedDatabase } = await import("../lib/seed.js");
      await seedDatabase();
    } catch (seedErr: unknown) {
      log.warn({ err: (seedErr as Error).message }, "Seed warning (non-fatal)");
    }
  } finally {
    // Always release the lock
    await releaseMigrationLock();
  }

  log.info("Database setup complete");
}

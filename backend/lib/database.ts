import { execSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import { pool } from "../services/dbService.js";
import { env } from "./env.js";
import { createChildLogger } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const log = createChildLogger("database");

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
  } catch (_) {
    // Ignore
  }

  if (!tablesExist) {
    log.info("No existing tables found — running schema sync");
    try {
      execSync("npx prisma db push --accept-data-loss", {
        stdio: "inherit",
        cwd: path.join(__dirname, "..", ".."),
        env: { ...process.env },
        timeout: 120000,
      });
      log.info("Schema synced with database");
    } catch (schemaErr: unknown) {
      const msg = (schemaErr as Error).message?.slice(0, 200);
      log.warn({ err: msg }, "Schema push had warnings");
    }
  } else {
    log.info("Tables already exist — skipping schema sync");
  }

  // Run seed if needed
  try {
    const { seedDatabase } = await import("../lib/seed.js");
    await seedDatabase();
  } catch (seedErr: unknown) {
    log.warn({ err: (seedErr as Error).message }, "Seed warning (non-fatal)");
  }

  log.info("Database setup complete");
}

#!/usr/bin/env tsx
/**
 * Database Index Migration Script
 *
 * Applies new performance indexes directly through the pg pool connection,
 * which works with Supabase's PgBouncer connection pooling.
 *
 * Usage: npx tsx backend/scripts/migrate-indexes.ts
 */

import "../lib/env.js";
import { pool } from "../services/dbService.js";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("migrate:indexes");

const NEW_INDEXES = [
  // Product indexes
  `CREATE INDEX IF NOT EXISTS "Product_id_adminId_idx" ON "Product" ("id", "adminId")`,
  `CREATE INDEX IF NOT EXISTS "Product_adminId_name_idx" ON "Product" ("adminId", "name")`,
  `CREATE INDEX IF NOT EXISTS "Product_adminId_stock_idx" ON "Product" ("adminId", "stock")`,

  // Session indexes
  `CREATE INDEX IF NOT EXISTS "Session_adminId_isBlocked_idx" ON "Session" ("adminId", "isBlocked")`,
  `CREATE INDEX IF NOT EXISTS "Session_adminId_state_isBlocked_lastMessageAt_idx" ON "Session" ("adminId", "state", "isBlocked", "lastMessageAt")`,

  // Message indexes
  `CREATE INDEX IF NOT EXISTS "Message_adminId_timestamp_idx" ON "Message" ("adminId", "timestamp")`,

  // Order indexes
  `CREATE INDEX IF NOT EXISTS "Order_adminId_userId_idx" ON "Order" ("adminId", "userId")`,
  `CREATE INDEX IF NOT EXISTS "Order_adminId_userId_status_idx" ON "Order" ("adminId", "userId", "status")`,
  `CREATE INDEX IF NOT EXISTS "Order_adminId_status_createdAt_idx" ON "Order" ("adminId", "status", "createdAt")`,

  // Deal indexes
  `CREATE INDEX IF NOT EXISTS "Deal_adminId_deleted_idx" ON "Deal" ("adminId", "deleted")`,
  `CREATE INDEX IF NOT EXISTS "Deal_adminId_endDate_idx" ON "Deal" ("adminId", "endDate")`,

  // DripCampaign indexes
  `CREATE INDEX IF NOT EXISTS "DripCampaign_adminId_enabled_idx" ON "DripCampaign" ("adminId", "enabled")`,
  `CREATE INDEX IF NOT EXISTS "DripCampaign_adminId_trigger_idx" ON "DripCampaign" ("adminId", "trigger")`,
];

async function main() {
  log.info({ count: NEW_INDEXES.length }, "Starting index migration");

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const sql of NEW_INDEXES) {
    try {
      const client = await pool.connect();
      try {
        await client.query(sql);
        log.info({ name: extractIndexName(sql) }, "✓ Index created");
        created++;
      } finally {
        client.release();
      }
    } catch (err: any) {
      if (err.code === "42P11" || err.message?.includes("already exists")) {
        log.info({ name: extractIndexName(sql) }, "~ Already exists");
        skipped++;
      } else {
        log.error({ err: err.message, name: extractIndexName(sql) }, "✗ Failed");
        errors++;
      }
    }
  }

  log.info({ created, skipped, errors, total: NEW_INDEXES.length }, "Index migration complete");
  await pool.end();

  if (errors > 0) {
    log.warn({ errors }, "Some indexes failed — review errors above");
    process.exit(1);
  }
}

function extractIndexName(sql: string): string {
  const match = sql.match(/"([^"]+)"/);
  return match ? match[1] : sql.substring(0, 60);
}

main().catch((err) => {
  log.error({ err: err.message }, "Index migration failed");
  process.exit(1);
});

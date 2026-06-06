/**
 * Birthday Backfill Script
 * 
 * Extracts birthday from existing sessions' `metadata` JSON and populates
 * the new `birthday` column for indexed queries.
 * 
 * Usage: npx tsx backend/scripts/backfill-birthdays.ts
 */

import "dotenv/config";
import { PrismaClient } from "../../generated/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const connectionString = (process.env.DATABASE_URL || "").replace(/[?&]sslmode=[^&]*/g, "").replace(/[?&]$/, "");
const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 5 });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * Normalize birthday to MM-DD format.
 * Mirrors the extractBirthday function in dbService.ts.
 */
function extractBirthday(metadata: any): string | null {
  if (!metadata || !metadata.birthday) return null;
  const raw = String(metadata.birthday).trim();
  if (!raw) return null;

  // ISO format: YYYY-MM-DD
  const isoMatch = raw.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if (isoMatch) {
    return `${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;
  }

  // Other formats: MM-DD, MM/DD, DD-MM-YYYY, etc.
  const dateMatch = raw.match(/(\d{1,2})[-\/](\d{1,2})(?:[-\/]\d{2,4})?/);
  if (dateMatch) {
    let month = dateMatch[1], day = dateMatch[2];
    if (parseInt(month, 10) > 12) { month = dateMatch[2]; day = dateMatch[1]; }
    return `${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return raw;
}

async function backfillBirthdays() {
  console.log("=".repeat(60));
  console.log("  Birthday Backfill Script");
  console.log("  Extracts birthdays from session metadata into the birthday column");
  console.log("=".repeat(60));
  console.log("");

  // Find all sessions that have birthday in metadata but NULL in birthday column
  const sessions = await prisma.$queryRaw<Array<{ adminId: string; id: string; metadata: any }>>`
    SELECT "adminId", "id", "metadata"
    FROM "Session"
    WHERE "metadata"->>'birthday' IS NOT NULL
      AND "metadata"->>'birthday' != ''
      AND ("birthday" IS NULL OR "birthday" = '')
  `;

  console.log(`Found ${sessions.length} sessions with unextracted birthdays.`);
  console.log("");

  if (sessions.length === 0) {
    console.log("✓ All birthdays are already extracted. Nothing to backfill.");
    await pool.end();
    return;
  }

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const session of sessions) {
    const normalized = extractBirthday(session.metadata);

    if (!normalized) {
      skipped++;
      continue;
    }

    try {
      await prisma.$executeRaw`
        UPDATE "Session"
        SET "birthday" = ${normalized}
        WHERE "adminId" = ${session.adminId} AND "id" = ${session.id}
      `;
      updated++;
      
      if (updated <= 5 || updated % 100 === 0) {
        console.log(`  [${updated}/${sessions.length}] ${session.adminId.slice(0, 12)}... → ${normalized}`);
      }
    } catch (err: any) {
      errors++;
      console.error(`  ✗ Error updating ${session.adminId}/${session.id}: ${err.message?.slice(0, 100)}`);
    }
  }

  console.log("");
  console.log("=".repeat(60));
  console.log("  Backfill Complete");
  console.log(`  ✓ Updated: ${updated}`);
  console.log(`  − Skipped (unparseable): ${skipped}`);
  console.log(`  ✗ Errors: ${errors}`);
  console.log("=".repeat(60));

  await pool.end();
}

backfillBirthdays().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});

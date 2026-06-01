import "dotenv/config";
import { dbService, pool } from "../services/dbService";
import { generateEmbedding, storeEmbedding } from "../services/embeddingService";
import { generateConversationSummary, extractCustomerPreferences, storeSummary } from "../services/summarizationService";
import { Message } from "../../src/types";

async function migrateMemory() {
  console.log("[MEMORY-MIGRATE] Starting backfill for existing conversations...");

  try {
    const adminIds = await dbService.getAllAdminIds();
    console.log(`[MEMORY-MIGRATE] Found ${adminIds.length} admins`);

    let totalEmbeddings = 0;
    let totalSummaries = 0;
    let totalSkipped = 0;

    for (const adminId of adminIds) {
      console.log(`\n[MEMORY-MIGRATE] Processing admin: ${adminId}`);

      // Get all sessions for this admin
      const sessions = await dbService.getRecentSessions(adminId, 1000);
      console.log(`[MEMORY-MIGRATE]   Sessions: ${sessions.length}`);

      for (const session of sessions) {
        const messages = await dbService.getMessages(adminId, session.id);
        if (messages.length === 0) {
          totalSkipped++;
          continue;
        }

        // Check if embeddings already exist for this session
        const existingResult = await pool.query(
          `SELECT COUNT(*) as count FROM message_embeddings WHERE admin_id = $1 AND session_id = $2`,
          [adminId, session.id]
        );
        const hasEmbeddings = parseInt(existingResult.rows[0]?.count || "0") > 0;

        // Check if summary already exists
        const summaryResult = await pool.query(
          `SELECT COUNT(*) as count FROM conversation_summaries WHERE admin_id = $1 AND session_id = $2`,
          [adminId, session.id]
        );
        const hasSummary = parseInt(summaryResult.rows[0]?.count || "0") > 0;

        // Generate embeddings for messages that don't have them
        if (!hasEmbeddings) {
          let embedded = 0;
          for (const msg of messages) {
            if (!msg.text || msg.text.length < 5) continue;
            const embedding = await generateEmbedding(msg.text, adminId);
            if (embedding) {
              const msgId = `${adminId}:${session.id}:${msg.timestamp}`;
              await storeEmbedding(adminId, session.id, msgId, msg.role, msg.text, embedding);
              embedded++;
            }
          }
          totalEmbeddings += embedded;
          console.log(`[MEMORY-MIGRATE]   Session ${session.id.slice(-8)}: ${embedded}/${messages.length} embeddings`);
        }

        // Generate summary for sessions with >= 20 messages
        if (!hasSummary && messages.length >= 20) {
          console.log(`[MEMORY-MIGRATE]   Session ${session.id.slice(-8)}: generating summary (${messages.length} msgs)...`);
          const [summary, preferences] = await Promise.all([
            generateConversationSummary(adminId, session.id, messages),
            extractCustomerPreferences(adminId, session.id, messages),
          ]);
          if (summary) {
            await storeSummary(adminId, session.id, summary, messages.length, preferences);
            totalSummaries++;
            console.log(`[MEMORY-MIGRATE]   Session ${session.id.slice(-8)}: summary saved ✓`);
          }
        } else if (!hasSummary && messages.length < 20) {
          totalSkipped++;
        }
      }
    }

    console.log(`\n[MEMORY-MIGRATE] Migration complete!`);
    console.log(`  • Embeddings generated: ${totalEmbeddings}`);
    console.log(`  • Summaries generated: ${totalSummaries}`);
    console.log(`  • Sessions skipped (too short or already done): ${totalSkipped}`);
  } catch (err: any) {
    console.error("[MEMORY-MIGRATE] Error during migration:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrateMemory();

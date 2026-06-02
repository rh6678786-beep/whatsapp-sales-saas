import { pool } from "./dbService";
import { dbService } from "./dbService";
import { getAIClient } from "./aiService";
import { Message } from "../../src/types";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("ai:summary");

const DEFAULT_SUMMARIZATION_THRESHOLD = 20;

export interface ConversationSummary {
  id: string;
  adminId: string;
  sessionId: string;
  summary: string;
  messageCount: number;
  customerPreferences: Record<string, any>;
  updatedAt: string;
}

export async function generateConversationSummary(
  adminId: string,
  sessionId: string,
  messages: Message[]
): Promise<string | null> {
  if (messages.length < DEFAULT_SUMMARIZATION_THRESHOLD) return null;

  try {
    const ai = await getAIClient(adminId);
    if (!ai) return null;

    const settings = await dbService.getSettings(adminId);
    const langCode = settings.language || "ur";

    const conversationText = messages
      .map(m => `${m.role === "user" ? "Customer" : "You"}: ${m.text}`)
      .join("\n");

    const prompt = `Summarize this sales conversation. Include: what the customer wants, budget, objections, preferred products, decision stage. Keep under 200 words. Language: respond in the same language as the conversation.

Conversation:
${conversationText}

Summary:`;

    const response = await ai.models.generateContent({
      model: settings.geminiModel || "gemini-2.0-flash",
      contents: prompt,
      config: { temperature: 0.3 },
    });

    return response.text || null;
  } catch (err: any) {
    log.warn({ err: err.message, adminId, sessionId }, "Failed to generate summary");
    return null;
  }
}

export async function extractCustomerPreferences(
  adminId: string,
  sessionId: string,
  messages: Message[]
): Promise<Record<string, any>> {
  try {
    const ai = await getAIClient(adminId);
    if (!ai) return {};

    const conversationText = messages
      .map(m => `${m.role === "user" ? "Customer" : "You"}: ${m.text}`)
      .join("\n");

    const prompt = `Extract customer preferences from this sales conversation. Return ONLY a JSON object with these fields:
{
  "preferredCategories": ["category1", "category2"],
  "priceRange": { "min": number, "max": number },
  "budget": number | null,
  "interests": ["interest1"],
  "communicationStyle": "formal" | "casual" | "urgent" | "price-sensitive"
}

If a field cannot be determined, use null or empty array. No explanation, no markdown, just JSON.

Conversation:
${conversationText}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: { temperature: 0.1 },
    });

    const text = response.text || "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return {};
  } catch (err: any) {
    log.warn({ err: err.message, adminId, sessionId }, "Failed to extract preferences");
    return {};
  }
}

export async function storeSummary(
  adminId: string,
  sessionId: string,
  summary: string,
  messageCount: number,
  preferences: Record<string, any> = {}
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO conversation_summaries (admin_id, session_id, summary, message_count, customer_preferences)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT (admin_id, session_id) 
       DO UPDATE SET summary = $3, message_count = $4, customer_preferences = $5::jsonb, updated_at = NOW()`,
      [adminId, sessionId, summary, messageCount, JSON.stringify(preferences)]
    );
  } catch (err: any) {
    log.warn({ err: err.message, adminId, sessionId }, "Failed to store summary");
  }
}

export async function getLatestSummary(
  adminId: string,
  sessionId: string
): Promise<ConversationSummary | null> {
  try {
    const result = await pool.query(
      `SELECT id, admin_id, session_id, summary, message_count, customer_preferences, updated_at
       FROM conversation_summaries
       WHERE admin_id = $1 AND session_id = $2
       ORDER BY updated_at DESC
       LIMIT 1`,
      [adminId, sessionId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      adminId: row.admin_id,
      sessionId: row.session_id,
      summary: row.summary,
      messageCount: row.message_count,
      customerPreferences: row.customer_preferences || {},
      updatedAt: row.updated_at,
    };
  } catch (err: any) {
    log.warn({ err: err.message, adminId, sessionId }, "Failed to get latest summary");
    return null;
  }
}

export async function shouldGenerateSummary(
  messageCount: number,
  lastMessageCount: number
): Promise<boolean> {
  const threshold = DEFAULT_SUMMARIZATION_THRESHOLD;
  if (messageCount < threshold) return false;
  if (lastMessageCount < threshold && messageCount >= threshold) return true;
  if (messageCount % threshold === 0) return true;
  return false;
}

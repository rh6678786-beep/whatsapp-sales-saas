import { pool } from "./dbService";
import { getAIClient } from "./aiService";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("ai:embedding");

const EMBEDDING_MODEL = "text-embedding-004";
const SIMILARITY_THRESHOLD = 0.7;
const MAX_SEARCH_RESULTS = 5;
const MAX_TEXT_LENGTH = 2000;

export interface EmbeddingRecord {
  id: string;
  adminId: string;
  sessionId: string;
  messageId: string;
  role: string;
  text: string;
  createdAt: string;
}

export interface SimilarResult {
  text: string;
  role: string;
  sessionId: string;
  similarity: number;
}

export async function generateEmbedding(text: string, adminId: string): Promise<number[] | null> {
  try {
    const ai = await getAIClient(adminId);
    if (!ai) return null;

    const truncated = text.slice(0, MAX_TEXT_LENGTH);
    const response = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: truncated,
    });

    const embedding = response.embeddings?.[0]?.values;
    if (!embedding || !Array.isArray(embedding)) return null;

    return embedding;
  } catch (err: any) {
    log.warn({ err: err.message, adminId }, "Failed to generate embedding");
    return null;
  }
}

export async function storeEmbedding(
  adminId: string,
  sessionId: string,
  messageId: string,
  role: string,
  text: string,
  embedding: number[]
): Promise<void> {
  try {
    const vectorStr = `[${embedding.join(",")}]`;
    await pool.query(
      `INSERT INTO message_embeddings (admin_id, session_id, message_id, role, text, embedding)
       VALUES ($1, $2, $3, $4, $5, $6::vector)
       ON CONFLICT (message_id) DO NOTHING`,
      [adminId, sessionId, messageId, role, text, vectorStr]
    );
  } catch (err: any) {
    log.warn({ err: err.message }, "Failed to store embedding");
  }
}

export async function searchSimilar(
  adminId: string,
  queryEmbedding: number[],
  limit: number = MAX_SEARCH_RESULTS
): Promise<SimilarResult[]> {
  try {
    const vectorStr = `[${queryEmbedding.join(",")}]`;
    const result = await pool.query(
      `SELECT text, role, session_id, 1 - (embedding <=> $1::vector) AS similarity
       FROM message_embeddings
       WHERE admin_id = $2
         AND 1 - (embedding <=> $1::vector) >= $3
       ORDER BY embedding <=> $1::vector
       LIMIT $4`,
      [vectorStr, adminId, SIMILARITY_THRESHOLD, limit]
    );

    return result.rows.map(row => ({
      text: row.text,
      role: row.role,
      sessionId: row.session_id,
      similarity: parseFloat(row.similarity),
    }));
  } catch (err: any) {
    log.warn({ err: err.message, adminId }, "Embedding search failed");
    return [];
  }
}

export async function getSessionEmbeddings(
  adminId: string,
  sessionId: string
): Promise<EmbeddingRecord[]> {
  try {
    const result = await pool.query(
      `SELECT id, admin_id, session_id, message_id, role, text, created_at
       FROM message_embeddings
       WHERE admin_id = $1 AND session_id = $2
       ORDER BY created_at ASC`,
      [adminId, sessionId]
    );

    return result.rows.map(row => ({
      id: row.id,
      adminId: row.admin_id,
      sessionId: row.session_id,
      messageId: row.message_id,
      role: row.role,
      text: row.text,
      createdAt: row.created_at,
    }));
  } catch (err: any) {
    log.warn({ err: err.message, adminId }, "Failed to get session embeddings");
    return [];
  }
}

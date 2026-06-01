import { pool } from "../services/dbService.js";
import { env } from "../config/env.js";

const MODEL_RATES: Record<string, { input: number; output: number }> = {
  "gemini-2.0-flash": { input: 0.10 / 1_000_000, output: 0.40 / 1_000_000 },
  "gemini-2.0-flash-exp": { input: 0.10 / 1_000_000, output: 0.40 / 1_000_000 },
  "gemini-1.5-pro": { input: 1.25 / 1_000_000, output: 5.00 / 1_000_000 },
  "gemini-1.5-flash": { input: 0.075 / 1_000_000, output: 0.30 / 1_000_000 },
};

function startOfDay(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function trackAICall(
  adminId: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
): Promise<void> {
  const rates = MODEL_RATES[model] || MODEL_RATES["gemini-2.0-flash"];
  const cost = (inputTokens * rates.input) + (outputTokens * rates.output);

  try {
    await pool.query(
      `INSERT INTO ai_cost_log (admin_id, model, input_tokens, output_tokens, cost)
       VALUES ($1, $2, $3, $4, $5)`,
      [adminId, model, inputTokens, outputTokens, cost],
    );
  } catch (err: any) {
    console.error(`[AI_COST] Failed to log cost for ${adminId}:`, err.message);
    return;
  }

  if (cost > 0.01) {
    console.log(`[AI_COST][${adminId}] $${cost.toFixed(6)} (${model})`);
  }
}

export async function getAdminDailyCost(adminId: string): Promise<number> {
  try {
    const result = await pool.query(
      `SELECT COALESCE(SUM(cost), 0) AS total
       FROM ai_cost_log
       WHERE admin_id = $1 AND created_at >= $2`,
      [adminId, startOfDay()],
    );
    return parseFloat(result.rows[0].total);
  } catch {
    return 0;
  }
}

export async function getAdminMonthlyCost(adminId: string): Promise<number> {
  try {
    const result = await pool.query(
      `SELECT COALESCE(SUM(cost), 0) AS total
       FROM ai_cost_log
       WHERE admin_id = $1 AND created_at >= $2`,
      [adminId, startOfMonth()],
    );
    return parseFloat(result.rows[0].total);
  } catch {
    return 0;
  }
}

export async function isBudgetExceeded(adminId: string): Promise<boolean> {
  const monthly = await getAdminMonthlyCost(adminId);
  return monthly >= env.AI_MONTHLY_BUDGET;
}

export async function getAdminCostSummary(adminId: string): Promise<{
  daily: number;
  monthly: number;
  budget: number;
  exceeded: boolean;
}> {
  const [daily, monthly] = await Promise.all([
    getAdminDailyCost(adminId),
    getAdminMonthlyCost(adminId),
  ]);
  return {
    daily: Math.round(daily * 1000000) / 1000000,
    monthly: Math.round(monthly * 100) / 100,
    budget: env.AI_MONTHLY_BUDGET,
    exceeded: monthly >= env.AI_MONTHLY_BUDGET,
  };
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

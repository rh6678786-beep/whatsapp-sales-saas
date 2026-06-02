import { dbService } from "./dbService.js";
import { env } from "../lib/env.js";
import { createChildLogger } from "../lib/logger.js";
import { getRedis } from "../lib/redis.js";

const log = createChildLogger("ai:cost-tracker");

const MODEL_RATES: Record<string, { input: number; output: number }> = {
  "gemini-2.0-flash": { input: 0.10 / 1_000_000, output: 0.40 / 1_000_000 },
  "gemini-2.0-flash-exp": { input: 0.10 / 1_000_000, output: 0.40 / 1_000_000 },
  "gemini-1.5-pro": { input: 1.25 / 1_000_000, output: 5.00 / 1_000_000 },
  "gemini-1.5-flash": { input: 0.075 / 1_000_000, output: 0.30 / 1_000_000 },
};

const REDIS_COST_KEY = (adminId: string, period: "daily" | "monthly") =>
  `ai:cost:${adminId}:${period}`;
const REDIS_COST_TTL = {
  daily: 86400, // 24h
  monthly: 86400 * 32, // ~32 days
};

async function getCacheOrCompute(
  adminId: string,
  period: "daily" | "monthly",
  compute: () => Promise<number>,
): Promise<number> {
  try {
    const redis = getRedis();
    if (redis) {
      const cached = await redis.get(REDIS_COST_KEY(adminId, period));
      if (cached !== null) return parseFloat(cached);
    }
  } catch {}

  const value = await compute();

  try {
    const redis = getRedis();
    if (redis) {
      await redis.setex(
        REDIS_COST_KEY(adminId, period),
        REDIS_COST_TTL[period],
        value.toString(),
      );
    }
  } catch {}

  return value;
}

export async function trackAICall(
  adminId: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
): Promise<void> {
  const rates = MODEL_RATES[model] || MODEL_RATES["gemini-2.0-flash"];
  const cost = inputTokens * rates.input + outputTokens * rates.output;

  try {
    await dbService.logAiCost(adminId, model, inputTokens, outputTokens, cost);
  } catch (err: any) {
    log.error({ err, adminId }, "Failed to log AI cost");
    return;
  }

  if (cost > 0.01) {
    log.info({ adminId, cost: cost.toFixed(6), model }, "AI cost tracked");
  }
}

export async function getAdminDailyCost(adminId: string): Promise<number> {
  return getCacheOrCompute(adminId, "daily", () => dbService.getAdminDailyCost(adminId));
}

export async function getAdminMonthlyCost(adminId: string): Promise<number> {
  return getCacheOrCompute(adminId, "monthly", () => dbService.getAdminMonthlyCost(adminId));
}

export async function isBudgetExceeded(adminId: string): Promise<boolean> {
  const monthly = await getAdminMonthlyCost(adminId);
  const budget = env.AI_MONTHLY_BUDGET;
  return monthly >= budget;
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
  const budget = env.AI_MONTHLY_BUDGET;
  return {
    daily: Math.round(daily * 1000000) / 1000000,
    monthly: Math.round(monthly * 100) / 100,
    budget,
    exceeded: monthly >= budget,
  };
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

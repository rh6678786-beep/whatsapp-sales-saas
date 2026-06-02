import { createChildLogger } from "./logger.js";

const log = createChildLogger("guard:token-budget");

const TOKEN_RATES: Record<string, number> = {
  "gemini-2.0-flash": 4.0,
  "gemini-2.0-flash-exp": 4.0,
  "gemini-1.5-pro": 4.0,
  "gemini-1.5-flash": 4.0,
};

const DEFAULT_CHARS_PER_TOKEN = 4.0;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / DEFAULT_CHARS_PER_TOKEN);
}

export interface TokenBudgetConfig {
  maxInputTokens: number;
  maxOutputTokens: number;
  maxContextTokens: number;
  reserveSystemTokens: number;
  reserveHistoryTokens: number;
}

const DEFAULT_BUDGETS: Record<string, TokenBudgetConfig> = {
  "generateSalesResponse": {
    maxInputTokens: 32000,
    maxOutputTokens: 1024,
    maxContextTokens: 28000,
    reserveSystemTokens: 8000,
    reserveHistoryTokens: 5000,
  },
  "generateAdminActionMessage": {
    maxInputTokens: 16000,
    maxOutputTokens: 512,
    maxContextTokens: 14000,
    reserveSystemTokens: 4000,
    reserveHistoryTokens: 2000,
  },
  "generateEnhancedPost": {
    maxInputTokens: 8000,
    maxOutputTokens: 1024,
    maxContextTokens: 7000,
    reserveSystemTokens: 3000,
    reserveHistoryTokens: 1000,
  },
};

export function getBudget(operation: string): TokenBudgetConfig {
  return DEFAULT_BUDGETS[operation] || DEFAULT_BUDGETS["generateSalesResponse"];
}

export interface TokenBudgetResult {
  withinBudget: boolean;
  inputTokens: number;
  outputTokens: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  remainingInput: number;
  remainingOutput: number;
}

export function validateTokenBudget(
  prompt: string,
  outputEstimate: number,
  operation: string = "generateSalesResponse",
): TokenBudgetResult {
  const budget = getBudget(operation);
  const inputTokens = estimateTokens(prompt);
  const outputTokens = outputEstimate;

  return {
    withinBudget: inputTokens <= budget.maxInputTokens && outputTokens <= budget.maxOutputTokens,
    inputTokens,
    outputTokens,
    maxInputTokens: budget.maxInputTokens,
    maxOutputTokens: budget.maxOutputTokens,
    remainingInput: budget.maxInputTokens - inputTokens,
    remainingOutput: budget.maxOutputTokens - outputTokens,
  };
}

export function shouldTruncate(
  prompt: string,
  operation: string = "generateSalesResponse",
): { needsTruncation: boolean; budget: TokenBudgetConfig; currentTokens: number } {
  const budget = getBudget(operation);
  const currentTokens = estimateTokens(prompt);
  return {
    needsTruncation: currentTokens > budget.maxContextTokens,
    budget,
    currentTokens,
  };
}

export function createTokenBudgetTracker(operation: string = "generateSalesResponse") {
  const budget = getBudget(operation);
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  return {
    trackInput: (text: string) => {
      const tokens = estimateTokens(text);
      totalInputTokens += tokens;
      if (totalInputTokens > budget.maxInputTokens) {
        log.warn({ operation, totalInputTokens, max: budget.maxInputTokens }, "Input token budget exceeded");
        return false;
      }
      return true;
    },
    trackOutput: (text: string) => {
      const tokens = estimateTokens(text);
      totalOutputTokens += tokens;
      if (totalOutputTokens > budget.maxOutputTokens) {
        log.warn({ operation, totalOutputTokens, max: budget.maxOutputTokens }, "Output token budget exceeded");
        return false;
      }
      return true;
    },
    getUsage: () => ({
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      maxInputTokens: budget.maxInputTokens,
      maxOutputTokens: budget.maxOutputTokens,
      inputPercent: Math.round((totalInputTokens / budget.maxInputTokens) * 100),
      outputPercent: Math.round((totalOutputTokens / budget.maxOutputTokens) * 100),
    }),
    reset: () => {
      totalInputTokens = 0;
      totalOutputTokens = 0;
    },
  };
}

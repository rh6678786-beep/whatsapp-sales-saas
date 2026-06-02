import { describe, it, expect } from "vitest";
import { estimateTokens, validateTokenBudget, shouldTruncate, createTokenBudgetTracker } from "../lib/tokenBudget.js";

describe("Token Budget Tracker", () => {
  it("should estimate tokens roughly as chars/4", () => {
    expect(estimateTokens("Hello world")).toBeGreaterThan(0);
    expect(estimateTokens("")).toBe(0);
    const hundredChars = "a".repeat(100);
    expect(estimateTokens(hundredChars)).toBe(25);
  });

  it("should validate budget within limits", () => {
    const result = validateTokenBudget("short prompt", 100);
    expect(result.withinBudget).toBe(true);
    expect(result.inputTokens).toBeLessThan(result.maxInputTokens);
  });

  it("should detect exceeded budget", () => {
    const hugePrompt = "x".repeat(500000);
    const result = validateTokenBudget(hugePrompt, 100);
    expect(result.withinBudget).toBe(false);
  });

  it("should detect truncation needed", () => {
    const hugePrompt = "x".repeat(500000);
    const result = shouldTruncate(hugePrompt);
    expect(result.needsTruncation).toBe(true);
  });

  it("should track cumulative usage", () => {
    const tracker = createTokenBudgetTracker("generateSalesResponse");
    tracker.trackInput("Hello");
    tracker.trackInput(" world");
    const usage = tracker.getUsage();
    expect(usage.inputTokens).toBeGreaterThan(0);
    expect(usage.maxInputTokens).toBeGreaterThan(0);
  });

  it("should reset usage", () => {
    const tracker = createTokenBudgetTracker("generateSalesResponse");
    tracker.trackInput("Some text");
    tracker.reset();
    const usage = tracker.getUsage();
    expect(usage.inputTokens).toBe(0);
    expect(usage.outputTokens).toBe(0);
  });
});

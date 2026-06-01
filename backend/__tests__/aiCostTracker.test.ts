import { describe, it, expect } from "vitest";
import { estimateTokens, isBudgetExceeded, getAdminMonthlyCost } from "../services/aiCostTracker.js";

describe("AI Cost Tracker", () => {
  it("should estimate tokens from text", () => {
    expect(estimateTokens("hello world")).toBe(3);
    expect(estimateTokens("a")).toBe(1);
    expect(estimateTokens("")).toBe(0);
  });

  it("should not exceed budget by default", async () => {
    const exceeded = await isBudgetExceeded("test-admin");
    expect(exceeded).toBe(false);
  });

  it("should return 0 cost for unknown admin", async () => {
    const cost = await getAdminMonthlyCost("nonexistent-admin");
    expect(cost).toBe(0);
  });
});

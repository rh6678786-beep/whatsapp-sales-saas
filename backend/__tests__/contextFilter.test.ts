import { describe, it, expect } from "vitest";
import { sortByPriority, filterContext, buildContextString } from "../lib/contextFilter.js";

describe("Context Filter", () => {
  const sections = [
    { name: "system", content: "You are a sales assistant", priority: 100, required: true },
    { name: "history", content: "Customer: Hello\nAgent: Hi!", priority: 50, required: false },
    { name: "products", content: "Product A: Rs. 100\nProduct B: Rs. 200", priority: 80, required: false },
    { name: "memory", content: "Past conversation summary", priority: 30, required: false },
  ];

  it("should sort by priority with required first", () => {
    const sorted = sortByPriority(sections);
    expect(sorted[0].name).toBe("system");
    expect(sorted[0].required).toBe(true);
  });

  it("should filter sections within token budget", () => {
    const result = filterContext(sections, 1000);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toContain("sales assistant");
  });

  it("should drop low-priority sections when budget tight", () => {
    const result = filterContext(sections, 10);
    // Should keep at least the required section
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("should build concatenated context string", () => {
    const result = buildContextString(sections, 5000);
    expect(result).toContain("sales assistant");
    expect(result).toContain("Hello");
  });

  it("should handle single section", () => {
    const single = [{ name: "only", content: "Just this", priority: 50, required: true }];
    const result = filterContext(single, 100);
    expect(result).toHaveLength(1);
  });

  it("should handle empty sections", () => {
    const result = filterContext([], 1000);
    expect(result).toHaveLength(0);
  });
});

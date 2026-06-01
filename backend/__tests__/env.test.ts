import { describe, it, expect } from "vitest";
import "dotenv/config";

describe("Environment Configuration", () => {
  it("should have DATABASE_URL", () => {
    expect(process.env.DATABASE_URL).toBeTruthy();
  });

  it("should have GEMINI_API_KEY", () => {
    expect(process.env.GEMINI_API_KEY).toBeTruthy();
  });

  it("should have JWT_SECRET", () => {
    expect(process.env.JWT_SECRET).toBeTruthy();
  });
});

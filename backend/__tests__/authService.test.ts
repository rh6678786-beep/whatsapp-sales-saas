import { describe, it, expect } from "vitest";
import { hashPassword, comparePassword, validatePassword, generateToken, verifyToken } from "../services/authService.js";

describe("Auth Service", () => {
  it("should hash and compare passwords", async () => {
    const password = "Test@123";
    const hash = await hashPassword(password);
    expect(hash).not.toBe(password);
    expect(hash).toMatch(/\$2[ab]\$/);

    const valid = await comparePassword(password, hash);
    expect(valid).toBe(true);

    const invalid = await comparePassword("wrong", hash);
    expect(invalid).toBe(false);
  });

  it("should validate password rules", () => {
    const weak = validatePassword("short");
    expect(weak.valid).toBe(false);

    const strong = validatePassword("Strong@123");
    expect(strong.valid).toBe(true);
  });

  it("should generate and verify JWT tokens", () => {
    const token = generateToken("test-admin");
    expect(token).toBeTruthy();

    const payload = verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.adminId).toBe("test-admin");
  });

  it("should reject expired or invalid tokens", () => {
    const payload = verifyToken("invalid-token");
    expect(payload).toBeNull();
  });
});

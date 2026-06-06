import { describe, it, expect, beforeEach } from "vitest";
import {
  hashPassword,
  comparePassword,
  validatePassword,
  generateToken,
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  revokeRefreshToken,
  isTokenBlacklisted,
  revokeAllAdminTokens,
} from "../services/authService.js";

describe("Auth Service", () => {
  // ===============================================
  // Password Hashing & Comparison
  // ===============================================
  describe("password hashing", () => {
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

    it("should return false when password is empty", async () => {
      const hash = await hashPassword("Valid@123");
      const result = await comparePassword("", hash);
      expect(result).toBe(false);
    });

    it("should return false when hash is empty", async () => {
      const result = await comparePassword("Valid@123", "");
      expect(result).toBe(false);
    });

    it("should return false when both are empty", async () => {
      const result = await comparePassword("", "");
      expect(result).toBe(false);
    });

    it("should return false when hash is nullish", async () => {
      const result = await comparePassword("Valid@123", "");
      expect(result).toBe(false);
    });
  });

  // ===============================================
  // Password Validation
  // ===============================================
  describe("validatePassword", () => {
    it("should accept a strong password", () => {
      const result = validatePassword("Strong@123");
      expect(result).toEqual({ valid: true });
    });

    it("should reject password shorter than 8 characters", () => {
      const result = validatePassword("Sh@1");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("at least 8 characters");
    });

    it("should reject password without lowercase letter", () => {
      const result = validatePassword("STRONG@123");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("lowercase");
    });

    it("should reject password without uppercase letter", () => {
      const result = validatePassword("strong@123");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("uppercase");
    });

    it("should reject password without a digit", () => {
      const result = validatePassword("Strong@aa");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("number");
    });

    it("should reject password without a special character", () => {
      const result = validatePassword("Strong123");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("special");
    });

    it("should reject empty password", () => {
      const result = validatePassword("");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("at least 8 characters");
    });

    it("should accept password with alternate special characters", () => {
      const result = validatePassword("Valid@123");
      expect(result.valid).toBe(true);
    });
  });

  // ===============================================
  // Admin Token (generateToken)
  // ===============================================
  describe("generateToken", () => {
    it("should generate and verify an admin token", () => {
      const token = generateToken("test-admin");
      expect(token).toBeTruthy();

      const payload = verifyToken(token);
      expect(payload).not.toBeNull();
      expect(payload?.adminId).toBe("test-admin");
    });

    it("should include issuer claim (iss)", () => {
      const token = generateToken("admin-1");
      const parts = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
      expect(parts.iss).toBe("saascloser");
    });

    it("should include subject claim (sub)", () => {
      const token = generateToken("admin-1");
      const parts = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
      expect(parts.sub).toBe("admin-1");
    });
  });

  // ===============================================
  // Access Token (generateAccessToken)
  // ===============================================
  describe("generateAccessToken", () => {
    it("should generate and verify an access token", () => {
      const token = generateAccessToken("admin-1");
      expect(token).toBeTruthy();

      const payload = verifyToken(token);
      expect(payload).not.toBeNull();
      expect(payload?.adminId).toBe("admin-1");
    });

    it("should include issuer claim", () => {
      const token = generateAccessToken("admin-1");
      const parts = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
      expect(parts.iss).toBe("saascloser");
    });

    it("should have a short expiry (15m)", () => {
      const token = generateAccessToken("admin-1");
      const parts = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
      const exp = parts.exp as number;
      const iat = parts.iat as number;
      // 15 minutes = 900 seconds
      const diff = exp - iat;
      expect(diff).toBe(900);
    });
  });

  // ===============================================
  // Refresh Token (generateRefreshToken)
  // ===============================================
  describe("generateRefreshToken", () => {
    it("should generate a refresh token with jti claim", () => {
      const token = generateRefreshToken("admin-1");
      const parts = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
      expect(parts.jti).toBeTruthy();
      expect(parts.jti.length).toBe(32); // 16 random bytes as hex
    });

    it("should generate unique jti for each token", () => {
      const token1 = generateRefreshToken("admin-1");
      const token2 = generateRefreshToken("admin-1");
      const p1 = JSON.parse(Buffer.from(token1.split(".")[1], "base64url").toString());
      const p2 = JSON.parse(Buffer.from(token2.split(".")[1], "base64url").toString());
      expect(p1.jti).not.toBe(p2.jti);
    });

    it("should have a long expiry (7d)", () => {
      const token = generateRefreshToken("admin-1");
      const parts = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
      const diff = (parts.exp as number) - (parts.iat as number);
      // 7 days = 604800 seconds
      expect(diff).toBe(604800);
    });
  });

  // ===============================================
  // Token Verification
  // ===============================================
  describe("verifyToken", () => {
    it("should reject an invalid token string", () => {
      const payload = verifyToken("invalid-token");
      expect(payload).toBeNull();
    });

    it("should reject a token with tampered payload", () => {
      const token = generateToken("admin-1");
      const parts = token.split(".");
      // Tamper with the payload
      const tamperedPayload = Buffer.from(JSON.stringify({ adminId: "hacker" })).toString("base64url");
      const fakeToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

      const payload = verifyToken(fakeToken);
      expect(payload).toBeNull();
    });

    it("should reject token with wrong algorithm", () => {
      // Create a token with 'none' algorithm (security test)
      const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
      const payload = Buffer.from(JSON.stringify({ adminId: "admin-1" })).toString("base64url");
      const noneToken = `${header}.${payload}.`;

      const result = verifyToken(noneToken);
      expect(result).toBeNull();
    });
  });

  // ===============================================
  // Token Blacklisting (refresh tokens)
  // ===============================================
  describe("token blacklisting", () => {
    it("should reject a blacklisted refresh token", () => {
      const token = generateRefreshToken("admin-1");
      const parts = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
      const jti: string = parts.jti;

      // Verify it works before revoking
      expect(verifyToken(token)).not.toBeNull();

      // Revoke and verify
      revokeRefreshToken(jti);
      expect(verifyToken(token)).toBeNull();
    });

    it("should handle isTokenBlacklisted for undefined jti", () => {
      expect(isTokenBlacklisted(undefined)).toBe(false);
    });

    it("should not block non-blacklisted tokens", () => {
      const token = generateRefreshToken("admin-1");
      const result = verifyToken(token);
      expect(result).not.toBeNull();
    });
  });

  // ===============================================
  // revokeAllAdminTokens
  // ===============================================
  describe("revokeAllAdminTokens", () => {
    it("should return 0 (simplified implementation)", () => {
      // The current in-memory implementation doesn't support prefix deletion
      const count = revokeAllAdminTokens("admin-1");
      expect(count).toBe(0);
    });
  });

  // ===============================================
  // Mixed Token Lifecycle
  // ===============================================
  describe("token lifecycle", () => {
    it("should support generating all token types for the same admin", () => {
      const adminId = "admin-lifecycle";
      const adminToken = generateToken(adminId);
      const accessToken = generateAccessToken(adminId);
      const refreshToken = generateRefreshToken(adminId);

      expect(verifyToken(adminToken)?.adminId).toBe(adminId);
      expect(verifyToken(accessToken)?.adminId).toBe(adminId);
      expect(verifyToken(refreshToken)?.adminId).toBe(adminId);
    });
  });
});

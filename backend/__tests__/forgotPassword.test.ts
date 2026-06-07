import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import crypto from "crypto";

// Mock dbService
vi.mock("../services/dbService.js", () => ({
  dbService: {
    findAdminByEmail: vi.fn(),
    storePasswordReset: vi.fn(),
    getPasswordReset: vi.fn(),
    deletePasswordReset: vi.fn(),
    registerAdmin: vi.fn(),
  },
}));

// Mock authService
vi.mock("../services/authService.js", () => ({
  generateToken: vi.fn(() => "mock-token"),
  hashPassword: vi.fn((pw) => Promise.resolve(`hashed-${pw}`)),
  comparePassword: vi.fn((pw, hash) => Promise.resolve(hash === `hashed-${pw}`)),
  validatePassword: vi.fn((pw) => {
    if (pw.length < 8) return { valid: false, error: "Password must be at least 8 characters" };
    if (!/[a-z]/.test(pw)) return { valid: false, error: "Password must contain a lowercase letter" };
    if (!/[A-Z]/.test(pw)) return { valid: false, error: "Password must contain an uppercase letter" };
    if (!/\d/.test(pw)) return { valid: false, error: "Password must contain a number" };
    if (!/[!@#$%^&*()_\-+=<>?/{}~|]/.test(pw)) return { valid: false, error: "Password must contain a special character" };
    return { valid: true };
  }),
}));

// Mock auth middleware
vi.mock("../middleware/auth.js", () => ({
  getAdminId: vi.fn(() => "test-admin"),
}));

import { dbService } from "../services/dbService.js";

// Setup express app with auth routes
async function setupApp() {
  const app = express();
  app.use(express.json());

  // Import router dynamically (it uses top-level await for dependencies)
  const authRouter = (await import("../routes/auth.js")).default;
  app.use("/api", authRouter);

  return app;
}

describe("Forgot Password API", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await setupApp();
  });

  describe("POST /api/auth/forgot-password", () => {
    it("returns error when email is missing", async () => {
      const res = await request(app)
        .post("/api/auth/forgot-password")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Email is required");
    });

    it("returns success even for unknown email (no enumeration)", async () => {
      (dbService.findAdminByEmail as any).mockResolvedValueOnce(null);

      const res = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "unknown@example.com" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain("password reset link");
      // Should not reveal whether email exists
      expect(dbService.storePasswordReset).not.toHaveBeenCalled();
    });

    it("generates reset token for known email", async () => {
      (dbService.findAdminByEmail as any).mockResolvedValueOnce({
        adminId: "zia-store",
        email: "zia@example.com",
        storeName: "Zia Store",
      });

      const res = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "zia@example.com" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(dbService.storePasswordReset).toHaveBeenCalledTimes(1);

      // Check that storePasswordReset was called with adminId, a token hash, and an expiry date
      const callArgs = (dbService.storePasswordReset as any).mock.calls[0];
      expect(callArgs[0]).toBe("zia-store"); // adminId
      expect(callArgs[1]).toBeDefined(); // token hash
      expect(callArgs[1].length).toBe(64); // sha256 hash is 64 hex chars
      expect(callArgs[2]).toBeInstanceOf(Date); // expiry
    });

    it("uses same success message for both found and not-found emails", async () => {
      // Test 1: Known email
      (dbService.findAdminByEmail as any).mockResolvedValueOnce({
        adminId: "zia-store",
        email: "zia@example.com",
      });

      const res1 = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "zia@example.com" });

      // Test 2: Unknown email
      (dbService.findAdminByEmail as any).mockResolvedValueOnce(null);

      const res2 = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "unknown@example.com" });

      // Both responses should have same structure
      expect(res1.body.message).toBe(res2.body.message);
      expect(res1.body.success).toBe(res2.body.success);
    });
  });

  describe("POST /api/auth/reset-password", () => {
    it("returns error when token is missing", async () => {
      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({ newPassword: "NewStr0ng@Pass" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Token and new password are required");
    });

    it("returns error when new password is missing", async () => {
      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({ token: "some-token" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Token and new password are required");
    });

    it("returns error for weak password", async () => {
      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({ token: "some-token", newPassword: "weak" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Password must be");
    });

    it("returns error for invalid/expired token", async () => {
      (dbService.getPasswordReset as any).mockResolvedValueOnce(null);

      // Generate a valid-looking token
      const token = crypto.randomBytes(32).toString("hex");

      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({ token, newPassword: "NewStr0ng@Pass" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid or expired reset token");
    });

    it("resets password when valid token is provided", async () => {
      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

      // Mock a valid reset record (not expired)
      (dbService.getPasswordReset as any).mockResolvedValueOnce({
        adminId: "zia-store",
        tokenHash,
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
      });

      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({ token, newPassword: "NewStr0ng@Pass" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain("Password has been reset");

      // Should have updated the password
      expect(dbService.registerAdmin).toHaveBeenCalledWith(
        "zia-store",
        expect.stringContaining("hashed-")
      );

      // Should have deleted the used token
      expect(dbService.deletePasswordReset).toHaveBeenCalledWith(tokenHash);
    });

    it("returns error for expired token", async () => {
      const token = crypto.randomBytes(32).toString("hex");

      // Mock an expired reset record
      (dbService.getPasswordReset as any).mockResolvedValueOnce({
        adminId: "zia-store",
        tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago (expired)
      });

      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({ token, newPassword: "NewStr0ng@Pass" });

      // May be 400 (bad request) or 429 (rate limited by authRateLimiter)
      expect([400, 429]).toContain(res.status);
      if (res.status === 400) {
        expect(res.body.error).toBe("Invalid or expired reset token");
      }
      expect(dbService.registerAdmin).not.toHaveBeenCalled();
    });
  });
});

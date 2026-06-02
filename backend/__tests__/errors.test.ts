import { describe, it, expect } from "vitest";
import { AppError, AuthenticationError, InvalidTokenError, ForbiddenError, TenantIsolationError, NotFoundError, ValidationError } from "../lib/errors.js";

describe("Error Hierarchy", () => {
  it("should create AuthenticationError with correct properties", () => {
    const err = new AuthenticationError("Invalid credentials");
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("Invalid credentials");
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("should create InvalidTokenError", () => {
    const err = new InvalidTokenError("Token expired");
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe("INVALID_TOKEN");
  });

  it("should create ForbiddenError", () => {
    const err = new ForbiddenError("Insufficient permissions");
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe("FORBIDDEN");
  });

  it("should create TenantIsolationError", () => {
    const err = new TenantIsolationError("Cross-tenant access detected");
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe("TENANT_ISOLATION_ERROR");
  });

  it("should create NotFoundError", () => {
    const err = new NotFoundError("Resource not found");
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
  });

  it("should create ValidationError with fields", () => {
    const fields = { email: "invalid format" };
    const err = new ValidationError("Validation failed", fields);
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.fields).toEqual(fields);
  });

  it("should create ConflictError", async () => {
    const { ConflictError } = await import("../lib/errors.js");
    const err = new ConflictError();
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe("CONFLICT");
  });

  it("should create RateLimitError", async () => {
    const { RateLimitError } = await import("../lib/errors.js");
    const err = new RateLimitError();
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe("RATE_LIMIT_EXCEEDED");
  });

  it("should preserve stack trace", () => {
    const err = new AppError("Test", 500, "TEST");
    expect(err.stack).toBeTruthy();
  });
});

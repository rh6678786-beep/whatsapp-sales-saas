import { describe, it, expect, vi } from "vitest";

describe("Rate Limiter", () => {
  it("should create rate limiter middleware", async () => {
    const mod = await import("../lib/rateLimiter.js");
    expect(typeof mod.createRateLimiter).toBe("function");
    const limiter = mod.createRateLimiter({ windowMs: 60000, maxRequests: 5 });
    expect(typeof limiter).toBe("function");
  });

  it("should have pre-configured limiters", async () => {
    const mod = await import("../lib/rateLimiter.js");
    expect(typeof mod.defaultRateLimiter).toBe("function");
    expect(typeof mod.authRateLimiter).toBe("function");
    expect(typeof mod.apiRateLimiter).toBe("function");
    expect(typeof mod.webhookRateLimiter).toBe("function");
  });

  it("default rate limiter should call next on success", async () => {
    const mod = await import("../lib/rateLimiter.js");
    const req = { ip: "127.0.0.1", socket: { remoteAddress: "127.0.0.1" } } as any;
    const res = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    await mod.defaultRateLimiter(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("auth rate limiter should allow fewer requests", async () => {
    const mod = await import("../lib/rateLimiter.js");
    const req = { ip: "10.0.0.1", socket: { remoteAddress: "10.0.0.1" } } as any;
    const res = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    // Auth limiter allows max 10 requests/min — 10 should pass
    for (let i = 0; i < 10; i++) {
      await mod.authRateLimiter(req, res, next);
    }
    expect(next).toHaveBeenCalledTimes(10);
  });
});

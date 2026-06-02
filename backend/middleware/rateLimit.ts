// Compatibility redirect — all new code should import from backend/lib/rateLimiter.ts
export { createRateLimiter, defaultRateLimiter as rateLimitDefault, authRateLimiter, apiRateLimiter, webhookRateLimiter } from "../lib/rateLimiter.js";

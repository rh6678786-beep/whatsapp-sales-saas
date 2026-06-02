// Compatibility redirect — all new code should import from backend/lib/redis.ts
export { getRedis, isRedisConnected, connectRedis, disconnectRedis } from "../lib/redis.js";

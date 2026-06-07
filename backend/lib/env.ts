import { config } from "dotenv";
config({ override: true });

export interface EnvConfig {
  NODE_ENV: "development" | "production" | "test";
  PORT: number;
  APP_URL: string;
  JWT_SECRET: string;
  ADMIN_PASSWORD: string;
  DATABASE_URL: string;
  DB_SSL_REJECT_UNAUTHORIZED: boolean;
  REDIS_URL: string;
  GEMINI_API_KEY: string;
  AI_MONTHLY_BUDGET: number;
  STRIPE_SECRET_KEY: string;
  STRIPE_STARTER_PRICE_ID: string;
  STRIPE_PROFESSIONAL_PRICE_ID: string;
  STRIPE_ENTERPRISE_PRICE_ID: string;
  STRIPE_WEBHOOK_SECRET: string;
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_USER: string;
  SMTP_PASS: string;
  SMTP_FROM: string;
  FACEBOOK_CLIENT_ID: string;
  FACEBOOK_CLIENT_SECRET: string;
  ENCRYPTION_KEY: string;
  SENTRY_DSN: string;
  CDN_URL: string;
}

/**
 * Try reading a secret from the secrets manager (AWS/GCP) if configured.
 * Uses dynamic import to avoid circular dependency.
 */
async function trySecretsManager(key: string): Promise<string | null> {
  try {
    const { getSecret } = await import("./secrets-manager.js");
    return await getSecret(key);
  } catch {
    return null;
  }
}

/**
 * Sync lookup of an env var. In production, if the var is missing,
 * adds it to a pending list for async resolution via secrets manager.
 * The async resolution must happen before the server starts.
 */
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === "") {
    // Don't throw immediately — mark for secrets manager resolution
    // The caller (server.ts) will call resolveMissingSecrets() before startup
    throw new Error(
      `[ENV] MISSING REQUIRED ENVIRONMENT VARIABLE: ${key}\n` +
      `  Set it in .env, environment, AWS Secrets Manager, or GCP Secret Manager.`
    );
  }
  return value.trim();
}

function optionalEnv(key: string, defaultValue: string): string {
  const value = process.env[key];
  if (!value || value.trim() === "") return defaultValue;
  return value.trim();
}

/**
 * Try to resolve the given key from secrets manager.
 * Returns the value if found, null otherwise.
 */
export async function resolveSecret(key: string): Promise<string | null> {
  // First check if it's now in process.env (could have been set between loadEnv and now)
  if (process.env[key]?.trim()) return process.env[key]!.trim();
  
  // Try secrets manager
  const secretValue = await trySecretsManager(key);
  if (secretValue) {
    process.env[key] = secretValue;
    return secretValue;
  }
  return null;
}

let _env: EnvConfig | null = null;

export function loadEnv(): EnvConfig {
  if (_env) return _env;

  const NODE_ENV = optionalEnv("NODE_ENV", "development") as EnvConfig["NODE_ENV"];
  const isProduction = NODE_ENV === "production";

  const config: EnvConfig = {
    NODE_ENV,
    PORT: parseInt(optionalEnv("PORT", "3000"), 10),
    APP_URL: isProduction ? requireEnv("APP_URL") : optionalEnv("APP_URL", "http://localhost:3000"),
    JWT_SECRET: requireEnv("JWT_SECRET"),
    ADMIN_PASSWORD: isProduction ? requireEnv("ADMIN_PASSWORD") : optionalEnv("ADMIN_PASSWORD", "admin"),
    DATABASE_URL: requireEnv("DATABASE_URL"),
    DB_SSL_REJECT_UNAUTHORIZED: optionalEnv("DB_SSL_REJECT_UNAUTHORIZED", "true") === "true",
    REDIS_URL: optionalEnv("REDIS_URL", ""),
    GEMINI_API_KEY: requireEnv("GEMINI_API_KEY"),
    AI_MONTHLY_BUDGET: parseFloat(optionalEnv("AI_MONTHLY_BUDGET", "100")),
    STRIPE_SECRET_KEY: optionalEnv("STRIPE_SECRET_KEY", ""),
    STRIPE_STARTER_PRICE_ID: optionalEnv("STRIPE_STARTER_PRICE_ID", ""),
    STRIPE_PROFESSIONAL_PRICE_ID: optionalEnv("STRIPE_PROFESSIONAL_PRICE_ID", ""),
    STRIPE_ENTERPRISE_PRICE_ID: optionalEnv("STRIPE_ENTERPRISE_PRICE_ID", ""),
    STRIPE_WEBHOOK_SECRET: optionalEnv("STRIPE_WEBHOOK_SECRET", ""),
    SMTP_HOST: optionalEnv("SMTP_HOST", ""),
    SMTP_PORT: parseInt(optionalEnv("SMTP_PORT", "587"), 10),
    SMTP_USER: optionalEnv("SMTP_USER", ""),
    SMTP_PASS: optionalEnv("SMTP_PASS", ""),
    SMTP_FROM: optionalEnv("SMTP_FROM", "noreply@saascloser.ai"),
    FACEBOOK_CLIENT_ID: optionalEnv("FACEBOOK_CLIENT_ID", ""),
    FACEBOOK_CLIENT_SECRET: optionalEnv("FACEBOOK_CLIENT_SECRET", ""),
    ENCRYPTION_KEY: requireEnv("ENCRYPTION_KEY"),
    SENTRY_DSN: optionalEnv("SENTRY_DSN", ""),
    CDN_URL: optionalEnv("CDN_URL", ""),
  };

  // Validate NODE_TLS_REJECT_UNAUTHORIZED is not 0 in production
  if (isProduction && process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
    console.error(
      "[ENV] CRITICAL: NODE_TLS_REJECT_UNAUTHORIZED is set to 0.\n" +
      "  This disables ALL TLS certificate validation for ALL outbound connections.\n" +
      "  This is INSECURE and must NOT be used in production."
    );
    throw new Error("NODE_TLS_REJECT_UNAUTHORIZED=0 is not allowed in production");
  }

  // Warn about default admin password in production
  if (isProduction && config.ADMIN_PASSWORD === "admin") {
    throw new Error("ADMIN_PASSWORD is still set to default 'admin' in production. Change it immediately.");
  }

  // Validate JWT_SECRET strength
  if (isProduction && config.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters in production. Generate with: openssl rand -hex 64");
  }

  // Validate encryption key
  if (isProduction) {
    const isHex = /^[0-9a-fA-F]+$/.test(config.ENCRYPTION_KEY);
    const isBase64 = /^[a-zA-Z0-9+/]*={0,2}$/.test(config.ENCRYPTION_KEY);
    
    let keyBytes = 0;
    if (isHex && config.ENCRYPTION_KEY.length >= 64) {
      keyBytes = config.ENCRYPTION_KEY.length / 2;
    } else if (isBase64) {
      keyBytes = Buffer.from(config.ENCRYPTION_KEY, 'base64').length;
    } else {
      keyBytes = Buffer.from(config.ENCRYPTION_KEY, 'utf-8').length;
    }

    if (keyBytes < 32) {
      throw new Error("ENCRYPTION_KEY must represent at least 32 bytes (256 bits) of key material in production.");
    }
  }

  _env = config;
  return config;
}

export const env = loadEnv();

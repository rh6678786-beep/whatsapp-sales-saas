/**
 * Secrets Manager — abstracts secret retrieval so production credentials
 * never need to live in .env files.
 *
 * Supported backends:
 *  1. Environment variables (default — works everywhere locally)
 *  2. AWS Secrets Manager (when AWS_SECRETS_PREFIX is set)
 *  3. Google Cloud Secret Manager (when GCP_SECRETS_PREFIX is set)
 *
 * Usage:
 *   import { getSecret } from "../lib/secrets-manager.js";
 *
 *   // Works with .env locally, falls back to AWS/GCP in production
 *   const apiKey = await getSecret("GEMINI_API_KEY");
 *
 * The manager caches fetched secrets for 5 minutes to reduce API calls.
 */

import { createChildLogger } from "./logger.js";

const log = createChildLogger("secrets");

interface CachedSecret {
  value: string;
  expiresAt: number;
}

const cache = new Map<string, CachedSecret>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Try to read a secret from the environment.
 */
function fromEnv(key: string): string | null {
  return process.env[key]?.trim() || null;
}

/**
 * Try to read a secret from AWS Secrets Manager.
 * Uses the AWS SDK v3 (secrets-manager) if available.
 */
async function fromAws(key: string): Promise<string | null> {
  try {
    const prefix = process.env.AWS_SECRETS_PREFIX || "";
    const secretId = prefix ? `${prefix}/${key}` : key;

    // Dynamic import so the dependency is optional
    let awsModule: any;
    try {
      // @ts-ignore — optional dependency, gracefully handled at runtime
      awsModule = await import("@aws-sdk/client-secrets-manager");
    } catch {
      log.warn("@aws-sdk/client-secrets-manager not installed — skipping AWS Secrets Manager");
      return null;
    }
    const { SecretsManagerClient, GetSecretValueCommand } = awsModule;
    const client = new SecretsManagerClient({
      region: process.env.AWS_REGION || "us-east-1",
    });
    const command = new GetSecretValueCommand({ SecretId: secretId });
    const response = await client.send(command);

    if (response.SecretString) {
      // Cache the result
      cache.set(key, { value: response.SecretString, expiresAt: Date.now() + CACHE_TTL_MS });
      return response.SecretString;
    }
    // Binary secrets
    if (response.SecretBinary) {
      const value = Buffer.from(response.SecretBinary).toString("utf-8");
      cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
      return value;
    }
    return null;
  } catch (err: any) {
    // If the secret doesn't exist in AWS, fall through
    if (err.name === "ResourceNotFoundException") {
      return null;
    }
    log.warn({ err: err.message, key }, "AWS Secrets Manager lookup failed");
    return null;
  }
}

/**
 * Try to read a secret from Google Cloud Secret Manager.
 */
async function fromGcp(key: string): Promise<string | null> {
  try {
    const prefix = process.env.GCP_SECRETS_PREFIX || "";
    const secretName = prefix ? `${prefix}-${key}` : key;
    const projectId = process.env.GCP_PROJECT_ID;

    if (!projectId) {
      log.warn("GCP_PROJECT_ID not set — cannot use Google Secret Manager");
      return null;
    }

    let gcpModule: any;
    try {
      // @ts-ignore — optional dependency, gracefully handled at runtime
      gcpModule = await import("@google-cloud/secret-manager");
    } catch {
      log.warn("@google-cloud/secret-manager not installed — skipping GCP Secret Manager");
      return null;
    }
    const { SecretManagerServiceClient } = gcpModule;
    const client = new SecretManagerServiceClient();
    const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;
    const [version] = await client.accessSecretVersion({ name });
    const payload = version?.payload?.data?.toString();
    if (payload) {
      cache.set(key, { value: payload, expiresAt: Date.now() + CACHE_TTL_MS });
    }
    return payload || null;
  } catch (err: any) {
    if (err.code === 5 || err.code === 404) {
      // NOT_FOUND — secret doesn't exist in GCP, fall through
      return null;
    }
    log.warn({ err: err.message, key }, "GCP Secret Manager lookup failed");
    return null;
  }
}

/**
 * Resolve `key` by checking, in order:
 *  1. Local cache (if still within TTL)
 *  2. Environment variables
 *  3. AWS Secrets Manager (if configured)
 *  4. Google Cloud Secret Manager (if configured)
 *
 * Falls back to defaultValue if none of the backends have the secret.
 */
export async function getSecret(
  key: string,
  defaultValue?: string
): Promise<string | null> {
  // 1. Check cache
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value;
  }

  // 2. Try environment
  const envValue = fromEnv(key);
  if (envValue !== null) {
    cache.set(key, { value: envValue, expiresAt: Date.now() + CACHE_TTL_MS });
    return envValue;
  }

  // 3. Try AWS Secrets Manager
  if (process.env.AWS_SECRETS_PREFIX) {
    const awsValue = await fromAws(key);
    if (awsValue !== null) {
      cache.set(key, { value: awsValue, expiresAt: Date.now() + CACHE_TTL_MS });
      return awsValue;
    }
  }

  // 4. Try GCP Secret Manager
  if (process.env.GCP_PROJECT_ID) {
    const gcpValue = await fromGcp(key);
    if (gcpValue !== null) {
      cache.set(key, { value: gcpValue, expiresAt: Date.now() + CACHE_TTL_MS });
      return gcpValue;
    }
  }

  // 5. Fall back to default
  if (defaultValue !== undefined) {
    return defaultValue;
  }

  return null;
}

/**
 * Synchronous version that only checks env + cache (no network calls).
 * Useful during startup before async initialization.
 */
export function getSecretSync(key: string, defaultValue?: string): string | null {
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value;
  }
  const envValue = fromEnv(key);
  if (envValue !== null) {
    return envValue;
  }
  return defaultValue ?? null;
}

/**
 * Clear the in-memory cache (useful after secret rotation).
 */
export function clearSecretCache(): void {
  cache.clear();
  log.info("Secrets cache cleared");
}

/**
 * Validate that all required secrets exist in at least one backend.
 * Throws on missing required secrets.
 */
export async function requireSecrets(keys: string[]): Promise<void> {
  const missing: string[] = [];
  for (const key of keys) {
    const value = await getSecret(key);
    if (!value) {
      missing.push(key);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `[SECRETS] Missing required secrets: ${missing.join(", ")}. ` +
      `Set them in environment variables, AWS Secrets Manager, or GCP Secret Manager.`
    );
  }
  log.info(`All ${keys.length} required secrets are available`);
}

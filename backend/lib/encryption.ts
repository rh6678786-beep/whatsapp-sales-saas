import crypto from "crypto";
import { createChildLogger } from "./logger.js";

const log = createChildLogger("encryption");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is required for encrypting secrets at rest");
  }
  
  // Support raw 32-byte hex keys (64 hex chars) directly without SHA-256 derivation
  // This allows operators to use a true 256-bit key directly
  if (/^[0-9a-fA-F]{64}$/.test(key)) {
    const rawKey = Buffer.from(key, 'hex');
    return rawKey;
  }
  
  // Support base64-encoded 32-byte keys
  try {
    const decoded = Buffer.from(key, 'base64');
    if (decoded.length === 32) {
      return decoded;
    }
  } catch {
    // Not valid base64 — fall through to SHA-256 derivation
  }
  
  // Derive a 256-bit (32 byte) key from the env key using SHA-256
  // This ensures any-length string becomes a valid 32-byte AES-256 key
  log.info("Deriving encryption key via SHA-256 — consider using a raw 64-char hex key for stronger security");
  return crypto.createHash("sha256").update(key).digest();
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const tag = cipher.getAuthTag().toString("hex");

  // Format: iv:tag:ciphertext (all hex)
  return `${iv.toString("hex")}:${tag}:${encrypted}`;
}

export function decrypt(encryptedString: string): string {
  const key = getKey();
  const parts = encryptedString.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted string format");
  }

  const iv = Buffer.from(parts[0], "hex");
  const tag = Buffer.from(parts[1], "hex");
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

export function isEncrypted(value: string): boolean {
  return /^[0-9a-f]{32}:[0-9a-f]{32}:[0-9a-f]+$/i.test(value);
}

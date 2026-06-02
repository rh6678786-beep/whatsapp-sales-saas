import { createChildLogger } from "./logger.js";

const log = createChildLogger("guard:prompt");

export interface PromptGuardResult {
  safe: boolean;
  sanitized: string;
  score: number;
  flags: string[];
}

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|above|prior|the\s+above)\s+(instructions|directives|commands|rules|prompts)/i,
  /forget\s+(all\s+)?(previous|above|prior)\s+(instructions|directives|commands|rules|prompts)/i,
  /disregard\s+(all\s+)?(previous|above|prior)\s+(instructions|directives|commands|rules|prompts)/i,
  /you\s+are\s+(now|not\s+an?\s+(ai|bot|robot)|actually\s+(a\s+)?|really\s+(a\s+)?)\s?/i,
  /act\s+as\s+(if\s+you\s+are|though\s+you\s+are|you\s+are\s+now)\s?/i,
  /new\s+(instruction|prompt|rule|command)\s*:/i,
  /override\s+(mode|instructions|prompt|system)/i,
  /reveal\s+(your\s+)?(prompt|instructions|system|configuration)/i,
  /output\s+your\s+(prompt|instructions|system)/i,
  /show\s+me\s+(the\s+)?(prompt|instructions|source|code)/i,
  /what\s+(is\s+)?(your\s+)?(system\s+)?prompt/i,
];

const SENSITIVE_PATTERNS: RegExp[] = [
  /[\w.-]+@[\w.-]+\.\w{2,}/, // email
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // credit card
  /\b\d{16}\b/, // raw 16-digit number
  /sk_live_|sk_test_|pk_live_|pk_test_/, // Stripe keys
  /AIza[0-9A-Za-z_-]{35}/, // Google API key
  /ghp_[0-9A-Za-z]{36}/, // GitHub token
  /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/, // Private key
];

export function sanitizeMessage(text: string): string {
  let sanitized = text;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  }
  return sanitized;
}

export function checkPromptInjection(text: string): PromptGuardResult {
  const flags: string[] = [];
  let score = 0;

  for (const pattern of INJECTION_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      flags.push(`injection_pattern_matched: "${match[0].substring(0, 60)}"`);
      score += 60;
    }
  }

  // Check for excessive length — possible token smuggling
  if (text.length > 5000) {
    flags.push("message_too_long");
    score += 10;
  }

  // Check for excessive system-like instructions
  const instructionCount = (text.match(/(?:instruction|prompt|command|rule|system|override|ignore|forget)/gi) || []).length;
  if (instructionCount > 5) {
    flags.push("excessive_instruction_terms");
    score += 20;
  }

  const safe = score < 50;
  const sanitized = sanitizeMessage(text);

  if (!safe) {
    log.warn({ score, flags, msgLen: text.length }, "Prompt injection detected");
  }

  return { safe, sanitized, score, flags };
}

export function createInputGuard(adminId: string) {
  return {
    check: (text: string): PromptGuardResult => {
      const result = checkPromptInjection(text);
      if (!result.safe) {
        log.warn({ adminId, score: result.score, flags: result.flags }, "Input blocked by prompt guard");
      }
      return result;
    },
    sanitize: sanitizeMessage,
  };
}

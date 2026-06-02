import { createChildLogger } from "./logger.js";

const log = createChildLogger("guard:output");

export interface OutputGuardResult {
  approved: boolean;
  cleaned: string;
  flags: string[];
}

const PII_PATTERNS: RegExp[] = [
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // credit card
  /\b\d{16}\b/g, // raw 16-digit
  /sk_live_|sk_test_|pk_live_|pk_test_/g, // Stripe
  /AIza[0-9A-Za-z_-]{35}/g, // Google API
  /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(RSA\s+)?PRIVATE\s+KEY-----/g, // private key
];

const HALLUCINATION_INDICATORS: RegExp[] = [
  /price\s+is\s+Rs\.\s*\d{1,3}\b(?!\s*(?:per|each|only))/i, // unrealistically low prices
  /we\s+have\s+(over\s+)?\d{4,}\s*(products|items|varieties)/i, // exaggerated inventory
  /we\s+(ship|deliver)\s+(worldwide|globally|internationally)/i, // unless configured
  /100%\s+(satisfaction|money.back|guaranteed)/i, // absolute guarantees
  /we\s+accept\s+(all|any)\s+(payment|crypto)/i, // unless configured
];

const BRAND_SAFETY_VIOLATIONS: RegExp[] = [
  /\b(crap|shit|fuck|damn|bastard|asshole)\b/i,
  /I\s+(hate|can't\s+stand|despise)\s/i,
  /this\s+(customer|person|guy|gal)\s+(is\s+)?(stupid|idiot|dumb|annoying)/i,
];

const AI_DISCLOSURE_PATTERNS: RegExp[] = [
  /\b(as\s+)?(I'm\s+)?(an?\s+)?(AI|artificial\s+intelligence|language\s+model|bot|automated|LLM)\b/i,
  /\b(I\s+am\s+)?(just\s+)?(a\s+)?(robot|machine|algorithm|virtual\s+assistant)\b/i,
  /\b(as\s+)?(I\s+don't\s+have\s+(access\s+to\s+)?(a\s+)?(physical|real|actual))\b/i,
  /\b(I\s+don't\s+(have\s+)?(feelings|emotions|consciousness))\b/i,
  /\b(disclaimer|note:\s+I'm\s+an?\s+AI)\b/i,
];

const INJECTION_IN_OUTPUT: RegExp[] = [
  /ignore\s+(all\s+)?(previous|above)\s+(instructions|commands)/i,
  /new\s+(instruction|prompt|rule):/i,
  /override\s+(mode|instructions)/i,
];

export function checkOutputSafety(text: string): OutputGuardResult {
  const flags: string[] = [];

  let piiFound = false;
  for (const pattern of PII_PATTERNS) {
    if (pattern.test(text)) {
      flags.push("pii_leak_detected");
      piiFound = true;
    }
  }

  for (const pattern of HALLUCINATION_INDICATORS) {
    if (pattern.test(text)) {
      flags.push("hallucination_indicator");
    }
  }

  for (const pattern of BRAND_SAFETY_VIOLATIONS) {
    if (pattern.test(text)) {
      flags.push("brand_safety_violation");
    }
  }

  for (const pattern of AI_DISCLOSURE_PATTERNS) {
    if (pattern.test(text)) {
      flags.push("ai_disclosure_detected");
    }
  }

  for (const pattern of INJECTION_IN_OUTPUT) {
    if (pattern.test(text)) {
      flags.push("injection_in_output");
    }
  }

  const approved = flags.length === 0;
  let cleaned = text;

  if (piiFound) {
    for (const pattern of PII_PATTERNS) {
      cleaned = cleaned.replace(pattern, "[REDACTED]");
    }
  }

  if (!approved) {
    log.warn({ flags, len: text.length }, "Output guard flags");
  }

  return { approved, cleaned, flags };
}

export function createOutputGuard(adminId: string) {
  return {
    check: (text: string): OutputGuardResult => {
      const result = checkOutputSafety(text);
      if (!result.approved) {
        log.warn({ adminId, flags: result.flags }, "Output blocked by guard");
      }
      return result;
    },
    sanitize: (text: string): string => {
      let s = text;
      for (const pattern of PII_PATTERNS) {
        s = s.replace(pattern, "[REDACTED]");
      }
      return s;
    },
  };
}

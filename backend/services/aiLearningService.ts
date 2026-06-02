import { dbService } from "./dbService.js";
import { getRedis } from "../lib/redis.js";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("ai:learning");

const REDIS_LEARNING_KEY = (adminId: string) => `ai:learning:patterns:${adminId}`;
const REDIS_LEARNING_TTL = 3600; // 1 hour cache

export interface ChatAnalysis {
  customerMessage: string;
  aiResponse: string;
  outcome: "sale" | "no_sale" | "pending" | "blocked";
  leadStatus: "HOT" | "WARM" | "COLD";
  leadScore: number;
  responseTime: number;
  timestamp: string;
}

export interface ResponsePattern {
  id: string;
  pattern: string;
  keywords: string[];
  responseTemplate: string;
  successRate: number;
  totalUses: number;
  salesCount: number;
  avgLeadScore: number;
  lastUsed: string;
}

export interface LearningInsights {
  topPatterns: ResponsePattern[];
  successKeywords: string[];
  failedKeywords: string[];
  avgResponseTime: number;
  totalSales: number;
  conversionRate: number;
}

export class AILearningService {
  private static responsePatternsByAdmin: Map<string, Map<string, ResponsePattern>> = new Map();
  private static initializedAdmins = new Set<string>();

  private static getPatternsForAdmin(adminId: string): Map<string, ResponsePattern> {
    if (!this.responsePatternsByAdmin.has(adminId)) {
      this.responsePatternsByAdmin.set(adminId, new Map());
    }
    return this.responsePatternsByAdmin.get(adminId)!;
  }

  private static async loadFromRedis(adminId: string): Promise<ResponsePattern[] | null> {
    try {
      const redis = getRedis();
      if (!redis) return null;
      const raw = await redis.get(REDIS_LEARNING_KEY(adminId));
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }

  private static async saveToRedis(adminId: string, patterns: ResponsePattern[]) {
    try {
      const redis = getRedis();
      if (redis) {
        await redis.setex(REDIS_LEARNING_KEY(adminId), REDIS_LEARNING_TTL, JSON.stringify(patterns));
      }
    } catch {}
  }

  static async initialize(adminId: string = "default-admin") {
    if (this.initializedAdmins.has(adminId)) return;

    log.info({ adminId }, "AI Learning System initializing");

    // Try Redis first
    const cached = await this.loadFromRedis(adminId);
    const patterns = this.getPatternsForAdmin(adminId);

    if (cached && cached.length > 0) {
      cached.forEach((p) => patterns.set(p.id, p));
      log.info({ adminId, count: patterns.size }, "Loaded patterns from Redis");
    } else {
      const settings = await dbService.getSettings(adminId);
      const savedPatterns = (settings.aiLearningPatterns || []) as ResponsePattern[];
      savedPatterns.forEach((p) => patterns.set(p.id, p));
      if (patterns.size === 0) {
        this.initializeDefaultPatterns(adminId);
      }
      await this.saveToRedis(adminId, Array.from(patterns.values()));
      log.info({ adminId, count: patterns.size }, "Loaded patterns from database");
    }

    this.initializedAdmins.add(adminId);
  }

  private static initializeDefaultPatterns(adminId: string) {
    const patterns = this.getPatternsForAdmin(adminId);
    const defaults: ResponsePattern[] = [
      {
        id: "greeting_warm",
        pattern: "Warm greeting with name",
        keywords: ["assalamualaikum", "welcome", "kaise hain"],
        responseTemplate: "Wa Alaikum Assalam {name} bhai! Kaise hain? Aaj kya dekh rahe hain — kuch khaas chahiye tha?",
        successRate: 0.3,
        totalUses: 100,
        salesCount: 30,
        avgLeadScore: 25,
        lastUsed: new Date().toISOString(),
      },
      {
        id: "price_inquiry_direct",
        pattern: "Direct price with product list",
        keywords: ["price", "kitna", "qeemat"],
        responseTemplate: "Ji bilkul! {products} available hain — sab fresh stock hai. Kaunsa dekhna chahenge, main detail bhejta hoon?",
        successRate: 0.4,
        totalUses: 200,
        salesCount: 80,
        avgLeadScore: 35,
        lastUsed: new Date().toISOString(),
      },
      {
        id: "price_concern_discount",
        pattern: "Price concern with 2 options",
        keywords: ["mehngi", "zyada", "expensive"],
        responseTemplate: "Sach batao, quality ke hisaab se yeh price bilkul sahi hai — lekin aapke liye main kuch kar sakta hoon. Batao budget kya hai, main best option nikalta hoon",
        successRate: 0.6,
        totalUses: 150,
        salesCount: 90,
        avgLeadScore: 45,
        lastUsed: new Date().toISOString(),
      },
      {
        id: "closing_urgency",
        pattern: "Close with limited stock",
        keywords: ["order", "lena", "chahiye", "ready"],
        responseTemplate: "Sir honestly, yeh waala bohat jaldi nikalte hain — abhi 2-3 pieces hi bache hain. Abhi lock kar lein? Main abhi hi confirm kar deta hoon",
        successRate: 0.7,
        totalUses: 80,
        salesCount: 56,
        avgLeadScore: 70,
        lastUsed: new Date().toISOString(),
      },
      {
        id: "payment_offer",
        pattern: "Payment with multiple methods",
        keywords: ["payment", "pay", "transfer"],
        responseTemplate: "Ji bilkul — payment aasaan hai! Easypaisa ya JazzCash pe {paymentNumber} pe bhej dein. Hote hi screenshot share karein, main turant order confirm kar dunga",
        successRate: 0.5,
        totalUses: 120,
        salesCount: 60,
        avgLeadScore: 55,
        lastUsed: new Date().toISOString(),
      },
    ];

    defaults.forEach((p) => patterns.set(p.id, p));
  }

  static async analyzeChat(
    customerMessage: string,
    aiResponse: string,
    leadScore: number,
    leadStatus: "HOT" | "WARM" | "COLD",
    adminId: string = "default-admin",
  ): Promise<void> {
    await this.initialize(adminId);

    const patterns = this.getPatternsForAdmin(adminId);
    const keywords = this.extractKeywords(customerMessage);

    for (const keyword of keywords) {
      const pattern = this.findMatchingPattern(patterns, keyword);
      if (pattern) {
        pattern.totalUses++;
        pattern.lastUsed = new Date().toISOString();

        if (leadStatus === "HOT" || leadScore >= 70) {
          pattern.salesCount++;
        }

        pattern.avgLeadScore =
          pattern.totalUses > 1
            ? (pattern.avgLeadScore * (pattern.totalUses - 1) + leadScore) / pattern.totalUses
            : leadScore;
        pattern.successRate = pattern.salesCount / pattern.totalUses;
      }
    }

    await this.savePatterns(adminId);
  }

  static async markSaleClosed(userId: string, adminId: string = "default-admin"): Promise<void> {
    await this.initialize(adminId);
    const patterns = this.getPatternsForAdmin(adminId);
    for (const [, pattern] of patterns) {
      if (pattern.totalUses > 0) {
        pattern.successRate = pattern.salesCount / pattern.totalUses;
      }
    }
    await this.savePatterns(adminId);
    log.info({ adminId, userId }, "Sale closed — learning patterns updated");
  }

  static async markSaleFailed(userId: string): Promise<void> {
    log.info({ userId }, "Sale failed");
  }

  private static extractKeywords(message: string): string[] {
    const keywords: string[] = [];
    const lowerMessage = message.toLowerCase();

    const keywordGroups = [
      ["assalamualaikum", "salam", "hello", "hi", "hy"],
      ["price", "kitna", "qeemat", "rate", "cost"],
      ["mehngi", "zyada", "expensive", "kam", "sasta"],
      ["order", "lena", "chahiye", "buy", "purchase"],
      ["payment", "pay", "transfer", "easypaisa", "jazzcash"],
      ["delivery", "kab tak", "kitni der"],
    ];

    for (const group of keywordGroups) {
      if (group.some((k) => lowerMessage.includes(k))) {
        keywords.push(group[0]);
      }
    }

    return keywords;
  }

  private static findMatchingPattern(
    patterns: Map<string, ResponsePattern>,
    keyword: string,
  ): ResponsePattern | undefined {
    for (const pattern of patterns.values()) {
      if (pattern.keywords.includes(keyword)) {
        return pattern;
      }
    }
    return undefined;
  }

  static getBestPattern(keyword: string, adminId: string = "default-admin"): ResponsePattern | null {
    const patterns = this.getPatternsForAdmin(adminId);
    const candidates = Array.from(patterns.values())
      .filter((p) => p.keywords.includes(keyword))
      .sort((a, b) => b.successRate - a.successRate);

    return candidates[0] || null;
  }

  static async getLearningInsights(adminId: string = "default-admin"): Promise<LearningInsights> {
    await this.initialize(adminId);

    const patterns = this.getPatternsForAdmin(adminId);
    const patternArray = Array.from(patterns.values());

    const topPatterns = patternArray
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 5);

    const successKeywords: string[] = [];
    const failedKeywords: string[] = [];

    patternArray.forEach((p) => {
      if (p.successRate >= 0.5) {
        successKeywords.push(...p.keywords);
      } else if (p.totalUses > 20) {
        failedKeywords.push(...p.keywords);
      }
    });

    const totalSales = patternArray.reduce((sum, p) => sum + p.salesCount, 0);
    const totalUses = patternArray.reduce((sum, p) => sum + p.totalUses, 0);

    return {
      topPatterns,
      successKeywords: [...new Set(successKeywords)],
      failedKeywords: [...new Set(failedKeywords)],
      avgResponseTime: 2500,
      totalSales,
      conversionRate: totalUses > 0 ? (totalSales / totalUses) * 100 : 0,
    };
  }

  private static async savePatterns(adminId: string = "default-admin") {
    const patterns = this.getPatternsForAdmin(adminId);
    const patternArray = Array.from(patterns.values());
    try {
      await dbService.updateSettings(adminId, { aiLearningPatterns: patternArray });
      await this.saveToRedis(adminId, patternArray);
    } catch (e: any) {
      log.error({ err: e, adminId }, "Failed to save patterns");
    }
  }

  static getPatternRecommendations(customerMessage: string, adminId: string = "default-admin"): string[] {
    const keywords = this.extractKeywords(customerMessage);
    const recommendations: string[] = [];

    for (const keyword of keywords) {
      const bestPattern = this.getBestPattern(keyword, adminId);
      if (bestPattern && bestPattern.successRate >= 0.5) {
        recommendations.push(
          `Use "${bestPattern.pattern}" pattern (${Math.round(bestPattern.successRate * 100)}% success rate)`,
        );
      }
    }

    return recommendations;
  }
}

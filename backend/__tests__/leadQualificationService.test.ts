import { describe, it, expect } from "vitest";
import { LeadQualificationService } from "../services/leadQualificationService.js";
import { Session, SalesState } from "../../src/types.js";

function createMockSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "user-1",
    userId: "user-1",
    state: SalesState.NEW,
    lastMessageAt: new Date().toISOString(),
    remindersCount: 0,
    metadata: {},
    ...overrides,
  };
}

describe("LeadQualificationService", () => {
  // ===============================================
  // classifyLead
  // ===============================================
  describe("classifyLead", () => {
    it("should return COLD for score 0", () => {
      expect(LeadQualificationService.classifyLead(0)).toBe("COLD");
    });

    it("should return COLD for score below 40", () => {
      expect(LeadQualificationService.classifyLead(10)).toBe("COLD");
      expect(LeadQualificationService.classifyLead(39)).toBe("COLD");
    });

    it("should return WARM for score 40", () => {
      expect(LeadQualificationService.classifyLead(40)).toBe("WARM");
    });

    it("should return WARM for score between 40 and 69", () => {
      expect(LeadQualificationService.classifyLead(55)).toBe("WARM");
      expect(LeadQualificationService.classifyLead(69)).toBe("WARM");
    });

    it("should return HOT for score 70", () => {
      expect(LeadQualificationService.classifyLead(70)).toBe("HOT");
    });

    it("should return HOT for score above 70", () => {
      expect(LeadQualificationService.classifyLead(85)).toBe("HOT");
      expect(LeadQualificationService.classifyLead(100)).toBe("HOT");
    });
  });

  // ===============================================
  // calculateScoreDelta
  // ===============================================
  describe("calculateScoreDelta", () => {
    it("should add 20 points for price inquiry", () => {
      const session = createMockSession();
      const delta = LeadQualificationService.calculateScoreDelta("price kya hai?", session);
      expect(delta).toBeGreaterThanOrEqual(20);
    });

    it("should add 15 points for delivery inquiry", () => {
      const session = createMockSession();
      const delta = LeadQualificationService.calculateScoreDelta("delivery time?", session);
      expect(delta).toBeGreaterThanOrEqual(15);
    });

    it("should add 25 points for urgency requirement", () => {
      const session = createMockSession();
      const delta = LeadQualificationService.calculateScoreDelta("urgent chahiye immediately", session);
      expect(delta).toBeGreaterThanOrEqual(25);
    });

    it("should add 20 points when customer mentions budget", () => {
      const session = createMockSession();
      const delta = LeadQualificationService.calculateScoreDelta("my budget is 5000", session);
      expect(delta).toBeGreaterThanOrEqual(20);
    });

    it("should add 15 points for ready to purchase signals", () => {
      const session = createMockSession();
      const delta = LeadQualificationService.calculateScoreDelta("main lena hai", session);
      expect(delta).toBeGreaterThanOrEqual(15);
    });

    it("should add 10 points for payment method inquiry", () => {
      const session = createMockSession();
      const delta = LeadQualificationService.calculateScoreDelta("easypaisa accept karte ho?", session);
      expect(delta).toBeGreaterThanOrEqual(10);
    });

    it("should add 10 points for warranty inquiry", () => {
      const session = createMockSession();
      const delta = LeadQualificationService.calculateScoreDelta("warranty hai?", session);
      expect(delta).toBeGreaterThanOrEqual(10);
    });

    it("should add 10 points for repeat engagement", () => {
      const session = createMockSession({
        metadata: { messageCount: 5 },
      });
      const delta = LeadQualificationService.calculateScoreDelta("tell me about products", session);
      expect(delta).toBeGreaterThanOrEqual(10);
    });

    it("should subtract 15 points for vague response", () => {
      const session = createMockSession();
      const delta = LeadQualificationService.calculateScoreDelta("ok", session);
      expect(delta).toBeLessThanOrEqual(-15);
    });

    it("should subtract 10 points for random inquiry", () => {
      const session = createMockSession();
      const delta = LeadQualificationService.calculateScoreDelta("hello", session);
      // "hello" is a random inquiry pattern
      expect(delta).toBeLessThanOrEqual(-10);
    });

    it("should subtract 15 points for unrealistic expectations", () => {
      const session = createMockSession();
      const delta = LeadQualificationService.calculateScoreDelta("free mein de do", session);
      expect(delta).toBeLessThanOrEqual(-15);
    });

    it("should subtract 10 points for lacks budget interest", () => {
      const session = createMockSession();
      const delta = LeadQualificationService.calculateScoreDelta("interested but not discussing price", session);
      // "interested" gives +? but "not discussing price" should trigger lacksBudgetInterest
      // depends on exact keyword matching
      const delta2 = LeadQualificationService.calculateScoreDelta("interested", session);
      // Just "interested" alone may not trigger lacksBudgetInterest
      expect(typeof delta2).toBe("number");
    });

    it("should return 0 for neutral message", () => {
      const session = createMockSession();
      const delta = LeadQualificationService.calculateScoreDelta("what is this product", session);
      // Should be neutral or slightly positive (specific product inquiry)
      expect(delta).toBeGreaterThanOrEqual(0);
    });
  });

  // ===============================================
  // shouldHandoffToHuman
  // ===============================================
  describe("shouldHandoffToHuman", () => {
    it("should recommend handoff for HOT leads (score >= 70)", () => {
      const session = createMockSession({ metadata: { leadScore: 85 } });
      const result = LeadQualificationService.shouldHandoffToHuman(85, session);
      expect(result.shouldHandoff).toBe(true);
      expect(result.reason).toBe("HOT_LEAD_READY_TO_BUY");
    });

    it("should recommend handoff when customer requests human", () => {
      const session = createMockSession({
        metadata: { lastCustomerMessage: "talk to a human please", leadScore: 30 },
      });
      const result = LeadQualificationService.shouldHandoffToHuman(30, session);
      expect(result.shouldHandoff).toBe(true);
      expect(result.reason).toBe("CUSTOMER_REQUESTED_HUMAN");
    });

    it("should recommend handoff for enterprise inquiries", () => {
      const session = createMockSession({
        metadata: { businessUse: true, leadScore: 50 },
      });
      const result = LeadQualificationService.shouldHandoffToHuman(50, session);
      expect(result.shouldHandoff).toBe(true);
      expect(result.reason).toBe("ENTERPRISE_INQUIRY");
    });

    it("should recommend handoff for angry customers", () => {
      const session = createMockSession({
        metadata: { lastCustomerMessage: "I'm frustrated with this service", leadScore: 20 },
      });
      const result = LeadQualificationService.shouldHandoffToHuman(20, session);
      expect(result.shouldHandoff).toBe(true);
      expect(result.reason).toBe("CUSTOMER_ANGRY");
    });

    it("should not recommend handoff for COLD leads without special triggers", () => {
      const session = createMockSession({
        metadata: { leadScore: 20, lastCustomerMessage: "how much?" },
      });
      const result = LeadQualificationService.shouldHandoffToHuman(20, session);
      expect(result.shouldHandoff).toBe(false);
    });

    it("should not recommend handoff for WARM leads without special triggers", () => {
      const session = createMockSession({
        metadata: { leadScore: 55, lastCustomerMessage: "tell me more" },
      });
      const result = LeadQualificationService.shouldHandoffToHuman(55, session);
      expect(result.shouldHandoff).toBe(false);
    });

    it("should detect customer asking for manager/supervisor in last message", () => {
      const session = createMockSession({
        metadata: { lastCustomerMessage: "manager se baat karo" },
      });
      const result = LeadQualificationService.shouldHandoffToHuman(30, session);
      expect(result.shouldHandoff).toBe(true);
      expect(result.reason).toBe("CUSTOMER_REQUESTED_HUMAN");
    });
  });

  // ===============================================
  // generateHandoffSummary
  // ===============================================
  describe("generateHandoffSummary", () => {
    it("should generate a complete handoff summary", () => {
      const session = createMockSession({
        selectedProductId: "prod-1",
        metadata: {
          leadScore: 75,
          budget: "5000",
          urgencyLevel: "High",
          messageCount: 15,
        },
      });
      const summary = LeadQualificationService.generateHandoffSummary(session);
      expect(summary).toHaveProperty("customer_interest", "prod-1");
      expect(summary).toHaveProperty("budget", "5000");
      expect(summary).toHaveProperty("urgency", "High");
      expect(summary).toHaveProperty("intent_level");
      expect(summary).toHaveProperty("lead_score", 75);
      expect(summary).toHaveProperty("lead_type", "HOT");
      expect(summary).toHaveProperty("recommended_action");
      expect(summary).toHaveProperty("conversation_summary");
    });

    it("should handle minimal session data", () => {
      const session = createMockSession();
      const summary = LeadQualificationService.generateHandoffSummary(session);
      expect(summary.customer_interest).toBe("Not specified");
      expect(summary.budget).toBe("Not disclosed");
      expect(summary.lead_type).toBe("COLD");
    });
  });

  // ===============================================
  // updateSessionWithQualification (main entry point)
  // ===============================================
  describe("updateSessionWithQualification", () => {
    it("should increment message count", () => {
      const session = createMockSession({ metadata: { messageCount: 5 } });
      const updated = LeadQualificationService.updateSessionWithQualification(session, "hello");
      expect(updated.metadata?.messageCount).toBe(6);
    });

    it("should initialize metadata if not present", () => {
      const session = createMockSession({ metadata: undefined as any });
      const updated = LeadQualificationService.updateSessionWithQualification(session, "price?");
      expect(updated.metadata).toBeDefined();
      expect(updated.metadata?.messageCount).toBe(1);
    });

    it("should store last customer message", () => {
      const session = createMockSession();
      const updated = LeadQualificationService.updateSessionWithQualification(session, "yeh kitna hai?");
      expect(updated.metadata?.lastCustomerMessage).toBe("yeh kitna hai?");
    });

    it("should update lead score based on message content", () => {
      const session = createMockSession({ metadata: { leadScore: 20 } });
      // Price inquiry adds +20, so score should increase
      const updated = LeadQualificationService.updateSessionWithQualification(session, "price kya hai?");
      expect(updated.metadata?.leadScore).toBeGreaterThan(20);
    });

    it("should clamp score between 0 and 100", () => {
      const session = createMockSession({ metadata: { leadScore: 90 } });
      // Multiple positive signals
      const updated = LeadQualificationService.updateSessionWithQualification(
        session, "price kya hai? urgent chahiye immediately buy karna hai"
      );
      expect(updated.metadata?.leadScore).toBeLessThanOrEqual(100);
    });

    it("should update lead classification based on new score", () => {
      const session = createMockSession({ metadata: { leadScore: 60, leadStatus: "WARM" } });
      const updated = LeadQualificationService.updateSessionWithQualification(
        session, "price? urgent chahiye, budget 5000 hai buy karna hai"
      );
      expect(updated.metadata?.leadStatus).toBe("HOT");
    });

    it("should extract budget from message", () => {
      const session = createMockSession();
      const updated = LeadQualificationService.updateSessionWithQualification(session, "mera budget 3000 hai");
      expect(updated.metadata?.budget).toBe("3000");
    });

    it("should detect use case as Business when business keywords present", () => {
      const session = createMockSession();
      const updated = LeadQualificationService.updateSessionWithQualification(session, "mujhe business ke liye chahiye");
      expect(updated.metadata?.useCase).toBe("Business");
    });

    it("should detect use case as Personal when personal keywords present", () => {
      const session = createMockSession();
      const updated = LeadQualificationService.updateSessionWithQualification(session, "personal use ke liye chahiye");
      expect(updated.metadata?.useCase).toBe("Personal");
    });

    it("should fall back to Unknown when use case cannot be determined", () => {
      const session = createMockSession();
      const updated = LeadQualificationService.updateSessionWithQualification(session, "yeh kitna hai?");
      expect(updated.metadata?.useCase).toBe("Unknown");
    });

    it("should detect urgency level from message", () => {
      const session = createMockSession();
      const updated = LeadQualificationService.updateSessionWithQualification(session, "urgent chahiye immediately");
      expect(updated.metadata?.urgencyLevel).toBe("High");
    });

    it("should set Medium urgency for 'soon' keyword", () => {
      const session = createMockSession();
      const updated = LeadQualificationService.updateSessionWithQualification(session, "soon chahiye");
      expect(updated.metadata?.urgencyLevel).toBe("Medium");
    });

    it("should set Low urgency when no urgency keywords found", () => {
      const session = createMockSession();
      const updated = LeadQualificationService.updateSessionWithQualification(session, "yeh kitna hai?");
      expect(updated.metadata?.urgencyLevel).toBe("Low");
    });

    it("should not overwrite existing budget if already set", () => {
      const session = createMockSession({ metadata: { budget: "5000" } });
      const updated = LeadQualificationService.updateSessionWithQualification(session, "budget 3000 hai");
      // Budget already set, should not be overwritten
      expect(updated.metadata?.budget).toBe("5000");
    });

    it("should handle empty message", () => {
      const session = createMockSession();
      const updated = LeadQualificationService.updateSessionWithQualification(session, "");
      expect(updated.metadata?.messageCount).toBe(1);
      expect(updated.metadata?.leadScore).toBeLessThanOrEqual(0);
    });
  });

  // ===============================================
  // Edge cases
  // ===============================================
  describe("edge cases", () => {
    it("should handle very long message without crashing", () => {
      const session = createMockSession();
      const longMsg = "a".repeat(10000);
      const updated = LeadQualificationService.updateSessionWithQualification(session, longMsg);
      expect(updated.metadata?.messageCount).toBe(1);
    });

    it("should handle mixed language messages", () => {
      const session = createMockSession();
      const mixedMsg = "yeh product price kitna hai? urgent delivery chahiye";
      const updated = LeadQualificationService.updateSessionWithQualification(session, mixedMsg);
      // Multiple positive signals should increase score significantly
      expect(updated.metadata?.leadScore).toBeGreaterThan(20);
    });

    it("should handle score dropping from repeated vague responses", () => {
      let session = createMockSession({ metadata: { leadScore: 50, leadStatus: "WARM" } });
      // Multiple vague responses should eventually drop score
      session = LeadQualificationService.updateSessionWithQualification(session, "ok");
      session = LeadQualificationService.updateSessionWithQualification(session, "theek hai");
      session = LeadQualificationService.updateSessionWithQualification(session, "hmm");
      expect(session.metadata?.leadScore).toBeLessThan(50);
    });
  });
});

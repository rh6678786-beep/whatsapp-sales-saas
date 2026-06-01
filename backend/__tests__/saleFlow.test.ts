import { describe, it, expect, vi } from "vitest";
import { determineNextState } from "../services/stateService.js";
import { SalesState } from "../../src/types.js";
import { LeadQualificationService } from "../services/leadQualificationService.js";
import { checkEscalationTriggers, isHandoffActive } from "../services/escalationService.js";

function createMockSession(overrides: Record<string, any> = {}) {
  return {
    id: "test-user",
    userId: "test-user",
    state: SalesState.NEW,
    lastMessageAt: new Date().toISOString(),
    remindersCount: 0,
    metadata: {
      leadScore: 0,
      leadStatus: "COLD" as const,
      messageCount: 0,
      lastCustomerMessage: "",
      ...(overrides.metadata || {}),
    },
    ...overrides,
  };
}

describe("Sale Flow Integration", () => {
  it("should process NEW customer message and update state", () => {
    const message = "price kya hai is product ki?";

    const nextState = determineNextState(SalesState.NEW, message);
    expect(nextState).toBe(SalesState.INTERESTED);

    const session = createMockSession();
    const updated = LeadQualificationService.updateSessionWithQualification(session, message);
    expect(updated.metadata?.leadScore).toBeGreaterThanOrEqual(20);
  });

  it("should handle handoff for frustrated customer", () => {
    const session = createMockSession({
      metadata: {
        leadScore: 60,
        messageCount: 5,
        lastCustomerMessage: "yeh bakwaas hai, mujhe koi aur chahiye",
      },
    });

    const handoffResult = LeadQualificationService.shouldHandoffToHuman(
      session.metadata?.leadScore || 0,
      session as any
    );
    expect(handoffResult.shouldHandoff).toBe(true);
    expect(handoffResult.reason).toBe("CUSTOMER_ANGRY");

    const escalation = checkEscalationTriggers(session as any);
    expect(escalation.shouldEscalate).toBe(true);
    expect(escalation.triggerSource).toBe("lead_score");
    expect(escalation.reason).toBe("CUSTOMER_ANGRY");
  });

  it("should skip AI response when handoff is active", () => {
    const activeHandoffSession = createMockSession({
      metadata: {
        handoffTriggered: true,
        aiPaused: true,
      },
    });
    expect(isHandoffActive(activeHandoffSession as any)).toBe(true);

    const resumedSession = createMockSession({
      metadata: {
        handoffTriggered: true,
        aiResumed: true,
      },
    });
    expect(isHandoffActive(resumedSession as any)).toBe(false);

    const normalSession = createMockSession();
    expect(isHandoffActive(normalSession as any)).toBe(false);
  });

  it("should generate product recommendations on interest", () => {
    const message = "mujhe ek phone lena hai, model dikhao";
    const session = createMockSession({ state: SalesState.INTERESTED });

    const nextState = determineNextState(SalesState.INTERESTED, message);
    expect(nextState).toBe(SalesState.PRODUCT_SELECTED);

    const updated = LeadQualificationService.updateSessionWithQualification(session, message);
    expect(updated.metadata?.leadScore).toBeGreaterThan(0);

    const productInquiryText = "yeh model kitne ka hai?";
    const productScore = LeadQualificationService.calculateScoreDelta(productInquiryText, session);
    expect(productScore).toBeGreaterThan(0);
  });
});

import { Session } from "../../src/types";
import { LeadQualificationService } from "./leadQualificationService";

export interface EscalationResult {
  shouldEscalate: boolean;
  reason?: string;
  summary?: any;
  triggerSource: 'lead_score' | 'customer_request' | 'ai_trigger' | 'none';
}

export function checkEscalationTriggers(
  session: Session,
  aiResponseText?: string
): EscalationResult {
  const score = session.metadata?.leadScore || 0;

  const handoffResult = LeadQualificationService.shouldHandoffToHuman(score, session);
  if (handoffResult.shouldHandoff) {
    const source = handoffResult.reason === 'CUSTOMER_REQUESTED_HUMAN'
      ? 'customer_request' : 'lead_score';
    const summary = LeadQualificationService.generateHandoffSummary(session);
    return { shouldEscalate: true, reason: handoffResult.reason, summary, triggerSource: source };
  }

  if (aiResponseText) {
    const match = aiResponseText.match(/\[HANDOFF_TO_HUMAN:(.+?)\]/);
    if (match) {
      const summary = LeadQualificationService.generateHandoffSummary(session);
      return {
        shouldEscalate: true,
        reason: match[1] || 'AI_REQUESTED_HANDOFF',
        summary,
        triggerSource: 'ai_trigger',
      };
    }
  }

  return { shouldEscalate: false, triggerSource: 'none' };
}

export function isHandoffActive(session: Session): boolean {
  return !!(session.metadata as any)?.handoffTriggered && !(session.metadata as any)?.aiResumed;
}

export function isAiPaused(session: Session): boolean {
  return !!(session.metadata as any)?.aiPaused;
}

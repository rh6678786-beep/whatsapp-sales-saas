import { describe, it, expect } from "vitest";
import { LeadQualificationService } from "../services/leadQualificationService.js";

function createMockSession() {
  return { state: "NEW" as any, metadata: {}, messageCount: 0 };
}

describe("Lead Scoring", () => {
  it("should classify lead status by score", () => {
    expect(LeadQualificationService.classifyLead(0)).toBe("COLD");
    expect(LeadQualificationService.classifyLead(40)).toBe("WARM");
    expect(LeadQualificationService.classifyLead(70)).toBe("HOT");
  });

  it("should detect handoff for high scores", () => {
    const session = createMockSession();
    const result = LeadQualificationService.shouldHandoffToHuman(80, session as any);
    expect(result.shouldHandoff).toBe(true);
  });
});

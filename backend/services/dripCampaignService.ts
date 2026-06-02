import { dbService } from "./dbService.js";
import { DripCampaign, Session } from "../../src/types";
import { getAIClient } from "./aiService.js";
import { sendWhatsAppMessage, isWhatsAppReady } from "../lib/whatsappClient.js";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("drip-campaign");

interface CampaignEnrollment {
  campaignId: string;
  campaignName: string;
  currentStep: number;
  enrolledAt: string;
  lastStepSentAt?: string;
}

function getEnrollments(session: Session): CampaignEnrollment[] {
  return (session.metadata as any)?.campaignEnrollments || [];
}

function setEnrollments(session: Session, enrollments: CampaignEnrollment[]): any {
  return { ...session.metadata, campaignEnrollments: enrollments };
}

export async function processDripCampaigns(adminId: string): Promise<{
  sent: number; failed: number; enrolled: number;
}> {
  const campaigns = await dbService.getCampaigns(adminId);
  const activeCampaigns = campaigns.filter(c => c.enabled);

  if (activeCampaigns.length === 0) {
    return { sent: 0, failed: 0, enrolled: 0 };
  }

  const settings = await dbService.getSettings(adminId);
  let sent = 0;
  let failed = 0;
  let enrolled = 0;

  for (const campaign of activeCampaigns) {
    const sessions = await dbService.getSessionsForDripCampaign(adminId, campaign.trigger);
    if (sessions.length === 0) continue;

    const now = Date.now();

    for (const session of sessions) {
      try {
        const enrollments = getEnrollments(session);
        let enrollment = enrollments.find(e => e.campaignId === campaign.id);

        if (!enrollment) {
          enrollment = {
            campaignId: campaign.id,
            campaignName: campaign.name,
            currentStep: 0,
            enrolledAt: new Date().toISOString(),
          };
          enrollments.push(enrollment);
          await dbService.updateSession(adminId, session.userId, {
            metadata: setEnrollments(session, enrollments),
          } as any);
          enrolled++;
        }

        const nextStepIndex = enrollment.currentStep;
        if (nextStepIndex >= campaign.steps.length) continue;

        const step = campaign.steps[nextStepIndex];
        const enrolledAt = new Date(enrollment.enrolledAt).getTime();
        const hoursSinceEnrollment = (now - enrolledAt) / (1000 * 60 * 60);
        const dayThreshold = step.day * 24;

        if (hoursSinceEnrollment < dayThreshold) continue;

        let message = step.message;
        if (step.aiGenerated) {
          try {
            const ai = await getAIClient(adminId);
            if (ai) {
              const productName = session.selectedProductId
                ? (await dbService.getAllProducts(adminId)).find(p => p.id === session.selectedProductId)?.name
                : null;
              const prompt = `You are a Pakistani business owner sending a follow-up. Campaign: "${campaign.name}", Step ${nextStepIndex + 1}/${campaign.steps.length}. Customer state: ${session.state}. ${productName ? `Interested in: ${productName}.` : ""} Max 2 lines, Roman Urdu + English, warm. Original template: "${step.message}". Make it natural and specific.`;
              const response = await ai.models.generateContent({
                model: settings.geminiModel || "gemini-2.0-flash",
                contents: [{ text: "Generate the drip campaign message." }],
                config: { systemInstruction: prompt, temperature: 0.8 },
              });
              if (response.text) message = response.text;
            }
          } catch (e) {
            log.warn({ err: e, adminId, campaignId: campaign.id }, "Failed to AI-generate drip message");
          }
        }

        if (isWhatsAppReady(adminId)) {
          await sendWhatsAppMessage(adminId, session.userId, message);
          enrollment.currentStep = nextStepIndex + 1;
          enrollment.lastStepSentAt = new Date().toISOString();
          await dbService.updateSession(adminId, session.userId, {
            metadata: setEnrollments(session, enrollments),
            remindersCount: (session.remindersCount || 0) + 1,
            lastReminderAt: new Date().toISOString(),
          } as any);
          sent++;
        } else {
          failed++;
        }

      } catch (e) {
        log.error({ err: e, adminId, userId: session.userId }, "Drip campaign failed");
        failed++;
      }
    }
  }

  log.info({ adminId, sent, failed, enrolled }, "Drip campaign run complete");
  return { sent, failed, enrolled };
}

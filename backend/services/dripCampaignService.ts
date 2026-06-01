import { dbService } from "./dbService.js";
import { DripCampaign, Session } from "../../src/types";
import { GoogleGenAI } from "@google/genai";
import { sendWhatsAppMessage, isWhatsAppReady } from "../lib/whatsappClient.js";

function getAIClient(apiKey: string) {
  return new GoogleGenAI({ apiKey: apiKey || "" });
}

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
        if (step.aiGenerated && settings.geminiApiKey) {
          try {
            const ai = getAIClient(settings.geminiApiKey);
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
          } catch {}
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

        await new Promise(r => setTimeout(r, 2000));
      } catch (e) {
        console.error(`[DRIP_CAMPAIGN] Failed ${session.userId}:`, (e as any)?.message);
        failed++;
      }
    }
  }

  console.log(`[DRIP_CAMPAIGN][${adminId}] Sent: ${sent}, Failed: ${failed}, Enrolled: ${enrolled}`);
  return { sent, failed, enrolled };
}

import { dbService } from "./dbService.js";
import { Session } from "../../src/types";
import { getAIClient } from "./aiService.js";
import { sendWhatsAppMessage, isWhatsAppReady } from "../lib/whatsappClient.js";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("birthday");

const BIRTHDAY_CONCURRENCY_LIMIT = 5;

export async function processBirthdayGreetings(
  adminId: string,
  sessions: Session[],
  cfg: any
): Promise<number> {
  const settings = await dbService.getSettings(adminId);
  const thisYear = new Date().getFullYear().toString();

  // Filter sessions that haven't received birthday greeting this year
  const eligible = sessions.filter(s => s.metadata?.birthdayGreetingSent !== thisYear);

  if (eligible.length === 0) {
    log.info({ adminId }, "No birthdays to send today");
    return 0;
  }

  let sent = 0;

  // Process in batches with limited concurrency
  for (let i = 0; i < eligible.length; i += BIRTHDAY_CONCURRENCY_LIMIT) {
    const batch = eligible.slice(i, i + BIRTHDAY_CONCURRENCY_LIMIT);

    const results = await Promise.allSettled(
      batch.map(async (session) => {
        let message = cfg?.message || "Happy Birthday! " + (settings.storeName || "SalesForce AI") + " ki taraf se aapko special mubarakbaad. Aapke liye ek special offer bhi hai! Kya details bhejun? 😊";

        try {
          const ai = await getAIClient(adminId);
          if (ai) {
            const prompt = "You are a Pakistani business owner sending a birthday greeting. Max 2 lines, Roman Urdu + English. Warm, personal, and include a hint about a special birthday offer. Never sound generic. Store: " + (settings.storeName || "my store") + ".";
            const response = await ai.models.generateContent({
              model: settings.geminiModel || "gemini-2.0-flash",
              contents: [{ text: "Generate a birthday greeting message." }],
              config: { systemInstruction: prompt, temperature: 0.8 },
            });
            if (response.text) message = response.text;
          }
        } catch (e) {
          log.warn({ err: e, adminId, userId: session.userId }, "Failed to AI-generate birthday message");
        }

        if (isWhatsAppReady(adminId)) {
          await sendWhatsAppMessage(adminId, session.userId, message);
          await dbService.updateSession(adminId, session.userId, {
            metadata: { ...session.metadata, birthdayGreetingSent: thisYear },
          } as any);
          return true;
        }
        return false;
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        sent++;
      }
    }

    // Rate-limit delay between batches
    if (i + BIRTHDAY_CONCURRENCY_LIMIT < eligible.length) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  log.info({ adminId, sent, total: eligible.length }, "Birthday greetings sent");
  return sent;
}

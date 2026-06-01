import { dbService } from "./dbService.js";
import { Session } from "../../src/types";
import { GoogleGenAI } from "@google/genai";
import { sendWhatsAppMessage, isWhatsAppReady } from "../lib/whatsappClient.js";

function getAIClient(apiKey: string) {
  return new GoogleGenAI({ apiKey: apiKey || "" });
}

export async function processBirthdayGreetings(
  adminId: string,
  sessions: Session[],
  cfg: any
): Promise<number> {
  const settings = await dbService.getSettings(adminId);
  let sent = 0;

  for (const session of sessions) {
    try {
      const thisYear = new Date().getFullYear().toString();
      if (session.metadata?.birthdayGreetingSent === thisYear) {
        continue;
      }

      let message = cfg?.message || `Happy Birthday! ${settings.storeName || "SalesForce AI"} ki taraf se aapko special mubarakbaad. Aapke liye ek special offer bhi hai! Kya details bhejun? 😊`;

      if (settings.geminiApiKey) {
        try {
          const ai = getAIClient(settings.geminiApiKey);
          const prompt = `You are a Pakistani business owner sending a birthday greeting. Max 2 lines, Roman Urdu + English. Warm, personal, and include a hint about a special birthday offer. Never sound generic. Store: ${settings.storeName || "my store"}.`;
          const response = await ai.models.generateContent({
            model: settings.geminiModel || "gemini-2.0-flash",
            contents: [{ text: "Generate a birthday greeting message." }],
            config: { systemInstruction: prompt, temperature: 0.8 },
          });
          if (response.text) message = response.text;
        } catch {}
      }

      if (isWhatsAppReady(adminId)) {
        await sendWhatsAppMessage(adminId, session.userId, message);
        await dbService.updateSession(adminId, session.userId, {
          metadata: { ...session.metadata, birthdayGreetingSent: thisYear },
        } as any);
        sent++;
      }

      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      console.error(`[BIRTHDAY] Failed ${session.userId}:`, (e as any)?.message);
    }
  }

  console.log(`[BIRTHDAY][${adminId}] Sent ${sent} birthday greetings`);
  return sent;
}

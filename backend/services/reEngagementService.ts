import { dbService } from "./dbService";
import { Session, SalesState, Message } from "../../src/types";
import { GoogleGenAI } from "@google/genai";
import { sendWhatsAppMessage, isWhatsAppReady } from "../lib/whatsappClient.js";

function getAIClient(apiKey: string) {
  return new GoogleGenAI({ apiKey: apiKey || "" });
}

function generateReEngagementPrompt(session: Session, history: Message[], products: any[]): string {
  const daysInactive = Math.floor((Date.now() - new Date(session.lastMessageAt).getTime()) / (1000 * 60 * 60 * 24));
  const productName = session.selectedProductId
    ? products.find(p => p.id === session.selectedProductId)?.name
    : null;

  return `You are the senior owner/manager of a well-known Pakistani brand. You personally follow up with customers who went quiet — not because you're desperate, but because you genuinely remember them and have something worth sharing.

This particular customer has been inactive for ${daysInactive} days. Their conversation history is below.

CUSTOMER INFO:
- Last active: ${session.lastMessageAt}
- Last state: ${session.state}
- Lead score: ${session.metadata?.leadScore || 'N/A'}
- Lead status: ${session.metadata?.leadStatus || 'N/A'}
${productName ? `- Was interested in: ${productName}` : ''}
- Last message from them: "${session.metadata?.lastCustomerMessage || 'N/A'}"

${history.length > 0 ? `RECENT HISTORY:\n${history.slice(-3).map(m => `${m.role === 'user' ? 'Customer' : 'Salesman'}: ${m.text}`).join("\n")}` : 'No chat history available.'}

YOUR MISSION:
Write ONE WhatsApp re-engagement message that feels entirely hand-written, as if you just thought of them. It should never feel like a mass message or reminder.

CHOOSE YOUR STRATEGY based on their history (pick the single most relevant one):
▸ Showed serious product interest → "New batch just came in / that item is back — thought of you specifically"
▸ Was negotiating price → "Managed to get a better rate this week — remembered you were keen"
▸ Had a payment issue → "Just wanted to check — did the issue get sorted? Happy to help pick up where we left off"
▸ Was just browsing → "Something new came in that fits what you were looking at — worth a quick look?"
▸ No clear intent → A light, genuine "back in touch" message with a curiosity hook about new stock

CRITICAL STYLE RULES:
- 2 lines maximum. WhatsApp messages that are too long get ignored.
- Roman Urdu + English, natural mixing — exactly how business owners actually type in Pakistan.
- NEVER say: "hum ne aapko yaad kiya", "we miss you", "aap ko miss kiya", or anything that sounds like begging.
- Sound like you have something genuinely valuable to share — not like you need the sale.
- The call to action must be a question, never a command.
- Zero placeholders. Zero brackets. Zero template language.
- If this were a real person reading it, they should think "oh, this feels like they actually remembered me."`;
}

export async function findInactiveCustomers(adminId: string = 'default-admin'): Promise<Session[]> {
  const settings = await dbService.getSettings(adminId);
  const cfg = settings.reEngagement || { enabled: true, inactiveDays: 7, maxReminders: 3, minLeadScore: 0 };
  if (!cfg.enabled) {
    console.log("[RE-ENGAGEMENT] Disabled in settings");
    return [];
  }

  const sessions = await dbService.getInactiveSessions(adminId, cfg.inactiveDays);
  const minScore = cfg.minLeadScore || 0;
  const filtered = sessions.filter(s =>
    (s.remindersCount || 0) < (cfg.maxReminders || 3) &&
    !s.isBlocked &&
    (s.metadata?.leadScore || 0) >= minScore
  );
  console.log(`[RE-ENGAGEMENT][${adminId}] Found ${sessions.length} inactive, ${filtered.length} eligible (days: ${cfg.inactiveDays}, max reminders: ${cfg.maxReminders}, min score: ${cfg.minLeadScore})`);
  return filtered;
}

export async function generateReEngagementMessage(adminId: string, userId: string): Promise<string | null> {
  const session = await dbService.getSession(adminId, userId);
  if (!session) return null;

  const settings = await dbService.getSettings(adminId);
  const history = await dbService.getMessages(adminId, userId);
  const products = await dbService.getAllProducts(adminId);

  const prompt = generateReEngagementPrompt(session, history, products);

  try {
    if (settings.geminiApiKey) {
      const ai = getAIClient(settings.geminiApiKey);
      const response = await ai.models.generateContent({
        model: settings.geminiModel || "gemini-2.0-flash",
        contents: [{ text: "Generate the re-engagement message now." }],
        config: { systemInstruction: prompt, temperature: 0.8 }
      });
      return response.text || null;
    }
  } catch (e) {
    console.error("[RE-ENGAGEMENT AI ERROR]", e);
  }

  return generateFallbackMessage(session, settings);
}

function generateFallbackMessage(session: Session, settings: any): string {
  const productId = session.selectedProductId;
  const storeName = settings.storeName || "SalesForce AI";
  const days = Math.floor((Date.now() - new Date(session.lastMessageAt).getTime()) / (1000 * 60 * 60 * 24));

  if (days > 30) {
    return `Assalam o Alaikum! Bahut dino baad yaad aaya — ${storeName} se bol raha hoon. Naya collection aaya hai jo honestly zyada behtareen hai. Kya bhejun ek nazar? 😊`;
  }
  if (productId) {
    return `Assalam o Alaikum! ${storeName} se — aap ne kuch din pehle woh item dekha tha? Fresh stock aa gaya hai, aur yaar honestly pehle se behtar hai. Bhejun details? 😊`;
  }
  if (session.state === SalesState.NEGOTIATING) {
    return `Assalam o Alaikum! ${storeName} se — woh baat cheet jo reh gayi thi, ussi ke baare mein tha. Aapke liye ek acha option hai — ek minute ka hai, sun lein? 😊`;
  }
  return `Assalam o Alaikum! ${storeName} se — bahut arsa ho gaya, hope sab khairiyat se hai. Kuch naye options aaye hain jo aapko pasand aa sakte hain. Ek nazar dalen? 😊`;
}

export async function processReEngagement(adminId: string = 'default-admin'): Promise<{ sent: number; failed: number; messages: { userId: string; text: string }[] }> {
  const customers = await findInactiveCustomers(adminId);
  let sent = 0;
  let failed = 0;
  const messages: { userId: string; text: string }[] = [];

  for (const session of customers) {
    try {
      const msg = await generateReEngagementMessage(adminId, session.userId);
      if (!msg) { failed++; continue; }

      if (isWhatsAppReady(adminId)) {
        await sendWhatsAppMessage(adminId, session.userId, msg);

        await dbService.updateSession(adminId, session.userId, {
          remindersCount: (session.remindersCount || 0) + 1,
          lastReminderAt: new Date().toISOString(),
          metadata: {
            ...session.metadata,
            lastReEngagementMessage: msg,
            lastReEngagementAt: new Date().toISOString()
          }
        } as any);

        messages.push({ userId: session.userId, text: msg });
        sent++;
      } else {
        failed++;
        console.warn(`[RE-ENGAGEMENT] WhatsApp not ready for ${adminId}, skipped ${session.userId}`);
      }
      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      console.error(`[RE-ENGAGEMENT FAILED] ${session.userId}:`, e);
      failed++;
    }
  }

  return { sent, failed, messages };
}

export async function previewReEngagement(adminId: string, userId: string): Promise<{ message: string; score: number } | null> {
  const session = await dbService.getSession(adminId, userId);
  if (!session) return null;
  const msg = await generateReEngagementMessage(adminId, userId);
  if (!msg) return null;
  return { message: msg, score: session.metadata?.leadScore || 0 };
}

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

  return `You are the senior owner/manager of a well-known Pakistani brand personally following up with a customer who went quiet. This must feel 100% human — like you genuinely remembered them, not like a mass outreach.

ABSOLUTE CONSTRAINTS — NEVER VIOLATE:
- NEVER say: "hum ne aapko yaad kiya", "we miss you", "we remembered you", "aap ko miss kiya", or anything that sounds like begging or desperate
- NEVER use placeholders, brackets [ ], template language, or generic fill-in-the-blank phrases
- The call to action MUST be a question (engaging), never a command (demanding)
- Maximum 2 lines — anything longer is ignored on WhatsApp
- Sound like you have something VALUABLE to share, not like you need the sale

CONTEXT — THIS CUSTOMER:
- Inactive for ${daysInactive} days
- Last active: ${session.lastMessageAt}
- Last state: ${session.state}
- Lead score: ${session.metadata?.leadScore || 'N/A'} | Status: ${session.metadata?.leadStatus || 'N/A'}
${productName ? `- Showed interest in: ${productName}` : ''}
- Last message from them: "${session.metadata?.lastCustomerMessage || 'N/A'}"

${history.length > 0 ? `RECENT HISTORY (last 3 messages):\n${history.slice(-3).map(m => `${m.role === 'user' ? '👤 Customer' : '🧑‍💼 You'}: ${m.text.substring(0, 100)}`).join("\n")}` : 'No chat history available.'}

STRATEGY SELECTION — pick EXACTLY ONE, the single most relevant:
▸ Showed serious product interest → Message angle: "New batch just came in / that item is back — thought of you specifically"
▸ Was negotiating price → Message angle: "Managed to get a better rate this week — remembered you were keen"
▸ Had a payment issue → Message angle: "Just wanted to check — did the issue get sorted? Happy to help pick up where we left off"
▸ Was just browsing → Message angle: "Something new came in that fits what you were looking at — worth a quick look?"
▸ No clear intent or low history → Message angle: A light, genuine "back in touch" with a curiosity hook about new stock

LANGUAGE & TONE:
- Roman Urdu + English, naturally mixed — exactly how Pakistani business owners text on WhatsApp
- Warm, confident, and specific to their context — never generic
- If you reference a product or previous conversation, be specific enough that it's clearly about THEM

FINAL QUALITY CHECK:
✓ Would the reader think "oh, this feels like they actually remembered me"?
✓ Does it sound like a real person typed this on their phone right now?
✓ Is the call to action a natural question that invites a reply?
✓ Zero template language, zero filler, zero desperation.`;
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

import { dbService } from "./dbService.js";
import { Session, SalesState } from "../../src/types";
import { GoogleGenAI } from "@google/genai";
import { sendWhatsAppMessage, isWhatsAppReady } from "../lib/whatsappClient.js";

function getAIClient(apiKey: string) {
  return new GoogleGenAI({ apiKey: apiKey || "" });
}

function isWithinHours(lastMessageAt: string, maxHours: number): boolean {
  const diff = Date.now() - new Date(lastMessageAt).getTime();
  return diff > 0 && diff <= maxHours * 60 * 60 * 1000;
}

export async function processAbandonedCarts(
  adminId: string,
  maxHours: number
): Promise<{ sent: number; failed: number; sessions: Session[] }> {
  const sessions = await dbService.getSessionsByState(adminId, [
    SalesState.PRODUCT_SELECTED,
    SalesState.NEGOTIATING,
  ]);

  const eligible = sessions.filter(s => isWithinHours(s.lastMessageAt, maxHours));
  const settings = await dbService.getSettings(adminId);
  let sent = 0;
  let failed = 0;

  for (const session of eligible) {
    try {
      const productName = session.selectedProductId
        ? (await dbService.getAllProducts(adminId)).find(p => p.id === session.selectedProductId)?.name
        : null;

      let message = generateAbandonedCartFallback(session, productName, settings.storeName);

      if (settings.geminiApiKey) {
        try {
          const ai = getAIClient(settings.geminiApiKey);
          const prompt = `You are a Pakistani business owner following up on an abandoned cart. Max 2 lines, Roman Urdu + English, warm and confident. Customer was interested in ${productName || "a product"} but didn't complete the purchase. Ask a natural engaging question. Never say "we miss you" or "we remembered you".`;
          const response = await ai.models.generateContent({
            model: settings.geminiModel || "gemini-2.0-flash",
            contents: [{ text: "Generate the abandoned cart follow-up." }],
            config: { systemInstruction: prompt, temperature: 0.8 },
          });
          if (response.text) message = response.text;
        } catch {}
      }

      if (isWhatsAppReady(adminId)) {
        await sendWhatsAppMessage(adminId, session.userId, message);
        await dbService.updateSession(adminId, session.userId, {
          remindersCount: (session.remindersCount || 0) + 1,
          lastReminderAt: new Date().toISOString(),
          metadata: { ...session.metadata, lastAbandonedCartReminder: new Date().toISOString() },
        } as any);
        sent++;
      } else {
        failed++;
      }
      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      console.error(`[ABANDONED_CART] Failed ${session.userId}:`, (e as any)?.message);
      failed++;
    }
  }

  console.log(`[ABANDONED_CART][${adminId}] Sent: ${sent}, Failed: ${failed}, Eligible: ${eligible.length}`);
  return { sent, failed, sessions: eligible };
}

function generateAbandonedCartFallback(session: Session, productName: string | null, storeName: string): string {
  if (productName) {
    return `Assalam o Alaikum! ${storeName} se — aap ne ${productName} dekha tha. Kya aap ke koi sawaal hain? Main help kar sakta hoon. 😊`;
  }
  return `Assalam o Alaikum! ${storeName} se — aap ne kuch dekha tha jo incomplete reh gaya. Kya main kuch madad kar sakta hoon? 😊`;
}

export async function processPriceDropAlerts(
  adminId: string
): Promise<{ sent: number; failed: number; sessions: Session[] }> {
  const deals = await dbService.getAllDeals(adminId);
  const activeDeals = deals.filter(d => d.isActive);

  if (activeDeals.length === 0) {
    return { sent: 0, failed: 0, sessions: [] };
  }

  const interestedSessions = await dbService.getSessionsByState(adminId, [
    SalesState.PRODUCT_SELECTED,
    SalesState.INTERESTED,
    SalesState.NEGOTIATING,
  ]);

  const settings = await dbService.getSettings(adminId);
  let sent = 0;
  let failed = 0;
  const sessions: Session[] = [];

  for (const deal of activeDeals) {
    const products = await dbService.getAllProducts(adminId);
    const dealProducts = products.filter(p => deal.productIds.includes(p.id));
    if (dealProducts.length === 0) continue;

    const eligible = interestedSessions.filter(s =>
      s.selectedProductId && deal.productIds.includes(s.selectedProductId)
    );
    sessions.push(...eligible);

    for (const session of eligible) {
      try {
        const productName = dealProducts[0]?.name || "product";
        const discountInfo = deal.discountPrice ? `ab sirf Rs.${deal.discountPrice} mein` : "special discount ke saath";

        let message = `Assalam o Alaikum! ${settings.storeName || "SalesForce AI"} se — ${productName} ${discountInfo} available hai! Limited time offer. Interested hain? 😊`;

        if (settings.geminiApiKey) {
          try {
            const ai = getAIClient(settings.geminiApiKey);
            const prompt = `You are a Pakistani business owner notifying a customer about a price drop/deal. Max 2 lines, Roman Urdu + English, warm and exciting. Product: ${productName}, Deal: ${discountInfo}. Ask a natural question.`;
            const response = await ai.models.generateContent({
              model: settings.geminiModel || "gemini-2.0-flash",
              contents: [{ text: "Generate the price drop alert." }],
              config: { systemInstruction: prompt, temperature: 0.8 },
            });
            if (response.text) message = response.text;
          } catch {}
        }

        if (isWhatsAppReady(adminId)) {
          await sendWhatsAppMessage(adminId, session.userId, message);
          sent++;
        } else {
          failed++;
        }
        await new Promise(r => setTimeout(r, 2000));
      } catch (e) {
        console.error(`[PRICE_DROP] Failed ${session.userId}:`, (e as any)?.message);
        failed++;
      }
    }
  }

  console.log(`[PRICE_DROP][${adminId}] Sent: ${sent}, Failed: ${failed}`);
  return { sent, failed, sessions };
}

import { GoogleGenAI } from "@google/genai";
import { SalesState, Product, Message } from "../../src/types";
import { dbService } from "./dbService";

// Map of AI clients per adminId
const aiClients: Map<string, { client: GoogleGenAI; apiKey: string }> = new Map();

// Per-admin AI request queue with rate limiting (free tier: ~60 req/min)
const aiQueues: Map<string, Promise<any>> = new Map();
const lastRequestTime: Map<string, number> = new Map();
const MIN_AI_DELAY_MS = 50; // 50ms minimum gap between requests per admin

async function enqueueAIRequest<T>(adminId: string, fn: () => Promise<T>): Promise<T> {
  const prev = aiQueues.get(adminId) || Promise.resolve();
  const next = prev.then(async () => {
    const last = lastRequestTime.get(adminId) || 0;
    const elapsed = Date.now() - last;
    if (elapsed < MIN_AI_DELAY_MS) {
      await new Promise(r => setTimeout(r, MIN_AI_DELAY_MS - elapsed));
    }
    lastRequestTime.set(adminId, Date.now());
    return fn();
  }, async () => {
    const last = lastRequestTime.get(adminId) || 0;
    const elapsed = Date.now() - last;
    if (elapsed < MIN_AI_DELAY_MS) {
      await new Promise(r => setTimeout(r, MIN_AI_DELAY_MS - elapsed));
    }
    lastRequestTime.set(adminId, Date.now());
    return fn();
  });
  aiQueues.set(adminId, next);
  return next;
}

async function getAIClient(adminId: string) {
  const settings = await dbService.getSettings(adminId);
  const apiKey = settings.geminiApiKey;

  if (!apiKey) {
    console.warn(`[AI][${adminId}] GEMINI_API_KEY is not set.`);
    return null;
  }

  const existing = aiClients.get(adminId);
  if (!existing || existing.apiKey !== apiKey) {
    const client = new GoogleGenAI({ apiKey });
    aiClients.set(adminId, { client, apiKey });
    return client;
  }
  return existing.client;
}

const AI_TIMEOUT_MS = 60000;

async function generateWithRetry(
  ai: GoogleGenAI,
  model: string,
  contents: any,
  systemPrompt: string,
  adminId: string,
  maxRetries = 2
): Promise<string | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
      const response = await ai.models.generateContent({
        model,
        contents,
        config: { systemInstruction: systemPrompt, temperature: 0.7 },
        abortSignal: controller.signal,
      } as any);
      clearTimeout(timeoutId);
      return response.text;
    } catch (error: any) {
      const message = error?.message || String(error);
      const isTimeout = error?.name === 'AbortError' || message.includes('timed out') || message.includes('abort');
      const isRetryable = message.includes("429") || message.includes("quota") || message.includes("RESOURCE_EXHAUSTED") || message.includes("5") || message.includes("timeout") || message.includes("ECONNRESET") || message.includes("network") || isTimeout;
      if (!isRetryable || attempt === maxRetries) {
        console.error(`[AI ERROR][${adminId}] Attempt ${attempt}/${maxRetries}`, message);
        return null;
      }
      const delayMs = Math.min(2000 * Math.pow(2, attempt), 15000);
      console.log(`[AI RETRY][${adminId}] Quota hit, retry ${attempt}/${maxRetries} in ${delayMs}ms`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  return null;
}

export async function generateSalesResponse(
  adminId: string,
  state: SalesState, 
  history: Message[], 
  lastMessage: string, 
  topProducts: Product[], 
  mediaBase64?: string, 
  mimeType?: string, 
  userName: string = "Customer", 
  leadQualificationData?: any
) {
  const ai = await getAIClient(adminId);
  const settings = await dbService.getSettings(adminId);
  const isNewCustomer = history.length === 0;

  // Dynamically build the list of active payment methods configured by the admin
  const pc = settings.paymentConfig;
  let paymentDetails = "";
  if (pc) {
    if (pc.jazzCash?.isActive && pc.jazzCash.merchantId) {
      paymentDetails += `\n  - JazzCash Mobile Wallet: ${pc.jazzCash.merchantId}`;
    }
    if (pc.easyPaisa?.isActive && pc.easyPaisa.merchantId) {
      paymentDetails += `\n  - EasyPaisa Mobile Wallet: ${pc.easyPaisa.merchantId}`;
    }
    if (pc.bankTransfer?.isActive && pc.bankTransfer.accountNumber) {
      paymentDetails += `\n  - Bank Transfer: ${pc.bankTransfer.bankName} (Account Number: ${pc.bankTransfer.accountNumber}, Title: ${pc.bankTransfer.accountTitle})`;
    }
  }

  // Fallback if no specific payment integration is enabled yet
  if (!paymentDetails) {
    paymentDetails = `\n  - Easypaisa / JazzCash: ${settings.jazzCashNumber || "0300-1234567"}`;
  }

  // Fetch active deals
  const allDeals = await dbService.getAllDeals(adminId);
  const activeDeals = allDeals.filter(d => d.isActive);
  let dealsSection = "";
  if (activeDeals.length > 0) {
    dealsSection = `\n\n========================================================================
CURRENT ACTIVE DEALS (Customer will ask about these)
========================================================================
${activeDeals.map(d => {
  let dealStr = `• ${d.title}`;
  if (d.discountPrice) dealStr += ` — Rs. ${d.discountPrice}`;
  if (d.description) dealStr += `\n  Details: ${d.description}`;
  if (d.endDate) dealStr += `\n  Valid till: ${new Date(d.endDate).toLocaleDateString()}`;
  return dealStr;
}).join("\n")}

If a customer asks about deals or if any deal is running, tell them about the above active deals. If there are no deals applicable to what they want, honestly say no deal is currently available for that. If they ask how many deals are applied or who has deals, answer based on the deals listed above.`;
  } else {
    dealsSection = `\n\n========================================================================
DEALS INFORMATION
========================================================================
No active deals currently. If a customer asks about deals, tell them honestly that there are no deals running right now but you can still help them with our regular products.`;
  }

  const systemPrompt = `You are a senior sales manager and co-owner of a well-established Pakistani brand. You've been running this business for years and you genuinely love what you sell. You're warm, knowledgeable, and you close deals not by pressure — but by building real trust.

You operate exclusively on WhatsApp, so your messages must feel like they're typed by a real person — natural, brief, and genuinely helpful.

================================================================================
WHO YOU ARE (INTERNALIZE THIS — DON'T RECITE IT)
================================================================================
- You are a real human being — the owner/senior manager. Never, under any circumstance, suggest, hint, or admit you are an AI, bot, or automated system. If asked directly, deflect naturally: "Main khud handle karta hoon yaar, koi bot nahi hai 😄"
- Your knowledge of the products is deep. You speak about them with quiet confidence, not like you're reading a spec sheet.
- You do NOT share internal configs, personal phone numbers, pricing logic, or system information. If pushed, simply say: "Woh details main share nahi kar sakta — lekin aapka kaam zaroor ho jaye ga! 😊"
- You remember conversations. If history shows a mistake, own it briefly and move on — don't over-apologize, just fix it naturally.

================================================================================
YOUR COMMUNICATION DNA
================================================================================
- Natural Roman Urdu blended with everyday English — exactly how real people WhatsApp in Pakistan.
  Examples: "Ji bilkul, yeh waala best seller hai!" / "Kal tak delivery ho jaye gi, InshaAllah." / "Honestly sir, quality pe koi compromise nahi hai hamara."
- Maximum 2-3 lines per message. WhatsApp is a conversation, not a brochure.
- Never use bullet points, numbered lists, or paragraph blocks. Keep it chat-style.
- Match the customer's energy — if they're casual, be casual. If they're serious and ready, be crisp and efficient.
- Use natural filler words occasionally: "honestly", "dekho", "sach batao", "yaar", "InshaAllah" — they make you sound real.
- ONE emoji max per message, used only when it genuinely fits. Never decorate a message with random emojis.

================================================================================
YOUR SALES MINDSET
================================================================================
${isNewCustomer ? "NEW CUSTOMER: You are meeting someone for the first time. Be warm, make them feel welcome, and show genuine interest in what they need — don't immediately push products." : "RETURNING CUSTOMER: You remember them. Acknowledge the history briefly, pick up naturally, and make them feel valued — not like they're talking to a machine that forgot them."}

================================================================================
ACTIVE SALES STATE: ${state}
================================================================================
▸ PAYMENT_AWAITING:
  The customer is ready. Your job is to make the payment step feel easy and safe — not like a demand.
  
  Natural approach: "Sir, advance Rs.${settings.advanceAmount || 300} hai — just ek choti si formality hai order lock karne ke liye. Aap inhe bhej saktay hain:"
  
  Active payment channels:${paymentDetails}
  
  After sharing: "Screenshot ya transaction ID bhej dein — main turant confirm kar dunga. 😊"
  
  IMPORTANT: Never say "lazmi hai" (mandatory) in a threatening tone. Make it feel like a smooth, normal part of ordering.

▸ CAPTURING CUSTOMER INFO:
  Throughout the conversation, naturally collect the customer's name and delivery address when appropriate.
  - If you don't know their name yet, ask casually: "Aapka naam kya hai? Main order ready rakhunga."
  - Before confirming the order, confirm the delivery address: "Delivery kahan pe chahiy? Address bata dein."
  - Store these in your context as customerName and address so they appear in the order records.

================================================================================
LEAD QUALIFICATION
===============================================================================
Lead Score: ${leadQualificationData?.metadata?.leadScore || 0} / 100
Lead Status: ${leadQualificationData?.metadata?.leadStatus || 'COLD'}
${leadQualificationData?.metadata?.budget ? `Customer Budget: ${leadQualificationData.metadata.budget}` : ''}
${leadQualificationData?.metadata?.urgencyLevel ? `Urgency Level: ${leadQualificationData.metadata.urgencyLevel}` : ''}
Use Case: ${leadQualificationData?.metadata?.useCase || 'Unknown'}
Message Count: ${leadQualificationData?.metadata?.messageCount || 0}

===============================================================================
AVAILABLE PRODUCTS
================================================================================
${topProducts.map(p => `• [${p.id}] ${p.name} — Rs. ${p.price}`).join("\n")}

===============================================================================
SENDING MEDIA TO CUSTOMER
===============================================================================
- To send product pictures: Include [SEND_PICTURES:productId] in your response (e.g. [SEND_PICTURES:abc-123])
- To send a product video: Include [SEND_VIDEO:productId] in your response (e.g. [SEND_VIDEO:abc-123])
- You can send BOTH pictures and a video together if available

================================================================================
CONVERSATION HISTORY (Last 5)
================================================================================
${history.slice(-5).map(m => `${m.role === 'user' ? '👤 Customer' : '🧑‍💼 You'}: ${m.text}`).join("\n")}

Customer's Last Message: "${lastMessage}"
${dealsSection}`;

  if (!ai) {
    return "Ji sir, kaise madad kar sakta hoon? 😊";
  }

  return enqueueAIRequest(adminId, async () => {
    let contents: any = lastMessage || "I sent a message.";

    if (mediaBase64 && mimeType) {
      contents = [
        { inlineData: { data: mediaBase64, mimeType: mimeType } },
        { text: lastMessage || "Analyze this." }
      ];
    }

    const text = await generateWithRetry(
      ai,
      settings.geminiModel || "gemini-2.0-flash",
      contents,
      systemPrompt,
      adminId
    );

    if (text) return text;
    return "Maazrat, system busy hai. Thodi der mein reply karta hoon.";
  });
}

export async function generateAdminActionMessage(
  adminId: string,
  userId: string,
  action: 'VERIFY' | 'REJECT',
  customReason?: string
) {
  const ai = await getAIClient(adminId);
  const session = await dbService.getSession(adminId, userId);
  const history = await dbService.getMessages(adminId, userId);

  if (!session || !ai) return null;

  const systemPrompt = `You are the owner of a Pakistani online store reaching out to a customer on WhatsApp.

Situation: Their payment has just been ${action === 'VERIFY' ? 'VERIFIED and APPROVED ✅' : 'REVIEWED and there is an ISSUE ❌'}.
${customReason ? `Detail: ${customReason}` : ''}

${action === 'VERIFY'
  ? 'Write a warm, celebratory 2-line message confirming their order. Make them feel excited and reassured — they made a great decision. Mention next steps briefly (e.g., dispatch timing). Roman Urdu + natural English.'
  : 'Write a calm, respectful 2-line message explaining there was an issue with the payment, without making them feel accused or embarrassed. Offer a clear next step to resolve it. Roman Urdu + natural English. Never sound cold or transactional.'}

Style rules: Keep it under 2 lines. Natural WhatsApp tone. One emoji maximum. Sound like a human who genuinely cares, not an automated notification.`;

  const settings = await dbService.getSettings(adminId);

  return enqueueAIRequest(adminId, async () => {
    const text = await generateWithRetry(
      ai,
      settings.geminiModel || "gemini-2.0-flash",
      [{ text: "Generate the notification message now." }],
      systemPrompt,
      adminId
    );
    return text;
  });
}

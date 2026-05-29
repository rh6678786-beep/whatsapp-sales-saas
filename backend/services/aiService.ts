import { GoogleGenAI } from "@google/genai";
import { SalesState, Product, Message } from "../../src/types";
import { dbService } from "./dbService";

const LANGUAGE_MAP: Record<string, { name: string; instruction: string; adminActionInstruction: string }> = {
  ur: {
    name: "Urdu (Roman)",
    instruction: `LANGUAGE: Roman Urdu (Urdu in English script) mixed with natural everyday English — exactly how business owners text on WhatsApp in Pakistan.

REQUIRED TONE:
- Informal, warm, and confident. Use natural filler words: "honestly", "dekho", "sach batao", "yaar", "InshaAllah"
- Mix English words naturally: "Yeh waala best seller hai!", "Quality pe koi compromise nahi"
- NEVER be formal or use pure Urdu script — this is a WhatsApp chat, not a letter

EXAMPLES (match this style precisely):
✓ "Ji bilkul, yeh waala best seller hai! Kal tak delivery ho jaye gi, InshaAllah."
✓ "Honestly sir, quality pe koi compromise nahi hai hamara. Aap ko pasand aa jaye ga."
✓ "Yeh limited stock hai — last month poora khatam ho gaya tha. Abhi order kar lein?"`,
    adminActionInstruction: "Roman Urdu + natural English. Warm, confident owner tone. Never sound cold or transactional.",
  },
  en: {
    name: "English",
    instruction: `LANGUAGE: Natural conversational English.

REQUIRED TONE:
- Warm, professional, and approachable — like a helpful boutique owner, not a corporation
- Use contractions naturally: "I'll", "you'll", "that's", "we're", "it's"
- Keep sentences short and conversational. Think of how a friend who runs a store would text you.
- Use occasional casual phrasing: "honestly", "to be honest", "the thing is", "here's the deal"

EXAMPLES (match this style precisely):
✓ "Honestly, this one's our bestseller right now. You'll love the quality — I'll send you the details!"
✓ "That's a great pick! It's in stock and I can get it to you by Wednesday."
✓ "Here's the deal — I can do Rs. 2500 if you order today. That's our best price."`,
    adminActionInstruction: "Natural English. Warm and professional boutique owner tone.",
  },
  ar: {
    name: "العربية (Arabic)",
    instruction: `LANGUAGE: Arabic (العربية) — conversational dialect preferred over formal Fus'ha.

REQUIRED TONE:
- Warm, respectful, and personal — like a trusted shopkeeper who knows their customer
- Use polite Arabic greetings: "السلام عليكم", "كيف حالك", "الله يبارك فيك"
- Keep it conversational, not formal. WhatsApp Arabic is different from written Arabic.
- Avoid overly classical or religious phrasing unless culturally appropriate

EXAMPLES (match this style precisely):
✓ "السلام عليكم! هذا المنتج متوفر حالياً — الجودة ممتازة، أضمنه لك شخصياً."
✓ "عندنا عرض خاص اليوم فقط — السعر الأصلي ٣٠٠٠ والسعر الحالي ٢٢٠٠. فرصة لا تعوض!"
✓ "تمام، حجزتك الطلبية. تواصل معي إذا احتجت أي مساعدة."`,
    adminActionInstruction: "Respond in conversational Arabic. Warm, respectful shopkeeper tone.",
  },
  hi: {
    name: "हिन्दी (Hindi)",
    instruction: `LANGUAGE: Hindi (हिन्दी) — conversational Hindi, not pure Sanskritized Hindi.

REQUIRED TONE:
- Warm, approachable local shopkeeper tone
- Mix common English words naturally: "quality", "deal", "stock", "price", "delivery"
- Use Hindi phrases: "क्या बात करें", "देखो", "सच कहूँ तो", "बिल्कुल"
- Keep it natural — how people actually speak Hindi in business conversations

EXAMPLES (match this style precisely):
✓ "बिल्कुल! ये वाला हमारा best seller है — quality एकदम top class है, आपको पसंद आएगा।"
✓ "सच कहूँ तो, ये limited stock है। कल तक delivery हो जाएगी।"
✓ "आपके लिए special deal लेकर आया हूँ — Rs. 2000 में दे रहे हैं।"`,
    adminActionInstruction: "Respond in conversational Hindi. Warm and friendly shopkeeper tone.",
  },
  bn: {
    name: "বাংলা (Bengali)",
    instruction: `LANGUAGE: Bengali (বাংলা) — conversational Bangladeshi Bengali, not overly formal Sadhu Bhasa.

REQUIRED TONE:
- Warm, friendly, and personal like a trusted local store owner
- Use natural Bengali expressions: "আসসালামু আলাইকুম", "কেমন আছেন", "দেখুন", "বিশ্বাস করুন"
- Mix common English words naturally: "quality", "deal", "delivery", "price"
- Keep sentences short — WhatsApp is casual conversation, not a formal letter

EXAMPLES (match this style precisely):
✓ "আসসালামু আলাইকুম! এই প্রোডাক্টটা এখন available — quality আশ্চর্যজনক, আমি personally guarantee দিচ্ছি।"
✓ "বিশ্বাস করুন, এটা আমাদের best seller। কালকের মধ্যে delivery পেয়ে যাবেন।"
✓ "আপনার জন্য special offer নিয়ে এসেছি — মাত্র Rs. 1500 থেকে শুরু।"`,
    adminActionInstruction: "Respond in conversational Bengali. Warm and trustworthy tone.",
  },
  es: {
    name: "Español (Spanish)",
    instruction: `LANGUAGE: Spanish (Español) — conversational Latin American Spanish.

REQUIRED TONE:
- Warm, friendly, and personal — like a local shopkeeper who values their customers
- Use natural Spanish expressions: "¡Claro que sí!", "mire", "déjeme contarle", "la verdad"
- Use tú form (informal) unless context suggests usted is more appropriate
- Keep it approachable and conversational, not formal business letter style

EXAMPLES (match this style precisely):
✓ "¡Claro que sí! Este es nuestro más vendido — la calidad es excelente, se lo garantizo."
✓ "Mire, tengo una oferta especial para usted hoy — 20% de descuento si pide ahora."
✓ "La verdad es que este producto tiene una calidad increíble para el precio. Le va a encantar."`,
    adminActionInstruction: "Respond in Spanish. Warm and friendly shopkeeper tone.",
  },
  fr: {
    name: "Français (French)",
    instruction: `LANGUAGE: French (Français) — conversational, not overly academic.

REQUIRED TONE:
- Warm, polite, and personal — like a friendly boutique owner
- Use natural French expressions: "honnêtement", "croyez-moi", "je vous promets", "du coup"
- Use "vous" form for respect unless the conversation becomes very casual
- Keep it flowing and conversational, not formal business correspondence

EXAMPLES (match this style precisely):
✓ "Honnêtement, c'est notre meilleure vente en ce moment — la qualité est exceptionnelle."
✓ "Je vous promets, vous ne serez pas déçu. Je vous l'envoie aujourd'hui même !"
✓ "Du coup, j'ai une offre spéciale pour vous — 15% de réduction si vous commandez cette semaine."`,
    adminActionInstruction: "Respond in French. Warm, polite, and professional tone.",
  },
  zh: {
    name: "中文 (Chinese)",
    instruction: `LANGUAGE: Chinese (中文 / Mandarin) — conversational, not formal written Chinese.

REQUIRED TONE:
- Warm, professional, and respectful — like a helpful store associate
- Use natural Chinese expressions: "老实说", "您放心", "这个真的很不错", "您觉得怎么样"
- Use 您 (formal you) as default for respect, switch to 你 only if customer does first
- Keep sentences short and conversational for WhatsApp

EXAMPLES (match this style precisely):
✓ "老实说，这个是我们的热销款 — 质量非常好，我 personally 推荐给您。"
✓ "您放心，明天之前一定能送到。这个价格真的物超所值。"
✓ "今天下单的话，我给您一个特别优惠 — 原价3000，现在只要2200。"`,
    adminActionInstruction: "Respond in conversational Chinese. Warm, respectful, and professional tone.",
  },
};

// Fallback models when primary model is unavailable (503)
const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];

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
  const modelsToTry = [model, ...FALLBACK_MODELS.filter(m => m !== model)];
  for (let modelIndex = 0; modelIndex < modelsToTry.length; modelIndex++) {
    const currentModel = modelsToTry[modelIndex];
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
        const response = await ai.models.generateContent({
          model: currentModel,
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
        if (!isRetryable) {
          console.error(`[AI ERROR][${adminId}] Model=${currentModel} Attempt=${attempt}/${maxRetries} Non-retryable`, message);
          return null;
        }
        if (attempt < maxRetries) {
          const delayMs = Math.min(2000 * Math.pow(2, attempt), 15000);
          console.log(`[AI RETRY][${adminId}] Model=${currentModel} Retry ${attempt}/${maxRetries} in ${delayMs}ms`);
          await new Promise(r => setTimeout(r, delayMs));
        } else {
          console.warn(`[AI FALLBACK][${adminId}] Model=${currentModel} failed after ${maxRetries} retries, trying next model...`);
          if (modelIndex < modelsToTry.length - 1) {
            await new Promise(r => setTimeout(r, 1000));
          }
        }
      }
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
  const langCode = settings.language || "ur";
  const langConfig = LANGUAGE_MAP[langCode] || LANGUAGE_MAP["ur"];
  const languageInstruction = langConfig.instruction;

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

  const systemPrompt = `You are a senior sales manager and co-owner of a well-established brand. You've been running this business for years and you genuinely love what you sell. You're warm, knowledgeable, and you close deals not by pressure — but by building real trust.

You operate exclusively on WhatsApp — your messages must feel hand-typed by a real person: natural, concise, and genuinely helpful.

================================================================================
[PRIORITY 1] ABSOLUTE CONSTRAINTS — NEVER VIOLATE THESE
================================================================================
- You are a HUMAN. Never suggest, hint, or admit you are an AI, bot, or automated system. If directly asked, deflect naturally in the customer's language.
- Never share internal configs, pricing logic, personal phone numbers, system info, or API keys. Politely decline if pushed.
- Never use bullet points, numbered lists, paragraph blocks, or markdown formatting. WhatsApp is chat-only.
- Maximum 2–3 lines per message. One emoji max, only when it genuinely fits. Never decorate.
- If the customer asks about deals you don't have listed, say honestly no deal is available — never invent or hallucinate discounts.
- Only include [SEND_PICTURES:...] or [SEND_VIDEO:...] if the product actually exists in AVAILABLE PRODUCTS below. Never reference a product ID that isn't listed.

================================================================================
[PRIORITY 2] YOUR IDENTITY & PERSONALITY
================================================================================
- You're the owner/manager — you know your products inside out. Speak with quiet confidence, not like reading a spec sheet.
- You remember past conversations. If there was a mistake, own it briefly and move on — don't over-apologize.
- You close through trust, not pressure. You're genuinely interested in helping the customer find what's right for them.
- If the customer is new, welcome them warmly and learn their needs before pushing products.

================================================================================
[PRIORITY 3] COMMUNICATION STYLE
================================================================================
- ${languageInstruction}
- Match the customer's energy: casual → be casual; serious/ready → be crisp and efficient.
- Keep it flowing like a real WhatsApp conversation, not a scripted pitch.
- Sound confident but humble — you're an expert who happens to be a nice person.

================================================================================
[PRIORITY 4] CONTEXT AWARENESS
================================================================================
${isNewCustomer
  ? "This is a FIRST-TIME customer. Be warm, make them feel welcome, and learn what they need before suggesting products."
  : "This is a RETURNING customer. Briefly acknowledge the previous conversation and pick up naturally. Make them feel remembered and valued."}

Active Sales State: ${state}
${state === 'PAYMENT_AWAITING' ? `▸ The customer is ready to pay. Make the payment step feel easy and safe — not like a demand.
  Explain the advance payment naturally. Example tone:
  "It's just a small advance of Rs.${settings.advanceAmount || 300} to lock your order. You can send it here:"
  Active payment channels:${paymentDetails}
  After sharing, ask them to send the payment screenshot or transaction ID.
  NEVER sound demanding. Keep it smooth and normal.` : ''}

${state === 'NEGOTIATING' ? `▸ The customer is negotiating. Stay firm on value, not price. Justify the quality, offer small concessions if needed, but know your floor.` : ''}

Throughout the conversation, naturally collect the customer's name and delivery address when appropriate. If you don't know their name yet, ask casually. Before confirming the order, confirm the delivery address.

================================================================================
[PRIORITY 5] LEAD QUALIFICATION SIGNALS — ADAPT YOUR APPROACH
================================================================================
Lead Score: ${leadQualificationData?.metadata?.leadScore || 0}/100 | Status: ${leadQualificationData?.metadata?.leadStatus || 'COLD'}
${leadQualificationData?.metadata?.budget ? `Budget: ${leadQualificationData.metadata.budget}` : ''}
${leadQualificationData?.metadata?.urgencyLevel ? `Urgency: ${leadQualificationData.metadata.urgencyLevel}` : ''}
Use Case: ${leadQualificationData?.metadata?.useCase || 'Unknown'} | Messages: ${leadQualificationData?.metadata?.messageCount || 0}

ADAPTATION RULES:
- HOT lead (score 70+): Be direct, confirm details, close efficiently. They're ready.
- WARM lead (score 40–69): Build value, address objections, gently move toward close.
- COLD lead (score < 40): Focus on rapport and understanding needs first. Don't push.
- High urgency: Prioritize speed and availability. Low urgency: Focus on value and quality.
- Budget known: Recommend products within budget. Budget unknown: Explore before quoting.

================================================================================
[PRIORITY 6] AVAILABLE PRODUCTS — ONLY REFERENCE THESE IDs
================================================================================
${topProducts.map(p => `• [${p.id}] ${p.name} — Rs. ${p.price}`).join("\n")}

To send product pictures: Include [SEND_PICTURES:productId] in your response (e.g. [SEND_PICTURES:abc-123])
To send a product video: Include [SEND_VIDEO:productId] in your response (e.g. [SEND_VIDEO:abc-123])
You may send BOTH pictures and a video together if available.

================================================================================
[PRIORITY 7] CONVERSATION HISTORY (Last 5)
================================================================================
${history.slice(-5).map(m => `${m.role === 'user' ? '👤 Customer' : '🧑‍💼 You'}: ${m.text}`).join("\n")}

Customer's Last Message: "${lastMessage}"
${dealsSection}`;

  if (!ai) {
    return "Hello! How can I help you today? 😊";
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
    return null;
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

  const settings = await dbService.getSettings(adminId);
  const langCode = settings.language || "ur";
  const langConfig = LANGUAGE_MAP[langCode] || LANGUAGE_MAP["ur"];
  const adminActionInstruction = langConfig.adminActionInstruction;

  const systemPrompt = `You are the owner of an online store personally reaching out to a customer on WhatsApp. This is a real human conversation, not an automated notification.

ABSOLUTE CONSTRAINT — NEVER VIOLATE:
You are HUMAN. Never mention or imply this is an automated message, system-generated, or AI-based. Sound like you personally checked their payment and are now reaching out.

SITUATION: Their payment has just been ${action === 'VERIFY' ? 'VERIFIED and APPROVED ✅' : 'REVIEWED and there is an ISSUE ❌'}.
${customReason ? `Additional detail: ${customReason}` : ''}

YOUR RESPONSE MUST:
${action === 'VERIFY'
  ? '- Confirm their order warmly and make them feel excited about their purchase\n- Mention the next step briefly (dispatch timing, delivery estimate)\n- Make them feel they made a great decision — confident reassurance, not desperate flattery\n- Keep it to exactly 2 lines, natural WhatsApp tone, one emoji max'
  : '- Calmly explain the issue without making them feel accused or embarrassed\n- Offer one clear, actionable next step to resolve it\n- Keep your tone helpful and solution-oriented, not cold or transactional\n- Keep it to exactly 2 lines, natural WhatsApp tone, one emoji max'}

LANGUAGE & STYLE:
Respond in the customer's language. ${adminActionInstruction}

FINAL CHECK:
- Does this sound like a real person texting a customer they personally know?
- Would the customer feel genuinely cared for, not mass-notified?
- NO system language, NO buzzwords, NO corporate speak.`;

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

export async function generateEnhancedPost(adminId: string, text: string): Promise<string> {
  const ai = await getAIClient(adminId);
  const settings = await dbService.getSettings(adminId);
  
  if (!ai) {
    return text;
  }
  
  const systemPrompt = `You are an expert social media copywriter specializing in e-commerce conversions. Your task is to transform raw product details into a high-impact social media post optimized for engagement and sales.

OUTPUT REQUIREMENTS (strict):
- Compelling hook in the first line to stop the scroll
- 2–4 short paragraphs with line breaks for readability
- 3–5 relevant, trending hashtags at the bottom
- Exactly 3–5 emojis, used strategically (not decorative) — one near the hook, one near the CTA, rest supporting key benefits
- Include a clear call to action in every post

PRESERVATION RULES:
- Keep ALL factual product details (price, features, availability) accurate — never add, remove, or alter facts
- If the input contains specific numbers (price, discount %, dimensions), preserve them exactly
- Do NOT fabricate reviews, testimonials, or awards not present in the input

LANGUAGE:
- Match the input language exactly — if Roman Urdu, write in engaging Roman Urdu; if English, write in high-converting English
- Write in the same regional dialect/variation as the input

FORMAT:
[Hook line — attention grabbing]

[Body — 2-3 concise lines covering key benefits/features]

[Call to action — clear, urgent, friendly]

[3-5 hashtags — mix of broad + niche, trending where relevant]`;

  try {
    const response = await ai.models.generateContent({
      model: settings.geminiModel || "gemini-2.0-flash",
      contents: [{ text: `Enhance this raw text: "${text}"` }],
      config: { systemInstruction: systemPrompt, temperature: 0.8 },
    } as any);
    return response.text || text;
  } catch (error) {
    console.error("[AI POST ENHANCE ERROR]", error);
    return text;
  }
}

import { dbService } from "./dbService";
import { generateSalesResponse } from "./aiService";
import { Message, SalesState, Session } from "../../src/types";
import { LeadQualificationService } from "./leadQualificationService";
import { getSubscriptionStatus } from "./stripeService";
import { queueMessage } from "./aiRetryQueue";
import { generateEmbedding, storeEmbedding, searchSimilar } from "./embeddingService";
import { getLatestSummary, generateConversationSummary, extractCustomerPreferences, storeSummary, shouldGenerateSummary } from "./summarizationService";
import { getFullProductRecommendations } from "./recommendationService";
import { checkEscalationTriggers, isHandoffActive } from "./escalationService";
import { AILearningService } from "./aiLearningService";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("message-handler");

// ---- Customer opt-out keywords (multi-language) ----
const OPT_OUT_KEYWORDS = [
  "stop", "unsubscribe", "opt out", "opt-out", "block", "exit",
  "leave", "remove", "delete", "cancel", "enough", "no more",
  "dont send", "don't send", "stop it", "quit",
  // Urdu/Roman Urdu
  "band karo", "band kar", "nahi chahiye", "mujhe nahi chahiye",
  "bas karo", "bas kar", "ruko", "rukoo", "chhoro",
  "nahi bhejo", "mat bhejo", "bhejna band kar",
  // Hindi
  "band karo", "nahi chahiye", "mujhe nahi chahiye", "bas karo",
  // Arabic
  "توقف", "إلغاء الاشتراك", "لا ترسل", "كفى", "انسحاب",
  // Bengali
  "বন্ধ করুন", "পাঠাবেন না", "চাই না", "আমার চাই না",
  // Generic patterns (catch-all for "not interested" type messages)
  "not intrested", "not interested", "nahi", "no thanks",
  "no thank you", "not now", "bothering", "spam", "harass",
];

// ---- Re-subscribe keywords ----
const RESUBSCRIBE_KEYWORDS = [
  "start", "subscribe", "opt in", "opt-in", "yes", "i want",
  "mujhe chahiye", "fir se", "dobara", "phir se", "haan",
  // Arabic
  "اشتراك", "بدء", "نعم",
  // Bengali
  "আবার পাঠান", "সাবস্ক্রাইব", "হ্যাঁ",
];

function checkOptOut(text: string): string | null {
  const lower = text.toLowerCase().trim();
  if (lower.length < 3) return null;
  for (const keyword of OPT_OUT_KEYWORDS) {
    if (lower.includes(keyword)) {
      return keyword;
    }
  }
  return null;
}

function checkResubscribe(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (lower.length < 3) return false;
  return RESUBSCRIBE_KEYWORDS.some(k => lower.includes(k));
}

interface SimulatorData {
  session: Session;
  messages: Message[];
}

const simulatorStore = new Map<string, SimulatorData>();
const SIMULATOR_MAX_ENTRIES = 100;
const simulatorCleanup = setInterval(() => {
  if (simulatorStore.size > SIMULATOR_MAX_ENTRIES) {
    const keys = [...simulatorStore.keys()].slice(0, simulatorStore.size - SIMULATOR_MAX_ENTRIES);
    for (const key of keys) simulatorStore.delete(key);
  }
}, 60000);

// Cleanup intervals on process exit to prevent dangling handles
const cleanupSimulatorInterval = () => clearInterval(simulatorCleanup);
process.on("SIGTERM", cleanupSimulatorInterval);
process.on("SIGINT", cleanupSimulatorInterval);
process.on("SIGUSR2", cleanupSimulatorInterval);

if (process.env.NODE_ENV === "test" || process.env.VITEST) {
  clearInterval(simulatorCleanup);
}


export async function processIncomingMessage(
  adminId: string,
  userId: string, 
  body: string, 
  mediaUrl?: string, 
  mediaBase64?: string, 
  mimeType?: string, 
  userPhone?: string,
  source: 'whatsapp' | 'simulator' = 'whatsapp'
): Promise<{ text: string; images?: string[]; videos?: string[]; shouldBlockUser?: boolean }> {
  try {
    const isSimulator = source === 'simulator';

    // 1. Initialize/Get Session
    let session: Session | null;
    let history: Message[];
    if (isSimulator) {
      const simKey = `${adminId}:${userId}`;
      if (!simulatorStore.has(simKey)) {
        session = {
          id: userId,
          userId,
          state: SalesState.NEW,
          lastMessageAt: new Date().toISOString(),
          remindersCount: 0,
          metadata: { leadScore: 0, leadStatus: 'COLD' as const, messageCount: 0 }
        };
        simulatorStore.set(simKey, { session, messages: [] });
      }
      const simData = simulatorStore.get(simKey)!;
      session = simData.session;
      history = simData.messages;
    } else {
      session = await dbService.getSession(adminId, userId);
      if (!session) {
        // Check conversation limit before creating new session
        const sub = await dbService.getSubscription(adminId);
        const { plan } = await getSubscriptionStatus(adminId, sub);
        const { sessionsThisMonth } = await dbService.getUsageCounts(adminId);
        if (sessionsThisMonth >= plan.limits.maxSessionsPerMonth) {
          return {
            text: `Sorry, your plan's monthly conversation limit (${
              plan.limits.maxSessionsPerMonth
            }) has been reached. Your message has been queued — we'll respond as soon as you upgrade your plan. 🤝`,
            images: [],
            videos: [],
            shouldBlockUser: false,
          };
        }
        session = await dbService.createSession(adminId, userId);
      }
      history = await dbService.getMessages(adminId, userId);
    }

    // 2a. Opt-out / Block Check — customer can unsubscribe anytime
    if (!isSimulator && session) {
      if (session.isBlocked) {
        // If already blocked, check for resubscribe
        if (checkResubscribe(body)) {
          await dbService.updateSession(adminId, userId, { isBlocked: false });
          log.info({ adminId, userId }, "Customer resubscribed — unblocked");
        } else {
          // Blocked user sent a message — silently ignore
          log.info({ adminId, userId }, "Blocked user sent message — ignored");
          return { text: "", images: [], videos: [] };
        }
      }
    }

    // 2. Context & Settings
    const products = await dbService.getAllProducts(adminId);
    const settings = await dbService.getSettings(adminId);
    
    // 3. Lead Qualification
    const qualifiedSession = LeadQualificationService.updateSessionWithQualification(
      JSON.parse(JSON.stringify(session)),
      body
    );
    
    if (!isSimulator && qualifiedSession.metadata) {
      await dbService.updateSession(adminId, userId, {
        metadata: qualifiedSession.metadata,
      });
    }
    session.metadata = qualifiedSession.metadata;
    
    // 4. Save user message to DB first (before AI call, for queued retries)
    const now = Date.now();
    const userMsg: Message = {
      sessionId: userId,
      role: "user",
      text: body || (mediaBase64 ? "[Media]" : "Empty Message"),
      timestamp: new Date(now).toISOString()
    };

    if (!isSimulator) {
      await dbService.addMessage(adminId, userId, userMsg);
    }

    // 4b. Opt-out Check — after saving user message (admin can see why they left)
    if (!isSimulator && session) {
      const optOutKeyword = checkOptOut(body);
      if (optOutKeyword) {
        await dbService.updateSession(adminId, userId, { isBlocked: true });
        log.info({ adminId, userId, keyword: optOutKeyword }, "Customer opted out — blocked");
        return {
          text: body.length < 15
            ? "You've been unsubscribed. You won't receive any more messages from us. If you change your mind, just say 'start' anytime. 👍"
            : "Got it, we won't bother you again. If you ever want to come back, just say 'start'. 👍",
          shouldBlockUser: false,
        };
      }
    }

    // 5. Handoff Check — skip AI if handoff is active
    if (!isSimulator && isHandoffActive(session)) {
      log.info({ adminId, userId }, "Handoff active, skipping AI response");
      return { text: "", images: [], videos: [] };
    }

    // 6. Memory & Context Retrieval (RAG)
    const memoryConfig = settings.memoryConfig || { enabled: true, summarizationThreshold: 20, embeddingEnabled: true };
    let memorySummary: string | null = null;
    let memoryPreferences: Record<string, any> = {};
    let similarContexts: { text: string; role: string; sessionId: string; similarity: number }[] = [];

    if (memoryConfig.enabled && !isSimulator) {
      // Get latest summary for this session
      const summary = await getLatestSummary(adminId, userId);
      if (summary) {
        memorySummary = summary.summary;
        memoryPreferences = summary.customerPreferences || {};
      }

      // Generate embedding + search similar conversations (fire-and-forget the storage)
      if (memoryConfig.embeddingEnabled && body) {
        const embedding = await generateEmbedding(body, adminId);
        if (embedding) {
          similarContexts = await searchSimilar(adminId, embedding, 3);
        }
      }
    }

    const retrievedContext = {
      summary: memorySummary,
      preferences: memoryPreferences,
      similarContexts,
    };

    // 6. Get smart product recommendations + Generate AI Response
    const recommendations = await getFullProductRecommendations(adminId, body, session);
    const topProducts = recommendations.all.length > 0 ? recommendations.all : products.slice(0, 10);

    const responseText = await generateSalesResponse(
      adminId,
      session.state,
      history,
      body,
      topProducts,
      mediaBase64,
      mimeType,
      "Customer",
      qualifiedSession,
      retrievedContext
    );

    // If AI unavailable (all models failed), send fallback + queue for retry
    if (!responseText) {
      if (isSimulator) {
        const simKey = `${adminId}:${userId}`;
        const simData = simulatorStore.get(simKey);
        if (simData) simData.messages.push(userMsg);
        return { text: "Sorry, I'm a bit busy right now. I'll get back to you shortly!" };
      }
      queueMessage(adminId, userId, body, mediaBase64, mimeType);
      return { text: "Sorry, I'm a bit busy right now. I'll get back to you shortly!" };
    }

    // 6b. Check escalation triggers (AI-suggested or rule-based)
    if (!isSimulator && !session.metadata?.handoffTriggered) {
      const escalation = checkEscalationTriggers(session, responseText);
      if (escalation.shouldEscalate) {
        log.info({ adminId, userId, reason: escalation.reason, source: escalation.triggerSource }, "Escalation triggered");
        session.metadata = {
          ...session.metadata,
          handoffTriggered: true,
          handoffReason: escalation.reason,
          handoffSummary: escalation.summary || null,
          handoffTriggeredAt: new Date().toISOString(),
          aiPaused: true,
        };
        await dbService.updateSession(adminId, userId, { metadata: session.metadata } as any);

        // Send real-time WebSocket notification to admin dashboard
        try {
          const { emitToAdmin } = await import("../config/websocket.js");
          emitToAdmin(adminId, "handoff:new", {
            sessionId: userId,
            reason: escalation.reason,
            triggerSource: escalation.triggerSource,
            summary: escalation.summary || null,
            userId: session.userId,
            state: session.state,
            lastMessageAt: session.lastMessageAt,
            handoffTriggeredAt: new Date().toISOString(),
          });
          log.info({ adminId, userId, reason: escalation.reason }, "WebSocket handoff notification sent");
        } catch (wsErr) {
          log.warn({ err: (wsErr as Error).message, adminId, userId }, "Failed to send WebSocket handoff notification");
        }
      }
    }

    // 6c. AI Pattern Learning (fire-and-forget)
    if (!isSimulator) {
      const score = session.metadata?.leadScore || 0;
      const status = (session.metadata?.leadStatus || 'COLD') as 'HOT' | 'WARM' | 'COLD';
      AILearningService.initialize(adminId).then(() => {
        AILearningService.analyzeChat(body, responseText, score, status, adminId);
      }).catch((err) => log.warn({ err, adminId }, "AI learning fire-and-forget failed"));
    }

    // 7. Post-processing Actions
    let shouldBlock = false;
    let imagesToSend: string[] = [];
    let videosToSend: string[] = [];

    // Trigger: SEND_PICTURES
    const picMatch = responseText.match(/\[SEND_PICTURES:(.+?)\]/);
    if (picMatch) {
      const pid = picMatch[1];
      const product = products.find(p => p.id === pid);
      if (product && product.images) {
        imagesToSend = product.images.slice(0, 3);
      }
    }

    // Trigger: SEND_VIDEO
    const vidMatch = responseText.match(/\[SEND_VIDEO:(.+?)\]/);
    if (vidMatch) {
      const pid = vidMatch[1];
      const product = products.find(p => p.id === pid);
      if (product && product.videos) {
        videosToSend = product.videos.slice(0, 1);
      }
    }

    // Trigger: PAYMENT_SCREENSHOT
    if (responseText.includes("[PAYMENT_SCREENSHOT]")) {
      session.state = SalesState.PAYMENT_SENT;
      if (isSimulator) {
        const simKey = `${adminId}:${userId}`;
        const simData = simulatorStore.get(simKey);
        if (simData) simData.session = session;
      } else {
        await dbService.updateSession(adminId, userId, { state: SalesState.PAYMENT_SENT });
      }
    }

    // Trigger: BLOCK_USER
    if (responseText.includes("[BLOCK_USER]")) {
      shouldBlock = true;
      session.isBlocked = true;
      if (isSimulator) {
        const simKey = `${adminId}:${userId}`;
        const simData = simulatorStore.get(simKey);
        if (simData) simData.session = session;
      } else {
        await dbService.updateSession(adminId, userId, { isBlocked: true });
      }
    }

    // 8. Save Model Response
    const cleanResponse = responseText.replace(/\[.*?\]/g, "").trim();
    const modelMsg: Message = {
      sessionId: userId,
      role: "model",
      text: cleanResponse,
      timestamp: new Date(now + 1).toISOString()
    };

    if (isSimulator) {
      const simKey = `${adminId}:${userId}`;
      const simData = simulatorStore.get(simKey);
      if (simData) {
        simData.messages.push(modelMsg);
        simData.session = session;
      }
    } else {
      await dbService.addMessage(adminId, userId, modelMsg);
      if (videosToSend && videosToSend.length) {
        for (const vid of videosToSend) {
          const videoMsg = {
            sessionId: userId,
            role: 'model' as const,
            text: '',
            videoUrl: vid,
            timestamp: new Date().toISOString(),
          };
          await dbService.addMessage(adminId, userId, videoMsg);
        }
      }

      // 9. Memory Persistence (fire-and-forget, non-blocking)
      if (memoryConfig.enabled) {
        const totalMessages = history.length + 1; // +1 for current user message

        // Store embedding for user message
        if (memoryConfig.embeddingEnabled && body) {
          const userMsgId = userMsg.id || `${adminId}:${userId}:${now}`;
          generateEmbedding(body, adminId).then(emb => {
            if (emb) storeEmbedding(adminId, userId, userMsgId, "user", body, emb);
          }).catch((err) => log.warn({ err, adminId }, "User embedding fire-and-forget failed"));
        }

        // Store embedding for AI response
        if (memoryConfig.embeddingEnabled && cleanResponse) {
          const modelMsgId = modelMsg.id || `${adminId}:${userId}:${now + 1}`;
          generateEmbedding(cleanResponse, adminId).then(emb => {
            if (emb) storeEmbedding(adminId, userId, modelMsgId, "model", cleanResponse, emb);
          }).catch((err) => log.warn({ err, adminId }, "Model embedding fire-and-forget failed"));
        }

        // Trigger summarization at threshold
        const lastCount = (session.metadata as any)?.messageCount || 0;
        shouldGenerateSummary(totalMessages, lastCount).then(should => {
          if (should) {
            dbService.getMessages(adminId, userId).then(async (allMessages) => {
              const [summary, preferences] = await Promise.all([
                generateConversationSummary(adminId, userId, allMessages),
                extractCustomerPreferences(adminId, userId, allMessages),
              ]);
              if (summary) {
                await storeSummary(adminId, userId, summary, totalMessages, preferences);
              }
            }).catch((err) => log.warn({ err, adminId }, "Summarization persistence failed"));
          }
        }).catch((err) => log.warn({ err, adminId }, "Summary generation check failed"));
      }
    }

    return { 
      text: cleanResponse, 
      images: imagesToSend,
      videos: videosToSend,
      shouldBlockUser: shouldBlock 
    };
  } catch (error: any) {
    log.error({ err: error, adminId }, "Message handler error");
    return { text: "Sorry, there was a temporary technical issue. Please try again in a moment." };
  }
}

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

    // 5. Handoff Check — skip AI if handoff is active
    if (!isSimulator && isHandoffActive(session)) {
      console.log(`[HANDOFF][${adminId}] Handoff active for ${userId}, skipping AI response`);
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
        console.log(`[HANDOFF][${adminId}] Escalation triggered for ${userId}: ${escalation.reason} (${escalation.triggerSource})`);
        session.metadata = {
          ...session.metadata,
          handoffTriggered: true,
          handoffReason: escalation.reason,
          handoffSummary: escalation.summary || null,
          aiPaused: true,
        };
        await dbService.updateSession(adminId, userId, { metadata: session.metadata } as any);
      }
    }

    // 6c. AI Pattern Learning (fire-and-forget)
    if (!isSimulator) {
      const score = session.metadata?.leadScore || 0;
      const status = (session.metadata?.leadStatus || 'COLD') as 'HOT' | 'WARM' | 'COLD';
      AILearningService.initialize(adminId).then(() => {
        AILearningService.analyzeChat(body, responseText, score, status, adminId);
      }).catch(() => {});
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
          }).catch(() => {});
        }

        // Store embedding for AI response
        if (memoryConfig.embeddingEnabled && cleanResponse) {
          const modelMsgId = modelMsg.id || `${adminId}:${userId}:${now + 1}`;
          generateEmbedding(cleanResponse, adminId).then(emb => {
            if (emb) storeEmbedding(adminId, userId, modelMsgId, "model", cleanResponse, emb);
          }).catch(() => {});
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
            }).catch(() => {});
          }
        }).catch(() => {});
      }
    }

    return { 
      text: cleanResponse, 
      images: imagesToSend,
      videos: videosToSend,
      shouldBlockUser: shouldBlock 
    };
  } catch (error: any) {
    console.error(`[HANDLER ERROR][${adminId}]`, error.message);
    return { text: "Sorry, there was a temporary technical issue. Please try again in a moment. 😊" };
  }
}

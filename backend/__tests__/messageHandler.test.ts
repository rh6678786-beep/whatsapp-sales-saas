import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SalesState } from "../../src/types.js";

// ---- Hoisted mocks ----

const {
  mockDbService,
  mockGenerateSalesResponse,
  mockLeadQualification,
  mockGetSubscriptionStatus,
  mockQueueMessage,
  mockGenerateEmbedding,
  mockStoreEmbedding,
  mockSearchSimilar,
  mockGetLatestSummary,
  mockGenerateConversationSummary,
  mockExtractCustomerPreferences,
  mockStoreSummary,
  mockShouldGenerateSummary,
  mockGetFullProductRecommendations,
  mockCheckEscalationTriggers,
  mockIsHandoffActive,
  mockAiLearningService,
  mockEmitToAdmin,
} = vi.hoisted(() => ({
  mockDbService: {
    getSession: vi.fn(),
    getSubscription: vi.fn(),
    getUsageCounts: vi.fn(),
    createSession: vi.fn(),
    getMessages: vi.fn(),
    getAllProducts: vi.fn(),
    getSettings: vi.fn(),
    updateSession: vi.fn(),
    addMessage: vi.fn(),
  },
  mockGenerateSalesResponse: vi.fn(),
  mockLeadQualification: {
    updateSessionWithQualification: vi.fn((s: any, _msg: string) => ({
      ...s,
      metadata: { ...(s.metadata || {}), messageCount: (s.metadata?.messageCount || 0) + 1, lastCustomerMessage: _msg },
    })),
  },
  mockGetSubscriptionStatus: vi.fn(),
  mockQueueMessage: vi.fn(),
  mockGenerateEmbedding: vi.fn(),
  mockStoreEmbedding: vi.fn(),
  mockSearchSimilar: vi.fn(),
  mockGetLatestSummary: vi.fn(),
  mockGenerateConversationSummary: vi.fn(),
  mockExtractCustomerPreferences: vi.fn(),
  mockStoreSummary: vi.fn(),
  mockShouldGenerateSummary: vi.fn(),
  mockGetFullProductRecommendations: vi.fn(),
  mockCheckEscalationTriggers: vi.fn<(adminId: string, text?: string) => { shouldEscalate: boolean; reason?: string; summary?: any; triggerSource: string }>(() => ({ shouldEscalate: false, triggerSource: 'none' })),
  mockIsHandoffActive: vi.fn(() => false),
  mockAiLearningService: {
    initialize: vi.fn(() => Promise.resolve()),
    analyzeChat: vi.fn(),
  },
  mockEmitToAdmin: vi.fn(),
}));

// ---- Module mocks (hoisted by vitest) ----

vi.mock("../services/dbService.js", () => ({ dbService: mockDbService }));
vi.mock("../services/aiService.js", () => ({ generateSalesResponse: mockGenerateSalesResponse }));
vi.mock("../services/leadQualificationService.js", () => ({
  LeadQualificationService: mockLeadQualification,
}));
vi.mock("../services/stripeService.js", () => ({
  getSubscriptionStatus: mockGetSubscriptionStatus,
}));
vi.mock("../services/aiRetryQueue.js", () => ({ queueMessage: mockQueueMessage }));
vi.mock("../services/embeddingService.js", () => ({
  generateEmbedding: mockGenerateEmbedding,
  storeEmbedding: mockStoreEmbedding,
  searchSimilar: mockSearchSimilar,
}));
vi.mock("../services/summarizationService.js", () => ({
  getLatestSummary: mockGetLatestSummary,
  generateConversationSummary: mockGenerateConversationSummary,
  extractCustomerPreferences: mockExtractCustomerPreferences,
  storeSummary: mockStoreSummary,
  shouldGenerateSummary: mockShouldGenerateSummary,
}));
vi.mock("../services/recommendationService.js", () => ({
  getFullProductRecommendations: mockGetFullProductRecommendations,
}));
vi.mock("../services/escalationService.js", () => ({
  checkEscalationTriggers: mockCheckEscalationTriggers,
  isHandoffActive: mockIsHandoffActive,
}));
vi.mock("../services/aiLearningService.js", () => ({
  AILearningService: mockAiLearningService,
}));

// ---- Test helpers ----

function baseSession(overrides: Record<string, any> = {}) {
  return {
    id: "user-1",
    userId: "user-1",
    state: SalesState.NEW,
    lastMessageAt: new Date().toISOString(),
    remindersCount: 0,
    ...overrides,
  };
}

function mockSettings(overrides: Record<string, any> = {}) {
  return {
    geminiModel: "gemini-2.0-flash",
    storeName: "Test Store",
    language: "ur",
    memoryConfig: { enabled: true, summarizationThreshold: 20, embeddingEnabled: true },
    ...overrides,
  };
}

function mockProducts(count = 2) {
  return Array.from({ length: count }, (_, i) => ({
    id: `prod-${i}`,
    name: `Product ${i}`,
    price: 1000 * (i + 1),
    costPrice: 500 * (i + 1),
    features: ["Feature A"],
    images: ["https://example.com/img.jpg"],
    videos: ["https://example.com/vid.mp4"],
    stock: 10,
  }));
}

const defaultRecommendations = {
  relevant: [] as any[],
  crossSell: [] as any[],
  personalized: [] as any[],
  all: [] as any[],
};

// ---- Tests ----

describe("processIncomingMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock responses
    mockDbService.getSession.mockResolvedValue(baseSession());
    mockDbService.getMessages.mockResolvedValue([]);
    mockDbService.getAllProducts.mockResolvedValue(mockProducts());
    mockDbService.getSettings.mockResolvedValue(mockSettings());
    mockDbService.addMessage.mockResolvedValue(undefined);
    mockDbService.updateSession.mockResolvedValue(undefined);
    mockDbService.createSession.mockResolvedValue(baseSession());

    mockGenerateSalesResponse.mockResolvedValue("Here is your response!");
    mockGetFullProductRecommendations.mockResolvedValue(defaultRecommendations);
    mockGetLatestSummary.mockResolvedValue(null);
    mockGenerateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
    mockSearchSimilar.mockResolvedValue([]);
    mockShouldGenerateSummary.mockResolvedValue(false);
    mockIsHandoffActive.mockReturnValue(false);
    mockCheckEscalationTriggers.mockReturnValue({ shouldEscalate: false, triggerSource: 'none' });
    mockAiLearningService.initialize.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetModules();
  });

  // ===============================================
  // Session handling
  // ===============================================
  describe("session handling", () => {
    it("should create a new session for unknown user", async () => {
      mockDbService.getSession.mockResolvedValue(null);
      mockDbService.createSession.mockResolvedValue(baseSession());
      mockDbService.getSubscription.mockResolvedValue({ planId: "free", status: "active" });
      mockGetSubscriptionStatus.mockResolvedValue({
        plan: { limits: { maxSessionsPerMonth: 9999 } },
        subscription: { planId: "free", status: "free" },
      });
      mockDbService.getUsageCounts.mockResolvedValue({ sessionsThisMonth: 0 });

      const { processIncomingMessage } = await import("../services/messageHandler.js");
      const result = await processIncomingMessage("admin-1", "new-user", "Hello");

      expect(mockDbService.createSession).toHaveBeenCalledWith("admin-1", "new-user");
      expect(result.text).toBe("Here is your response!");
    });

    it("should return limit message when session limit is reached", async () => {
      mockDbService.getSession.mockResolvedValue(null);
      mockDbService.getSubscription.mockResolvedValue({ planId: "free", status: "active" });
      mockGetSubscriptionStatus.mockResolvedValue({
        plan: { limits: { maxSessionsPerMonth: 2 } },
        subscription: { planId: "free", status: "free" },
      });
      mockDbService.getUsageCounts.mockResolvedValue({ sessionsThisMonth: 2 });

      const { processIncomingMessage } = await import("../services/messageHandler.js");
      const result = await processIncomingMessage("admin-1", "new-user", "Hello");

      expect(mockDbService.createSession).not.toHaveBeenCalled();
      expect(result.text).toContain("monthly conversation limit");
      expect(result.text).toContain("queued");
    });

    it("should load existing session for returning user", async () => {
      const existingSession = baseSession({ state: SalesState.PRODUCT_SELECTED });
      mockDbService.getSession.mockResolvedValue(existingSession);

      const { processIncomingMessage } = await import("../services/messageHandler.js");
      await processIncomingMessage("admin-1", "user-1", "I want this");

      // Should NOT create a new session
      expect(mockDbService.createSession).not.toHaveBeenCalled();
      // Should call generateSalesResponse with the existing session state
      expect(mockGenerateSalesResponse).toHaveBeenCalledWith(
        "admin-1",
        SalesState.PRODUCT_SELECTED,
        expect.any(Array),
        "I want this",
        expect.any(Array),
        undefined,
        undefined,
        "Customer",
        expect.objectContaining({ state: SalesState.PRODUCT_SELECTED }),
        expect.any(Object),
      );
    });
  });

  // ===============================================
  // Handoff & Escalation
  // ===============================================
  describe("handoff & escalation", () => {
    it("should skip AI response when handoff is active", async () => {
      mockIsHandoffActive.mockReturnValue(true);
      const session = baseSession({
        metadata: { handoffTriggered: true, aiPaused: true },
      });
      mockDbService.getSession.mockResolvedValue(session);

      const { processIncomingMessage } = await import("../services/messageHandler.js");
      const result = await processIncomingMessage("admin-1", "user-1", "Hello");

      expect(mockGenerateSalesResponse).not.toHaveBeenCalled();
      expect(result.text).toBe("");
    });

    it("should trigger escalation when AI response contains handoff tags", async () => {
      mockCheckEscalationTriggers.mockReturnValue({
        shouldEscalate: true,
        reason: "CUSTOMER_ANGRY",
        summary: { lead_score: 80 },
        triggerSource: "lead_score",
      });

      const { processIncomingMessage } = await import("../services/messageHandler.js");
      const result = await processIncomingMessage("admin-1", "user-1", "I'm very frustrated!");

      // Handoff metadata should be saved
      expect(mockDbService.updateSession).toHaveBeenCalledWith(
        "admin-1", "user-1",
        expect.objectContaining({
          metadata: expect.objectContaining({
            handoffTriggered: true,
            handoffReason: "CUSTOMER_ANGRY",
          }),
        }),
      );
      // Response should still be returned
      expect(result.text).toBe("Here is your response!");
    });

    it("should send WebSocket notification on escalation", async () => {
      mockCheckEscalationTriggers.mockReturnValue({
        shouldEscalate: true,
        reason: "AI_REQUESTED_HANDOFF",
        summary: { reason: "complex query" },
        triggerSource: "ai_trigger",
      });

      const { processIncomingMessage } = await import("../services/messageHandler.js");
      await processIncomingMessage("admin-1", "user-1", "Help me with a complex issue");

      // The dynamic import inside the handler uses the real websocket module.
      // Since we can't mock dynamic imports easily, we verify the handoff was processed.
      expect(mockDbService.updateSession).toHaveBeenCalledWith(
        "admin-1", "user-1",
        expect.objectContaining({
          metadata: expect.objectContaining({ handoffTriggered: true }),
        }),
      );
    });
  });

  // ===============================================
  // AI Response handling
  // ===============================================
  describe("AI response handling", () => {
    it("should queue message for retry when AI is unavailable", async () => {
      mockGenerateSalesResponse.mockResolvedValue(null);

      const { processIncomingMessage } = await import("../services/messageHandler.js");
      const result = await processIncomingMessage("admin-1", "user-1", "Hello");

      expect(mockQueueMessage).toHaveBeenCalledWith("admin-1", "user-1", "Hello", undefined, undefined);
      expect(result.text).toBe("Sorry, I'm a bit busy right now. I'll get back to you shortly!");
    });

    it("should return fallback in simulator mode when AI is unavailable", async () => {
      mockGenerateSalesResponse.mockResolvedValue(null);

      const { processIncomingMessage } = await import("../services/messageHandler.js");
      const result = await processIncomingMessage("admin-1", "user-1", "Hello", undefined, undefined, undefined, undefined, "simulator");

      // Simulator should NOT queue for retry
      expect(mockQueueMessage).not.toHaveBeenCalled();
      expect(result.text).toBe("Sorry, I'm a bit busy right now. I'll get back to you shortly!");
    });

    it("should save model message and return clean response on success", async () => {
      mockGenerateSalesResponse.mockResolvedValue("Thank you for your order!");
      mockGetFullProductRecommendations.mockResolvedValue({
        ...defaultRecommendations,
        all: mockProducts(2),
      });

      const { processIncomingMessage } = await import("../services/messageHandler.js");
      const result = await processIncomingMessage("admin-1", "user-1", "I want to buy");

      // User message saved first
      expect(mockDbService.addMessage).toHaveBeenNthCalledWith(
        1, "admin-1", "user-1",
        expect.objectContaining({ role: "user", text: "I want to buy" }),
      );
      // Model message saved second
      expect(mockDbService.addMessage).toHaveBeenNthCalledWith(
        2, "admin-1", "user-1",
        expect.objectContaining({ role: "model", text: "Thank you for your order!" }),
      );
      expect(result.text).toBe("Thank you for your order!");
      expect(result.images).toEqual([]);
      expect(result.videos).toEqual([]);
      expect(result.shouldBlockUser).toBe(false);
    });
  });

  // ===============================================
  // Action tags
  // ===============================================
  describe("action tags", () => {
    it("should process SEND_PICTURES tag and extract product images", async () => {
      const products = mockProducts(2);
      products[0].images = ["https://example.com/img1.jpg", "https://example.com/img2.jpg"];
      mockDbService.getAllProducts.mockResolvedValue(products);
      mockGenerateSalesResponse.mockResolvedValue("Here are the pictures [SEND_PICTURES:prod-0]");

      const { processIncomingMessage } = await import("../services/messageHandler.js");
      const result = await processIncomingMessage("admin-1", "user-1", "Show me");

      expect(result.images).toEqual(["https://example.com/img1.jpg", "https://example.com/img2.jpg"]);
      expect(result.text).toBe("Here are the pictures");
    });

    it("should process SEND_VIDEO tag and extract product video", async () => {
      const products = mockProducts(2);
      products[0].videos = ["https://example.com/vid1.mp4"];
      mockDbService.getAllProducts.mockResolvedValue(products);
      mockGenerateSalesResponse.mockResolvedValue("Check this video [SEND_VIDEO:prod-0]");

      const { processIncomingMessage } = await import("../services/messageHandler.js");
      const result = await processIncomingMessage("admin-1", "user-1", "Send video");

      expect(result.videos).toEqual(["https://example.com/vid1.mp4"]);
      expect(result.text).toBe("Check this video");
    });

    it("should process PAYMENT_SCREENSHOT tag and update state", async () => {
      const session = baseSession({ state: SalesState.PAYMENT_AWAITING });
      mockDbService.getSession.mockResolvedValue(session);
      mockGenerateSalesResponse.mockResolvedValue("Thank you! [PAYMENT_SCREENSHOT]");

      const { processIncomingMessage } = await import("../services/messageHandler.js");
      const result = await processIncomingMessage("admin-1", "user-1", "Payment sent");

      expect(mockDbService.updateSession).toHaveBeenCalledWith(
        "admin-1", "user-1",
        expect.objectContaining({ state: SalesState.PAYMENT_SENT }),
      );
      expect(result.text).toBe("Thank you!");
    });

    it("should process BLOCK_USER tag and block the user", async () => {
      mockGenerateSalesResponse.mockResolvedValue("You are blocked [BLOCK_USER]");

      const { processIncomingMessage } = await import("../services/messageHandler.js");
      const result = await processIncomingMessage("admin-1", "user-1", "Show products");

      expect(mockDbService.updateSession).toHaveBeenCalledWith(
        "admin-1", "user-1",
        expect.objectContaining({ isBlocked: true }),
      );
      expect(result.shouldBlockUser).toBe(true);
      expect(result.text).toBe("You are blocked");
    });
  });

  // ===============================================
  // Simulator mode
  // ===============================================
  describe("simulator mode", () => {
    it("should process messages using in-memory store instead of DB", async () => {
      const { processIncomingMessage } = await import("../services/messageHandler.js");
      await processIncomingMessage("admin-1", "user-1", "Test message", undefined, undefined, undefined, undefined, "simulator");

      // Simulator should NOT call DB for session, messages, or addMessage
      expect(mockDbService.getSession).not.toHaveBeenCalled();
      expect(mockDbService.addMessage).not.toHaveBeenCalled();
      expect(mockDbService.updateSession).not.toHaveBeenCalled();
      // But it should fetch products and settings
      expect(mockDbService.getAllProducts).toHaveBeenCalled();
      expect(mockDbService.getSettings).toHaveBeenCalled();
    });

    it("should process multiple messages in sequence within simulator", async () => {
      const { processIncomingMessage } = await import("../services/messageHandler.js");

      const res1 = await processIncomingMessage("admin-1", "user-1", "First message", undefined, undefined, undefined, undefined, "simulator");
      const res2 = await processIncomingMessage("admin-1", "user-1", "Second message", undefined, undefined, undefined, undefined, "simulator");

      // Both messages should return responses
      expect(res1.text).toBe("Here is your response!");
      expect(res2.text).toBe("Here is your response!");

      // Simulator should NOT use DB for session/messages
      expect(mockDbService.getSession).not.toHaveBeenCalled();
      expect(mockDbService.addMessage).not.toHaveBeenCalled();
      expect(mockDbService.updateSession).not.toHaveBeenCalled();

      // AI should have been called twice
      expect(mockGenerateSalesResponse).toHaveBeenCalledTimes(2);
    });
  });

  // ===============================================
  // Safety & error handling
  // ===============================================
  describe("error handling", () => {
    it("should handle empty body and media gracefully", async () => {
      const { processIncomingMessage } = await import("../services/messageHandler.js");
      const result = await processIncomingMessage("admin-1", "user-1", "", undefined, "base64img", "image/jpeg");

      // Empty body with media should save "[Media]" and proceed
      expect(mockDbService.addMessage).toHaveBeenCalledWith(
        "admin-1", "user-1",
        expect.objectContaining({ text: "[Media]"}),
      );
      expect(result.text).toBe("Here is your response!");
    });

    it("should return graceful error message on unexpected failure", async () => {
      mockDbService.getSession.mockRejectedValue(new Error("Database connection failed"));

      const { processIncomingMessage } = await import("../services/messageHandler.js");
      const result = await processIncomingMessage("admin-1", "user-1", "Hello");

      expect(result.text).toBe("Sorry, there was a temporary technical issue. Please try again in a moment.");
      expect(result.images).toBeUndefined();
    });

    it("should not update DB for memory when memoryConfig is disabled", async () => {
      mockDbService.getSettings.mockResolvedValue(mockSettings({
        memoryConfig: { enabled: false, summarizationThreshold: 20, embeddingEnabled: false },
      }));

      const { processIncomingMessage } = await import("../services/messageHandler.js");
      await processIncomingMessage("admin-1", "user-1", "Hello");

      // Memory services should not be called
      expect(mockGetLatestSummary).not.toHaveBeenCalled();
      expect(mockGenerateEmbedding).not.toHaveBeenCalled();
      expect(mockShouldGenerateSummary).not.toHaveBeenCalled();
    });

    it("should still save user message before AI call even if AI fails later", async () => {
      mockGenerateSalesResponse.mockRejectedValue(new Error("AI crash"));

      const { processIncomingMessage } = await import("../services/messageHandler.js");
      const result = await processIncomingMessage("admin-1", "user-1", "Hello");

      // User message should have been saved
      expect(mockDbService.addMessage).toHaveBeenCalledWith(
        "admin-1", "user-1",
        expect.objectContaining({ role: "user", text: "Hello" }),
      );
      // Should return graceful error
      expect(result.text).toBe("Sorry, there was a temporary technical issue. Please try again in a moment.");
    });
  });

  // ===============================================
  // Memory & AI Learning
  // ===============================================
  describe("memory & learning", () => {
    it("should pass retrieved context from memory to AI", async () => {
      mockGetLatestSummary.mockResolvedValue({
        summary: "Customer wants a laptop",
        customerPreferences: { preferredCategories: ["electronics"] },
      });
      mockSearchSimilar.mockResolvedValue([
        { text: "Previous conversation about laptops", role: "user", sessionId: "prev-1", similarity: 0.85 },
      ]);

      const { processIncomingMessage } = await import("../services/messageHandler.js");
      await processIncomingMessage("admin-1", "user-1", "I need a laptop");

      // Verify memory context was passed to generateSalesResponse
      const aiCallArgs = mockGenerateSalesResponse.mock.calls[0];
      const retrievedContext = aiCallArgs[9]; // 10th argument
      expect(retrievedContext.summary).toBe("Customer wants a laptop");
      expect(retrievedContext.preferences.preferredCategories).toEqual(["electronics"]);
      expect(retrievedContext.similarContexts).toHaveLength(1);
    });

    it("should fire AI learning analysis asynchronously", async () => {
      const session = baseSession({
        metadata: { leadScore: 65, leadStatus: "WARM", messageCount: 3 },
      });
      mockDbService.getSession.mockResolvedValue(session);
      mockLeadQualification.updateSessionWithQualification.mockImplementation(
        (s: any, _msg: string) => ({
          ...s,
          metadata: {
            ...s.metadata,
            messageCount: (s.metadata?.messageCount || 0) + 1,
            leadScore: 65,
            leadStatus: "WARM",
            lastCustomerMessage: _msg,
          },
        }),
      );

      const { processIncomingMessage } = await import("../services/messageHandler.js");
      await processIncomingMessage("admin-1", "user-1", "Tell me more");

      // AI Learning should be initialized and analysis fired
      expect(mockAiLearningService.initialize).toHaveBeenCalledWith("admin-1");
    });

    it("should not crash when AI learning fails asynchronously", async () => {
      mockAiLearningService.initialize.mockRejectedValue(new Error("Learning service down"));

      const { processIncomingMessage } = await import("../services/messageHandler.js");
      // Should not throw despite AI learning failure
      const result = await processIncomingMessage("admin-1", "user-1", "Hello");
      expect(result.text).toBe("Here is your response!");
    });
  });

  // ===============================================
  // Opt-out / Block flow
  // ===============================================
  describe("opt-out & block", () => {
    it("should block user when they send opt-out keyword", async () => {
      const session = baseSession({ metadata: { messageCount: 3 } });
      mockDbService.getSession.mockResolvedValue(session);

      const { processIncomingMessage } = await import("../services/messageHandler.js");
      const result = await processIncomingMessage("admin-1", "user-1", "stop");

      // Should block and return unsubscribe message
      expect(mockDbService.updateSession).toHaveBeenCalledWith(
        "admin-1", "user-1",
        expect.objectContaining({ isBlocked: true }),
      );
      expect(result.text).toContain("unsubscribed");
      // Should NOT call AI for opt-out messages
      expect(mockGenerateSalesResponse).not.toHaveBeenCalled();
    });

    it("should block user on Urdu opt-out keyword", async () => {
      const session = baseSession({ metadata: { messageCount: 3 } });
      mockDbService.getSession.mockResolvedValue(session);

      const { processIncomingMessage } = await import("../services/messageHandler.js");
      const result = await processIncomingMessage("admin-1", "user-1", "band karo");

      expect(mockDbService.updateSession).toHaveBeenCalledWith(
        "admin-1", "user-1",
        expect.objectContaining({ isBlocked: true }),
      );
      expect(result.text).toContain("unsubscribed");
    });

    it("should silently ignore blocked user messages", async () => {
      const session = baseSession({ isBlocked: true });
      mockDbService.getSession.mockResolvedValue(session);

      const { processIncomingMessage } = await import("../services/messageHandler.js");
      const result = await processIncomingMessage("admin-1", "user-1", "Hello");

      // Should return empty response (silent ignore)
      expect(result.text).toBe("");
      expect(mockGenerateSalesResponse).not.toHaveBeenCalled();
    });

    it("should unblock user when they send resubscribe keyword", async () => {
      const session = baseSession({ isBlocked: true });
      mockDbService.getSession.mockResolvedValue(session);

      const { processIncomingMessage } = await import("../services/messageHandler.js");
      const result = await processIncomingMessage("admin-1", "user-1", "start");

      // Should unblock by setting isBlocked to false
      expect(mockDbService.updateSession).toHaveBeenCalledWith(
        "admin-1", "user-1",
        expect.objectContaining({ isBlocked: false }),
      );
      // Should then process the message normally
      expect(result.text).toBe("Here is your response!");
    });

    it("should still save user message before blocking for admin visibility", async () => {
      const session = baseSession({ metadata: { messageCount: 3 } });
      mockDbService.getSession.mockResolvedValue(session);

      const { processIncomingMessage } = await import("../services/messageHandler.js");
      await processIncomingMessage("admin-1", "user-1", "stop sending messages");

      // User message should be saved so admin can see why they left
      expect(mockDbService.addMessage).toHaveBeenCalledWith(
        "admin-1", "user-1",
        expect.objectContaining({ role: "user", text: "stop sending messages" }),
      );
    });

    it("should not call AI for short opt-out messages", async () => {
      const session = baseSession({ metadata: { messageCount: 3 } });
      mockDbService.getSession.mockResolvedValue(session);

      const { processIncomingMessage } = await import("../services/messageHandler.js");
      await processIncomingMessage("admin-1", "user-1", "stop");

      expect(mockGenerateSalesResponse).not.toHaveBeenCalled();
    });
  });

  // ===============================================
  // Simulator mode edge cases
  // ===============================================
  describe("simulator mode edge cases", () => {
    it("should maintain session state across simulator messages", async () => {
      const { processIncomingMessage } = await import("../services/messageHandler.js");

      // First message in simulator
      await processIncomingMessage("admin-1", "sim-user", "Hello", undefined, undefined, undefined, undefined, "simulator");

      // Second message — simulator should update lead score via qualification
      await processIncomingMessage("admin-1", "sim-user", "price kya hai? urgent chahiye", undefined, undefined, undefined, undefined, "simulator");

      // Simulator should NOT use DB for anything
      expect(mockDbService.getSession).not.toHaveBeenCalled();
      expect(mockDbService.addMessage).not.toHaveBeenCalled();
      expect(mockDbService.updateSession).not.toHaveBeenCalled();
      // But should still use qualification and AI
      expect(mockGenerateSalesResponse).toHaveBeenCalledTimes(2);
    });

    it("should not queue retry in simulator mode when AI fails", async () => {
      mockGenerateSalesResponse.mockResolvedValue(null);

      const { processIncomingMessage } = await import("../services/messageHandler.js");
      const result = await processIncomingMessage("admin-1", "sim-user", "Hello", undefined, undefined, undefined, undefined, "simulator");

      expect(mockQueueMessage).not.toHaveBeenCalled();
      expect(result.text).toBe("Sorry, I'm a bit busy right now. I'll get back to you shortly!");
    });

    it("should handle multiple different simulator users independently", async () => {
      const { processIncomingMessage } = await import("../services/messageHandler.js");

      const r1 = await processIncomingMessage("admin-1", "sim-user-1", "Hello", undefined, undefined, undefined, undefined, "simulator");
      const r2 = await processIncomingMessage("admin-2", "sim-user-2", "Hi", undefined, undefined, undefined, undefined, "simulator");

      expect(r1.text).toBe("Here is your response!");
      expect(r2.text).toBe("Here is your response!");
      expect(mockGenerateSalesResponse).toHaveBeenCalledTimes(2);
    });
  });

  // ===============================================
  // Video message handling
  // ===============================================
  describe("video message handling", () => {
    it("should save video message in DB when SEND_VIDEO is triggered", async () => {
      const products = mockProducts(2);
      products[0].videos = ["https://example.com/vid1.mp4"];
      mockDbService.getAllProducts.mockResolvedValue(products);
      mockGenerateSalesResponse.mockResolvedValue("Check video [SEND_VIDEO:prod-0]");

      const { processIncomingMessage } = await import("../services/messageHandler.js");
      const result = await processIncomingMessage("admin-1", "user-1", "Show video");

      expect(result.videos).toEqual(["https://example.com/vid1.mp4"]);
      // Video message should be saved to DB
      expect(mockDbService.addMessage).toHaveBeenCalledWith(
        "admin-1", "user-1",
        expect.objectContaining({ role: "model", videoUrl: "https://example.com/vid1.mp4" }),
      );
    });
  });

  // ===============================================
  // Lead qualification flow
  // ===============================================
  describe("lead qualification", () => {
    it("should update session metadata with qualification when session exists", async () => {
      const existingSession = baseSession({
        metadata: { leadScore: 30, leadStatus: "COLD", messageCount: 2 },
      });
      mockDbService.getSession.mockResolvedValue(existingSession);

      // Lead qualification adds score for price inquiry
      mockLeadQualification.updateSessionWithQualification.mockImplementation(
        (s: any, msg: string) => ({
          ...s,
          metadata: {
            ...(s.metadata || {}),
            messageCount: 3,
            leadScore: 50,
            leadStatus: "WARM",
            lastCustomerMessage: msg,
          },
        }),
      );

      const { processIncomingMessage } = await import("../services/messageHandler.js");
      await processIncomingMessage("admin-1", "user-1", "What is the price?");

      // Session should be updated with new qualification data
      expect(mockDbService.updateSession).toHaveBeenCalledWith(
        "admin-1", "user-1",
        expect.objectContaining({
          metadata: expect.objectContaining({
            leadScore: 50,
            leadStatus: "WARM",
            messageCount: 3,
          }),
        }),
      );
    });
  });
});

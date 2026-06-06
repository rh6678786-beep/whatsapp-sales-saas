import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---- Hoisted mocks (required for vitest mock hoisting) ----

const {
  mockDbService,
  mockGenerateSalesResponse,
  mockSendWhatsAppMessage,
} = vi.hoisted(() => ({
  mockDbService: {
    getSession: vi.fn(),
    getMessages: vi.fn(),
    getAllProducts: vi.fn(),
    addMessage: vi.fn(),
  },
  mockGenerateSalesResponse: vi.fn(),
  mockSendWhatsAppMessage: vi.fn(),
}));

// ---- Module mocks (hoisted by vitest) ----

vi.mock("../services/dbService.js", () => ({
  dbService: mockDbService,
}));

vi.mock("../services/aiService.js", () => ({
  generateSalesResponse: mockGenerateSalesResponse,
}));

vi.mock("../lib/whatsappClient.js", () => ({
  sendWhatsAppMessage: mockSendWhatsAppMessage,
}));

// ---- Tests ----

describe("aiRetryQueue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    // Default mock implementations
    mockDbService.getSession.mockResolvedValue({ id: "user-1", userId: "user-1", state: "NEW", lastMessageAt: new Date().toISOString(), remindersCount: 0 });
    mockDbService.getMessages.mockResolvedValue([]);
    mockDbService.getAllProducts.mockResolvedValue([]);
    mockDbService.addMessage.mockResolvedValue(undefined);
    mockGenerateSalesResponse.mockResolvedValue("Test response");
    mockSendWhatsAppMessage.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  // ===============================================
  // queueMessage
  // ===============================================
  describe("queueMessage", () => {
    it("should add a message to the queue", async () => {
      const { queueMessage, startAiRetryProcessor } = await import("../services/aiRetryQueue.js");
      queueMessage("admin-1", "user-1", "Hello");
      startAiRetryProcessor();

      await vi.advanceTimersByTimeAsync(30000);

      expect(mockGenerateSalesResponse).toHaveBeenCalledTimes(1);
      expect(mockDbService.addMessage).toHaveBeenCalledTimes(1);
      expect(mockSendWhatsAppMessage).toHaveBeenCalledWith("admin-1", "user-1", "Test response");
    });

    it("should skip duplicate messages (same adminId + userId)", async () => {
      const { queueMessage, startAiRetryProcessor } = await import("../services/aiRetryQueue.js");

      queueMessage("admin-1", "user-1", "First");
      queueMessage("admin-1", "user-1", "Second"); // Duplicate — should be skipped

      startAiRetryProcessor();
      await vi.advanceTimersByTimeAsync(30000);

      // Only one processing attempt, using the first message body's context
      expect(mockGenerateSalesResponse).toHaveBeenCalledTimes(1);
    });

    it("should allow different users to queue independently", async () => {
      const { queueMessage, startAiRetryProcessor } = await import("../services/aiRetryQueue.js");

      queueMessage("admin-1", "user-1", "Hello");
      queueMessage("admin-1", "user-2", "Hi");

      startAiRetryProcessor();
      await vi.advanceTimersByTimeAsync(30000);

      // Both should be processed in a single tick
      expect(mockGenerateSalesResponse).toHaveBeenCalledTimes(2);
      expect(mockDbService.addMessage).toHaveBeenCalledTimes(2);
    });

    it("should queue with optional media parameters", async () => {
      const { queueMessage, startAiRetryProcessor } = await import("../services/aiRetryQueue.js");

      queueMessage("admin-1", "user-1", "Hello", "base64data", "image/jpeg");

      startAiRetryProcessor();
      await vi.advanceTimersByTimeAsync(30000);

      // generateSalesResponse should be called with media params
      expect(mockGenerateSalesResponse).toHaveBeenCalledWith(
        "admin-1",
        "NEW",
        [],
        "Hello",
        [],
        "base64data",
        "image/jpeg",
        "Customer",
        undefined,
      );
    });
  });

  // ===============================================
  // startAiRetryProcessor
  // ===============================================
  describe("startAiRetryProcessor", () => {
    it("should start processing queued messages on interval", async () => {
      const { queueMessage, startAiRetryProcessor } = await import("../services/aiRetryQueue.js");

      queueMessage("admin-1", "user-1", "Hello");
      startAiRetryProcessor();

      // First tick
      await vi.advanceTimersByTimeAsync(30000);
      expect(mockGenerateSalesResponse).toHaveBeenCalledTimes(1);

      // Second tick — queue is empty, so no more calls
      mockGenerateSalesResponse.mockClear();
      await vi.advanceTimersByTimeAsync(30000);
      expect(mockGenerateSalesResponse).not.toHaveBeenCalled();
    });

    it("should not start twice", async () => {
      const { queueMessage, startAiRetryProcessor } = await import("../services/aiRetryQueue.js");

      queueMessage("admin-1", "user-1", "Hello");
      startAiRetryProcessor();
      startAiRetryProcessor(); // Second call — should be no-op

      await vi.advanceTimersByTimeAsync(30000);

      // Still processes one message (the interval wasn't overwritten)
      expect(mockGenerateSalesResponse).toHaveBeenCalledTimes(1);
    });
  });

  // ===============================================
  // Processor logic
  // ===============================================
  describe("processor logic", () => {
    it("should handle session not found — remove from queue", async () => {
      const { queueMessage, startAiRetryProcessor } = await import("../services/aiRetryQueue.js");

      queueMessage("admin-1", "user-1", "Hello");
      mockDbService.getSession.mockResolvedValue(null); // Session doesn't exist

      startAiRetryProcessor();
      await vi.advanceTimersByTimeAsync(30000);

      // No AI call, no message sent
      expect(mockGenerateSalesResponse).not.toHaveBeenCalled();
      expect(mockDbService.addMessage).not.toHaveBeenCalled();
      expect(mockSendWhatsAppMessage).not.toHaveBeenCalled();

      // Next tick should have no work (item was removed)
      await vi.advanceTimersByTimeAsync(30000);
      // Still no calls
      expect(mockGenerateSalesResponse).not.toHaveBeenCalled();
    });

    it("should retry when generateSalesResponse returns null", async () => {
      const { queueMessage, startAiRetryProcessor } = await import("../services/aiRetryQueue.js");

      queueMessage("admin-1", "user-1", "Hello");
      mockGenerateSalesResponse.mockResolvedValue(null); // AI returns null

      startAiRetryProcessor();

      // 1st attempt — retryCount becomes 1
      await vi.advanceTimersByTimeAsync(30000);
      expect(mockGenerateSalesResponse).toHaveBeenCalledTimes(1);
      expect(mockDbService.addMessage).not.toHaveBeenCalled();

      // 2nd attempt — retryCount becomes 2
      await vi.advanceTimersByTimeAsync(30000);
      expect(mockGenerateSalesResponse).toHaveBeenCalledTimes(2);

      // Item should still be in the queue (re-queue should be blocked)
      await vi.advanceTimersByTimeAsync(30000);
      expect(mockGenerateSalesResponse).toHaveBeenCalledTimes(3);
    });

    it("should drop from queue after max retries (6)", async () => {
      const { queueMessage, startAiRetryProcessor } = await import("../services/aiRetryQueue.js");

      queueMessage("admin-1", "user-1", "Hello");
      mockGenerateSalesResponse.mockResolvedValue(null);

      startAiRetryProcessor();

      // Advance through 6 retry attempts (retryCount: 1→2→3→4→5→6)
      for (let i = 0; i < 6; i++) {
        await vi.advanceTimersByTimeAsync(30000);
      }
      // After 6 failures, retryCount=6 >= MAX_RETRIES=6, so it's dropped

      // 7th tick — item should be gone, no more calls
      await vi.advanceTimersByTimeAsync(30000);
      expect(mockGenerateSalesResponse).toHaveBeenCalledTimes(6);
    });

    it("should clean response text by removing tags", async () => {
      const { queueMessage, startAiRetryProcessor } = await import("../services/aiRetryQueue.js");

      queueMessage("admin-1", "user-1", "Hello");
      mockGenerateSalesResponse.mockResolvedValue("Thank you! [HANDOFF_TO_HUMAN:complex] [CHECK_ORDER:123]");

      startAiRetryProcessor();
      await vi.advanceTimersByTimeAsync(30000);

      // The message should be cleaned of tags before sending
      const addedMessage = mockDbService.addMessage.mock.calls[0][2];
      expect(addedMessage.text).toBe("Thank you!");
      expect(addedMessage.text).not.toContain("[HANDOFF_TO_HUMAN");
      expect(addedMessage.text).not.toContain("[CHECK_ORDER");

      // WhatsApp should receive the cleaned version
      expect(mockSendWhatsAppMessage).toHaveBeenCalledWith("admin-1", "user-1", "Thank you!");
    });

    it("should handle sendWhatsAppMessage failure gracefully", async () => {
      const { queueMessage, startAiRetryProcessor } = await import("../services/aiRetryQueue.js");

      queueMessage("admin-1", "user-1", "Hello");
      mockSendWhatsAppMessage.mockRejectedValue(new Error("Network error"));

      startAiRetryProcessor();
      await vi.advanceTimersByTimeAsync(30000);

      // Message should still have been saved to DB (addMessage called)
      expect(mockDbService.addMessage).toHaveBeenCalledTimes(1);
      // And the item should be removed from queue despite send failure
      // Verify by checking no further processing:
      mockGenerateSalesResponse.mockClear();
      await vi.advanceTimersByTimeAsync(30000);
      expect(mockGenerateSalesResponse).not.toHaveBeenCalled();
    });

    it("should handle errors during processing — retry then drop", async () => {
      const { queueMessage, startAiRetryProcessor } = await import("../services/aiRetryQueue.js");

      queueMessage("admin-1", "user-1", "Hello");
      // Simulate an error thrown from generateSalesResponse (not a null return)
      mockGenerateSalesResponse.mockRejectedValue(new Error("API timeout"));

      startAiRetryProcessor();

      // First attempt — error caught, retryCount becomes 1
      await vi.advanceTimersByTimeAsync(30000);
      expect(mockGenerateSalesResponse).toHaveBeenCalledTimes(1);

      // Advance through 5 more retries
      for (let i = 0; i < 5; i++) {
        await vi.advanceTimersByTimeAsync(30000);
      }

      // After 6 total attempts, item should be dropped
      expect(mockGenerateSalesResponse).toHaveBeenCalledTimes(6);

      // 7th tick — no more calls
      await vi.advanceTimersByTimeAsync(30000);
      expect(mockGenerateSalesResponse).toHaveBeenCalledTimes(6);
    });

    it("should do nothing on empty queue", async () => {
      const { startAiRetryProcessor } = await import("../services/aiRetryQueue.js");

      startAiRetryProcessor();
      await vi.advanceTimersByTimeAsync(30000);

      expect(mockGenerateSalesResponse).not.toHaveBeenCalled();
      expect(mockDbService.addMessage).not.toHaveBeenCalled();
      expect(mockSendWhatsAppMessage).not.toHaveBeenCalled();
    });

    it("should include sales state and products in the AI prompt", async () => {
      const { queueMessage, startAiRetryProcessor } = await import("../services/aiRetryQueue.js");

      queueMessage("admin-1", "user-1", "Price?");
      mockDbService.getSession.mockResolvedValue({ id: "user-1", userId: "user-1", state: "INTERESTED", lastMessageAt: new Date().toISOString(), remindersCount: 0 });
      mockDbService.getMessages.mockResolvedValue([
        { sessionId: "user-1", role: "user", text: "Hi", timestamp: new Date().toISOString() },
      ]);
      mockDbService.getAllProducts.mockResolvedValue([
        { id: "p1", name: "Widget", price: 10, costPrice: 5, features: ["red"], images: [], stock: 5 },
      ]);

      startAiRetryProcessor();
      await vi.advanceTimersByTimeAsync(30000);

      expect(mockGenerateSalesResponse).toHaveBeenCalledWith(
        "admin-1",
        "INTERESTED",
        expect.arrayContaining([expect.objectContaining({ role: "user", text: "Hi" })]),
        "Price?",
        expect.arrayContaining([expect.objectContaining({ id: "p1" })]),
        undefined,
        undefined,
        "Customer",
        undefined,
      );
    });

    it("should handle multiple items in a single tick", async () => {
      const { queueMessage, startAiRetryProcessor } = await import("../services/aiRetryQueue.js");

      queueMessage("admin-1", "user-1", "Hello");
      queueMessage("admin-1", "user-2", "Hi");
      queueMessage("admin-1", "user-3", "Hey");

      startAiRetryProcessor();
      await vi.advanceTimersByTimeAsync(30000);

      expect(mockGenerateSalesResponse).toHaveBeenCalledTimes(3);
      expect(mockDbService.addMessage).toHaveBeenCalledTimes(3);
      expect(mockSendWhatsAppMessage).toHaveBeenCalledTimes(3);
    });

    it("should pass media parameters through to AI", async () => {
      const { queueMessage, startAiRetryProcessor } = await import("../services/aiRetryQueue.js");

      queueMessage("admin-1", "user-1", "What is this?", "base64image", "image/png");

      startAiRetryProcessor();
      await vi.advanceTimersByTimeAsync(30000);

      expect(mockGenerateSalesResponse).toHaveBeenCalledWith(
        "admin-1", "NEW", [], "What is this?", [],
        "base64image", "image/png", "Customer", undefined,
      );
    });
  });
});

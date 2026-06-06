import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import BroadcastManager from "../components/BroadcastManager";

vi.mock("axios");

// Mock useFeatures hook
vi.mock("../hooks/useFeatures", () => ({
  useFeatures: vi.fn(),
}));

import { useFeatures } from "../hooks/useFeatures";

const mockNavigate = vi.fn();

function setupFeatures(enabled: boolean) {
  (useFeatures as any).mockReturnValue({
    broadcast: enabled,
    instagram: false,
    facebook: false,
    telegram: false,
    reEngagement: false,
    analytics: "none",
    aiPersona: false,
    whiteLabel: false,
    paymentVerification: false,
  });
}

function mockStats(activeUsers = 45) {
  (axios.get as any).mockImplementation((url: string) => {
    if (url === "/api/stats") return Promise.resolve({ data: { activeUsers } });
    return Promise.reject(new Error("Unknown URL: " + url));
  });
}

describe("BroadcastManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFeatures(true);
  });

  afterEach(() => {
    cleanup();
  });

  describe("Locked state", () => {
    it("shows 'Broadcast Locked' when feature is disabled", () => {
      setupFeatures(false);
      render(<BroadcastManager />);

      expect(screen.getByText("Broadcast Locked")).toBeTruthy();
      expect(
        screen.getByText(/Bulk broadcast messaging is available/)
      ).toBeTruthy();
    });

    it("shows View Plans button when locked", () => {
      setupFeatures(false);
      render(<BroadcastManager onNavigate={mockNavigate} />);

      const plansBtn = screen.getByText("View Plans");
      expect(plansBtn).toBeTruthy();
    });

    it("calls onNavigate when View Plans clicked", async () => {
      setupFeatures(false);
      render(<BroadcastManager onNavigate={mockNavigate} />);

      const user = userEvent.setup();
      await user.click(screen.getByText("View Plans"));

      expect(mockNavigate).toHaveBeenCalledWith("billing");
    });
  });

  describe("Header and reach", () => {
    it("renders Broadcast Center header when enabled", async () => {
      mockStats();
      render(<BroadcastManager />);

      await waitFor(() => {
        expect(screen.getByText("Broadcast Center")).toBeTruthy();
        expect(
          screen.getByText(/Reach your entire audience/)
        ).toBeTruthy();
      });
    });

    it("shows total reach count from API", async () => {
      mockStats(100);
      render(<BroadcastManager />);

      await waitFor(() => {
        expect(screen.getByText("100")).toBeTruthy();
      });
    });

    it("shows Total Reach label", async () => {
      mockStats();
      render(<BroadcastManager />);

      await waitFor(() => {
        expect(screen.getByText("Total Reach")).toBeTruthy();
      });
    });
  });

  describe("Templates", () => {
    it("renders all quick template buttons", async () => {
      mockStats();
      render(<BroadcastManager />);

      await waitFor(() => {
        expect(screen.getByText("Quick Templates")).toBeTruthy();
      });

      expect(screen.getByText("🌙 Eid Sale")).toBeTruthy();
      expect(screen.getByText("🔥 Stock Clearance")).toBeTruthy();
      expect(screen.getByText("👋 New Arrivals")).toBeTruthy();
      expect(screen.getByText("🛒 Flash Discount")).toBeTruthy();
      expect(screen.getByText("⭐ Request Review")).toBeTruthy();
    });

    it("populates message field when template is clicked", async () => {
      mockStats();
      render(<BroadcastManager />);

      const user = userEvent.setup();
      const eidBtn = await screen.findByText("🌙 Eid Sale");
      await user.click(eidBtn);

      const textarea = screen.getByPlaceholderText(
        /Start typing your viral marketing message/
      ) as HTMLTextAreaElement;
      expect(textarea.value).toContain("EID SALE");
    });
  });

  describe("Message composition", () => {
    it("shows textarea for composing message", async () => {
      mockStats();
      render(<BroadcastManager />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText(
            /Start typing your viral marketing message/
          )
        ).toBeTruthy();
      });
    });

    it("shows Anti-Ban protection notice", async () => {
      mockStats();
      render(<BroadcastManager />);

      await waitFor(() => {
        expect(screen.getByText(/Anti-Ban Protection/)).toBeTruthy();
      });
    });

    it("disables Send button when message is empty", async () => {
      mockStats();
      render(<BroadcastManager />);

      await waitFor(() => {
        const sendBtn = screen.getByText("Send Broadcast").closest("button");
        expect(sendBtn?.disabled).toBe(true);
      });
    });

    it("enables Send button when message is typed", async () => {
      mockStats();
      render(<BroadcastManager />);

      const user = userEvent.setup();
      const textarea = await screen.findByPlaceholderText(
        /Start typing your viral marketing message/
      );
      await user.type(textarea, "Test broadcast message");

      await waitFor(() => {
        const sendBtn = screen.getByText("Send Broadcast").closest("button");
        expect(sendBtn?.disabled).toBe(false);
      });
    });
  });

  describe("Broadcast sending", () => {
    it("calls broadcast API on send", async () => {
      mockStats();
      // First call is for stats, second for broadcast
      (axios.post as any).mockResolvedValueOnce({
        data: { message: "Broadcast started" },
      });

      render(<BroadcastManager />);

      const user = userEvent.setup();
      const textarea = await screen.findByPlaceholderText(
        /Start typing your viral marketing message/
      );
      await user.type(textarea, "Sale! 50% off");

      await user.click(screen.getByText("Send Broadcast"));

      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith("/api/broadcast", {
          message: "Sale! 50% off",
        });
      });
    });

    it("shows progress indicator while sending", async () => {
      mockStats();
      // Don't resolve the broadcast post immediately
      (axios.post as any).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ data: { message: "Started" } }), 5000)
          )
      );

      render(<BroadcastManager />);

      const user = userEvent.setup();
      const textarea = await screen.findByPlaceholderText(
        /Start typing your viral marketing message/
      );
      await user.type(textarea, "Big sale");

      await user.click(screen.getByText("Send Broadcast"));

      // Should show launching state
      await waitFor(() => {
        expect(screen.getByText("Launching...")).toBeTruthy();
      });
    });

    it("calls broadcast API and returns to idle state on success", async () => {
      // Use 1 customer so progress completes in 3s (1 interval tick at 3s each)
      mockStats(1);
      (axios.post as any).mockResolvedValueOnce({
        data: { message: "Broadcast started" },
      });

      render(<BroadcastManager />);

      const user = userEvent.setup();
      const textarea = await screen.findByPlaceholderText(
        /Start typing your viral marketing message/
      );
      await user.type(textarea, "Test message");
      await user.click(screen.getByText("Send Broadcast"));

      // API should be called
      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith("/api/broadcast", {
          message: "Test message",
        });
      });

      // After completion (3s for 1 customer), the Send Broadcast button should reappear
      await waitFor(
        () => {
          expect(screen.getByText("Send Broadcast")).toBeTruthy();
        },
        { timeout: 8000 }
      );
    });

    it("returns to idle state on broadcast API error", async () => {
      mockStats();
      (axios.post as any).mockRejectedValueOnce(new Error("Network error"));

      render(<BroadcastManager />);

      const user = userEvent.setup();
      const textarea = await screen.findByPlaceholderText(
        /Start typing your viral marketing message/
      );
      await user.type(textarea, "Test");
      await user.click(screen.getByText("Send Broadcast"));

      // After error, sending stops and Send Broadcast button should reappear
      await waitFor(() => {
        expect(screen.getByText("Send Broadcast")).toBeTruthy();
      });
    });

    it("does not crash when broadcast API fails", async () => {
      mockStats();
      (axios.post as any).mockRejectedValueOnce(new Error("Network error"));

      render(<BroadcastManager />);

      const user = userEvent.setup();
      const textarea = await screen.findByPlaceholderText(
        /Start typing your viral marketing message/
      );
      await user.type(textarea, "Test");

      // Should not throw when clicking send and API fails
      await expect(
        user.click(screen.getByText("Send Broadcast"))
      ).resolves.not.toThrow();
    });
  });

  describe("Live preview", () => {
    it("shows live preview section", async () => {
      mockStats();
      render(<BroadcastManager />);

      await waitFor(() => {
        expect(screen.getByText("Live Preview")).toBeTruthy();
      });
    });

    it("shows placeholder text in preview when no message typed", async () => {
      mockStats();
      render(<BroadcastManager />);

      await waitFor(() => {
        expect(
          screen.getByText("Type a message to see preview...")
        ).toBeTruthy();
      });
    });

    it("updates preview text when message is typed", async () => {
      mockStats();
      render(<BroadcastManager />);

      const user = userEvent.setup();
      const textarea = await screen.findByPlaceholderText(
        /Start typing your viral marketing message/
      );
      await user.type(textarea, "Hello customers!");

      await waitFor(() => {
        // Text appears in both textarea and preview — check it appears at least once
        expect(screen.getAllByText("Hello customers!").length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe("Benefits section", () => {
    it("shows benefit cards", async () => {
      mockStats();
      render(<BroadcastManager />);

      await waitFor(() => {
        expect(screen.getByText("Instant Reach")).toBeTruthy();
        expect(screen.getByText("High Conversion")).toBeTruthy();
        expect(screen.getByText("Anti-Ban")).toBeTruthy();
      });
    });
  });
});

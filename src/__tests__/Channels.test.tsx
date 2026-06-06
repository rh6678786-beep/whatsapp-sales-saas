import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import Channels from "../components/Channels";

vi.mock("axios");
vi.mock("../hooks/useFeatures", () => ({
  useFeatures: vi.fn(),
}));

// Mock child channel setup components (tested separately)
vi.mock("../components/channels/FacebookSetup", () => ({
  default: () => <div data-testid="facebook-setup">FacebookSetup Mock</div>,
}));
vi.mock("../components/channels/InstagramSetup", () => ({
  default: () => <div data-testid="instagram-setup">InstagramSetup Mock</div>,
}));
vi.mock("../components/channels/TelegramSetup", () => ({
  default: () => <div data-testid="telegram-setup">TelegramSetup Mock</div>,
}));

import { useFeatures } from "../hooks/useFeatures";

const mockNavigate = vi.fn();

function setupFeatures(features?: Partial<Record<string, boolean>>) {
  (useFeatures as any).mockReturnValue({
    instagram: true,
    facebook: true,
    telegram: true,
    broadcast: false,
    reEngagement: false,
    analytics: "none",
    aiPersona: false,
    whiteLabel: false,
    paymentVerification: false,
    ...features,
  });
}

function mockSettingsApi(data?: Record<string, any>) {
  (axios.get as any).mockImplementation((url: string) => {
    if (url === "/api/settings") {
      return Promise.resolve({
        data: {
          facebook: { pageId: "123", isActive: false },
          instagram: { igBusinessId: "456", isActive: false },
          telegram: { botToken: "", isActive: false },
          ...data,
        },
      });
    }
    if (url === "/api/whatsapp/status") {
      return Promise.resolve({ data: { isReady: false } });
    }
    return Promise.reject(new Error("Unknown URL: " + url));
  });
}

describe("Channels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFeatures();
    mockSettingsApi();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Header and stats", () => {
    it("renders Connect Channels header", async () => {
      render(<Channels />);

      await waitFor(() => {
        expect(screen.getByText("Connect Channels")).toBeTruthy();
      });
    });

    it("shows all 4 channel cards", async () => {
      render(<Channels />);

      await waitFor(() => {
        expect(screen.getByText("WhatsApp")).toBeTruthy();
        expect(screen.getByText("Facebook Messenger")).toBeTruthy();
        expect(screen.getByText("Instagram DM")).toBeTruthy();
        expect(screen.getByText("Telegram")).toBeTruthy();
      });
    });

    it("shows stat cards: Connected, Available, Total Platforms", async () => {
      render(<Channels />);

      await waitFor(() => {
        expect(screen.getByText("Connected")).toBeTruthy();
        expect(screen.getByText("Available")).toBeTruthy();
        expect(screen.getByText("Total Platforms")).toBeTruthy();
      });
    });

    it("shows 0 Connected when nothing is connected", async () => {
      render(<Channels />);

      await waitFor(() => {
        const connectedStat = screen.getByText("Connected").closest("div");
        expect(connectedStat?.querySelector("p")?.textContent).toBe("0");
      });
    });

    it("shows all 4 platforms as Total Platforms", async () => {
      render(<Channels />);

      await waitFor(() => {
        const totalStat = screen.getByText("Total Platforms").closest("div");
        expect(totalStat?.querySelector("p")?.textContent).toBe("4");
      });
    });
  });

  describe("WhatsApp channel", () => {
    it("shows WhatsApp channel card with description", async () => {
      render(<Channels />);

      await waitFor(() => {
        expect(screen.getByText("Connected via whatsapp-web.js")).toBeTruthy();
      });
    });

    it("shows WhatsApp info when expanded", async () => {
      render(<Channels />);

      await waitFor(() => {
        expect(screen.getByText("WhatsApp")).toBeTruthy();
      });

      const user = userEvent.setup();
      await user.click(screen.getByText("WhatsApp"));

      await waitFor(() => {
        expect(screen.getByText("WhatsApp Integration")).toBeTruthy();
        expect(
          screen.getByText(/Manage your WhatsApp connection/)
        ).toBeTruthy();
      });
    });

    it("shows Setup buttons for all configurable channels", async () => {
      render(<Channels />);

      await waitFor(() => {
        const setupBtns = screen.getAllByText("Setup");
        // All 4 configurable non-locked channels show Setup
        expect(setupBtns.length).toBe(4);
      });
    });
  });

  describe("Channel expand/collapse", () => {
    it("expands Facebook section when clicked", async () => {
      render(<Channels />);

      await waitFor(() => {
        expect(screen.getByText("Facebook Messenger")).toBeTruthy();
      });

      const user = userEvent.setup();
      await user.click(screen.getByText("Facebook Messenger"));

      await waitFor(() => {
        expect(screen.getByTestId("facebook-setup")).toBeTruthy();
      });
    });

    it("expands Instagram section when clicked", async () => {
      render(<Channels />);

      await waitFor(() => {
        expect(screen.getByText("Instagram DM")).toBeTruthy();
      });

      const user = userEvent.setup();
      await user.click(screen.getByText("Instagram DM"));

      await waitFor(() => {
        expect(screen.getByTestId("instagram-setup")).toBeTruthy();
      });
    });

    it("expands Telegram section when clicked", async () => {
      render(<Channels />);

      await waitFor(() => {
        expect(screen.getByText("Telegram")).toBeTruthy();
      });

      const user = userEvent.setup();
      await user.click(screen.getByText("Telegram"));

      await waitFor(() => {
        expect(screen.getByTestId("telegram-setup")).toBeTruthy();
      });
    });

    it("collapses when same channel is clicked again", async () => {
      render(<Channels />);

      await waitFor(() => {
        expect(screen.getByText("Facebook Messenger")).toBeTruthy();
      });

      const user = userEvent.setup();
      await user.click(screen.getByText("Facebook Messenger"));

      await waitFor(() => {
        expect(screen.getByTestId("facebook-setup")).toBeTruthy();
      });

      await user.click(screen.getByText("Facebook Messenger"));

      await waitFor(() => {
        expect(screen.queryByTestId("facebook-setup")).toBeNull();
      });
    });
  });

  describe("Feature-locked channels", () => {
    it("shows Upgrade button for locked messenger channel", async () => {
      setupFeatures({ facebook: false });
      mockSettingsApi();
      render(<Channels />);

      await waitFor(() => {
        const upgradeBtns = screen.getAllByText("Upgrade");
        expect(upgradeBtns.length).toBeGreaterThanOrEqual(1);
      });
    });

    it("calls onNavigate with billing when Upgrade clicked on locked channel", async () => {
      setupFeatures({ facebook: false });
      mockSettingsApi();
      render(<Channels onNavigate={mockNavigate} />);

      await waitFor(() => {
        const upgradeBtns = screen.getAllByText("Upgrade");
        expect(upgradeBtns.length).toBeGreaterThanOrEqual(1);
      });

      const user = userEvent.setup();
      const upgradeBtn = screen.getAllByText("Upgrade")[0];
      await user.click(upgradeBtn);

      expect(mockNavigate).toHaveBeenCalledWith("billing");
    });

    it("shows Lock icon for feature-disabled channels", async () => {
      setupFeatures({ facebook: false, instagram: false, telegram: false });
      mockSettingsApi();
      render(<Channels />);

      // Locked channels show "Upgrade to unlock this channel" as description
      await waitFor(() => {
        const lockedDescs = screen.getAllByText(
          "Upgrade to unlock this channel"
        );
        // 3 channels locked: messenger, instagram, telegram (whatsapp is always available)
        expect(lockedDescs.length).toBe(3);
      });
    });

    it("does NOT show Setup button for locked channels", async () => {
      setupFeatures({ facebook: false, instagram: false, telegram: false });
      mockSettingsApi();
      render(<Channels />);

      await waitFor(() => {
        // Only WhatsApp should have Setup since it's not feature-gated
        const setupBtns = screen.getAllByText("Setup");
        expect(setupBtns.length).toBe(1);
      });
    });
  });

  describe("API loading", () => {
    it("loads settings from API on mount", async () => {
      render(<Channels />);

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith("/api/settings");
      });
    });

    it("checks WhatsApp status on mount", async () => {
      render(<Channels />);

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith("/api/whatsapp/status");
      });
    });

    it("shows Live badge when WhatsApp is connected", async () => {
      (axios.get as any).mockImplementation((url: string) => {
        if (url === "/api/settings") {
          return Promise.resolve({
            data: {
              facebook: { pageId: "", isActive: false },
              instagram: { igBusinessId: "", isActive: false },
              telegram: { botToken: "", isActive: false },
            },
          });
        }
        if (url === "/api/whatsapp/status") {
          return Promise.resolve({ data: { isReady: true } });
        }
        return Promise.reject(new Error("Unknown URL: " + url));
      });

      render(<Channels />);

      await waitFor(() => {
        const liveBadges = screen.getAllByText("Live");
        expect(liveBadges.length).toBeGreaterThanOrEqual(1);
      });
    });

    it("handles settings API error gracefully", async () => {
      (axios.get as any).mockImplementation((url: string) => {
        if (url === "/api/settings") {
          return Promise.reject(new Error("API Error"));
        }
        if (url === "/api/whatsapp/status") {
          return Promise.resolve({ data: { isReady: false } });
        }
        return Promise.reject(new Error("Unknown URL: " + url));
      });

      render(<Channels />);

      // Should not crash - just shows 0 connected
      await waitFor(() => {
        expect(screen.getByText("Connect Channels")).toBeTruthy();
      });
    });
  });
});

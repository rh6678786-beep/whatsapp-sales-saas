import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import TelegramSetup from "../components/channels/TelegramSetup";

vi.mock("axios");

const defaultProps = {
  config: { botToken: "", isActive: false },
  connected: false,
  testing: false,
  error: null as string | null,
  showToken: false,
  botName: null as string | null,
  setConfig: vi.fn(),
  setTesting: vi.fn(),
  setError: vi.fn(),
  setConnected: vi.fn(),
  setBotName: vi.fn(),
  setShowToken: vi.fn(),
};

function renderComponent(overrides: Partial<typeof defaultProps> = {}) {
  const props = { ...defaultProps, ...overrides };
  return render(<TelegramSetup {...props} />);
}

describe("TelegramSetup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Connected state", () => {
    it("shows connected message with bot name", () => {
      renderComponent({
        connected: true,
        botName: "MyTestBot",
        config: { botToken: "123456:ABC-DEF", isActive: true },
      });

      expect(screen.getByText("Telegram Bot Connected")).toBeTruthy();
      expect(screen.getByText("MyTestBot")).toBeTruthy();
    });

    it("shows Active status badge", () => {
      renderComponent({
        connected: true,
        config: { botToken: "123456:ABC-DEF", isActive: true },
      });

      expect(screen.getByText("Active")).toBeTruthy();
    });

    it("renders Disconnect button", () => {
      renderComponent({
        connected: true,
        config: { botToken: "123456:ABC-DEF", isActive: true },
      });

      expect(screen.getByText("Disconnect Telegram")).toBeTruthy();
    });

    it("calls disconnect API and resets state on Disconnect click", async () => {
      (axios.post as any).mockResolvedValueOnce({ data: {} });
      const setConfig = vi.fn();
      const setConnected = vi.fn();
      const setBotName = vi.fn();

      renderComponent({
        connected: true,
        config: { botToken: "123456:ABC-DEF", isActive: true },
        setConfig,
        setConnected,
        setBotName,
      });

      const user = userEvent.setup();
      await user.click(screen.getByText("Disconnect Telegram"));

      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith("/api/telegram/config", {
          isActive: false,
          botToken: "",
        });
      });

      expect(setConfig).toHaveBeenCalledWith({
        botToken: "",
        isActive: false,
      });
      expect(setConnected).toHaveBeenCalledWith(false);
      expect(setBotName).toHaveBeenCalledWith(null);
    });
  });

  describe("Disconnected state (setup mode)", () => {
    it("shows Bot Token input label", () => {
      renderComponent();

      expect(screen.getByText("Telegram Bot Token")).toBeTruthy();
    });

    it("shows token input with placeholder", () => {
      renderComponent();

      expect(
        screen.getByPlaceholderText("123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11")
      ).toBeTruthy();
    });

    it("updates config on token input change", async () => {
      const setConfig = vi.fn();
      renderComponent({ setConfig });

      const user = userEvent.setup();
      const input = screen.getByPlaceholderText(
        "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
      );
      await user.type(input, "789012:XYZ");

      expect(setConfig).toHaveBeenCalled();
    });

    it("shows Test & Connect button", () => {
      renderComponent();

      expect(screen.getByText("Test & Connect")).toBeTruthy();
    });

    it("shows setup step instructions", () => {
      renderComponent();

      expect(screen.getByText("How to get these:")).toBeTruthy();
      expect(screen.getByText(/Open Telegram/)).toBeTruthy();
      expect(screen.getByText(/@BotFather/)).toBeTruthy();
    });
  });

  describe("Token visibility toggle", () => {
    it("shows password input by default (showToken=false)", () => {
      renderComponent({ showToken: false });

      const input = screen.getByPlaceholderText(
        "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
      );
      expect(input.getAttribute("type")).toBe("password");
    });

    it("shows text input when showToken=true", () => {
      renderComponent({ showToken: true });

      const input = screen.getByPlaceholderText(
        "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
      );
      expect(input.getAttribute("type")).toBe("text");
    });

    it("calls setShowToken when eye button clicked", async () => {
      const setShowToken = vi.fn();
      renderComponent({ setShowToken });

      const user = userEvent.setup();
      const eyeBtn = document.querySelector(
        'button[type="button"]'
      ) as HTMLButtonElement;
      if (eyeBtn) {
        await user.click(eyeBtn);
        expect(setShowToken).toHaveBeenCalledWith(true);
      }
    });
  });

  describe("Test & Connect flow", () => {
    it("disables Test & Connect button when token is empty", () => {
      renderComponent();

      const testBtn = screen.getByText("Test & Connect").closest("button");
      expect(testBtn?.disabled).toBe(true);
    });

    it("calls test API with token", async () => {
      (axios.post as any).mockResolvedValueOnce({
        data: { success: true, botName: "MyShopBot" },
      });
      (axios.post as any).mockResolvedValueOnce({
        data: {},
      });

      renderComponent({
        config: { botToken: "789012:XYZ", isActive: false },
      });

      const user = userEvent.setup();
      await user.click(screen.getByText("Test & Connect"));

      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith("/api/telegram/test", {
          botToken: "789012:XYZ",
        });
        expect(axios.post).toHaveBeenCalledWith("/api/telegram/config", {
          isActive: true,
          botToken: "789012:XYZ",
          botName: "MyShopBot",
        });
      });
    });

    it("sets connected and botName on successful test", async () => {
      (axios.post as any).mockResolvedValueOnce({
        data: { success: true, botName: "MyShopBot" },
      });
      (axios.post as any).mockResolvedValueOnce({
        data: {},
      });
      const setConnected = vi.fn();
      const setBotName = vi.fn();

      renderComponent({
        config: { botToken: "789012:XYZ", isActive: false },
        setConnected,
        setBotName,
      });

      const user = userEvent.setup();
      await user.click(screen.getByText("Test & Connect"));

      await waitFor(() => {
        expect(setConnected).toHaveBeenCalledWith(true);
        expect(setBotName).toHaveBeenCalledWith("MyShopBot");
      });
    });

    it("shows error when test API fails", async () => {
      (axios.post as any).mockResolvedValueOnce({
        data: { success: false, error: "Invalid bot token" },
      });
      const setError = vi.fn();

      renderComponent({
        config: { botToken: "789012:XYZ", isActive: false },
        setError,
      });

      const user = userEvent.setup();
      await user.click(screen.getByText("Test & Connect"));

      await waitFor(() => {
        expect(setError).toHaveBeenCalledWith("Invalid bot token");
      });
    });

    it("shows error when test API throws", async () => {
      (axios.post as any).mockRejectedValueOnce({
        response: { data: { error: "Bot token invalid" } },
      });
      const setError = vi.fn();

      renderComponent({
        config: { botToken: "789012:XYZ", isActive: false },
        setError,
      });

      const user = userEvent.setup();
      await user.click(screen.getByText("Test & Connect"));

      await waitFor(() => {
        expect(setError).toHaveBeenCalledWith("Bot token invalid");
      });
    });

    it("disables button while testing", () => {
      renderComponent({
        testing: true,
        config: { botToken: "789012:XYZ", isActive: false },
      });

      const testBtn = screen.getByText("Testing...").closest("button");
      expect(testBtn?.disabled).toBe(true);
    });
  });

  describe("Error display", () => {
    it("shows error message when error prop is set", () => {
      renderComponent({ error: "Invalid token format" });

      expect(screen.getByText("Invalid token format")).toBeTruthy();
    });

    it("does not show error when error prop is null", () => {
      renderComponent({ error: null });

      expect(screen.queryByText("Invalid token format")).toBeNull();
    });
  });
});

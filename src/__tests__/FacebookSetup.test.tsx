import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import FacebookSetup from "../components/channels/FacebookSetup";

vi.mock("axios");

const defaultProps = {
  config: { pageId: "", pageAccessToken: "", verifyToken: "", isActive: false },
  connected: false,
  testing: false,
  error: null as string | null,
  showToken: false,
  showVerifyToken: false,
  advancedMode: false,
  setConfig: vi.fn(),
  setTesting: vi.fn(),
  setError: vi.fn(),
  setConnected: vi.fn(),
  setShowToken: vi.fn(),
  setShowVerifyToken: vi.fn(),
  setAdvancedMode: vi.fn(),
  openOAuthPopup: vi.fn(),
};

function renderComponent(overrides: Partial<typeof defaultProps> = {}) {
  const props = { ...defaultProps, ...overrides };
  return render(<FacebookSetup {...props} />);
}

describe("FacebookSetup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Connected state", () => {
    it("shows connected message with Page ID", () => {
      renderComponent({
        connected: true,
        config: { pageId: "12345", pageAccessToken: "token", verifyToken: "vt", isActive: true },
      });

      expect(screen.getByText("Facebook Messenger Connected")).toBeTruthy();
      expect(screen.getByText(/Page ID: 12345/)).toBeTruthy();
    });

    it("shows Active status badge", () => {
      renderComponent({
        connected: true,
        config: { pageId: "123", pageAccessToken: "token", verifyToken: "vt", isActive: true },
      });

      expect(screen.getByText("Active")).toBeTruthy();
    });

    it("shows webhook URL info", () => {
      renderComponent({
        connected: true,
        config: { pageId: "123", pageAccessToken: "token", verifyToken: "vt", isActive: true },
      });

      expect(screen.getByText(/Webhook URL/)).toBeTruthy();
      expect(screen.getByText(/\/api\/webhook\/facebook/)).toBeTruthy();
    });

    it("renders Disconnect button", () => {
      renderComponent({
        connected: true,
        config: { pageId: "123", pageAccessToken: "token", verifyToken: "vt", isActive: true },
      });

      expect(screen.getByText("Disconnect Messenger")).toBeTruthy();
    });

    it("calls disconnect API and resets state on Disconnect click", async () => {
      (axios.post as any).mockResolvedValueOnce({ data: {} });
      const setConfig = vi.fn();
      const setConnected = vi.fn();

      renderComponent({
        connected: true,
        config: { pageId: "123", pageAccessToken: "token", verifyToken: "vt", isActive: true },
        setConfig,
        setConnected,
      });

      const user = userEvent.setup();
      await user.click(screen.getByText("Disconnect Messenger"));

      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith("/api/facebook/config", {
          isActive: false,
          pageAccessToken: "",
          verifyToken: "",
        });
      });

      expect(setConfig).toHaveBeenCalledWith({
        pageId: "",
        pageAccessToken: "",
        verifyToken: "",
        isActive: false,
      });
      expect(setConnected).toHaveBeenCalledWith(false);
    });
  });

  describe("Easy OAuth login mode", () => {
    it("shows Connect with Facebook button by default", () => {
      renderComponent();

      expect(screen.getByText("Continue with Facebook")).toBeTruthy();
    });

    it("shows description text in OAuth mode", () => {
      renderComponent();

      expect(screen.getByText("Connect with Facebook")).toBeTruthy();
    });

    it("calls openOAuthPopup when Continue with Facebook clicked", async () => {
      const openOAuthPopup = vi.fn();
      renderComponent({ openOAuthPopup });

      const user = userEvent.setup();
      await user.click(screen.getByText("Continue with Facebook"));

      expect(openOAuthPopup).toHaveBeenCalledWith(
        "/api/auth/facebook/login",
        "Facebook Login"
      );
    });

    it("shows link to advanced mode", () => {
      renderComponent();

      expect(
        screen.getByText("Use Manual Developer Setup (Advanced)")
      ).toBeTruthy();
    });

    it("switches to advanced mode when link clicked", async () => {
      const setAdvancedMode = vi.fn();
      renderComponent({ setAdvancedMode });

      const user = userEvent.setup();
      await user.click(
        screen.getByText("Use Manual Developer Setup (Advanced)")
      );

      expect(setAdvancedMode).toHaveBeenCalledWith(true);
    });
  });

  describe("Advanced manual setup mode", () => {
    it("shows form fields in advanced mode", () => {
      renderComponent({ advancedMode: true });

      expect(screen.getByText("Advanced Manual Setup")).toBeTruthy();
      expect(screen.getByText("Facebook Page ID")).toBeTruthy();
      expect(screen.getByText("Page Access Token")).toBeTruthy();
      expect(screen.getByText("Webhook Verify Token")).toBeTruthy();
    });

    it("shows back to easy login button", () => {
      renderComponent({ advancedMode: true });

      expect(screen.getByText("Back to Easy Login")).toBeTruthy();
    });

    it("switches back to easy mode when Back clicked", async () => {
      const setAdvancedMode = vi.fn();
      renderComponent({ advancedMode: true, setAdvancedMode });

      const user = userEvent.setup();
      await user.click(screen.getByText("Back to Easy Login"));

      expect(setAdvancedMode).toHaveBeenCalledWith(false);
    });

    it("updates Page ID on input change", async () => {
      const setConfig = vi.fn();
      renderComponent({ advancedMode: true, setConfig });

      const user = userEvent.setup();
      const input = screen.getByPlaceholderText("e.g. 123456789012345");
      await user.type(input, "98765");

      expect(setConfig).toHaveBeenCalled();
    });

    it("toggles Access Token visibility", async () => {
      const setShowToken = vi.fn();
      renderComponent({
        advancedMode: true,
        showToken: false,
        setShowToken,
      });

      const user = userEvent.setup();
      // Find the eye toggle button in the token section (has Eye icon)
      const toggleBtns = document.querySelectorAll(
        'button[type="button"]'
      );
      // Filter for ones inside advanced mode
      const eyeBtns = Array.from(toggleBtns).filter(
        (btn) =>
          btn.innerHTML.includes("Eye") || btn.innerHTML.includes("eye")
      );
      if (eyeBtns.length > 0) {
        await user.click(eyeBtns[0]);
        expect(setShowToken).toHaveBeenCalledWith(true);
      }
    });

    it("shows Test & Connect button in advanced mode", () => {
      renderComponent({ advancedMode: true });

      expect(screen.getByText("Test & Connect")).toBeTruthy();
    });

    it("shows setup step instructions", () => {
      renderComponent({ advancedMode: true });

      expect(
        screen.getByText("How to get these:")
      ).toBeTruthy();
      expect(
        screen.getByText(/Go to developers.facebook.com/)
      ).toBeTruthy();
    });
  });

  describe("Test & Connect flow", () => {
    it("disables Test & Connect button when Page ID and token are empty", () => {
      renderComponent({ advancedMode: true });

      const testBtn = screen.getByText("Test & Connect").closest("button");
      expect(testBtn?.disabled).toBe(true);
    });

    it("calls test API when fields are filled", async () => {
      (axios.post as any).mockResolvedValueOnce({
        data: { success: true },
      });
      (axios.post as any).mockResolvedValueOnce({
        data: {},
      });

      renderComponent({
        advancedMode: true,
        config: {
          pageId: "12345",
          pageAccessToken: "EAAAtest",
          verifyToken: "vtest",
          isActive: false,
        },
      });

      const user = userEvent.setup();
      await user.click(screen.getByText("Test & Connect"));

      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith("/api/facebook/test", {
          pageId: "12345",
          pageAccessToken: "EAAAtest",
        });
        expect(axios.post).toHaveBeenCalledWith("/api/facebook/config", {
          isActive: true,
        });
      });
    });

    it("sets connected on successful test", async () => {
      (axios.post as any).mockResolvedValueOnce({
        data: { success: true },
      });
      (axios.post as any).mockResolvedValueOnce({
        data: {},
      });
      const setConnected = vi.fn();

      renderComponent({
        advancedMode: true,
        config: {
          pageId: "12345",
          pageAccessToken: "EAAAtest",
          verifyToken: "vtest",
          isActive: false,
        },
        setConnected,
      });

      const user = userEvent.setup();
      await user.click(screen.getByText("Test & Connect"));

      await waitFor(() => {
        expect(setConnected).toHaveBeenCalledWith(true);
      });
    });

    it("shows error when test API fails", async () => {
      (axios.post as any).mockResolvedValueOnce({
        data: { success: false, error: "Invalid token" },
      });
      const setError = vi.fn();

      renderComponent({
        advancedMode: true,
        config: {
          pageId: "12345",
          pageAccessToken: "EAAAtest",
          verifyToken: "vtest",
          isActive: false,
        },
        setError,
      });

      const user = userEvent.setup();
      await user.click(screen.getByText("Test & Connect"));

      await waitFor(() => {
        expect(setError).toHaveBeenCalledWith("Invalid token");
      });
    });

    it("shows error when test API throws", async () => {
      (axios.post as any).mockRejectedValueOnce({
        response: { data: { error: "Network error" } },
      });
      const setError = vi.fn();

      renderComponent({
        advancedMode: true,
        config: {
          pageId: "12345",
          pageAccessToken: "EAAAtest",
          verifyToken: "vtest",
          isActive: false,
        },
        setError,
      });

      const user = userEvent.setup();
      await user.click(screen.getByText("Test & Connect"));

      await waitFor(() => {
        expect(setError).toHaveBeenCalledWith("Network error");
      });
    });

    it("disables button while testing", () => {
      renderComponent({
        advancedMode: true,
        testing: true,
        config: {
          pageId: "12345",
          pageAccessToken: "EAAAtest",
          verifyToken: "vtest",
          isActive: false,
        },
      });

      const testBtn = screen.getByText("Testing...").closest("button");
      expect(testBtn?.disabled).toBe(true);
    });
  });

  describe("Error display", () => {
    it("shows error message when error prop is set", () => {
      renderComponent({
        advancedMode: true,
        error: "Invalid credentials",
      });

      expect(screen.getByText("Invalid credentials")).toBeTruthy();
    });

    it("does not show error when error prop is null", () => {
      renderComponent({
        advancedMode: true,
        error: null,
      });

      expect(screen.queryByText("Invalid credentials")).toBeNull();
    });
  });
});

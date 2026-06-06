import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import InstagramSetup from "../components/channels/InstagramSetup";

vi.mock("axios");

const defaultProps = {
  config: { igBusinessId: "", pageAccessToken: "", verifyToken: "", isActive: false },
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
  return render(<InstagramSetup {...props} />);
}

describe("InstagramSetup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Connected state", () => {
    it("shows connected message with IG Business ID", () => {
      renderComponent({
        connected: true,
        config: { igBusinessId: "17841405822304917", pageAccessToken: "token", verifyToken: "vt", isActive: true },
      });

      expect(screen.getByText("Instagram DM Connected")).toBeTruthy();
      expect(screen.getByText(/IG Business ID: 17841405822304917/)).toBeTruthy();
    });

    it("shows Active status badge", () => {
      renderComponent({
        connected: true,
        config: { igBusinessId: "1784", pageAccessToken: "token", verifyToken: "vt", isActive: true },
      });

      expect(screen.getByText("Active")).toBeTruthy();
    });

    it("shows webhook URL info", () => {
      renderComponent({
        connected: true,
        config: { igBusinessId: "1784", pageAccessToken: "token", verifyToken: "vt", isActive: true },
      });

      expect(screen.getByText(/Webhook URL/)).toBeTruthy();
      expect(screen.getByText(/\/api\/webhook\/instagram/)).toBeTruthy();
    });

    it("renders Disconnect button", () => {
      renderComponent({
        connected: true,
        config: { igBusinessId: "1784", pageAccessToken: "token", verifyToken: "vt", isActive: true },
      });

      expect(screen.getByText("Disconnect Instagram")).toBeTruthy();
    });

    it("calls disconnect API and resets state on Disconnect click", async () => {
      (axios.post as any).mockResolvedValueOnce({ data: {} });
      const setConfig = vi.fn();
      const setConnected = vi.fn();

      renderComponent({
        connected: true,
        config: { igBusinessId: "1784", pageAccessToken: "token", verifyToken: "vt", isActive: true },
        setConfig,
        setConnected,
      });

      const user = userEvent.setup();
      await user.click(screen.getByText("Disconnect Instagram"));

      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith("/api/instagram/config", {
          isActive: false,
          pageAccessToken: "",
          verifyToken: "",
        });
      });

      expect(setConfig).toHaveBeenCalledWith({
        igBusinessId: "",
        pageAccessToken: "",
        verifyToken: "",
        isActive: false,
      });
      expect(setConnected).toHaveBeenCalledWith(false);
    });
  });

  describe("Easy OAuth login mode", () => {
    it("shows Connect via Instagram button by default", () => {
      renderComponent();

      expect(screen.getByText("Connect via Instagram")).toBeTruthy();
    });

    it("shows description text in OAuth mode", () => {
      renderComponent();

      expect(screen.getByText("Connect with Instagram")).toBeTruthy();
    });

    it("calls openOAuthPopup when Connect via Instagram clicked", async () => {
      const openOAuthPopup = vi.fn();
      renderComponent({ openOAuthPopup });

      const user = userEvent.setup();
      await user.click(screen.getByText("Connect via Instagram"));

      expect(openOAuthPopup).toHaveBeenCalledWith(
        "/api/auth/instagram/login",
        "Instagram Login"
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
      expect(screen.getByText("Instagram Business Account ID")).toBeTruthy();
      expect(screen.getByText("Facebook Page Access Token")).toBeTruthy();
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

    it("updates IG Business ID on input change", async () => {
      const setConfig = vi.fn();
      renderComponent({ advancedMode: true, setConfig });

      const user = userEvent.setup();
      const input = screen.getByPlaceholderText("e.g. 17841405822304917");
      await user.type(input, "17841405822304918");

      expect(setConfig).toHaveBeenCalled();
    });

    it("shows Test & Connect button in advanced mode", () => {
      renderComponent({ advancedMode: true });

      expect(screen.getByText("Test & Connect")).toBeTruthy();
    });

    it("shows setup step instructions", () => {
      renderComponent({ advancedMode: true });

      expect(screen.getByText("How to get these:")).toBeTruthy();
      expect(
        screen.getByText(/Go to developers.facebook.com/)
      ).toBeTruthy();
    });
  });

  describe("Test & Connect flow", () => {
    it("disables Test & Connect button when IG Business ID and token are empty", () => {
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
          igBusinessId: "17841405822304917",
          pageAccessToken: "EAAAtest",
          verifyToken: "vtest",
          isActive: false,
        },
      });

      const user = userEvent.setup();
      await user.click(screen.getByText("Test & Connect"));

      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith("/api/instagram/test", {
          igBusinessId: "17841405822304917",
          pageAccessToken: "EAAAtest",
        });
        expect(axios.post).toHaveBeenCalledWith("/api/instagram/config", {
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
          igBusinessId: "17841405822304917",
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
        data: { success: false, error: "Invalid permissions" },
      });
      const setError = vi.fn();

      renderComponent({
        advancedMode: true,
        config: {
          igBusinessId: "17841405822304917",
          pageAccessToken: "EAAAtest",
          verifyToken: "vtest",
          isActive: false,
        },
        setError,
      });

      const user = userEvent.setup();
      await user.click(screen.getByText("Test & Connect"));

      await waitFor(() => {
        expect(setError).toHaveBeenCalledWith("Invalid permissions");
      });
    });

    it("shows error when test API throws", async () => {
      (axios.post as any).mockRejectedValueOnce({
        response: { data: { error: "API failure" } },
      });
      const setError = vi.fn();

      renderComponent({
        advancedMode: true,
        config: {
          igBusinessId: "17841405822304917",
          pageAccessToken: "EAAAtest",
          verifyToken: "vtest",
          isActive: false,
        },
        setError,
      });

      const user = userEvent.setup();
      await user.click(screen.getByText("Test & Connect"));

      await waitFor(() => {
        expect(setError).toHaveBeenCalledWith("API failure");
      });
    });

    it("disables button while testing", () => {
      renderComponent({
        advancedMode: true,
        testing: true,
        config: {
          igBusinessId: "17841405822304917",
          pageAccessToken: "EAAAtest",
          verifyToken: "vtest",
          isActive: false,
        },
      });

      const testBtn = screen.getByText("Testing...").closest("button");
      expect(testBtn?.disabled).toBe(true);
    });
  });

  describe("OAuth message event", () => {
    it("calls setConfig with updater function when OAuth message is received", () => {
      const setConfig = vi.fn();
      renderComponent({ setConfig });

      const event = new MessageEvent("message", {
        data: {
          type: "instagram_oauth",
          igBusinessId: "17841405822304917",
          pageAccessToken: "EAAAtest123",
        },
      });
      window.dispatchEvent(event);

      // setConfig is called with a React updater function
      expect(setConfig).toHaveBeenCalled();
      const updaterFn = setConfig.mock.calls[0][0];
      expect(typeof updaterFn).toBe("function");

      // Applying updater to base state should produce the expected result
      const result = updaterFn({
        igBusinessId: "",
        pageAccessToken: "",
        verifyToken: "",
        isActive: false,
      });
      expect(result).toEqual({
        igBusinessId: "17841405822304917",
        pageAccessToken: "EAAAtest123",
        verifyToken: "",
        isActive: false,
      });
    });

    it("does not crash with unrelated message events", () => {
      renderComponent();

      const event = new MessageEvent("message", {
        data: { type: "some_other_event" },
      });

      expect(() => window.dispatchEvent(event)).not.toThrow();
    });

    it("cleanup removes event listener on unmount", () => {
      const addSpy = vi.spyOn(window, "addEventListener");
      const removeSpy = vi.spyOn(window, "removeEventListener");

      const { unmount } = renderComponent();
      unmount();

      expect(addSpy).toHaveBeenCalledWith("message", expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith("message", expect.any(Function));
    });
  });

  describe("Error display", () => {
    it("shows error message when error prop is set", () => {
      renderComponent({
        advancedMode: true,
        error: "Connection timeout",
      });

      expect(screen.getByText("Connection timeout")).toBeTruthy();
    });

    it("does not show error when error prop is null", () => {
      renderComponent({
        advancedMode: true,
        error: null,
      });

      expect(screen.queryByText("Connection timeout")).toBeNull();
    });
  });
});

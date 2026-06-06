import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import Login from "../components/Login";

vi.mock("axios");

const mockOnLogin = vi.fn();

function renderLogin() {
  return render(<Login onLogin={mockOnLogin} />);
}

describe("Login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    (axios.post as any).mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Login mode (default)", () => {
    it("renders the sign-in form with username and password fields", () => {
      renderLogin();
      expect(screen.getByText("Welcome Back")).toBeTruthy();
      expect(screen.getByText("Sign in to your dashboard")).toBeTruthy();
      expect(screen.getByPlaceholderText("e.g. zia-store")).toBeTruthy();
      expect(screen.getByPlaceholderText("••••••••")).toBeTruthy();
      expect(screen.getAllByText("Sign In").length).toBeGreaterThanOrEqual(1);
    });

    it("submits login form and stores auth data on success", async () => {
      (axios.post as any).mockResolvedValueOnce({
        data: { token: "test-token", adminId: "zia-store", success: true },
      });

      renderLogin();

      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText("e.g. zia-store"), "zia-store");
      await user.type(screen.getByPlaceholderText("••••••••"), "mypassword");

      const submitBtn = screen.getAllByText("Sign In")[1];
      await user.click(submitBtn);

      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith("/api/auth/login", {
          adminId: "zia-store",
          password: "mypassword",
        });
      });

      expect(localStorage.getItem("isAdmin")).toBe("true");
      expect(localStorage.getItem("adminId")).toBe("zia-store");
      expect(localStorage.getItem("authToken")).toBe("test-token");
      expect(mockOnLogin).toHaveBeenCalled();
    });

    it("submits with typed username as adminId", async () => {
      (axios.post as any).mockResolvedValueOnce({
        data: { token: "token", adminId: "zia-store", success: true },
      });

      renderLogin();

      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText("e.g. zia-store"), "zia-store");
      await user.type(screen.getByPlaceholderText("••••••••"), "admin123");

      const submitBtn = document.querySelector('button[type="submit"]') as HTMLElement;
      expect(submitBtn).toBeTruthy();
      await user.click(submitBtn);

      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith("/api/auth/login", {
          adminId: "zia-store",
          password: "admin123",
        });
      });
    });

    it("shows error message on failed login (401)", async () => {
      (axios.post as any).mockRejectedValueOnce({
        response: { status: 401, data: { error: "Invalid credentials" } },
      });

      renderLogin();

      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText("e.g. zia-store"), "test");
      await user.type(screen.getByPlaceholderText("••••••••"), "wrong");
      const submitBtn = screen.getAllByText("Sign In")[1];
      await user.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText("Invalid credentials. Please try again.")).toBeTruthy();
      });
    });

    it("shows error message when server is unreachable", async () => {
      (axios.post as any).mockRejectedValueOnce({
        message: "Network Error",
      });

      renderLogin();

      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText("e.g. zia-store"), "test");
      await user.type(screen.getByPlaceholderText("••••••••"), "password");
      const submitBtn = screen.getAllByText("Sign In")[1];
      await user.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/Cannot connect to server/)).toBeTruthy();
      });
    });

    it("toggles password visibility", async () => {
      renderLogin();
      const passwordInput = screen.getByPlaceholderText("••••••••");
      expect(passwordInput).toHaveAttribute("type", "password");

      const user = userEvent.setup();
      const toggleBtn = screen.getAllByRole("button").find(
        (b) => b.innerHTML.includes("eye") || b.querySelector(".lucide-eye")
      );

      // Find the eye toggle button by its parent's button type
      const showBtn = document.querySelector('button[type="button"]') as HTMLElement;
      if (showBtn) {
        await user.click(showBtn);
        expect(passwordInput).toHaveAttribute("type", "text");
        await user.click(showBtn);
        expect(passwordInput).toHaveAttribute("type", "password");
      }
    });
  });

  describe("Register mode", () => {
    it("switches to register mode and shows additional fields", async () => {
      renderLogin();

      const user = userEvent.setup();
      await user.click(screen.getByText("Register"));

      await waitFor(() => {
        expect(screen.getByText("Create Account")).toBeTruthy();
        expect(screen.getByText("Start your 7-day free trial")).toBeTruthy();
      });

      // Registration specific fields
      expect(screen.getByPlaceholderText("you@example.com")).toBeTruthy();
      expect(screen.getByPlaceholderText("e.g. Zia Fashion Store")).toBeTruthy();
    });

    it("shows password strength indicator when typing in register mode", async () => {
      renderLogin();

      const user = userEvent.setup();
      await user.click(screen.getByText("Register"));

      const passwordInput = screen.getByPlaceholderText("••••••••");
      await user.type(passwordInput, "StrongP@ss1");

      await waitFor(() => {
        expect(screen.getByText("Strong")).toBeTruthy();
      });
    });

    it("shows password requirements checklist in register mode", async () => {
      renderLogin();

      const user = userEvent.setup();
      await user.click(screen.getByText("Register"));

      await user.type(screen.getByPlaceholderText("••••••••"), "Abc@1234");

      await waitFor(() => {
        expect(screen.getByText("8+ characters")).toBeTruthy();
        expect(screen.getByText("Lowercase")).toBeTruthy();
        expect(screen.getByText("Uppercase")).toBeTruthy();
        expect(screen.getByText("Number")).toBeTruthy();
        expect(screen.getByText("Special char")).toBeTruthy();
      });
    });

    it("validates password requirements before sending OTP", async () => {
      renderLogin();

      const user = userEvent.setup();
      await user.click(screen.getByText("Register"));
      await user.type(screen.getByPlaceholderText("e.g. zia-store"), "test-store");
      await user.type(screen.getByPlaceholderText("you@example.com"), "test@gmail.com");
      await user.type(screen.getByPlaceholderText("••••••••"), "weak");

      await user.click(screen.getByText("Send OTP"));

      await waitFor(() => {
        expect(screen.getByText(/Password must be at least 8 characters/)).toBeTruthy();
      });
      expect(axios.post).not.toHaveBeenCalled();
    });

    it("sends OTP on valid registration form submission", async () => {
      (axios.post as any).mockResolvedValueOnce({
        data: { success: true },
      });

      renderLogin();

      const user = userEvent.setup();
      await user.click(screen.getByText("Register"));
      await user.type(screen.getByPlaceholderText("e.g. zia-store"), "zia-store");
      await user.type(screen.getByPlaceholderText("you@example.com"), "store@gmail.com");
      await user.type(screen.getByPlaceholderText("e.g. Zia Fashion Store"), "Zia Store");
      await user.type(screen.getByPlaceholderText("••••••••"), "StrongP@ss1");

      await user.click(screen.getByText("Send OTP"));

      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith("/api/auth/send-otp", {
          email: "store@gmail.com",
          adminId: "zia-store",
          password: "StrongP@ss1",
          storeName: "Zia Store",
        });
      });
    });

    it("restricts registration to Gmail addresses only", async () => {
      renderLogin();

      const user = userEvent.setup();
      await user.click(screen.getByText("Register"));
      await user.type(screen.getByPlaceholderText("e.g. zia-store"), "test");
      await user.type(screen.getByPlaceholderText("you@example.com"), "test@outlook.com");
      await user.type(screen.getByPlaceholderText("••••••••"), "StrongP@ss1");

      await user.click(screen.getByText("Send OTP"));

      await waitFor(() => {
        expect(screen.getByText(/only Gmail accounts/)).toBeTruthy();
      });
    });
  });

  describe("OTP flow", () => {
    it("shows OTP input after successful registration form submission", async () => {
      (axios.post as any).mockResolvedValueOnce({
        data: { success: true },
      });

      renderLogin();

      const user = userEvent.setup();
      await user.click(screen.getByText("Register"));
      await user.type(screen.getByPlaceholderText("e.g. zia-store"), "zia-store");
      await user.type(screen.getByPlaceholderText("you@example.com"), "test@gmail.com");
      await user.type(screen.getByPlaceholderText("••••••••"), "StrongP@ss1");

      await user.click(screen.getByText("Send OTP"));

      await waitFor(() => {
        expect(screen.getByText(/Code sent to/)).toBeTruthy();
        expect(screen.getByPlaceholderText("000000")).toBeTruthy();
        expect(screen.getByText("Verify & Create Account")).toBeTruthy();
      });
    });

    it("verifies OTP and logs in on success", async () => {
      // First call: send OTP
      (axios.post as any).mockResolvedValueOnce({
        data: { success: true },
      });

      renderLogin();

      const user = userEvent.setup();
      await user.click(screen.getByText("Register"));
      await user.type(screen.getByPlaceholderText("e.g. zia-store"), "zia-store");
      await user.type(screen.getByPlaceholderText("you@example.com"), "test@gmail.com");
      await user.type(screen.getByPlaceholderText("••••••••"), "StrongP@ss1");
      await user.click(screen.getByText("Send OTP"));

      await waitFor(() => {
        expect(screen.getByPlaceholderText("000000")).toBeTruthy();
      });

      // Second call: verify OTP
      (axios.post as any).mockResolvedValueOnce({
        data: { token: "otp-token", adminId: "zia-store" },
      });

      const otpInput = screen.getByPlaceholderText("000000");
      await user.type(otpInput, "123456");
      await user.click(screen.getByText("Verify & Create Account"));

      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith("/api/auth/verify-otp", {
          email: "test@gmail.com",
          otp: "123456",
        });
      });

      expect(localStorage.getItem("authToken")).toBe("otp-token");
      expect(mockOnLogin).toHaveBeenCalled();
    });

    it("allows going back from OTP step to form", async () => {
      (axios.post as any).mockResolvedValueOnce({
        data: { success: true },
      });

      renderLogin();

      const user = userEvent.setup();
      await user.click(screen.getByText("Register"));
      await user.type(screen.getByPlaceholderText("e.g. zia-store"), "test");
      await user.type(screen.getByPlaceholderText("you@example.com"), "test@gmail.com");
      await user.type(screen.getByPlaceholderText("••••••••"), "StrongP@ss1");
      await user.click(screen.getByText("Send OTP"));

      await waitFor(() => {
        expect(screen.getByText("Back")).toBeTruthy();
      });

      await user.click(screen.getByText("Back"));

      await waitFor(() => {
        expect(screen.getByText("Send OTP")).toBeTruthy();
      });
    });
  });

  describe("Mode switching", () => {
    it("toggles between login and register modes", async () => {
      renderLogin();

      const user = userEvent.setup();

      // Switch to register
      await user.click(screen.getByText("Register"));
      expect(screen.getByText("Create Account")).toBeTruthy();

      // Switch back to login via bottom link
      await user.click(screen.getByText("Sign in"));
      expect(screen.getByText("Welcome Back")).toBeTruthy();

      // Switch to register via bottom link
      await user.click(screen.getByText("Register here"));
      expect(screen.getByText("Create Account")).toBeTruthy();
    });

    it("clears error when switching modes", async () => {
      (axios.post as any).mockRejectedValueOnce({
        response: { status: 401, data: { error: "Invalid" } },
      });

      renderLogin();

      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText("e.g. zia-store"), "test");
      await user.type(screen.getByPlaceholderText("••••••••"), "wrong");
      const submitBtn = screen.getAllByText("Sign In")[1];
      await user.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText("Invalid credentials. Please try again.")).toBeTruthy();
      });

      await user.click(screen.getByText("Register"));
      expect(screen.queryByText("Invalid credentials. Please try again.")).toBeNull();
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import ResetPassword from "../components/ResetPassword";

vi.mock("axios");

const mockOnBackToLogin = vi.fn();

function renderResetPassword() {
  return render(<ResetPassword onBackToLogin={mockOnBackToLogin} />);
}

describe("ResetPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    (axios.post as any).mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  describe("No token in URL", () => {
    it("shows invalid link message when no token is present", () => {
      window.history.replaceState(null, "", window.location.pathname);
      renderResetPassword();

      expect(screen.getByText("Invalid Link")).toBeTruthy();
      expect(
        screen.getByText(/This password reset link is invalid or has expired/)
      ).toBeTruthy();
      expect(screen.getByText("Back to Sign In")).toBeTruthy();
    });

    it("calls onBackToLogin when Back to Sign In is clicked with no token", async () => {
      window.history.replaceState(null, "", window.location.pathname);
      renderResetPassword();

      const user = userEvent.setup();
      await user.click(screen.getByText("Back to Sign In"));

      expect(mockOnBackToLogin).toHaveBeenCalledTimes(1);
    });
  });

  describe("With valid token in URL", () => {
    beforeEach(() => {
      window.history.replaceState(
        null,
        "",
        window.location.pathname + "?token=valid-test-token-123"
      );
    });

    it("renders the reset password form when token is present", () => {
      renderResetPassword();

      expect(screen.getByRole("heading", { name: /Reset Password/i })).toBeTruthy();
      expect(screen.getByText("Enter your new password below.")).toBeTruthy();
      const inputs = screen.getAllByPlaceholderText("••••••••");
      expect(inputs.length).toBe(2);
      expect(screen.getByRole("button", { name: /Reset Password/i })).toBeTruthy();
    });

    it("shows password strength indicator while typing", async () => {
      renderResetPassword();

      const user = userEvent.setup();
      const passwordInputs = screen.getAllByPlaceholderText("••••••••");

      await user.type(passwordInputs[0], "StrongP@ss1");

      await waitFor(() => {
        expect(screen.getByText("Strong")).toBeTruthy();
      });
    });

    it("shows password match indicator", async () => {
      renderResetPassword();

      const user = userEvent.setup();
      const passwordInputs = screen.getAllByPlaceholderText("••••••••");

      await user.type(passwordInputs[0], "StrongP@ss1");
      await user.type(passwordInputs[1], "StrongP@ss1");

      await waitFor(() => {
        expect(screen.getByText("Passwords match")).toBeTruthy();
      });
    });

    it("shows error when passwords do not match", async () => {
      renderResetPassword();

      const user = userEvent.setup();
      const passwordInputs = screen.getAllByPlaceholderText("••••••••");

      await user.type(passwordInputs[0], "StrongP@ss1");
      await user.type(passwordInputs[1], "DifferentP@ss2");

      await user.click(screen.getByRole("button", { name: /Reset Password/i }));

      await waitFor(() => {
        const matchMessages = screen.getAllByText("Passwords do not match");
        expect(matchMessages.length).toBeGreaterThanOrEqual(1);
      });
      expect(axios.post).not.toHaveBeenCalled();
    });

    it("shows validation error for weak password", async () => {
      renderResetPassword();

      const user = userEvent.setup();
      const passwordInputs = screen.getAllByPlaceholderText("••••••••");

      await user.type(passwordInputs[0], "weak");
      await user.type(passwordInputs[1], "weak");

      await user.click(screen.getByRole("button", { name: /Reset Password/i }));

      await waitFor(() => {
        expect(screen.getByText(/Password must be at least 8 characters/)).toBeTruthy();
      });
      expect(axios.post).not.toHaveBeenCalled();
    });

    it("calls reset-password API on valid submission", async () => {
      (axios.post as any).mockResolvedValueOnce({
        data: { success: true, message: "Password has been reset." },
      });

      renderResetPassword();

      const user = userEvent.setup();
      const passwordInputs = screen.getAllByPlaceholderText("••••••••");

      await user.type(passwordInputs[0], "StrongP@ss1");
      await user.type(passwordInputs[1], "StrongP@ss1");

      await user.click(screen.getByRole("button", { name: /Reset Password/i }));

      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith("/api/auth/reset-password", {
          token: "valid-test-token-123",
          newPassword: "StrongP@ss1",
        });
      });
    });

    it("shows success state after successful password reset", async () => {
      (axios.post as any).mockResolvedValueOnce({
        data: { success: true },
      });

      renderResetPassword();

      const user = userEvent.setup();
      const passwordInputs = screen.getAllByPlaceholderText("••••••••");

      await user.type(passwordInputs[0], "StrongP@ss1");
      await user.type(passwordInputs[1], "StrongP@ss1");

      await user.click(screen.getByRole("button", { name: /Reset Password/i }));

      await waitFor(() => {
        expect(screen.getByText("Password Reset!")).toBeTruthy();
        expect(screen.getByText(/Your password has been updated successfully/)).toBeTruthy();
        expect(screen.getByRole("button", { name: /Sign In/i })).toBeTruthy();
      });
    });

    it("calls onBackToLogin from success state", async () => {
      (axios.post as any).mockResolvedValueOnce({
        data: { success: true },
      });

      renderResetPassword();

      const user = userEvent.setup();
      const passwordInputs = screen.getAllByPlaceholderText("••••••••");

      await user.type(passwordInputs[0], "StrongP@ss1");
      await user.type(passwordInputs[1], "StrongP@ss1");

      await user.click(screen.getByRole("button", { name: /Reset Password/i }));

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Sign In/i })).toBeTruthy();
      });

      await user.click(screen.getByRole("button", { name: /Sign In/i }));
      expect(mockOnBackToLogin).toHaveBeenCalledTimes(1);
    });

    it("shows error message when API call fails", async () => {
      (axios.post as any).mockRejectedValueOnce({
        response: {
          status: 400,
          data: { error: "Invalid or expired reset token" },
        },
      });

      renderResetPassword();

      const user = userEvent.setup();
      const passwordInputs = screen.getAllByPlaceholderText("••••••••");

      await user.type(passwordInputs[0], "StrongP@ss1");
      await user.type(passwordInputs[1], "StrongP@ss1");

      await user.click(screen.getByRole("button", { name: /Reset Password/i }));

      await waitFor(() => {
        expect(screen.getByText("Invalid or expired reset token")).toBeTruthy();
      });
    });

    it("shows generic error when network fails", async () => {
      (axios.post as any).mockRejectedValueOnce({
        message: "Network Error",
      });

      renderResetPassword();

      const user = userEvent.setup();
      const passwordInputs = screen.getAllByPlaceholderText("••••••••");

      await user.type(passwordInputs[0], "StrongP@ss1");
      await user.type(passwordInputs[1], "StrongP@ss1");

      await user.click(screen.getByRole("button", { name: /Reset Password/i }));

      await waitFor(() => {
        // Component shows err?.message ("Network Error") when no response object
        expect(screen.getByText("Network Error")).toBeTruthy();
      });
    });

    it("calls onBackToLogin when Back to Sign In is clicked from form", async () => {
      renderResetPassword();

      const user = userEvent.setup();
      await user.click(screen.getByText("← Back to Sign In"));

      expect(mockOnBackToLogin).toHaveBeenCalledTimes(1);
    });
  });
});

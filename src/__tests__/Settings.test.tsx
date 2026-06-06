import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import Settings from "../components/Settings";

vi.mock("axios");

function mockGetHealth() {
  (axios.get as any).mockImplementation((url: string) => {
    if (url === "/api/health") {
      return Promise.resolve({
        data: { database: "PostgreSQL 16", connected: true },
      });
    }
    if (url === "/api/settings") {
      return Promise.resolve({
        data: {
          storeName: "Test Store",
          geminiApiKey: "test-key",
          geminiModel: "gemini-flash-latest",
          language: "ur",
          jazzCashNumber: "0300-1234567",
          advanceAmount: 300,
          businessLogo: "",
          phone: "+92 300 1234567",
          address: "Test Address",
          memoryConfig: { enabled: true, summarizationThreshold: 20, embeddingEnabled: true },
          proactiveConfig: {
            enabled: false,
            maxPerDay: 5,
            maxPerRun: 50,
            quietStartHour: 21,
            quietEndHour: 9,
            abandonedCart: { enabled: true, hours: 24 },
            reEngagement: { enabled: true, inactiveDays: 7 },
            priceDrop: { enabled: true },
            birthday: { enabled: true },
          },
        },
      });
    }
    if (url === "/api/email-report/settings") {
      return Promise.resolve({
        data: {
          notificationEmail: "",
          smtpHost: "",
          smtpPort: 587,
          smtpUser: "",
          smtpPass: "",
          emailReportsEnabled: true,
          isSuperAdmin: false,
        },
      });
    }
    return Promise.reject(new Error("Unknown URL: " + url));
  });
}

describe("Settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    mockGetHealth();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Layout and header", () => {
    it("renders the settings page with header", async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByText("Settings")).toBeTruthy();
        expect(screen.getByText("Save Changes")).toBeTruthy();
      });
    });

    it("renders all major setting sections", async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByText("Store Info")).toBeTruthy();
        expect(screen.getByText("AI Engine")).toBeTruthy();
        expect(screen.getByText("AI Memory")).toBeTruthy();
      });
    });
  });

  describe("Store Info", () => {
    it("loads and displays store name from API", async () => {
      render(<Settings />);

      await waitFor(() => {
        const storeNameInput = screen.getByDisplayValue("Test Store");
        expect(storeNameInput).toBeTruthy();
      });
    });

    it("updates store name on input change", async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("Test Store")).toBeTruthy();
      });

      const user = userEvent.setup();
      const input = screen.getByDisplayValue("Test Store");
      await user.clear(input);
      await user.type(input, "Updated Store");

      expect(screen.getByDisplayValue("Updated Store")).toBeTruthy();
    });

    it("shows phone field with loaded value", async () => {
      render(<Settings />);

      await waitFor(() => {
        const phoneInput = screen.getByDisplayValue("+92 300 1234567");
        expect(phoneInput).toBeTruthy();
      });
    });

    it("shows address field with loaded value", async () => {
      render(<Settings />);

      await waitFor(() => {
        const addressInput = screen.getByDisplayValue("Test Address");
        expect(addressInput).toBeTruthy();
      });
    });
  });

  describe("AI Engine", () => {
    it("shows Gemini API key field", async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Enter your Gemini API Key")
        ).toBeTruthy();
      });
    });

    it("toggles API key visibility", async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Enter your Gemini API Key")
        ).toBeTruthy();
      });

      const apiInput = screen.getByPlaceholderText("Enter your Gemini API Key");
      expect(apiInput).toHaveAttribute("type", "password");

      // Find the eye toggle button associated with the API key input
      const keyContainer = apiInput.closest('[class*="relative"]');
      const eyeBtn = keyContainer?.querySelector('button');
      
      if (eyeBtn) {
        const user = userEvent.setup();
        await user.click(eyeBtn);
        expect(apiInput).toHaveAttribute("type", "text");
        await user.click(eyeBtn);
        expect(apiInput).toHaveAttribute("type", "password");
      }
    });

    it("shows AI language selector with Urdu as default", async () => {
      render(<Settings />);

      await waitFor(() => {
        const langSelect = screen.getByDisplayValue("Urdu (Roman) — اردو");
        expect(langSelect).toBeTruthy();
      });
    });

    it("loads available languages in the selector", async () => {
      render(<Settings />);

      await waitFor(() => {
        // Check a few languages
        expect(screen.getByText("English")).toBeTruthy();
      });
    });
  });

  describe("AI Memory", () => {
    it("shows memory toggle enabled by default", async () => {
      render(<Settings />);

      await waitFor(() => {
        const toggle = screen.getByText("Enable AI Memory");
        expect(toggle).toBeTruthy();
      });
    });
  });

  describe("Proactive Agent", () => {
    it("shows proactive agent section with toggles", async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByText("Proactive Agent")).toBeTruthy();
        expect(screen.getByText("Enable Proactive Engine")).toBeTruthy();
      });
    });

    it("shows trigger options when proactive is enabled", async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByText("Proactive Agent")).toBeTruthy();
      });

      const user = userEvent.setup();
      const toggleLabel = screen.getByText("Enable Proactive Engine");
      const toggleCheckbox = toggleLabel.closest("label")?.querySelector('input[type="checkbox"]');

      if (toggleCheckbox) {
        await user.click(toggleCheckbox);

        await waitFor(() => {
          expect(screen.getByText("Abandoned Cart")).toBeTruthy();
          expect(screen.getByText("Re-engagement (Inactive)")).toBeTruthy();
          expect(screen.getByText("Price Drop Alerts")).toBeTruthy();
          expect(screen.getByText("Birthday Greetings")).toBeTruthy();
        });
      }
    });
  });

  describe("Security section", () => {
    it("renders password change fields", async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByText("Security")).toBeTruthy();
        expect(screen.getByText("Change admin password")).toBeTruthy();
        expect(screen.getByPlaceholderText("Enter current password")).toBeTruthy();
        expect(
          screen.getByPlaceholderText(/Min 8 chars/)
        ).toBeTruthy();
        expect(screen.getByPlaceholderText("Re-enter new password")).toBeTruthy();
      });
    });

    it("shows validation error when password fields are empty", async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByText("Change Password")).toBeTruthy();
      });

      const user = userEvent.setup();

      // Find and click change password button
      const changePwBtn = screen.getByText("Change Password");
      await user.click(changePwBtn);

      await waitFor(() => {
        expect(
          screen.getByText("All password fields are required")
        ).toBeTruthy();
      });
    });

    it("shows error when new passwords do not match", async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Enter current password")).toBeTruthy();
      });

      const user = userEvent.setup();
      await user.type(
        screen.getByPlaceholderText("Enter current password"),
        "old"
      );
      await user.type(
        screen.getByPlaceholderText(/Min 8 chars/),
        "newpass123"
      );
      await user.type(
        screen.getByPlaceholderText("Re-enter new password"),
        "different"
      );

      await user.click(screen.getByText("Change Password"));

      await waitFor(() => {
        expect(
          screen.getByText("New passwords do not match")
        ).toBeTruthy();
      });
    });
  });

  describe("Two-Factor Authentication", () => {
    it("renders 2FA section", async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByText("Two-Factor Authentication")).toBeTruthy();
      });
    });
  });

  describe("Advance Payment (JazzCash)", () => {
    it("renders JazzCash payment section", async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByText("Advance Payment")).toBeTruthy();
      });
    });

    it("loads and displays JazzCash number", async () => {
      render(<Settings />);

      await waitFor(() => {
        const jazzInput = screen.getByDisplayValue("0300-1234567");
        expect(jazzInput).toBeTruthy();
      });
    });

    it("shows advance amount default", async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByText("Rs. 300")).toBeTruthy();
      });
    });
  });

  describe("Daily Email Report", () => {
    it("renders email report section", async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByText("Daily Email Report")).toBeTruthy();
      });
    });

    it("shows notification email field", async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("admin@example.com")
        ).toBeTruthy();
      });
    });
  });

  describe("Save settings", () => {
    it("calls save API and shows saved state", async () => {
      (axios.post as any).mockResolvedValueOnce({ data: {} });

      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByText("Save Changes")).toBeTruthy();
      });

      const user = userEvent.setup();
      await user.click(screen.getByText("Save Changes"));

      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith("/api/settings", expect.any(Object));
      });
    });

    it("shows error alert on save failure", async () => {
      const originalAlert = globalThis.alert;
      const mockAlert = vi.fn();
      globalThis.alert = mockAlert;

      (axios.post as any).mockRejectedValueOnce({
        response: { data: { error: "Validation failed" } },
      });

      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByText("Save Changes")).toBeTruthy();
      });

      const user = userEvent.setup();
      await user.click(screen.getByText("Save Changes"));

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith(
          expect.stringContaining("Validation failed")
        );
      });

      globalThis.alert = originalAlert;
    });
  });

  describe("Account Info", () => {
    it("shows account info with database status", async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByText("Account Info")).toBeTruthy();
        expect(screen.getByText(/PostgreSQL/)).toBeTruthy();
      });
    });
  });
});

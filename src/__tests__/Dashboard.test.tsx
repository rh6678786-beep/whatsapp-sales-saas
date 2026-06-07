import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import Dashboard from "../components/Dashboard";

vi.mock("axios");

const mockStatsData = {
  activeUsers: 45,
  totalOrders: 128,
  pendingPayments: 7,
  totalSales: 450000,
  totalProfit: 180000,
  todayProfit: 12500,
  stats: {
    today: { count: 12, value: 45000 },
    week: { count: 85, value: 320000 },
    month: { count: 350, value: 1200000 },
    year: { count: 4200, value: 15000000 },
  },
};

const mockFunnelData = {
  funnel: [
    { state: "NEW", count: 500, dropOff: 0 },
    { state: "INTERESTED", count: 300, dropOff: 40 },
    { state: "PRODUCT_SELECTED", count: 150, dropOff: 50 },
    { state: "ORDER_CONFIRMED", count: 80, dropOff: 47 },
  ],
  totalSessions: 500,
};

const mockActivityData = {
  activities: [
    { type: "order", description: "New order confirmed", time: "2 min ago", icon: "🛒", color: "emerald" },
    { type: "message", description: "Customer replied to AI", time: "5 min ago", icon: "💬", color: "blue" },
    { type: "payment", description: "Payment screenshot received", time: "10 min ago", icon: "📸", color: "amber" },
  ],
  summary: { sessionsToday: 24, ordersToday: 8 },
};

function mockAllApis() {
  (axios.get as any).mockImplementation((url: string) => {
    if (url === "/api/stats") return Promise.resolve({ data: mockStatsData });
    if (url === "/api/analytics/funnel") return Promise.resolve({ data: mockFunnelData });
    if (url === "/api/activity") return Promise.resolve({ data: mockActivityData });
    return Promise.reject(new Error("Unknown URL: " + url));
  });
}

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Loading state", () => {
    it("renders skeleton while data is loading", () => {
      // Don't resolve any API calls immediately
      (axios.get as any).mockImplementation(() => new Promise(() => {}));

      const { container } = render(<Dashboard />);

      // Should show skeleton elements (animated pulse divs)
      const skeletons = container.querySelectorAll(".animate-pulse");
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe("Data rendering", () => {
    it("renders Sales Dashboard header after loading", async () => {
      mockAllApis();
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText("Sales Dashboard")).toBeTruthy();
      });
    });

    it("displays stat cards with values from API", async () => {
      mockAllApis();
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText("Total Revenue")).toBeTruthy();
        expect(screen.getByText(/Rs\.\s*450,000/)).toBeTruthy();
      });

      expect(screen.getByText("Net Profit")).toBeTruthy();
      expect(screen.getByText(/Rs\.\s*180,000/)).toBeTruthy();
      expect(screen.getByText("Pending Verification")).toBeTruthy();
      expect(screen.getByText("7")).toBeTruthy();
      expect(screen.getByText("Confirmed Orders")).toBeTruthy();
      expect(screen.getByText("128")).toBeTruthy();
    });

    it("shows Live Monitoring status indicator", async () => {
      mockAllApis();
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText("Live Monitoring")).toBeTruthy();
      });
    });
  });

  describe("Revenue chart", () => {
    it("renders revenue chart section with time range selector", async () => {
      mockAllApis();
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText("Revenue Growth")).toBeTruthy();
        expect(screen.getByText("Last 7 Days")).toBeTruthy();
      });
    });

    it("switches chart time range on selector change", async () => {
      mockAllApis();
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText("Last 7 Days")).toBeTruthy();
      });

      const user = userEvent.setup();
      const select = screen.getByRole("combobox");
      await user.selectOptions(select, "1M");

      await waitFor(() => {
        expect(screen.getByText("Last 1 Month (Weekly)")).toBeTruthy();
      });

      await user.selectOptions(select, "6M");
      expect(screen.getByText("Last 6 Months")).toBeTruthy();
    });
  });

  describe("Period stats sidebar", () => {
    it("displays Today, This Week, This Month stats", async () => {
      mockAllApis();
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText("Today")).toBeTruthy();
        expect(screen.getByText("This Week")).toBeTruthy();
        expect(screen.getByText("This Month")).toBeTruthy();
      });
    });

    it("shows order counts for each period", async () => {
      mockAllApis();
      render(<Dashboard />);

      await waitFor(() => {
        // Today: 12 orders, value PKR 45,000
        expect(screen.getByText(/12.*Orders/i)).toBeTruthy();
        // Week: 85 orders
        expect(screen.getByText(/85.*Orders/i)).toBeTruthy();
      });
    });
  });

  describe("Conversion funnel", () => {
    it("renders conversion funnel with stages", async () => {
      mockAllApis();
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText("Conversion Funnel")).toBeTruthy();
      });

      await waitFor(() => {
        expect(screen.getByText("NEW")).toBeTruthy();
        expect(screen.getByText("INTERESTED")).toBeTruthy();
        expect(screen.getByText("PRODUCT SELECTED")).toBeTruthy();
        expect(screen.getByText("ORDER CONFIRMED")).toBeTruthy();
      });
    });

    it("shows total sessions count", async () => {
      mockAllApis();
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText(/500 Total Sessions/)).toBeTruthy();
      });
    });

    it("shows drop-off percentages", async () => {
      mockAllApis();
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText("40%")).toBeTruthy();
        expect(screen.getByText("50%")).toBeTruthy();
        expect(screen.getByText("47%")).toBeTruthy();
      });
    });
  });

  describe("Activity feed", () => {
    it("renders activity feed section", async () => {
      mockAllApis();
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText("Activity Feed")).toBeTruthy();
      });
    });

    it("displays activity summary cards", async () => {
      mockAllApis();
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText("Sessions Today")).toBeTruthy();
        expect(screen.getByText("Orders Today")).toBeTruthy();
      });

      expect(screen.getByText("24")).toBeTruthy();
      expect(screen.getByText("8")).toBeTruthy();
    });

    it("renders individual activity items", async () => {
      mockAllApis();
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText("New order confirmed")).toBeTruthy();
        expect(screen.getByText("Customer replied to AI")).toBeTruthy();
        expect(screen.getByText("Payment screenshot received")).toBeTruthy();
      });
    });

    it("shows relative timestamps for activities", async () => {
      mockAllApis();
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText("2 min ago")).toBeTruthy();
        expect(screen.getByText("5 min ago")).toBeTruthy();
      });
    });
  });

  describe("Error handling", () => {
    it("shows skeleton when stats API fails", async () => {
      (axios.get as any).mockImplementation((url: string) => {
        if (url === "/api/stats") return Promise.reject(new Error("API Error"));
        if (url === "/api/analytics/funnel") return Promise.resolve({ data: mockFunnelData });
        if (url === "/api/activity") return Promise.resolve({ data: mockActivityData });
        return Promise.reject(new Error("Unknown"));
      });

      const { container } = render(<Dashboard />);

      // Should still show skeleton since stats is null (required for render)
      await vi.waitFor(() => {
        const skeletons = container.querySelectorAll(".animate-pulse");
        expect(skeletons.length).toBeGreaterThan(0);
      });
    });

    it("handles activity API failure gracefully", async () => {
      (axios.get as any).mockImplementation((url: string) => {
        if (url === "/api/stats") return Promise.resolve({ data: mockStatsData });
        if (url === "/api/analytics/funnel") return Promise.resolve({ data: mockFunnelData });
        if (url === "/api/activity") return Promise.reject(new Error("Activity Error"));
        return Promise.reject(new Error("Unknown"));
      });

      render(<Dashboard />);

      // Dashboard should still render with stats
      await waitFor(() => {
        expect(screen.getByText("Sales Dashboard")).toBeTruthy();
      });

      // Activity heading always renders, but the inner content should not
      expect(screen.getByText("Activity Feed")).toBeTruthy();
      // Summary cards (Sessions Today, Orders Today) should NOT render
      expect(screen.queryByText("Sessions Today")).toBeNull();
    });

    it("handles funnel API failure gracefully", async () => {
      (axios.get as any).mockImplementation((url: string) => {
        if (url === "/api/stats") return Promise.resolve({ data: mockStatsData });
        if (url === "/api/analytics/funnel") return Promise.reject(new Error("Funnel Error"));
        if (url === "/api/activity") return Promise.resolve({ data: mockActivityData });
        return Promise.reject(new Error("Unknown"));
      });

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText("Sales Dashboard")).toBeTruthy();
      });

      // Funnel should not render if data failed
      expect(screen.queryByText("Conversion Funnel")).toBeNull();
    });
  });
});

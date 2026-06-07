import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import ProductManager from "../components/ProductManager";

vi.mock("axios");
vi.mock("react-hot-toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockProducts = [
  {
    id: "p1",
    name: "Smart Watch X1",
    price: 5000,
    costPrice: 3000,
    features: ["Water Resistant", "Heart Rate Monitor", "GPS Tracking"],
    images: ["https://example.com/watch.jpg"],
    videos: [],
    stock: 10,
  },
  {
    id: "p2",
    name: "Wireless Earbuds Pro",
    price: 3000,
    costPrice: 1800,
    features: ["Noise Cancelling", "12hr Battery"],
    images: [],
    videos: [],
    stock: 25,
  },
];

const mockPaginatedResponse = {
  data: {
    data: mockProducts,
    pagination: { total: 2, totalPages: 1, page: 1, limit: 20 },
    total: 2,
    totalPages: 1,
  },
};

function mockProductApi(url: string) {
  if (url?.startsWith("/api/products?page=")) {
    return Promise.resolve(mockPaginatedResponse);
  }
  if (url === "/api/products?page=1&pageSize=20") {
    return Promise.resolve(mockPaginatedResponse);
  }
  return Promise.reject(new Error("Unknown URL: " + url));
}

describe("ProductManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Loading state", () => {
    it("shows TableSkeleton while products are loading", () => {
      (axios.get as any).mockImplementation(() => new Promise(() => {}));

      const { container } = render(<ProductManager />);
      const skeletons = container.querySelectorAll(".animate-pulse");
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe("Product grid", () => {
    it("renders Product Catalog header", async () => {
      (axios.get as any).mockImplementation(mockProductApi);
      render(<ProductManager />);

      await waitFor(() => {
        expect(screen.getByText("Product Catalog")).toBeTruthy();
      });
    });

    it("displays product cards with names", async () => {
      (axios.get as any).mockImplementation(mockProductApi);
      render(<ProductManager />);

      await waitFor(() => {
        expect(screen.getByText("Smart Watch X1")).toBeTruthy();
        expect(screen.getByText("Wireless Earbuds Pro")).toBeTruthy();
      });
    });

    it("shows product prices", async () => {
      (axios.get as any).mockImplementation(mockProductApi);
      render(<ProductManager />);

      await waitFor(() => {
        const prices = screen.getAllByText(/5,000/);
        expect(prices.length).toBeGreaterThanOrEqual(1);
      });
    });

    it("shows product features", async () => {
      (axios.get as any).mockImplementation(mockProductApi);
      render(<ProductManager />);

      await waitFor(() => {
        expect(screen.getByText("Water Resistant")).toBeTruthy();
        expect(screen.getByText("Heart Rate Monitor")).toBeTruthy();
        expect(screen.getByText("GPS Tracking")).toBeTruthy();
        expect(screen.getByText("Noise Cancelling")).toBeTruthy();
      });
    });

    it("shows cost price label on cards", async () => {
      (axios.get as any).mockImplementation(mockProductApi);
      render(<ProductManager />);

      await waitFor(() => {
        const costLabels = screen.getAllByText(/Cost:/);
        expect(costLabels.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe("Search", () => {
    it("renders search bar with placeholder", async () => {
      (axios.get as any).mockImplementation(mockProductApi);
      render(<ProductManager />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search products...")
        ).toBeTruthy();
      });
    });
  });

  describe("Filter buttons", () => {
    it("renders All, In Stock, Out of Stock filters", async () => {
      (axios.get as any).mockImplementation(mockProductApi);
      render(<ProductManager />);

      await waitFor(() => {
        expect(screen.getByText("All")).toBeTruthy();
        expect(screen.getByText("In Stock")).toBeTruthy();
        expect(screen.getByText("Out of Stock")).toBeTruthy();
      });
    });

    it("shows All filter as active by default", async () => {
      (axios.get as any).mockImplementation(mockProductApi);
      render(<ProductManager />);

      await waitFor(() => {
        const allBtn = screen.getByText("All");
        expect(allBtn.className).toContain("bg-zinc-900");
      });
    });
  });

  describe("Add product button", () => {
    it("shows Add New Product button", async () => {
      (axios.get as any).mockImplementation(mockProductApi);
      render(<ProductManager />);

      await waitFor(() => {
        expect(screen.getByText("Add New Product")).toBeTruthy();
      });
    });

    it("opens modal with form on Add click", async () => {
      (axios.get as any).mockImplementation(mockProductApi);
      render(<ProductManager />);

      const user = userEvent.setup();
      const addBtn = await screen.findByText("Add New Product");
      await user.click(addBtn);

      await waitFor(() => {
        expect(screen.getByText("New Product")).toBeTruthy();
        expect(
          screen.getByPlaceholderText("e.g. Ultra Smart Watch Series 9")
        ).toBeTruthy();
      });
    });

    it("closes modal on X button click", async () => {
      (axios.get as any).mockImplementation(mockProductApi);
      render(<ProductManager />);

      const user = userEvent.setup();
      const addBtn = await screen.findByText("Add New Product");
      await user.click(addBtn);

      await waitFor(() => {
        expect(screen.getByText("New Product")).toBeTruthy();
      });

      const xButtons = document.querySelectorAll(
        'button:has(> svg.lucide-x)'
      );
      if (xButtons.length > 0) {
        await user.click(xButtons[0] as HTMLElement);
        await waitFor(() => {
          expect(screen.queryByText("New Product")).toBeNull();
        });
      }
    });
  });

  describe("Add product form", () => {
    it("validates cost price must be less than sale price", async () => {
      (axios.get as any).mockImplementation(mockProductApi);
      render(<ProductManager />);

      const user = userEvent.setup();
      const addBtn = await screen.findByText("Add New Product");
      await user.click(addBtn);

      await waitFor(() => {
        expect(screen.getByText("Create Product")).toBeTruthy();
      });

      const nameInput = screen.getByPlaceholderText(
        "e.g. Ultra Smart Watch Series 9"
      );
      await user.type(nameInput, "Test Product");

      const numberInputs = document.querySelectorAll(
        'input[type="number"]'
      ) as unknown as HTMLInputElement[];

      if (numberInputs.length >= 2) {
        await user.clear(numberInputs[0]);
        await user.type(numberInputs[0], "100");
        await user.clear(numberInputs[1]);
        await user.type(numberInputs[1], "200");
      }

      const featuresTextarea = document.querySelectorAll("textarea");
      if (featuresTextarea.length > 0) {
        await user.type(featuresTextarea[featuresTextarea.length - 1], "Feature A");
      }

      const submitBtn = screen.getByText("Create Product");
      await user.click(submitBtn);

      await waitFor(() => {
        expect(
          screen.getByText(/Sale Price cost price se zyada/)
        ).toBeTruthy();
      });
    });

    it("shows profit analysis when both prices entered", async () => {
      (axios.get as any).mockImplementation(mockProductApi);
      render(<ProductManager />);

      const user = userEvent.setup();
      const addBtn = await screen.findByText("Add New Product");
      await user.click(addBtn);

      await waitFor(() => {
        expect(screen.getByText("Create Product")).toBeTruthy();
      });

      const numberInputs = document.querySelectorAll(
        'input[type="number"]'
      ) as unknown as HTMLInputElement[];

      if (numberInputs.length >= 2) {
        await user.clear(numberInputs[0]);
        await user.type(numberInputs[0], "500");
        await user.clear(numberInputs[1]);
        await user.type(numberInputs[1], "300");
      }

      await waitFor(() => {
        expect(screen.getByText(/Estimated Profit/)).toBeTruthy();
      });
    });
  });

  describe("Empty state", () => {
    it("shows empty state when no products exist", async () => {
      (axios.get as any).mockResolvedValueOnce({
        data: { data: [], pagination: { total: 0, totalPages: 0 }, total: 0, totalPages: 0 },
      });

      render(<ProductManager />);

      await waitFor(() => {
        expect(
          screen.getByText("No products found in catalog.")
        ).toBeTruthy();
      });
    });

    it("shows add first product link in empty state", async () => {
      (axios.get as any).mockResolvedValueOnce({
        data: { data: [], pagination: { total: 0, totalPages: 0 }, total: 0, totalPages: 0 },
      });

      render(<ProductManager />);

      await waitFor(() => {
        expect(
          screen.getByText("Add your first product")
        ).toBeTruthy();
      });
    });
  });

  describe("Error state", () => {
    it("shows error message when API fails", async () => {
      (axios.get as any).mockRejectedValueOnce({
        response: { data: { error: "Database connection failed" } },
      });

      render(<ProductManager />);

      await waitFor(() => {
        expect(screen.getByText("Failed to load products")).toBeTruthy();
      });
    });

    it("shows Try Again button on error", async () => {
      (axios.get as any).mockRejectedValueOnce({
        response: { data: { error: "Failed" } },
      });

      render(<ProductManager />);

      await waitFor(() => {
        expect(screen.getByText("Try Again")).toBeTruthy();
      });
    });
  });

  describe("Bulk import button", () => {
    it("shows Bulk Import button", async () => {
      (axios.get as any).mockImplementation(mockProductApi);
      render(<ProductManager />);

      await waitFor(() => {
        expect(screen.getByText("Bulk Import")).toBeTruthy();
      });
    });
  });

  describe("Selection", () => {
    it("shows Select All checkbox when products are loaded", async () => {
      (axios.get as any).mockImplementation(mockProductApi);
      render(<ProductManager />);

      await waitFor(() => {
        expect(screen.getByText("Smart Watch X1")).toBeTruthy();
      });

      // Click the 3-dots menu button to open dropdown with Select All option
      const user = userEvent.setup();
      const menuButtons = document.querySelectorAll('button[title="Bulk Actions"]');
      if (menuButtons.length > 0) {
        await user.click(menuButtons[0]);
      }

      await waitFor(() => {
        expect(screen.getByText("Select All")).toBeTruthy();
      });
    });

    it("shows batch action bar when a product is selected", async () => {
      (axios.get as any).mockImplementation(mockProductApi);
      render(<ProductManager />);

      await waitFor(() => {
        expect(screen.getByText("Smart Watch X1")).toBeTruthy();
      });

      const user = userEvent.setup();
      // Select All is the first checkbox; skip it and click the first product checkbox
      const allCheckboxes = document.querySelectorAll(
        'input[type="checkbox"]'
      ) as unknown as HTMLInputElement[];
      const productCheckboxes = Array.from(allCheckboxes).filter(
        (cb) => cb.closest('.absolute.top-4')
      );

      if (productCheckboxes.length > 0) {
        await user.click(productCheckboxes[0]);
      }

      await waitFor(() => {
        expect(screen.getByText(/1 selected/)).toBeTruthy();
      });
    });

    it("shows Cancel and Delete Selected in batch bar", async () => {
      (axios.get as any).mockImplementation(mockProductApi);
      render(<ProductManager />);

      await waitFor(() => {
        expect(screen.getByText("Smart Watch X1")).toBeTruthy();
      });

      const user = userEvent.setup();
      const allCheckboxes = document.querySelectorAll(
        'input[type="checkbox"]'
      ) as unknown as HTMLInputElement[];
      const productCheckboxes = Array.from(allCheckboxes).filter(
        (cb) => cb.closest('.absolute.top-4')
      );

      if (productCheckboxes.length > 0) {
        await user.click(productCheckboxes[0]);
      }

      await waitFor(() => {
        expect(screen.getByText("Cancel")).toBeTruthy();
        expect(screen.getByText("Delete Selected")).toBeTruthy();
      });
    });
  });
});

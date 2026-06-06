import { describe, it, expect } from "vitest";
import { SmartNegotiationService, NegotiationState } from "../services/smartNegotiationService.js";
import { Product } from "../../src/types.js";

function createMockProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "prod-1",
    name: "Test Product",
    price: 4000,
    costPrice: 2000,
    stock: 10,
    features: ["Feature A", "Feature B"],
    images: [],
    videos: [],
    ...overrides,
  };
}

function createInitialState(): NegotiationState {
  return {
    isNegotiating: false,
    originalPrice: 0,
    currentOfferedPrice: 0,
    discountGiven: 0,
    negotiationCount: 0,
    lastOfferAt: null,
    offerHistory: [],
    customerSatisfactionLevel: 'HIGH',
  };
}

describe("SmartNegotiationService", () => {
  describe("getInitialNegotiationState", () => {
    it("should return a fresh negotiation state", () => {
      const state = SmartNegotiationService.getInitialNegotiationState();
      expect(state.isNegotiating).toBe(false);
      expect(state.discountGiven).toBe(0);
      expect(state.negotiationCount).toBe(0);
      expect(state.offerHistory).toEqual([]);
      expect(state.customerSatisfactionLevel).toBe('HIGH');
    });
  });

  describe("getMaxDiscountForProduct", () => {
    it("should return HIGH_DISCOUNT_MAX for products > Rs. 6000", () => {
      const product = createMockProduct({ price: 8000 });
      expect(SmartNegotiationService.getMaxDiscountForProduct(product)).toBe(400);
    });

    it("should return LOW_DISCOUNT_MAX for products > Rs. 3500 and <= Rs. 6000", () => {
      const product = createMockProduct({ price: 5000 });
      expect(SmartNegotiationService.getMaxDiscountForProduct(product)).toBe(200);
    });

    it("should return 0 for products <= Rs. 3500", () => {
      const product = createMockProduct({ price: 3000 });
      expect(SmartNegotiationService.getMaxDiscountForProduct(product)).toBe(0);
    });
  });

  describe("isPriceNegotiationRequest", () => {
    it("should detect Urdu negotiation keywords", () => {
      expect(SmartNegotiationService.isPriceNegotiationRequest("kam kar do")).toBe(true);
      expect(SmartNegotiationService.isPriceNegotiationRequest("sasta karo")).toBe(true);
    });

    it("should detect English negotiation keywords", () => {
      expect(SmartNegotiationService.isPriceNegotiationRequest("give me discount")).toBe(true);
      expect(SmartNegotiationService.isPriceNegotiationRequest("can you lower the price")).toBe(true);
    });

    it("should return false for non-negotiation messages", () => {
      expect(SmartNegotiationService.isPriceNegotiationRequest("hello")).toBe(false);
      expect(SmartNegotiationService.isPriceNegotiationRequest("product kya hai")).toBe(false);
    });
  });

  describe("isCustomerDissatisfied", () => {
    it("should detect dissatisfaction with 'nahi' keyword", () => {
      expect(SmartNegotiationService.isCustomerDissatisfied("nahi yeh theek nahi hai", 200)).toBe(true);
    });

    it("should return true with dissatisfaction keywords even without previous offer", () => {
      // The method returns hasDissatisfaction directly, even without a previous offer
      expect(SmartNegotiationService.isCustomerDissatisfied("nahi", undefined)).toBe(true);
    });

    it("should return false for positive messages", () => {
      expect(SmartNegotiationService.isCustomerDissatisfied("theek hai", 200)).toBe(false);
    });
  });

  describe("isCustomerPositive", () => {
    it("should detect positive responses", () => {
      expect(SmartNegotiationService.isCustomerPositive("ok")).toBe(true);
      expect(SmartNegotiationService.isCustomerPositive("theek hai")).toBe(true);
      expect(SmartNegotiationService.isCustomerPositive("done")).toBe(true);
      expect(SmartNegotiationService.isCustomerPositive("great deal")).toBe(true);
    });

    it("should return false for negative responses", () => {
      expect(SmartNegotiationService.isCustomerPositive("nahi")).toBe(false);
      expect(SmartNegotiationService.isCustomerPositive("too expensive")).toBe(false);
    });
  });

  describe("analyzeCustomerSatisfaction", () => {
    it("should return HIGH when no offers have been made", () => {
      const satisfaction = SmartNegotiationService.analyzeCustomerSatisfaction("ok", []);
      expect(satisfaction).toBe('HIGH');
    });

    it("should return HIGH for positive keywords", () => {
      const history = [{ discount: 100, price: 3900, at: new Date().toISOString() }];
      expect(SmartNegotiationService.analyzeCustomerSatisfaction("ok theek hai", history)).toBe('HIGH');
    });

    it("should return LOW for negative keywords with large discount already given", () => {
      const history = [{ discount: 300, price: 3700, at: new Date().toISOString() }];
      expect(SmartNegotiationService.analyzeCustomerSatisfaction("nahi, bahut mehngi", history)).toBe('LOW');
    });
  });

  describe("calculateMinimumProfitablePrice", () => {
    it("should calculate 15% margin above cost price", () => {
      const product = createMockProduct({ costPrice: 2000 });
      const minPrice = SmartNegotiationService.calculateMinimumProfitablePrice(product);
      // 2000 * 0.15 = 2300, rounded up to nearest 100 = 2300
      expect(minPrice).toBe(2300);
    });

    it("should handle zero cost price", () => {
      const product = createMockProduct({ costPrice: 0, price: 1000 });
      const minPrice = SmartNegotiationService.calculateMinimumProfitablePrice(product);
      expect(minPrice).toBe(0);
    });
  });

  describe("canOfferDiscount", () => {
    it("should return false for products under Rs. 3500", () => {
      const product = createMockProduct({ price: 2000 });
      expect(SmartNegotiationService.canOfferDiscount(product, 0)).toBe(false);
    });

    it("should return false if discount would go below minimum profitable price", () => {
      const product = createMockProduct({ price: 3600, costPrice: 3500 });
      // min profitable = 4025 -> 4100, price 3600 is already below that
      expect(SmartNegotiationService.canOfferDiscount(product, 0)).toBe(false);
    });

    it("should return true for products with room to discount", () => {
      const product = createMockProduct({ price: 5000, costPrice: 2000 });
      expect(SmartNegotiationService.canOfferDiscount(product, 0)).toBe(true);
    });
  });

  describe("calculateNextDiscount", () => {
    it("should return first discount step (Rs. 100) for 4000 product", () => {
      const product = createMockProduct({ price: 4000, costPrice: 2000 });
      const state = createInitialState();
      const result = SmartNegotiationService.calculateNextDiscount(state, product);
      expect(result.discount).toBe(100);
      expect(result.newPrice).toBe(3900);
      expect(result.canProceed).toBe(true);
    });

    it("should return next discount step when already at Rs. 100", () => {
      const product = createMockProduct({ price: 5000, costPrice: 2000 });
      const state = { ...createInitialState(), discountGiven: 100 };
      const result = SmartNegotiationService.calculateNextDiscount(state, product);
      expect(result.discount).toBe(200);
      expect(result.newPrice).toBe(4800);
    });

    it("should cap discount at max when already at limit", () => {
      const product = createMockProduct({ price: 5000, costPrice: 2000 });
      const state = { ...createInitialState(), discountGiven: 200 }; // max is 200
      const result = SmartNegotiationService.calculateNextDiscount(state, product);
      expect(result.discount).toBeGreaterThanOrEqual(200);
    });
  });

  describe("processNegotiation — full flow", () => {
    it("should refuse discount for products under Rs. 3500", () => {
      const product = createMockProduct({ price: 2000, costPrice: 500 });
      const state = createInitialState();
      const result = SmartNegotiationService.processNegotiation("kam karo", product, state, 30);
      expect(result.shouldOfferDiscount).toBe(false);
      expect(result.message).toBe("no_discount_available");
    });

    it("should ask customer to chat more if message count < 20", () => {
      const product = createMockProduct({ price: 5000, costPrice: 2000 });
      const state = createInitialState();
      const result = SmartNegotiationService.processNegotiation("kam karo", product, state, 5);
      expect(result.shouldOfferDiscount).toBe(false);
      expect(result.message).toBe("chat_15_more");
      expect(result.negotiationState.isNegotiating).toBe(true);
    });

    it("should offer Rs. 100 discount on first negotiation after 20 messages", () => {
      const product = createMockProduct({ price: 5000, costPrice: 2000 });
      const state = createInitialState();
      const result = SmartNegotiationService.processNegotiation("thoda discount do", product, state, 25);
      expect(result.shouldOfferDiscount).toBe(true);
      expect(result.discountAmount).toBe(100);
      expect(result.newPrice).toBe(4900);
      expect(result.negotiationState.negotiationCount).toBe(1);
    });

    it("should escalate discount when customer is dissatisfied", () => {
      const product = createMockProduct({ price: 5000, costPrice: 2000 });
      const state = {
        ...createInitialState(),
        discountGiven: 100,
        currentOfferedPrice: 4900,
        negotiationCount: 1,
        lastOfferAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        offerHistory: [{ discount: 100, price: 4900, at: new Date().toISOString() }],
      };
      const result = SmartNegotiationService.processNegotiation("nahi, aur discount do", product, state, 25);
      expect(result.shouldOfferDiscount).toBe(true);
      expect(result.discountAmount).toBe(200);
      expect(result.newPrice).toBe(4800);
    });

    it("should detect max discount reached", () => {
      const product = createMockProduct({ price: 5000, costPrice: 2000 });
      const state = {
        ...createInitialState(),
        discountGiven: 400,
        currentOfferedPrice: 4600,
        negotiationCount: 4,
        lastOfferAt: new Date(Date.now() - 3600000).toISOString(),
        offerHistory: [
          { discount: 100, price: 4900, at: new Date().toISOString() },
          { discount: 200, price: 4800, at: new Date().toISOString() },
          { discount: 300, price: 4700, at: new Date().toISOString() },
          { discount: 400, price: 4600, at: new Date().toISOString() },
        ],
      };
      const result = SmartNegotiationService.processNegotiation("aur chahiye discount", product, state, 25);
      expect(result.shouldOfferDiscount).toBe(false);
      expect(result.maxDiscountReached).toBe(true);
      expect(result.message).toBe("max_discount_reached");
    });

    it("should not offer discount if recent offer was made (< 5 min)", () => {
      const product = createMockProduct({ price: 5000, costPrice: 2000 });
      const state = {
        ...createInitialState(),
        discountGiven: 100,
        currentOfferedPrice: 4900,
        lastOfferAt: new Date().toISOString(), // just now
        offerHistory: [{ discount: 100, price: 4900, at: new Date().toISOString() }],
      };
      const result = SmartNegotiationService.processNegotiation("aur discount do", product, state, 25);
      expect(result.shouldOfferDiscount).toBe(false);
      expect(result.message).toBe("recent_offer");
    });
  });

  describe("generateNegotiationMessage", () => {
    it("should generate message for Rs. 100 discount", () => {
      const result = {
        shouldOfferDiscount: true,
        discountAmount: 100,
        newPrice: 3900,
        message: "first_offer_100",
        negotiationState: createInitialState(),
        maxDiscountReached: false,
        customerSatisfied: false,
      };
      const msg = SmartNegotiationService.generateNegotiationMessage(result, "Test Product");
      expect(msg).toBeDefined();
      expect(msg).toContain("100");
      expect(msg).toContain("3900");
    });

    it("should generate max discount reached message", () => {
      const result = {
        shouldOfferDiscount: false,
        discountAmount: 200,
        newPrice: 3800,
        message: "max_discount_reached",
        negotiationState: createInitialState(),
        maxDiscountReached: true,
        customerSatisfied: false,
      };
      const msg = SmartNegotiationService.generateNegotiationMessage(result, "Test Product");
      expect(msg).toBeDefined();
      expect(msg).toContain("200");
      expect(msg).toContain("3800");
    });

    it("should return null for chat_X_more messages", () => {
      const result = {
        shouldOfferDiscount: false,
        discountAmount: 0,
        newPrice: 5000,
        message: "chat_15_more",
        negotiationState: createInitialState(),
        maxDiscountReached: false,
        customerSatisfied: true,
      };
      const msg = SmartNegotiationService.generateNegotiationMessage(result, "Test Product");
      expect(msg).toBeNull();
    });

    it("should return null for satisfied_or_no_request messages", () => {
      const result = {
        shouldOfferDiscount: false,
        discountAmount: 0,
        newPrice: 5000,
        message: "satisfied_or_no_request",
        negotiationState: createInitialState(),
        maxDiscountReached: false,
        customerSatisfied: true,
      };
      const msg = SmartNegotiationService.generateNegotiationMessage(result, "Test Product");
      expect(msg).toBeNull();
    });

    it("should generate no_discount_available message", () => {
      const result = {
        shouldOfferDiscount: false,
        discountAmount: 0,
        newPrice: 2000,
        message: "no_discount_available",
        negotiationState: createInitialState(),
        maxDiscountReached: true,
        customerSatisfied: true,
      };
      const msg = SmartNegotiationService.generateNegotiationMessage(result, "Budget Product");
      expect(msg).toBeDefined();
      expect(msg).toContain("Budget Product");
    });
  });

  describe("getDiscountStepsForProduct", () => {
    it("should return full steps for high-price products", () => {
      const product = createMockProduct({ price: 7000 });
      const steps = SmartNegotiationService.getDiscountStepsForProduct(product);
      expect(steps).toEqual([100, 200, 300, 400]);
    });

    it("should return limited steps for mid-range products", () => {
      const product = createMockProduct({ price: 4000 });
      const steps = SmartNegotiationService.getDiscountStepsForProduct(product);
      expect(steps).toEqual([100, 200]);
    });

    it("should return empty steps for low-price products", () => {
      const product = createMockProduct({ price: 3000 });
      const steps = SmartNegotiationService.getDiscountStepsForProduct(product);
      expect(steps).toEqual([]);
    });
  });

  describe("saveNegotiationState", () => {
    it("should merge negotiation state into metadata", () => {
      const metadata = { leadScore: 50, leadStatus: "WARM" };
      const state = createInitialState();
      const updated = SmartNegotiationService.saveNegotiationState(metadata, state);
      expect(updated.leadScore).toBe(50);
      expect(updated.negotiationState).toEqual(state);
    });
  });

  // ===============================================
  // getNegotiationState
  // ===============================================
  describe("getNegotiationState", () => {
    it("should return initial state when metadata is empty", () => {
      const state = SmartNegotiationService.getNegotiationState({});
      expect(state.isNegotiating).toBe(false);
      expect(state.discountGiven).toBe(0);
    });

    it("should return initial state when metadata is null", () => {
      const state = SmartNegotiationService.getNegotiationState(null);
      expect(state.isNegotiating).toBe(false);
    });

    it("should return existing negotiation state when present", () => {
      const existingState: NegotiationState = {
        isNegotiating: true,
        originalPrice: 5000,
        currentOfferedPrice: 4800,
        discountGiven: 200,
        negotiationCount: 2,
        lastOfferAt: new Date().toISOString(),
        offerHistory: [{ discount: 100, price: 4900, at: new Date().toISOString() }],
        customerSatisfactionLevel: 'MEDIUM',
      };
      const state = SmartNegotiationService.getNegotiationState({ negotiationState: existingState });
      expect(state.isNegotiating).toBe(true);
      expect(state.discountGiven).toBe(200);
      expect(state.negotiationCount).toBe(2);
    });
  });

  // ===============================================
  // processNegotiation — additional edge cases
  // ===============================================
  describe("processNegotiation — edge cases", () => {
    it("should not offer discount when message is not a negotiation request", () => {
      const product = createMockProduct({ price: 5000, costPrice: 2000 });
      const state = createInitialState();
      const result = SmartNegotiationService.processNegotiation(
        "yeh product kaisa hai?",
        product, state, 25
      );
      expect(result.shouldOfferDiscount).toBe(false);
      expect(result.message).toBe("");
    });

    it("should return satisfied state when customer is positive and no negotiation", () => {
      const product = createMockProduct({ price: 5000, costPrice: 2000 });
      const state = createInitialState();
      const result = SmartNegotiationService.processNegotiation(
        "ok theek hai",
        product, state, 25
      );
      expect(result.shouldOfferDiscount).toBe(false);
      expect(result.customerSatisfied).toBe(true);
    });

    it("should work with very high message count", () => {
      const product = createMockProduct({ price: 5000, costPrice: 2000 });
      const state = createInitialState();
      const result = SmartNegotiationService.processNegotiation(
        "discount do",
        product, state, 100
      );
      // Should work same as any count >= 20
      expect(result.shouldOfferDiscount).toBe(true);
      expect(result.discountAmount).toBe(100);
    });

    it("should handle product at boundary price (3501)", () => {
      const product = createMockProduct({ price: 3501, costPrice: 2000 });
      const state = createInitialState();
      const result = SmartNegotiationService.processNegotiation(
        "kam karo",
        product, state, 25
      );
      // 3501 > 3500, so discount is possible
      expect(result.shouldOfferDiscount).toBe(true);
    });

    it("should handle product exactly at boundary price (3500)", () => {
      const product = createMockProduct({ price: 3500, costPrice: 2000 });
      const state = createInitialState();
      const result = SmartNegotiationService.processNegotiation(
        "kam karo",
        product, state, 25
      );
      // 3500 <= 3500, so no discount
      expect(result.shouldOfferDiscount).toBe(false);
      expect(result.message).toBe("no_discount_available");
    });
  });

  // ===============================================
  // generateNegotiationMessage — all discount levels
  // ===============================================
  describe("generateNegotiationMessage — all discount levels", () => {
    it("should generate message for Rs. 300 discount", () => {
      const result = {
        shouldOfferDiscount: true,
        discountAmount: 300,
        newPrice: 4700,
        message: "next_offer_300",
        negotiationState: createInitialState(),
        maxDiscountReached: false,
        customerSatisfied: false,
      };
      const msg = SmartNegotiationService.generateNegotiationMessage(result, "Test Product");
      expect(msg).toBeDefined();
      expect(msg).toContain("300");
      expect(msg).toContain("4700");
    });

    it("should generate message for Rs. 400 discount", () => {
      const result = {
        shouldOfferDiscount: true,
        discountAmount: 400,
        newPrice: 4600,
        message: "next_offer_400",
        negotiationState: createInitialState(),
        maxDiscountReached: false,
        customerSatisfied: false,
      };
      const msg = SmartNegotiationService.generateNegotiationMessage(result, "Test Product");
      expect(msg).toBeDefined();
      expect(msg).toContain("400");
      expect(msg).toContain("4600");
    });

    it("should generate recent_offer message", () => {
      const result = {
        shouldOfferDiscount: false,
        discountAmount: 100,
        newPrice: 4900,
        message: "recent_offer",
        negotiationState: createInitialState(),
        maxDiscountReached: false,
        customerSatisfied: false,
      };
      const msg = SmartNegotiationService.generateNegotiationMessage(result, "Test Product");
      expect(msg).toBeDefined();
      expect(msg).toContain("thodi der pehle");
    });
  });

  // ===============================================
  // isCustomerDissatisfied — edge cases
  // ===============================================
  describe("isCustomerDissatisfied — edge cases", () => {
    it("should return false for empty message", () => {
      expect(SmartNegotiationService.isCustomerDissatisfied("", 200)).toBe(false);
    });

    it("should detect dissatisfaction with 'nhi' variant", () => {
      expect(SmartNegotiationService.isCustomerDissatisfied("nhi chahiye", 200)).toBe(true);
    });

    it("should detect dissatisfaction with 'zyada' keyword", () => {
      expect(SmartNegotiationService.isCustomerDissatisfied("zyada hai", 200)).toBe(true);
    });

    it("should detect dissatisfaction without previous offer", () => {
      expect(SmartNegotiationService.isCustomerDissatisfied("nahi", undefined)).toBe(true);
    });
  });

  // ===============================================
  // canOfferDiscount — edge cases
  // ===============================================
  describe("canOfferDiscount — edge cases", () => {
    it("should return false when current discount already exceeds profitable limit", () => {
      const product = createMockProduct({ price: 3600, costPrice: 3400 });
      // min profitable = 3400 * 1.15 = 3910 -> 4000
      // price 3600 already below min profitable, so can't discount
      expect(SmartNegotiationService.canOfferDiscount(product, 0)).toBe(false);
    });

    it("should return true for high margin product", () => {
      const product = createMockProduct({ price: 10000, costPrice: 3000 });
      expect(SmartNegotiationService.canOfferDiscount(product, 0)).toBe(true);
    });
  });
});

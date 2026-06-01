import { describe, it, expect } from "vitest";
import { determineNextState } from "../services/stateService.js";
import { SalesState } from "../../src/types.js";

describe("State Machine", () => {
  it("should transition from NEW to INTERESTED on price keyword", () => {
    const result = determineNextState(SalesState.NEW, "price kya hai");
    expect(result).toBe(SalesState.INTERESTED);
  });

  it("should stay in same state on neutral messages", () => {
    const result = determineNextState(SalesState.NEW, "hello");
    expect(result).toBe(SalesState.NEW);
  });

  it("should transition to NEGOTIATING on discount keywords", () => {
    const result = determineNextState(SalesState.PRODUCT_SELECTED, "discount do");
    expect(result).toBe(SalesState.NEGOTIATING);
  });

  it("should transition to PAYMENT_AWAITING on confirmation", () => {
    const result = determineNextState(SalesState.PRODUCT_SELECTED, "theek hai main lunga");
    expect(result).toBe(SalesState.PAYMENT_AWAITING);
  });
});

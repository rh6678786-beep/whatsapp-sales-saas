import { SalesState, Product, Session } from "../../src/types";

export function determineNextState(
  currentState: SalesState,
  lastMessage: string,
  hasImage: boolean = false
): SalesState {
  const text = lastMessage.toLowerCase();

  switch (currentState) {
    case SalesState.NEW:
      if (text.includes("price") || text.includes("product") || text.includes("kya hai")) {
        return SalesState.INTERESTED;
      }
      return SalesState.NEW;

    case SalesState.INTERESTED:
      if (text.includes("buy") || text.includes("lena hai") || text.includes("order")) {
        return SalesState.PRODUCT_SELECTED;
      }
      return SalesState.INTERESTED;

    case SalesState.PRODUCT_SELECTED:
      if (text.includes("discount") || text.includes("kam") || text.includes("sasta")) {
        return SalesState.NEGOTIATING;
      }
      if (text.includes("theek hai") || text.includes("ok") || text.includes("done") || text.includes("lena hai") || text.includes("lunga") || text.includes("lu ga")) {
        return SalesState.PAYMENT_AWAITING;
      }
      return SalesState.PRODUCT_SELECTED;

    case SalesState.NEGOTIATING:
      if (text.includes("theek hai") || text.includes("ok") || text.includes("done") || text.includes("lena hai") || text.includes("lunga") || text.includes("lu ga")) {
        return SalesState.PAYMENT_AWAITING;
      }
      return SalesState.NEGOTIATING;

    case SalesState.PAYMENT_AWAITING:
      if (hasImage || text.includes("kar diya") || text.includes("bhej diya") || text.includes("payment") || text.includes("pay") || text.includes("trx") || text.includes("transaction") || text.includes("send")) {
        return SalesState.PAYMENT_SENT;
      }
      return SalesState.PAYMENT_AWAITING;

    case SalesState.PAYMENT_PENDING:
      if (hasImage) {
        return SalesState.PAYMENT_SENT;
      }
      return SalesState.PAYMENT_PENDING;

    case SalesState.PAYMENT_SENT:
      return SalesState.PAYMENT_SENT;

    case SalesState.VERIFIED:
      if (text.includes("confirm") || text.includes("done") || text.includes("theek hai") || text.includes("ok") || text.includes("han") || text.includes("yes") || text.includes("ho gaya") || text.includes("haan")) {
        return SalesState.ORDER_CONFIRMED;
      }
      return SalesState.VERIFIED;

    case SalesState.ORDER_CONFIRMED:
      return SalesState.ORDER_CONFIRMED;

    default:
      return currentState;
  }
}

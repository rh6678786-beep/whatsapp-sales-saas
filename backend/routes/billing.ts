import { Router } from "express";
import { dbService } from "../services/dbService.js";
import { getAdminId } from "../middleware/auth.js";
import {
  SUBSCRIPTION_PLANS, getSubscriptionStatus, getAdminFeatures,
  createCheckoutSession, createBillingPortalSession, handleWebhook,
  startTrial, getPlanById,
} from "../services/stripeService.js";
import { env } from "../lib/env.js";
import { createChildLogger } from "../lib/logger.js";
import crypto from "crypto";

const log = createChildLogger("route:billing");
const router = Router();

// Simple in-memory idempotency store for Stripe webhooks
// Key: idempotency-key header value, Value: { result, expiresAt }
// Cleaned up every hour to prevent memory leaks
const IDEMPOTENCY_CACHE = new Map<string, { result: any; expiresAt: number }>();
const IDEMPOTENCY_TTL = 60 * 60 * 1000; // 1 hour

// Periodic cleanup of expired idempotency keys
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of IDEMPOTENCY_CACHE) {
    if (entry.expiresAt < now) {
      IDEMPOTENCY_CACHE.delete(key);
    }
  }
}, 60 * 60 * 1000); // Clean every hour

/**
 * Check if a request has already been processed via its idempotency key.
 * Returns cached result if found, null otherwise.
 */
function checkIdempotency(key: string): any | null {
  const cached = IDEMPOTENCY_CACHE.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }
  return null;
}

/**
 * Store the result for a given idempotency key.
 */
function setIdempotency(key: string, result: any): void {
  IDEMPOTENCY_CACHE.set(key, {
    result,
    expiresAt: Date.now() + IDEMPOTENCY_TTL,
  });
}

router.get("/billing/plans", (_req, res) => {
  res.json(SUBSCRIPTION_PLANS);
});

router.get("/billing/subscription", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const existingSub = await dbService.getSubscription(adminId);
    const status = await getSubscriptionStatus(adminId, existingSub);
    const usage = await dbService.getUsageCounts(adminId);
    res.json({ ...status, usage });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/billing/features", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const existingSub = await dbService.getSubscription(adminId);
    const capabilities = await getAdminFeatures(adminId, existingSub);
    res.json(capabilities);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/billing/create-checkout", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const { planId } = req.body;

    if (!planId) {
      res.status(400).json({ error: "planId is required" });
      return;
    }

    const plan = getPlanById(planId);
    if (!plan) {
      res.status(400).json({ error: "Invalid plan" });
      return;
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const successUrl = `${baseUrl}/app?billing=success`;
    const cancelUrl = `${baseUrl}/app?billing=cancel`;

    const result = await createCheckoutSession(adminId, planId, successUrl, cancelUrl);

    // Mock mode: directly update subscription
    if (!result.url && result.sessionId === "mock-session-id") {
      const trial = startTrial();
      await dbService.updateSubscription(adminId, {
        ...trial,
        planId: plan.id,
      });
      res.json({ mockUpgrade: true, plan: plan.id });
      return;
    }

    // Checkout URL mode
    if (result.url) {
      res.json({ url: result.url, sessionId: result.sessionId });
      return;
    }

    // Mock: no stripe key, direct update
    const sub = plan.price === 0
      ? { planId: plan.id, status: "active" as const }
      : startTrial();
    await dbService.updateSubscription(adminId, sub);
    res.json({ mockUpgrade: true, plan: plan.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/billing/cancel", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const existingSub = await dbService.getSubscription(adminId);
    if (!existingSub || existingSub.planId === "free") {
      res.status(400).json({ error: "No active subscription to cancel" });
      return;
    }
    await dbService.updateSubscription(adminId, {
      ...existingSub,
      cancelAtPeriodEnd: true,
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/billing/portal", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const existingSub = await dbService.getSubscription(adminId);
    const returnUrl = `${req.protocol}://${req.get("host")}/app?tab=billing`;
    const portalUrl = await createBillingPortalSession(adminId, existingSub || { planId: "free", status: "free" }, returnUrl);
    if (portalUrl) {
      res.json({ url: portalUrl });
    } else {
      res.json({ url: null, message: "No Stripe customer found. Upgrade first via checkout." });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/billing/stripe-status", async (req, res) => {
  try {
    const isConfigured = !!env.STRIPE_SECRET_KEY;
    const hasWebhookSecret = !!env.STRIPE_WEBHOOK_SECRET;
    const hasPriceIds = !!env.STRIPE_STARTER_PRICE_ID && !!env.STRIPE_PROFESSIONAL_PRICE_ID;
    const isLiveMode = isConfigured && env.STRIPE_SECRET_KEY.startsWith("sk_live_");
    const isTestMode = isConfigured && env.STRIPE_SECRET_KEY.startsWith("sk_test_");

    res.json({
      configured: isConfigured,
      webhookConfigured: hasWebhookSecret,
      priceIdsConfigured: hasPriceIds,
      mode: isLiveMode ? "live" : isTestMode ? "test" : "not_configured",
      status: isConfigured && hasWebhookSecret && hasPriceIds
        ? "ready"
        : !isConfigured
          ? "not_configured"
          : "partial",
      missing: [
        ...(!isConfigured ? ["STRIPE_SECRET_KEY"] : []),
        ...(!hasWebhookSecret ? ["STRIPE_WEBHOOK_SECRET"] : []),
        ...(!hasPriceIds ? ["STRIPE_STARTER_PRICE_ID or STRIPE_PROFESSIONAL_PRICE_ID"] : []),
      ],
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/billing/webhook", async (req: any, res) => {
  const sig = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

  if (!sig || !webhookSecret) {
    res.status(400).json({ error: "Missing signature or webhook secret" });
    return;
  }

  // Check idempotency key to prevent duplicate webhook processing
  const idempotencyKey = req.headers["idempotency-key"] as string
    || req.headers["stripe-idempotency-key"] as string
    || `${sig}:${webhookSecret.slice(0, 8)}`;
  const cachedResult = checkIdempotency(idempotencyKey);
  if (cachedResult) {
    log.info({ key: idempotencyKey.slice(0, 12) }, "Duplicate webhook detected via idempotency key — returning cached result");
    res.json(cachedResult);
    return;
  }

  try {
    const rawBody = req.rawBody || JSON.stringify(req.body);
    const event = await handleWebhook(rawBody, sig, webhookSecret);

    if (event?.adminId && event.subscription) {
      await dbService.updateSubscription(event.adminId, event.subscription);
      log.info({ adminId: event.adminId, type: event.type }, "Subscription updated via webhook");
    }

    const response = { received: true };
    // Cache the result using the idempotency key
    setIdempotency(idempotencyKey, response);
    res.json(response);
  } catch (error: any) {
    log.error({ err: error }, "Stripe webhook handler error");
    res.status(400).json({ error: error.message });
  }
});

export default router;

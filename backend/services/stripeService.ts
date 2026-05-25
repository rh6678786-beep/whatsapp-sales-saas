import Stripe from "stripe";

const isMockMode = !process.env.STRIPE_SECRET_KEY;
const stripe = isMockMode ? null : new Stripe(process.env.STRIPE_SECRET_KEY!);

export interface PlanLimits {
  maxSessionsPerMonth: number;
  maxProducts: number;
  maxBroadcastsPerMonth: number;
  maxTeamMembers: number;
}

export interface PlanCapabilities {
  instagram: boolean;
  facebook: boolean;
  telegram: boolean;
  broadcast: boolean;
  reEngagement: boolean;
  analytics: 'none' | 'basic' | 'full';
  aiPersona: boolean;
  whiteLabel: boolean;
  paymentVerification: boolean;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  features: string[];
  limits: PlanLimits;
  capabilities: PlanCapabilities;
  stripePriceId: string | null;
  popular?: boolean;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    currency: "pkr",
    features: [
      "30 customer conversations/month",
      "Manage up to 5 products",
      "AI sales agent (core features)",
      "WhatsApp channel ready",
      "Email support included",
    ],
    limits: {
      maxSessionsPerMonth: 30,
      maxProducts: 5,
      maxBroadcastsPerMonth: 0,
      maxTeamMembers: 1,
    },
    capabilities: {
      instagram: false,
      facebook: false,
      telegram: false,
      broadcast: false,
      reEngagement: false,
      analytics: 'none',
      aiPersona: false,
      whiteLabel: false,
      paymentVerification: false,
    },
    stripePriceId: null,
  },
  {
    id: "basic",
    name: "Basic",
    price: 1500,
    currency: "pkr",
    features: [
      "300 customer conversations/month",
      "Up to 20 products in catalog",
      "Advanced AI — smarter closing & objection handling",
      "WhatsApp + Instagram, both active",
      "Built-in payment verification (EasyPaisa, JazzCash, Bank)",
      "Email + live chat support",
    ],
    limits: {
      maxSessionsPerMonth: 300,
      maxProducts: 20,
      maxBroadcastsPerMonth: 0,
      maxTeamMembers: 1,
    },
    capabilities: {
      instagram: true,
      facebook: false,
      telegram: false,
      broadcast: false,
      reEngagement: false,
      analytics: 'basic',
      aiPersona: false,
      whiteLabel: false,
      paymentVerification: true,
    },
    stripePriceId: process.env.STRIPE_STARTER_PRICE_ID || null,
  },
  {
    id: "professional",
    name: "Professional",
    price: 3500,
    currency: "pkr",
    popular: true,
    features: [
      "1,500 customer conversations/month",
      "Up to 100 products in catalog",
      "All channels: WhatsApp, Instagram, Facebook, Telegram",
      "Smart negotiation engine (closes more deals automatically)",
      "Auto re-engagement for inactive customers",
      "Full analytics — conversion rates, lead scores, top products",
      "Priority support with fast response",
    ],
    limits: {
      maxSessionsPerMonth: 1500,
      maxProducts: 100,
      maxBroadcastsPerMonth: 10,
      maxTeamMembers: 3,
    },
    capabilities: {
      instagram: true,
      facebook: true,
      telegram: true,
      broadcast: false,
      reEngagement: true,
      analytics: 'full',
      aiPersona: false,
      whiteLabel: false,
      paymentVerification: true,
    },
    stripePriceId: process.env.STRIPE_PROFESSIONAL_PRICE_ID || null,
  },
  {
    id: "business",
    name: "Business",
    price: 6500,
    currency: "pkr",
    features: [
      "5,000 customer conversations/month",
      "Up to 500 products in catalog",
      "All channels: WhatsApp, Instagram, Facebook, Telegram",
      "Smart negotiation + custom AI persona",
      "Bulk broadcast messaging",
      "Auto re-engagement + lead scoring",
      "Dedicated support with fast response",
    ],
    limits: {
      maxSessionsPerMonth: 5000,
      maxProducts: 500,
      maxBroadcastsPerMonth: 50,
      maxTeamMembers: 10,
    },
    capabilities: {
      instagram: true,
      facebook: true,
      telegram: true,
      broadcast: true,
      reEngagement: true,
      analytics: 'full',
      aiPersona: true,
      whiteLabel: false,
      paymentVerification: true,
    },
    stripePriceId: null,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 15000,
    currency: "pkr",
    features: [
      "Unlimited conversations — no monthly cap",
      "Unlimited product catalog",
      "All channels: WhatsApp, Instagram, Facebook, Telegram",
      "Custom API & third-party integrations",
      "Dedicated account manager assigned to you",
      "White-label: your brand, your bot",
      "Custom feature development on request",
    ],
    limits: {
      maxSessionsPerMonth: 999999,
      maxProducts: 999999,
      maxBroadcastsPerMonth: 999,
      maxTeamMembers: 999,
    },
    capabilities: {
      instagram: true,
      facebook: true,
      telegram: true,
      broadcast: true,
      reEngagement: true,
      analytics: 'full',
      aiPersona: true,
      whiteLabel: true,
      paymentVerification: true,
    },
    stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || null,
  },
];

export function getPlanById(planId: string): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find(p => p.id === planId);
}

export function getDefaultLimits(): PlanLimits {
  return SUBSCRIPTION_PLANS[0].limits;
}

export interface SubscriptionInfo {
  planId: string;
  status: "active" | "trialing" | "past_due" | "canceled" | "incomplete" | "free";
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  cancelAtPeriodEnd?: boolean;
  trialEnd?: string;
}

export async function createCheckoutSession(
  adminId: string,
  planId: string,
  successUrl: string,
  cancelUrl: string
): Promise<{ url: string | null; sessionId: string }> {
  const plan = getPlanById(planId);
  if (!plan || !plan.stripePriceId) {
    return { url: null, sessionId: "mock-session-id" };
  }

  if (isMockMode) {
    return {
      url: `${successUrl}?session_id=mock_${adminId}_${planId}`,
      sessionId: `mock_${adminId}_${planId}`,
    };
  }

  const session = await stripe!.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    customer_email: undefined,
    metadata: { adminId, planId },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return { url: session.url, sessionId: session.id };
}

export async function createBillingPortalSession(
  adminId: string,
  subscription: SubscriptionInfo,
  returnUrl: string
): Promise<string | null> {
  if (isMockMode || !subscription.stripeCustomerId) {
    return null;
  }

  const portal = await stripe!.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: returnUrl,
  });

  return portal.url;
}

export async function handleWebhook(
  body: any,
  signature: string,
  webhookSecret: string
): Promise<{ type: string; adminId?: string; subscription?: SubscriptionInfo } | null> {
  if (isMockMode) {
    return null;
  }

  let event: Stripe.Event;
  try {
    event = stripe!.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return null;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const adminId = session.metadata?.adminId;
    const planId = session.metadata?.planId;
    if (adminId && planId) {
      return {
        type: "subscription.created",
        adminId,
        subscription: {
          planId,
          status: "active",
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
          currentPeriodStart: new Date().toISOString(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
      };
    }
  }

  if (event.type === "invoice.paid" || event.type === "customer.subscription.updated") {
    const sub = event.data.object as any;
    const adminId = sub.metadata?.adminId;
    if (adminId) {
      const plan = SUBSCRIPTION_PLANS.find(p => p.stripePriceId === sub.items?.data?.[0]?.price?.id);
      return {
        type: "subscription.updated",
        adminId,
        subscription: {
          planId: plan?.id || "free",
          status: sub.status as SubscriptionInfo["status"],
          stripeCustomerId: sub.customer as string,
          stripeSubscriptionId: sub.id,
          currentPeriodStart: sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : undefined,
          currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : undefined,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        },
      };
    }
  }

  return { type: event.type };
}

export function startTrial(): SubscriptionInfo {
  const now = new Date();
  const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    planId: "free",
    status: "trialing",
    currentPeriodStart: now.toISOString(),
    currentPeriodEnd: trialEnd.toISOString(),
    trialEnd: trialEnd.toISOString(),
  };
}

export async function getSubscriptionStatus(
  adminId: string,
  currentSubscription?: SubscriptionInfo | null
): Promise<{ plan: SubscriptionPlan; subscription: SubscriptionInfo }> {
  // Super admin always gets Enterprise plan with all features
  if (adminId === "default-admin") {
    const plan = getPlanById("enterprise")!;
    const sub: SubscriptionInfo = {
      planId: "enterprise",
      status: "active",
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    };
    return { plan, subscription: sub };
  }

  let sub = currentSubscription || { planId: "free", status: "free" as const };

  // Trial check: If trial has expired, downgrade to Free
  if (sub.status === "trialing" && sub.trialEnd && new Date(sub.trialEnd) < new Date()) {
    console.log(`[STRIPE][${adminId}] Trial expired. Downgrading to Free plan.`);
    sub = {
      planId: "free",
      status: "free" as const,
      currentPeriodStart: undefined,
      currentPeriodEnd: undefined,
      stripeCustomerId: sub.stripeCustomerId,
      stripeSubscriptionId: undefined,
    };
  }

  // Auto-expire check: If subscription has expired, revert to Free!
  if (sub.planId !== "free" && sub.status !== "trialing" && sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) < new Date()) {
    console.log(`[STRIPE][${adminId}] Subscription ${sub.planId} has expired. Auto-downgrading to Free plan.`);
    sub = {
      planId: "free",
      status: "free" as const,
      currentPeriodStart: undefined,
      currentPeriodEnd: undefined,
      stripeCustomerId: sub.stripeCustomerId,
      stripeSubscriptionId: undefined,
    };
  }

  // Trial: grant Professional plan limits during trial period
  let effectivePlanId = sub.planId;
  if (sub.status === "trialing") {
    effectivePlanId = "professional";
  }

  const plan = getPlanById(effectivePlanId) || SUBSCRIPTION_PLANS[0];

  return { plan, subscription: sub };
}

export interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
  soft?: boolean;
  current: number;
  limit: number;
}

export async function getAdminFeatures(adminId: string, currentSubscription?: SubscriptionInfo | null): Promise<PlanCapabilities> {
  const { plan } = await getSubscriptionStatus(adminId, currentSubscription);
  return plan.capabilities;
}

export async function checkLimit(
  adminId: string,
  limitType: keyof PlanLimits,
  currentValue: number,
  currentSubscription?: SubscriptionInfo | null
): Promise<LimitCheckResult> {
  const { plan } = await getSubscriptionStatus(adminId, currentSubscription);
  const limit = plan.limits[limitType];
  const pct = limit > 0 ? Math.round((currentValue / limit) * 100) : 0;

  if (currentValue >= limit) {
    return {
      allowed: false,
      reason: `${limitType.replace('max', '').replace(/([A-Z])/g, ' $1').trim()} limit reached (${currentValue}/${limit}) for ${plan.name} plan. Upgrade to continue.`,
      current: currentValue,
      limit,
    };
  }

  if (pct >= 80) {
    return {
      allowed: true,
      soft: true,
      reason: `You've used ${pct}% of your ${plan.name} plan ${limitType.replace('max', '').replace(/([A-Z])/g, ' $1').trim().toLowerCase()} limit (${currentValue}/${limit}).`,
      current: currentValue,
      limit,
    };
  }

  return { allowed: true, current: currentValue, limit };
}

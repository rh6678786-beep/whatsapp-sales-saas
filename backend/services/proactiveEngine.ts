import { dbService } from "./dbService.js";
import { processReEngagement } from "./reEngagementService.js";
import { processBirthdayGreetings } from "./birthdayService.js";
import { processDripCampaigns } from "./dripCampaignService.js";
import { processAbandonedCarts, processPriceDropAlerts } from "./proactiveTriggers.js";
import { sendWhatsAppMessage, isWhatsAppReady } from "../lib/whatsappClient.js";
import { Session } from "../../src/types";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("proactive:engine");

// Track daily sent messages per customer (cleaned hourly)
const DAILY_SENT_MAP = new Map<string, number>();

function getLocalDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDailyKey(adminId: string, userId: string): string {
  return `${adminId}:${userId}:${getLocalDateStr()}`;
}

function isQuietHours(cfg: any): boolean {
  const hour = new Date().getHours();
  const start = cfg.quietStartHour ?? 21;
  const end = cfg.quietEndHour ?? 9;
  if (start > end) {
    return hour >= start || hour < end;
  }
  return hour >= start && hour < end;
}

function canSendToCustomer(adminId: string, userId: string, cfg: any, remindersCount: number): boolean {
  if (isQuietHours(cfg)) {
    log.debug({ adminId, userId }, "Quiet hours — skipping");
    return false;
  }
  const key = getDailyKey(adminId, userId);
  const sentToday = DAILY_SENT_MAP.get(key) || 0;
  const maxPerDay = cfg.maxPerDay || 5;
  if (sentToday >= maxPerDay) {
    log.debug({ adminId, userId, maxPerDay }, "Hit daily limit");
    return false;
  }
  DAILY_SENT_MAP.set(key, sentToday + 1);
  return true;
}

async function sendProactiveMessage(adminId: string, session: Session, message: string, cfg: any): Promise<boolean> {
  if (!canSendToCustomer(adminId, session.userId, cfg, session.remindersCount || 0)) {
    return false;
  }
  if (!isWhatsAppReady(adminId)) {
    log.warn({ adminId }, "WhatsApp not ready");
    return false;
  }
  try {
    await sendWhatsAppMessage(adminId, session.userId, message);
    await dbService.updateSession(adminId, session.userId, {
      remindersCount: (session.remindersCount || 0) + 1,
      lastReminderAt: new Date().toISOString(),
      metadata: { ...session.metadata, lastProactiveAt: new Date().toISOString() },
    } as any);
    return true;
  } catch (e) {
    log.error({ err: e, adminId, userId: session.userId }, "Failed to send proactive message");
    return false;
  }
}

export async function processProactiveForAdmin(adminId: string): Promise<{
  sent: number; failed: number; details: string[];
}> {
  const settings = await dbService.getSettings(adminId);
  const cfg = settings.proactiveConfig;
  if (!cfg?.enabled) {
    return { sent: 0, failed: 0, details: ["Proactive engine disabled for this admin"] };
  }

  const details: string[] = [];
  let totalSent = 0;
  let totalFailed = 0;
  let totalRun = 0;

  const handlers: { name: string; fn: () => Promise<{ sent: number; failed: number; sessions: Session[] }> }[] = [];

  if (cfg.abandonedCart?.enabled) {
    handlers.push({
      name: "abandoned_cart",
      fn: () => processAbandonedCarts(adminId, cfg.abandonedCart.hours || 24),
    });
  }

  if (cfg.reEngagement?.enabled) {
    handlers.push({
      name: "re_engagement",
      fn: async () => {
        const result = await processReEngagement(adminId);
        return { sent: result.sent, failed: result.failed, sessions: [] };
      },
    });
  }

  if (cfg.priceDrop?.enabled) {
    handlers.push({
      name: "price_drop",
      fn: () => processPriceDropAlerts(adminId),
    });
  }

  if (cfg.birthday?.enabled) {
    handlers.push({
      name: "birthday",
      fn: async () => {
        const sessions = await dbService.getCustomersWithBirthdays(adminId);
        const sent = await processBirthdayGreetings(adminId, sessions, cfg.birthday);
        return { sent, failed: 0, sessions };
      },
    });
  }

  handlers.push({
    name: "drip_campaigns",
    fn: async () => {
      const result = await processDripCampaigns(adminId);
      return { sent: result.sent, failed: result.failed, sessions: [] };
    },
  });

  const maxPerRun = cfg.maxPerRun || 50;

  for (const handler of handlers) {
    if (totalRun >= maxPerRun) {
      details.push(`Hit maxPerRun (${maxPerRun}), stopping`);
      break;
    }
    try {
      const result = await handler.fn();
      totalSent += result.sent;
      totalFailed += result.failed;
      totalRun += result.sent + result.failed;
      details.push(`${handler.name}: sent=${result.sent}, failed=${result.failed}`);
    } catch (e: any) {
      log.error({ err: e.message, adminId, handler: handler.name }, "Proactive handler error");
      details.push(`${handler.name}: ERROR — ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  log.info({ adminId, sent: totalSent, failed: totalFailed }, "Proactive run complete");
  return { sent: totalSent, failed: totalFailed, details };
}

function clearDailyMap() {
  const today = getLocalDateStr();
  for (const key of DAILY_SENT_MAP.keys()) {
    if (!key.startsWith(today)) {
      DAILY_SENT_MAP.delete(key);
    }
  }
}

const clearDailyMapInterval = setInterval(clearDailyMap, 60 * 60 * 1000);

// Clean up interval on process exit
const cleanupProactiveInterval = () => clearInterval(clearDailyMapInterval);
process.on("SIGTERM", cleanupProactiveInterval);
process.on("SIGINT", cleanupProactiveInterval);

if (process.env.VITEST || process.env.NODE_ENV === "test") {
  clearInterval(clearDailyMapInterval);
}

export async function processAllAdmins(): Promise<void> {
  log.info({}, "Starting proactive run for all admins");
  const adminIds = await dbService.getAllAdminIds();
  if (adminIds.length === 0) {
    log.info({}, "No admins found");
    return;
  }
  for (const adminId of adminIds) {
    try {
      await processProactiveForAdmin(adminId);
    } catch (e: any) {
      log.error({ err: e.message, adminId }, "Fatal error in proactive run");
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  log.info({}, "All admins processed");
}

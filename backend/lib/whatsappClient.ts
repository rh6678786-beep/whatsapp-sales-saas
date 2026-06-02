import pkg from "whatsapp-web.js";
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from "qrcode-terminal";
import fs from "fs";
import https from "https";
import { execSync } from "child_process";
import { processIncomingMessage } from "../services/messageHandler.js";
import { dbService } from "../services/dbService.js";
import { getRedis } from "./redis.js";
import { createChildLogger } from "./logger.js";

const log = createChildLogger("whatsapp:client");

const REDIS_WHATSAPP_PREFIX = "whatsapp:instance:";
const REDIS_QR_TTL = 60 * 5; // QR codes expire after 5 minutes

function urlToBase64(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("base64")));
      res.on("error", reject);
    }).on("error", reject);
  });
}

interface WhatsAppInstance {
  client: any;
  isReady: boolean;
  latestQr: string | null;
  keepAliveTimer?: any;
  reconnectAttempts: number;
}

const instances: Map<string, WhatsAppInstance> = new Map();

async function persistStatus(adminId: string, status: { isReady: boolean; qr?: string | null }) {
  try {
    const redis = getRedis();
    if (redis) {
      const data = JSON.stringify({ isReady: status.isReady, updatedAt: Date.now() });
      await redis.set(`${REDIS_WHATSAPP_PREFIX}${adminId}`, data);
      if (status.qr) {
        await redis.setex(`${REDIS_WHATSAPP_PREFIX}${adminId}:qr`, REDIS_QR_TTL, status.qr);
      } else {
        await redis.del(`${REDIS_WHATSAPP_PREFIX}${adminId}:qr`);
      }
    }
  } catch (err: any) {
    log.warn({ err, adminId }, "Failed to persist WhatsApp status to Redis");
  }
}

async function getPersistedStatus(adminId: string): Promise<{ isReady: boolean } | null> {
  try {
    const redis = getRedis();
    if (redis) {
      const raw = await redis.get(`${REDIS_WHATSAPP_PREFIX}${adminId}`);
      if (raw) return JSON.parse(raw);
    }
  } catch { /* ignore */ }
  return null;
}

export const getWhatsAppStatus = (adminId: string) => {
  const inst = instances.get(adminId);
  return {
    latestQr: inst?.latestQr || null,
    isReady: inst?.isReady || false,
  };
};

export const isWhatsAppReady = (adminId: string) => instances.get(adminId)?.isReady || false;

export async function sendWhatsAppMessage(adminId: string, to: string, message: string) {
  const inst = instances.get(adminId);
  if (!inst || !inst.isReady) {
    log.error({ adminId }, "Cannot send message: client not initialized or ready");
    throw new Error("WhatsApp client is not ready for this admin");
  }

  log.info({ adminId, to, msgLen: message.length }, "Attempting to deliver message");
  try {
    const sent = await inst.client.sendMessage(to, message);
    if (sent) {
      log.info({ adminId, to }, "Message successfully delivered");
      return sent;
    } else {
      log.warn({ adminId, to }, "client.sendMessage returned empty — trying chat.sendMessage");
      const chat = await inst.client.getChatById(to);
      const altSent = await chat.sendMessage(message);
      log.info({ adminId, to, success: !!altSent }, "Alt delivery status");
      return altSent;
    }
  } catch (error: any) {
    log.warn({ err: error, adminId, to }, "First send attempt failed — trying fallback direct chat send");
    try {
      const chat = await inst.client.getChatById(to);
      const fallbackSent = await chat.sendMessage(message);
      log.info({ adminId, to, success: !!fallbackSent }, "Fallback direct delivery");
      return fallbackSent;
    } catch (fallbackError: any) {
      log.error({ err: fallbackError, adminId, to }, "All message delivery attempts failed");
      throw fallbackError;
    }
  }
}

export async function blockWhatsAppContact(adminId: string, userId: string) {
  const inst = instances.get(adminId);
  if (!inst || !inst.isReady) return;
  try {
    const contact = await inst.client.getContactById(userId);
    if (contact) {
      await contact.block();
      log.info({ adminId, userId }, "Permanently blocked contact");
    }
  } catch (error: any) {
    log.error({ err: error, adminId, userId }, "Failed to block contact");
  }
}

function cleanupInstance(adminId: string) {
  const inst = instances.get(adminId);
  if (inst) {
    if (inst.keepAliveTimer) clearInterval(inst.keepAliveTimer);
    inst.latestQr = null;
    inst.isReady = false;
  }
  persistStatus(adminId, { isReady: false }).catch((err) => log.warn({ err, adminId }, "Status persist failed"));
}

export async function logoutWhatsApp(adminId: string) {
  const inst = instances.get(adminId);
  if (inst) {
    cleanupInstance(adminId);
    try { await inst.client.logout(); } catch (e) {}
    try { await inst.client.destroy(); } catch (e) {}
    instances.delete(adminId);
  }

  const authDir = `.wwebjs_auth_${adminId}`;
  const cacheDir = `.wwebjs_cache_${adminId}`;
  try { fs.rmSync(authDir, { recursive: true, force: true }); } catch (e) {}
  try { fs.rmSync(cacheDir, { recursive: true, force: true }); } catch (e) {}

  log.info({ adminId }, "WhatsApp logged out");
  return { success: true };
}

function cleanupOrphanedBrowser(authDir: string) {
  try {
    const sessionDir = `${authDir}/session`;
    const lockFile = `${authDir}/session/SingletonLock`;
    if (fs.existsSync(lockFile)) {
      try { fs.unlinkSync(lockFile); } catch {}
    }
    if (fs.existsSync(sessionDir)) {
      ["SingletonCookie", "SingletonSocket", "SingletonLock"].forEach(f => {
        try { fs.unlinkSync(`${sessionDir}/${f}`); } catch {}
      });
    }
  } catch {}
}

function clearStaleSessions() {
  try {
    const files = fs.readdirSync(".");
    for (const f of files) {
      if (f.startsWith(".wwebjs_auth_")) {
        try {
          const sessionDir = `${f}/session`;
          if (fs.existsSync(`${f}/Default`) || fs.existsSync(sessionDir)) {
            fs.rmSync(f, { recursive: true, force: true });
            log.info({ dir: f }, "Cleared stale session");
          }
        } catch {}
      }
      if (f.startsWith(".wwebjs_cache_")) {
        try { fs.rmSync(f, { recursive: true, force: true }); } catch {}
      }
    }
  } catch {}
}

const MAX_RETRIES = 3;
const retryCounters: Map<string, number> = new Map();
let sessionsCleared = false;

function killOrphanedChrome() {
  try {
    if (process.platform !== "win32") {
      execSync('pkill -f "chrome.*--headless" 2>/dev/null || true', { stdio: "ignore" });
    }
  } catch {}
}

export function initializeWhatsAppClient(adminId: string) {
  killOrphanedChrome();
  const existing = instances.get(adminId);
  if (existing) {
    return existing.client;
  }

  if (!sessionsCleared) {
    clearStaleSessions();
    sessionsCleared = true;
  }

  const retries = retryCounters.get(adminId) || 0;
  log.info({ adminId, retries }, "initializeWhatsAppClient called");

  if (retries >= MAX_RETRIES) {
    log.error({ adminId }, "Max retries reached — giving up");
    return;
  }

  const authDir = `.wwebjs_auth_${adminId}`;
  cleanupOrphanedBrowser(authDir);

  const chromePaths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    `${process.env.LOCALAPPDATA || ""}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env.PROGRAMFILES || ""}\\Google\\Chrome\\Application\\chrome.exe`,
  ];

  const puppeteerConfig: any = {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-extensions",
      "--no-first-run",
      "--mute-audio",
    ],
  };

  const execPath = chromePaths.find(p => fs.existsSync(p));
  if (execPath) {
    puppeteerConfig.executablePath = execPath;
    log.info({ adminId, execPath }, "Using Chrome at");
  }

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: authDir }),
    puppeteer: puppeteerConfig,
    takeoverOnConflict: true,
  });

  const inst: WhatsAppInstance = {
    client,
    isReady: false,
    latestQr: null,
    reconnectAttempts: 0,
  };
  instances.set(adminId, inst);

  client.on("qr", (qr) => {
    log.info({ adminId }, "QR Code received");
    inst.latestQr = qr;
    inst.isReady = false;
    persistStatus(adminId, { isReady: false, qr }).catch((err) => log.warn({ err, adminId }, "Status persist (QR) failed"));
  });

  client.on("authenticated", () => {
    log.info({ adminId }, "Auth success");
    inst.latestQr = null;
    persistStatus(adminId, { isReady: false }).catch((err) => log.warn({ err, adminId }, "Status persist (auth) failed"));
  });

  client.on("ready", () => {
    log.info({ adminId }, "READY");
    inst.latestQr = null;
    inst.isReady = true;
    retryCounters.delete(adminId);
    persistStatus(adminId, { isReady: true }).catch((err) => log.warn({ err, adminId }, "Status persist (ready) failed"));
  });

  client.on("message", async (msg) => {
    if (!msg || msg.isStatus) return;
    const chat = await msg.getChat().catch(() => null);
    if (!chat || chat.isGroup) return;

    const userId = msg.from;
    const text = msg.body;

    log.info({ adminId, userId, text: text.substring(0, 100) }, "Received message");

    try {
      const result = await processIncomingMessage(adminId, userId, text || "");

      if (result?.text) {
        log.info({ adminId, userId, responseLen: result.text.length }, "AI response ready");
        await sendWhatsAppMessage(adminId, userId, result.text);
      } else if (result?.text === "") {
        log.info({ adminId, userId }, "Handoff active — no auto-response sent");
      } else {
        log.info({ adminId, userId }, "No text response to send");
      }

      if (result?.images?.length) {
        log.info({ adminId, userId, count: result.images.length }, "Sending images");
        for (const img of result.images) {
          const media = await MessageMedia.fromUrl(img).catch((err) => {
            log.error({ err, adminId, img }, "Failed to load image");
            return null;
          });
          if (media) {
            await client.sendMessage(userId, media, { caption: result.text?.slice(0, 100) || "" });
          }
        }
      }

      if (result?.videos?.length) {
        log.info({ adminId, userId, count: result.videos.length }, "Sending videos");
        for (const vid of result.videos) {
          const media = await MessageMedia.fromUrl(vid, { unsafeMime: true }).catch((err) => {
            log.error({ err, adminId, vid }, "Failed to load video");
            return null;
          });
          if (media) {
            await client.sendMessage(userId, media, { sendVideoAsGif: false, caption: result.text?.slice(0, 100) || "" });
          }
        }
      }
    } catch (e: any) {
      log.error({ err: e, adminId, userId }, "Error in message processing or sending");
    }
  });

  client.on("disconnected", (reason: any) => {
    log.info({ adminId, reason }, "Disconnected");
    inst.isReady = false;
    inst.latestQr = null;
    persistStatus(adminId, { isReady: false }).catch((err) => log.warn({ err, adminId }, "Status persist (disconnect) failed"));
    log.info({ adminId }, "Attempting auto-reconnect in 10 seconds");
    setTimeout(() => {
      if (!instances.get(adminId)?.isReady) {
        log.info({ adminId }, "Auto-reconnecting");
        instances.delete(adminId);
        initializeWhatsAppClient(adminId);
      }
    }, 10000);
  });

  client.initialize().catch(e => {
    log.error({ err: e, adminId }, "Client initialize failed");
    instances.delete(adminId);
    try { client.destroy(); } catch (_) {}
    if ((e.message?.includes("EMAXCONNSESSIONS") || e.message?.includes("max clients")) && process.platform !== "win32") {
      killOrphanedChrome();
    }
    retryCounters.set(adminId, retries + 1);
    const delay = Math.min(3000 * (retries + 1), 10000);
    log.info({ adminId, retry: retries + 1, max: MAX_RETRIES, delay }, "Scheduling retry");
    setTimeout(() => initializeWhatsAppClient(adminId), delay);
  });

  return client;
}

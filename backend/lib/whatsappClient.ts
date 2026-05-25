import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import https from 'https';
import { execSync } from 'child_process';
import { processIncomingMessage } from '../services/messageHandler';
import { dbService } from '../services/dbService';

function urlToBase64(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// Multi-instance manager
interface WhatsAppInstance {
  client: any;
  isReady: boolean;
  latestQr: string | null;
  keepAliveTimer?: any;
  reconnectAttempts: number;
}

const instances: Map<string, WhatsAppInstance> = new Map();

export const getWhatsAppStatus = (adminId: string) => {
  const inst = instances.get(adminId);
  return { 
    latestQr: inst?.latestQr || null, 
    isReady: inst?.isReady || false 
  };
};

export const isWhatsAppReady = (adminId: string) => instances.get(adminId)?.isReady || false;

export async function sendWhatsAppMessage(adminId: string, to: string, message: string) {
  const inst = instances.get(adminId);
  if (!inst || !inst.isReady) {
    console.error(`[WHATSAPP_SEND_ERROR][${adminId}] Cannot send message: client not initialized or ready.`);
    throw new Error('WhatsApp client is not ready for this admin');
  }
  
  console.log(`[WHATSAPP][${adminId}] Attempting to deliver message to ${to}...`);
  try {
    const sent = await inst.client.sendMessage(to, message);
    if (sent) {
      console.log(`[WHATSAPP][${adminId}] Message successfully delivered to ${to}.`);
      return sent;
    } else {
      console.warn(`[WHATSAPP_WARNING][${adminId}] client.sendMessage returned empty response for ${to}. Trying alternative chat.sendMessage...`);
      const chat = await inst.client.getChatById(to);
      const altSent = await chat.sendMessage(message);
      console.log(`[WHATSAPP][${adminId}] Alt delivery status:`, altSent ? "✅ SUCCESS" : "❌ FAILED");
      return altSent;
    }
  } catch (error: any) {
    console.error(`[WHATSAPP_SEND_FAIL][${adminId}] First send attempt failed: ${error.message}. Attempting fallback direct chat send...`);
    try {
      const chat = await inst.client.getChatById(to);
      const fallbackSent = await chat.sendMessage(message);
      console.log(`[WHATSAPP][${adminId}] Fallback direct delivery status:`, fallbackSent ? "✅ SUCCESS" : "❌ FAILED");
      return fallbackSent;
    } catch (fallbackError: any) {
      console.error(`[WHATSAPP_CRITICAL_FAIL][${adminId}] All message delivery attempts failed to ${to}:`, fallbackError.message);
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
      console.log(`[BLOCK][${adminId}] Permanently blocked ${userId}`);
    }
  } catch (error) {
    console.error(`[BLOCK ERROR][${adminId}]`, (error as any)?.message);
  }
}

function cleanupInstance(adminId: string) {
  const inst = instances.get(adminId);
  if (inst) {
    if (inst.keepAliveTimer) clearInterval(inst.keepAliveTimer);
    inst.latestQr = null;
    inst.isReady = false;
  }
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

  console.log(`[${adminId}] WhatsApp logged out.`);
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
      ['SingletonCookie', 'SingletonSocket', 'SingletonLock'].forEach(f => {
        try { fs.unlinkSync(`${sessionDir}/${f}`); } catch {}
      });
    }
  } catch {}
}

// Clear stale auth dirs from old sessions to prevent QR loop
function clearStaleSessions() {
  try {
    const files = fs.readdirSync('.');
    for (const f of files) {
      if (f.startsWith('.wwebjs_auth_')) {
        try {
          const sessionDir = `${f}/session`;
          if (fs.existsSync(`${f}/Default`) || fs.existsSync(sessionDir)) {
            fs.rmSync(f, { recursive: true, force: true });
            console.log(`[WHATSAPP] Cleared stale session: ${f}`);
          }
        } catch {}
      }
      if (f.startsWith('.wwebjs_cache_')) {
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
    if (process.platform !== 'win32') {
      execSync('pkill -f "chrome.*--headless" 2>/dev/null || true', { stdio: 'ignore' });
    }
  } catch {}
}

export function initializeWhatsAppClient(adminId: string) {
  killOrphanedChrome();
  const existing = instances.get(adminId);
  if (existing) {
    return existing.client;
  }

  // Clear stale sessions once on first init
  if (!sessionsCleared) {
    clearStaleSessions();
    sessionsCleared = true;
  }

  const retries = retryCounters.get(adminId) || 0;
  console.log(`[WHATSAPP][${adminId}] initializeWhatsAppClient called. Current retries: ${retries}`);

  if (retries >= MAX_RETRIES) {
    console.error(`[WHATSAPP][${adminId}] Max retries (${MAX_RETRIES}) reached. Giving up.`);
    return;
  }

  console.log(`[WHATSAPP][${adminId}] Initializing instance...`);

  const authDir = `.wwebjs_auth_${adminId}`;

  cleanupOrphanedBrowser(authDir);

  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    `${process.env.LOCALAPPDATA || ''}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env.PROGRAMFILES || ''}\\Google\\Chrome\\Application\\chrome.exe`,
  ];

  const puppeteerConfig: any = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
      '--no-first-run',
      '--mute-audio'
    ]
  };

  const execPath = chromePaths.find(p => fs.existsSync(p));
  if (execPath) {
    puppeteerConfig.executablePath = execPath;
    console.log(`[WHATSAPP][${adminId}] Using Chrome at: ${execPath}`);
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
    reconnectAttempts: 0
  };
  instances.set(adminId, inst);

  client.on('qr', (qr) => {
    console.log(`[WHATSAPP][${adminId}] QR Code received.`);
    inst.latestQr = qr;
    inst.isReady = false;
  });

  client.on('authenticated', () => {
    console.log(`[WHATSAPP][${adminId}] Auth success`);
    inst.latestQr = null;
  });

  client.on('ready', () => {
    console.log(`[WHATSAPP][${adminId}] READY!`);
    inst.latestQr = null;
    inst.isReady = true;
    retryCounters.delete(adminId);
  });

  client.on('message', async (msg) => {
    if (!msg || msg.isStatus) return;
    const chat = await msg.getChat().catch(() => null);
    if (!chat || chat.isGroup) return;

    const userId = msg.from;
    const text = msg.body;
    
    console.log(`[WHATSAPP][${adminId}] Received message from ${userId}: "${text}"`);
    
    try {
      const result = await processIncomingMessage(adminId, userId, text || "");
      console.log(`[WHATSAPP][${adminId}] AI response generated: "${result?.text?.slice(0, 40)}..."`);
      
      if (result?.text) {
        await sendWhatsAppMessage(adminId, userId, result.text);
      } else {
        console.log(`[WHATSAPP][${adminId}] No text response to send.`);
      }
      
      if (result?.images?.length) {
        console.log(`[WHATSAPP][${adminId}] Sending ${result.images.length} images...`);
        for (const img of result.images) {
          const media = await MessageMedia.fromUrl(img).catch((err) => {
            console.error(`[WHATSAPP][${adminId}] Failed to load image: ${img}`, err.message);
            return null;
          });
          if (media) {
            await client.sendMessage(userId, media, { caption: result.text?.slice(0, 100) || "" });
            console.log(`[WHATSAPP][${adminId}] Image sent successfully.`);
          }
        }
      }

      if (result?.videos?.length) {
        console.log(`[WHATSAPP][${adminId}] Sending ${result.videos.length} videos...`);
        for (const vid of result.videos) {
          const media = await MessageMedia.fromUrl(vid, { unsafeMime: true }).catch((err) => {
            console.error(`[WHATSAPP][${adminId}] Failed to load video: ${vid}`, err.message);
            return null;
          });
          if (media) {
            await client.sendMessage(userId, media, { sendVideoAsGif: false, caption: result.text?.slice(0, 100) || "" });
            console.log(`[WHATSAPP][${adminId}] Video sent successfully.`);
          }
        }
      }
    } catch (e: any) {
      console.error(`[MSG ERROR][${adminId}] Error in message processing or sending:`, e.message);
    }
  });

  client.on('disconnected', (reason: any) => {
    console.log(`[WHATSAPP][${adminId}] Disconnected:`, reason);
    inst.isReady = false;
    inst.latestQr = null;
    console.log(`[WHATSAPP][${adminId}] Attempting auto-reconnect in 10 seconds...`);
    setTimeout(() => {
      if (!instances.get(adminId)?.isReady) {
        console.log(`[WHATSAPP][${adminId}] Auto-reconnecting...`);
        instances.delete(adminId);
        initializeWhatsAppClient(adminId);
      }
    }, 10000);
  });

  client.initialize().catch(e => {
    console.error(`[INIT ERROR][${adminId}]`, e.message);
    instances.delete(adminId);
    try { client.destroy(); } catch (_) {}
    if ((e.message?.includes('EMAXCONNSESSIONS') || e.message?.includes('max clients')) && process.platform !== 'win32') {
      killOrphanedChrome();
    }
    retryCounters.set(adminId, retries + 1);
    const delay = Math.min(3000 * (retries + 1), 10000);
    console.log(`[WHATSAPP][${adminId}] Retry ${retries + 1}/${MAX_RETRIES} in ${delay}ms...`);
    setTimeout(() => initializeWhatsAppClient(adminId), delay);
  });

  return client;
}

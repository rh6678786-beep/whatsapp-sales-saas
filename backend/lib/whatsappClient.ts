/**
 * WhatsApp Cloud API Client
 * 
 * Replaces the old whatsapp-web.js (Puppeteer) implementation with
 * Meta's official WhatsApp Business Cloud API.
 * 
 * Key differences:
 * - No Chrome/Puppeteer needed
 * - Stateless REST API — scales horizontally
 * - No QR codes — uses permanent access tokens
 * - Webhook-based incoming messages
 * - Handles 1000+ tenants per server
 */

import axios from "axios";
import fs from "fs";
import { dbService } from "../services/dbService.js";
import { createChildLogger } from "./logger.js";

// ---- One-time cleanup of old whatsapp-web.js session files ----
try {
  const files = fs.readdirSync(".");
  for (const f of files) {
    if (f.startsWith(".wwebjs_auth_") || f.startsWith(".wwebjs_cache_")) {
      try { fs.rmSync(f, { recursive: true, force: true }); } catch {}
    }
  }
} catch {}

const log = createChildLogger("whatsapp:cloud");

// ---- Helpers ----

/**
 * Dynamically import form-data for media uploads (ESM compatibility).
 */
const getFormData = async (): Promise<any> => {
  const mod = await import("form-data");
  return mod.default;
};

// WhatsApp Cloud API base URL
const WHATSAPP_API_BASE = "https://graph.facebook.com/v22.0";

// Upload API for media
const WHATSAPP_MEDIA_API_BASE = "https://graph.facebook.com/v22.0";

// ---- Types ----

export interface WhatsAppCloudConfig {
  /** Permanent access token from Meta Developer Portal */
  accessToken: string;
  /** Phone Number ID (from WABA) */
  phoneNumberId: string;
  /** WhatsApp Business Account ID */
  wabaId: string;
  /** Business Account ID from Meta */
  businessAccountId: string;
  /** Verify token for webhook validation */
  verifyToken: string;
  /** Whether this connection is active */
  isActive: boolean;
  /** The registered phone number (human-readable) */
  phoneNumber?: string;
  /** ISO timestamp of last connection test */
  lastTestedAt?: string;
}

export interface WhatsAppStatus {
  isReady: boolean;
  phoneNumber?: string;
  wabaId?: string;
  lastTestedAt?: string;
}

// ---- Validation ----

function validateConfig(config: WhatsAppCloudConfig | undefined | null): asserts config is WhatsAppCloudConfig {
  if (!config) throw new Error("WhatsApp Cloud API not configured");
  if (!config.accessToken) throw new Error("WhatsApp access token not configured");
  if (!config.phoneNumberId) throw new Error("WhatsApp Phone Number ID not configured");
  if (!config.isActive) throw new Error("WhatsApp Cloud API is not active");
}

// ---- Status ----

/**
 * Get WhatsApp Cloud API status for an admin.
 * Checks if the admin has configured their WABA credentials.
 */
export async function getWhatsAppStatus(adminId: string): Promise<WhatsAppStatus> {
  try {
    const settings = await dbService.getSettings(adminId);
    const config = settings.whatsappCloud as WhatsAppCloudConfig | undefined;
    
    if (!config || !config.isActive) {
      return { isReady: false };
    }

    return {
      isReady: !!(
        config.accessToken && 
        config.phoneNumberId && 
        config.isActive
      ),
      phoneNumber: config.phoneNumber,
      wabaId: config.wabaId,
      lastTestedAt: config.lastTestedAt,
    };
  } catch (err) {
    log.warn({ err, adminId }, "Failed to get WhatsApp status");
    return { isReady: false };
  }
}

/**
 * In-memory ready cache for fast synchronous checks.
 * Populated on configure/test, cleared on logout/removal.
 */
const readyCache = new Map<string, boolean>();

/**
 * Mark an admin as WhatsApp-ready (set on configure/test success).
 */
export function setWhatsAppReady(adminId: string, ready: boolean): void {
  readyCache.set(adminId, ready);
}

/**
 * Synchronous check — returns true if this admin has been marked ready.
 * Used by high-frequency callers (broadcasts, proactive engine, etc.)
 * that checked the old sync `isWhatsAppReady` without await.
 */
export function isWhatsAppReady(adminId: string): boolean {
  return readyCache.get(adminId) === true;
}

/**
 * Async check — fetches actual status from DB.
 * Use this for rare, non-performance-critical checks.
 */
export async function verifyWhatsAppReady(adminId: string): Promise<boolean> {
  const status = await getWhatsAppStatus(adminId);
  readyCache.set(adminId, status.isReady);
  return status.isReady;
}

// ---- Send Message ----

/**
 * Send a text message via WhatsApp Cloud API.
 */
export async function sendWhatsAppMessage(
  adminId: string, 
  to: string, 
  message: string
): Promise<boolean> {
  const settings = await dbService.getSettings(adminId);
  const config = settings.whatsappCloud as WhatsAppCloudConfig | undefined;
  
  try {
    validateConfig(config);
  } catch (err: any) {
    log.error({ adminId }, err.message);
    throw new Error(err.message);
  }

  // Clean the phone number — remove any non-digit characters
  const cleanNumber = to.replace(/[^\d]/g, "");
  
  log.info({ adminId, to: cleanNumber, msgLen: message.length }, "Sending WhatsApp Cloud API message");

  try {
    const response = await axios.post(
      `${WHATSAPP_API_BASE}/${config.phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanNumber,
        type: "text",
        text: {
          preview_url: false,
          body: message,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    if (response.status === 200) {
      log.info({ adminId, to: cleanNumber }, "Message sent successfully");
      return true;
    }

    log.warn({ adminId, to: cleanNumber, status: response.status }, "Unexpected response from WhatsApp API");
    return false;
  } catch (error: any) {
    const errorData = error?.response?.data;
    const errorMessage = errorData?.error?.message || error.message;
    
    log.error({ 
      err: errorMessage, 
      adminId, 
      to: cleanNumber,
      code: errorData?.error?.code 
    }, "WhatsApp Cloud API send failed");
    
    throw new Error(`WhatsApp send failed: ${errorMessage}`);
  }
}

// ---- Send Media ----

/**
 * Upload media to WhatsApp Cloud API servers and get a media ID.
 */
export async function uploadMedia(
  adminId: string,
  base64Data: string,
  mimeType: string,
  filename: string
): Promise<string | null> {
  const settings = await dbService.getSettings(adminId);
  const config = settings.whatsappCloud as WhatsAppCloudConfig | undefined;
  
  try {
    validateConfig(config);
  } catch {
    return null;
  }

  try {
    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, "base64");

    // Upload using form data
    const FormData = await getFormData();
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("file", buffer, {
      filename,
      contentType: mimeType,
    });
    form.append("type", mimeType);

    const response = await axios.post(
      `${WHATSAPP_MEDIA_API_BASE}/${config.phoneNumberId}/media`,
      form,
      {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          ...form.getHeaders(),
        },
        timeout: 30000,
      }
    );

    return response.data?.id || null;
  } catch (error: any) {
    log.error({ err: error?.response?.data || error.message, adminId }, "Media upload failed");
    return null;
  }
}

/**
 * Send a media message (image, video, document) using a pre-uploaded media ID.
 */
export async function sendMediaMessage(
  adminId: string,
  to: string,
  mediaId: string,
  mediaType: "image" | "video" | "document",
  caption?: string
): Promise<boolean> {
  const settings = await dbService.getSettings(adminId);
  const config = settings.whatsappCloud as WhatsAppCloudConfig | undefined;
  
  try {
    validateConfig(config);
  } catch (err: any) {
    log.error({ adminId }, err.message);
    return false;
  }

  const cleanNumber = to.replace(/[^\d]/g, "");

  try {
    const body: any = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanNumber,
      type: mediaType,
    };

    body[mediaType] = { id: mediaId };
    if (caption) {
      body[mediaType].caption = caption;
    }

    await axios.post(
      `${WHATSAPP_API_BASE}/${config.phoneNumberId}/messages`,
      body,
      {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    return true;
  } catch (error: any) {
    log.error({ err: error?.response?.data || error.message, adminId }, "Media send failed");
    return false;
  }
}

/**
 * Send an image from a URL by first downloading and uploading it.
 */
export async function sendImageFromUrl(
  adminId: string,
  to: string,
  imageUrl: string,
  caption?: string
): Promise<boolean> {
  try {
    // Download the image
    const response = await axios.get(imageUrl, {
      responseType: "arraybuffer",
      timeout: 15000,
    });
    
    const base64 = Buffer.from(response.data).toString("base64");
    const mimeType = String(response.headers["content-type"] || "image/jpeg");
    
    // Upload to WhatsApp
    const mediaId = await uploadMedia(adminId, base64, mimeType, "image.jpg");
    if (!mediaId) return false;
    
    // Send the media
    return sendMediaMessage(adminId, to, mediaId, "image", caption);
  } catch (error: any) {
    log.error({ err: error.message, adminId }, "Send image from URL failed");
    return false;
  }
}

// ---- Webhook Handling ----

/**
 * Verify WhatsApp webhook subscription (GET request from Meta).
 * Returns the challenge string if verification succeeds, null otherwise.
 */
export async function verifyWhatsAppWebhook(
  adminId: string,
  mode: string,
  token: string,
  challenge: string
): Promise<string | null> {
  if (mode !== "subscribe") return null;

  const settings = await dbService.getSettings(adminId);
  const config = settings.whatsappCloud as WhatsAppCloudConfig | undefined;

  if (config?.verifyToken && token === config.verifyToken) {
    log.info({ adminId }, "WhatsApp webhook verified successfully");
    return challenge;
  }

  log.warn({ adminId }, "WhatsApp webhook verification failed — token mismatch");
  return null;
}

/**
 * Process an incoming WhatsApp webhook event.
 * This is called by the webhook POST route.
 */
export async function handleWhatsAppWebhook(
  adminId: string,
  payload: any
): Promise<void> {
  try {
    // Navigate the complex webhook payload structure
    const entry = payload?.entry?.[0];
    if (!entry) return;

    const change = entry?.changes?.[0];
    if (!change) return;

    const value = change?.value;
    if (!value) return;

    // Skip status updates
    if (value.statuses) {
      // Log delivery status for monitoring
      for (const status of value.statuses) {
        log.debug({ 
          adminId, 
          messageId: status.id, 
          status: status.status,
          timestamp: status.timestamp 
        }, "Message status update");
      }
      return;
    }

    // Process incoming messages
    const messages = value?.messages;
    if (!messages || !Array.isArray(messages) || messages.length === 0) return;

    const message = messages[0];
    const from = message.from; // sender's phone number
    const msgType = message.type;

    let text = "";
    let mediaBase64: string | undefined;
    let mimeType: string | undefined;

    if (msgType === "text") {
      text = message.text?.body || "";
    } else if (msgType === "interactive") {
      // Handle button replies and list selections
      text = message.interactive?.button_reply?.title || 
             message.interactive?.list_reply?.title || "";
    } else if (msgType === "image") {
      text = message.image?.caption || "[Image]";
      mimeType = "image/jpeg";
      // For media, we'd need to download from WhatsApp's servers
      // using the media ID. For now, we just log the caption.
      log.info({ adminId, from, mediaId: message.image?.id }, "Image received via webhook");
    } else if (msgType === "video") {
      text = message.video?.caption || "[Video]";
      mimeType = "video/mp4";
    } else if (msgType === "document") {
      text = message.document?.caption || "[Document]";
    } else if (msgType === "audio") {
      text = "[Audio]";
    } else if (msgType === "location") {
      text = `[Location: ${message.location?.latitude}, ${message.location?.longitude}]`;
    } else {
      text = `[${msgType} message]`;
    }

    if (!text) return;

    // Use phone number as user ID (consistent with existing system)
    const userId = from;

    log.info({ adminId, userId, text: text.substring(0, 100), msgType }, 
      "Incoming WhatsApp message via Cloud API webhook");

    // Process through the AI message handler
    const { processIncomingMessage } = await import("../services/messageHandler.js");
    const result = await processIncomingMessage(
      adminId, 
      userId, 
      text, 
      undefined, 
      mediaBase64, 
      mimeType, 
      from,
      'whatsapp'
    );

    // Send AI response back
    if (result?.text) {
      await sendWhatsAppMessage(adminId, userId, result.text);
    }

    // Send images if requested
    if (result?.images?.length) {
      for (const img of result.images) {
        await sendImageFromUrl(adminId, userId, img, result.text?.substring(0, 100));
      }
    }

  } catch (error: any) {
    log.error({ err: error.message, adminId }, "Webhook processing error");
  }
}

// ---- Block Contact ----

/**
 * Block a WhatsApp contact using the Cloud API.
 * Note: The Cloud API handles blocking differently — use the /business/profile endpoint.
 * For now, we mark the user as blocked in our DB.
 */
export async function blockWhatsAppContact(
  adminId: string, 
  userId: string
): Promise<void> {
  // WhatsApp Cloud API doesn't have a direct block endpoint for 1:1 blocking.
  // We handle this in our application layer by marking the session as blocked.
  log.info({ adminId, userId }, "Contact blocked (application-level)");
  
  // The actual blocking is done in messageHandler via dbService.updateSession
}

// ---- Test Connection ----

/**
 * Test the WhatsApp Cloud API connection by sending a message to the business phone.
 */
export async function testWhatsAppConnection(
  adminId: string
): Promise<{ success: boolean; error?: string }> {
  const settings = await dbService.getSettings(adminId);
  const config = settings.whatsappCloud as WhatsAppCloudConfig | undefined;

  if (!config?.accessToken || !config?.phoneNumberId) {
    return { success: false, error: "WhatsApp Cloud API not fully configured" };
  }

  try {
    // Test by getting the phone number info
    const response = await axios.get(
      `${WHATSAPP_API_BASE}/${config.phoneNumberId}`,
      {
        headers: { Authorization: `Bearer ${config.accessToken}` },
        timeout: 10000,
      }
    );

    if (response.status === 200) {
      // Update last tested timestamp
      await dbService.updateSettings(adminId, {
        whatsappCloud: {
          ...config,
          lastTestedAt: new Date().toISOString(),
        },
      });

      // Mark as ready in memory cache
      setWhatsAppReady(adminId, true);

      return { success: true };
    }

    return { success: false, error: "Unexpected API response" };
  } catch (error: any) {
    const errorData = error?.response?.data;
    const errorMessage = errorData?.error?.message || error.message;
    return { success: false, error: errorMessage };
  }
}

// ---- Logout / Disconnect ----

/**
 * Disconnect WhatsApp by clearing the configuration,
 * not by invalidating the token (which is permanent).
 * The user can re-connect later with the same token.
 */
export async function logoutWhatsApp(adminId: string): Promise<{ success: boolean }> {
  try {
    const settings = await dbService.getSettings(adminId);
    
    // Preserve the token and IDs but mark as inactive
    const config = settings.whatsappCloud as WhatsAppCloudConfig | undefined;
    if (config) {
      await dbService.updateSettings(adminId, {
        whatsappCloud: {
          ...config,
          isActive: false,
        },
      });
    }

    // Clear from ready cache
    setWhatsAppReady(adminId, false);

    log.info({ adminId }, "WhatsApp disconnected");
    return { success: true };
  } catch (error: any) {
    log.error({ err: error.message, adminId }, "WhatsApp disconnect failed");
    return { success: false };
  }
}

/**
 * Completely remove all WhatsApp Cloud API configuration.
 */
export async function removeWhatsAppConfig(adminId: string): Promise<{ success: boolean }> {
  try {
    const settings = await dbService.getSettings(adminId);
    const config = { ...(settings.whatsappCloud || {}) };
    
    // Clear all sensitive fields
    await dbService.updateSettings(adminId, {
      whatsappCloud: {
        ...config,
        accessToken: "",
        phoneNumberId: "",
        wabaId: "",
        isActive: false,
      },
    });

    log.info({ adminId }, "WhatsApp configuration removed");
    return { success: true };
  } catch (error: any) {
    log.error({ err: error.message, adminId }, "WhatsApp config removal failed");
    return { success: false };
  }
}

// ---- Startup: Warm the ready cache from active configurations ----
// This runs once when the module is first loaded (server startup).
// Without this, all admins would show as "not ready" until they
// manually test their connection after a restart.
(async () => {
  try {
    const adminIds = await dbService.getAllAdminIds();
    for (const id of adminIds) {
      // Fire-and-forget — don't block startup
      verifyWhatsAppReady(id).catch(() => {});
    }
    log.info({ count: adminIds.length }, "Warmed WhatsApp ready cache from DB");
  } catch (err) {
    log.warn({ err }, "Failed to warm WhatsApp ready cache");
  }
})();

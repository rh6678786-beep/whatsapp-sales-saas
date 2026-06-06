import { Router } from "express";
import axios from "axios";
import crypto from "crypto";
import { dbService } from "../services/dbService.js";
import { getAdminId, requireAuth, AuthenticatedRequest } from "../middleware/auth.js";
import { 
  getWhatsAppStatus, 
  logoutWhatsApp, 
  testWhatsAppConnection,
  verifyWhatsAppWebhook,
  handleWhatsAppWebhook,
  setWhatsAppReady,
} from "../lib/whatsappClient.js";
import { webhookRateLimiter } from "../lib/rateLimiter.js";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("route:whatsapp");
const router = Router();

// ---- WhatsApp OAuth (Easy Connect via Facebook Login) ----

const FB_APP_ID = process.env.FACEBOOK_CLIENT_ID || "";
const FB_APP_SECRET = process.env.FACEBOOK_CLIENT_SECRET || "";
const BASE_URL = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
const WA_REDIRECT_URI = `${BASE_URL}/api/whatsapp/oauth/callback`;

// In-memory state store — used for OAuth CSRF protection
const oauthStateStore = new Map<string, { adminId: string; expiresAt: number }>();
const STATE_TTL = 10 * 60 * 1000; // 10 minutes

// Cleanup expired states
setInterval(() => {
  const now = Date.now();
  for (const [state, entry] of oauthStateStore) {
    if (entry.expiresAt < now) oauthStateStore.delete(state);
  }
}, 60 * 1000);

/**
 * GET /api/whatsapp/oauth/login
 * Redirect to Facebook OAuth dialog for WhatsApp Cloud API permissions.
 */
router.get("/whatsapp/oauth/login", requireAuth, (req: AuthenticatedRequest, res) => {
  if (!FB_APP_ID) {
    return res.send(`
      <html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#fafafa;">
        <div style="text-align:center;max-width:400px;padding:40px;">
          <h2 style="color:#e11d48;">Facebook App Not Configured</h2>
          <p style="color:#64748b;margin-top:12px;">Set FACEBOOK_CLIENT_ID and FACEBOOK_CLIENT_SECRET in .env</p>
        </div>
      </body></html>
    `);
  }

  const adminId = req.adminId!;
  const state = crypto.randomUUID();

  // Store state with adminId for CSRF validation
  oauthStateStore.set(state, {
    adminId,
    expiresAt: Date.now() + STATE_TTL,
  });

  // WhatsApp Cloud API scopes
  const scopes = [
    "whatsapp_business_messaging",
    "whatsapp_business_management",
    "business_management",
  ].join(",");

  const fbOAuthUrl = `https://www.facebook.com/v22.0/dialog/oauth?client_id=${FB_APP_ID}&redirect_uri=${encodeURIComponent(WA_REDIRECT_URI)}&state=${state}&scope=${encodeURIComponent(scopes)}&response_type=code`;
  res.redirect(fbOAuthUrl);
});

/**
 * GET /api/whatsapp/oauth/callback
 * Handle the OAuth callback from Facebook, exchange code for token,
 * fetch WABA info, and save WhatsApp Cloud config.
 */
router.get("/whatsapp/oauth/callback", async (req, res) => {
  const { code, state, error: fbError } = req.query;

  if (fbError) {
    log.warn({ fbError }, "Facebook OAuth failed");
    return res.send(`<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;"><p style="color:#ef4444;">Authorization failed: ${fbError}</p><script>window.close();</script></body></html>`);
  }

  if (!code || !state) {
    return res.send(`<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;"><p style="color:#ef4444;">Missing authorization code or state.</p><script>window.close();</script></body></html>`);
  }

  // Validate CSRF state
  const stateEntry = oauthStateStore.get(state as string);
  if (!stateEntry || stateEntry.expiresAt < Date.now()) {
    oauthStateStore.delete(state as string);
    log.warn({ state: state as string }, "OAuth state validation failed — possible CSRF attack");
    return res.send(`<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;"><p style="color:#ef4444;">Invalid or expired OAuth state. Please try again.</p><script>window.close();</script></body></html>`);
  }

  // State is valid — consume it
  oauthStateStore.delete(state as string);
  const adminId = stateEntry.adminId;

  try {
    // Exchange code for access token
    const tokenRes = await axios.get("https://graph.facebook.com/v22.0/oauth/access_token", {
      params: {
        client_id: FB_APP_ID,
        client_secret: FB_APP_SECRET,
        redirect_uri: WA_REDIRECT_URI,
        code: code as string,
      },
    });

    const userAccessToken = tokenRes.data.access_token;

    // Fetch the user's businesses and WABA
    // First, get the user's business accounts
    const bizRes = await axios.get("https://graph.facebook.com/v22.0/me/businesses", {
      params: { access_token: userAccessToken },
    });

    const businesses = bizRes.data?.data || [];
    let wabaId = "";
    let phoneNumberId = "";
    let phoneNumber = "";
    let accessToken = "";
    let businessAccountId = "";

    // Try to find WABA and get a page access token
    // WABA is typically managed through a Facebook Page
    for (const business of businesses) {
      businessAccountId = business.id;
      
      // Get WABA for this business
      try {
        const wabaRes = await axios.get(`https://graph.facebook.com/v22.0/${business.id}/whatsapp_business_accounts`, {
          params: { access_token: userAccessToken },
        });
        const wabaAccounts = wabaRes.data?.data || [];
        
        if (wabaAccounts.length > 0) {
          wabaId = wabaAccounts[0].id;
          
          // Get phone numbers for this WABA
          const phoneRes = await axios.get(`https://graph.facebook.com/v22.0/${wabaId}/phone_numbers`, {
            params: { access_token: userAccessToken },
          });
          const phoneNumbers = phoneRes.data?.data || [];
          
          if (phoneNumbers.length > 0) {
            phoneNumberId = phoneNumbers[0].id;
            phoneNumber = phoneNumbers[0].display_phone_number || "";
            
            // Get a permanent token — the userAccessToken from OAuth is short-lived.
            // For now, use the user token. The admin can replace with a permanent token later.
            accessToken = userAccessToken;
            
            break; // Found a WABA with phone numbers
          }
        }
      } catch (wabaErr) {
        log.warn({ businessId: business.id, err: (wabaErr as Error).message }, "Failed to fetch WABA for business");
      }
    }

    if (!wabaId || !phoneNumberId) {
      return res.send(`
        <html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
          <div style="text-align:center;max-width:400px;padding:40px;">
            <h3 style="color:#e11d48;">WhatsApp Business Account Not Found</h3>
            <p style="color:#64748b;margin-top:12px;font-size:14px;">
              No WhatsApp Business Account or phone number was found for your account.<br><br>
              To use WhatsApp Cloud API:<br>
              1. Go to <a href="https://business.facebook.com/" target="_blank" style="color:#10b981;">Meta Business Suite</a><br>
              2. Add WhatsApp to your Business Account<br>
              3. Register a phone number<br>
              4. Then connect again here<br><br>
              Or use the <strong>Manual Setup</strong> option below.
            </p>
            <script>
              window.opener?.postMessage({ 
                type: 'whatsapp_oauth_error', 
                error: 'No WABA or phone number found. Set up WhatsApp in Meta Business Suite first.' 
              }, '*');
              setTimeout(() => window.close(), 1000);
            </script>
          </div>
        </body></html>
      `);
    }

    // Generate a verify token automatically
    const verifyToken = crypto.randomBytes(16).toString("hex");

    // Fetch existing settings to preserve any other fields
    const settings = await dbService.getSettings(adminId);
    const existingConfig = (settings.whatsappCloud || {}) as any;

    // Save the WhatsApp Cloud configuration
    await dbService.updateSettings(adminId, {
      whatsappCloud: {
        ...existingConfig,
        accessToken,
        phoneNumberId,
        wabaId,
        businessAccountId,
        verifyToken,
        phoneNumber,
        isActive: true,
        lastTestedAt: new Date().toISOString(),
      },
    });

    // Mark as ready in cache
    setWhatsAppReady(adminId, true);

    log.info({ adminId, wabaId, phoneNumber }, "WhatsApp connected via OAuth");

    res.send(`
      <html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#fafafa;">
        <div style="text-align:center;">
          <div style="width:48px;height:48px;border-radius:24px;background:#10b981;color:white;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:24px;">✓</div>
          <h3 style="color:#1e293b;">WhatsApp Connected!</h3>
          <p style="color:#64748b;font-size:13px;">Phone: ${phoneNumber}</p>
          <p style="color:#64748b;font-size:11px;">WABA ID: ${wabaId.slice(0, 20)}…</p>
          <p style="color:#10b981;font-size:12px;margin-top:8px;">AI Sales Agent is now active! 🎉</p>
        </div>
        <script>
          window.opener?.postMessage({ 
            type: 'whatsapp_oauth', 
            phoneNumber: ${JSON.stringify(phoneNumber)},
            wabaId: ${JSON.stringify(wabaId)},
            phoneNumberId: ${JSON.stringify(phoneNumberId)},
            businessAccountId: ${JSON.stringify(businessAccountId)},
          }, '*');
          setTimeout(() => window.close(), 2000);
        </script>
      </body></html>
    `);
  } catch (error: any) {
    log.error({ err: error?.response?.data || error?.message }, "WhatsApp OAuth failed");
    res.send(`<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;"><p style="color:#ef4444;">OAuth failed: ${error?.response?.data?.error?.message || error.message}</p><script>window.close();</script></body></html>`);
  }
});

// ---- WhatsApp Cloud API Configuration Routes ----

/**
 * GET /api/whatsapp/status
 * Returns the current WhatsApp Cloud API connection status.
 */
router.get("/whatsapp/status", requireAuth, async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const status = await getWhatsAppStatus(adminId);
    res.json(status);
  } catch (e: any) {
    res.status(401).json({ error: e.message });
  }
});

/**
 * POST /api/whatsapp/configure
 * Save WhatsApp Cloud API credentials provided by the admin.
 * Body: { accessToken, phoneNumberId, wabaId, businessAccountId, verifyToken, phoneNumber }
 */
router.post("/whatsapp/configure", requireAuth, async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const { accessToken, phoneNumberId, wabaId, businessAccountId, verifyToken, phoneNumber } = req.body;

    if (!accessToken || !phoneNumberId || !wabaId) {
      return res.status(400).json({ 
        error: "Missing required fields: accessToken, phoneNumberId, wabaId" 
      });
    }

    // Fetch existing settings to preserve any other fields
    const settings = await dbService.getSettings(adminId);
    const existingConfig = (settings.whatsappCloud || {}) as any;

    await dbService.updateSettings(adminId, {
      whatsappCloud: {
        ...existingConfig,
        accessToken,
        phoneNumberId,
        wabaId,
        businessAccountId: businessAccountId || existingConfig.businessAccountId || "",
        verifyToken: verifyToken || existingConfig.verifyToken || "",
        phoneNumber: phoneNumber || existingConfig.phoneNumber || "",
        isActive: true,
        lastTestedAt: existingConfig.lastTestedAt || "",
      },
    });

    log.info({ adminId }, "WhatsApp Cloud API configured");
    res.json({ success: true, message: "WhatsApp Cloud API credentials saved successfully." });
  } catch (e: any) {
    log.error({ err: e.message }, "WhatsApp configure error");
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/whatsapp/test
 * Test the WhatsApp Cloud API connection.
 */
router.post("/whatsapp/test", requireAuth, async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const result = await testWhatsAppConnection(adminId);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/whatsapp/logout
 * Disconnect WhatsApp (mark as inactive, keep credentials).
 */
router.post("/whatsapp/logout", requireAuth, async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const result = await logoutWhatsApp(adminId);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * DELETE /api/whatsapp/config
 * Completely remove WhatsApp Cloud API configuration.
 */
router.delete("/whatsapp/config", requireAuth, async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const { removeWhatsAppConfig } = await import("../lib/whatsappClient.js");
    const result = await removeWhatsAppConfig(adminId);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ---- Webhook Routes (no auth — Meta calls these) ----

/**
 * GET /api/whatsapp/webhook
 * WhatsApp Cloud API webhook verification (GET challenge).
 * Meta calls this to verify the webhook endpoint.
 * Query params: hub.mode, hub.verify_token, hub.challenge
 */
router.get("/whatsapp/webhook", async (req, res) => {
  try {
    const mode = req.query["hub.mode"] as string;
    const token = req.query["hub.verify_token"] as string;
    const challenge = req.query["hub.challenge"] as string;

    log.info({ mode, token: token?.slice(0,10) }, "Webhook verification request received");

    // Find the admin by verifying against all admin configs
    // Since webhook doesn't know which admin, we iterate
    const adminIds = await dbService.getAllAdminIds();
    
    for (const adminId of adminIds) {
      const result = await verifyWhatsAppWebhook(adminId, mode, token, challenge);
      if (result) {
        log.info({ adminId }, "Webhook verification successful");
        // Meta expects the challenge string returned as plain text (not JSON)
        return res.status(200).type("text/plain").send(result);
      }
    }

    log.warn("No matching admin found for webhook verify token");
    res.status(403).send("Verification failed: no matching verify token");
  } catch (e: any) {
    log.error({ err: e.message }, "Webhook verification error");
    res.status(500).send("Verification error");
  }
});

/**
 * POST /api/whatsapp/webhook
 * WhatsApp Cloud API incoming message webhook.
 * Meta sends POST requests with message payloads.
 */
router.post("/whatsapp/webhook", webhookRateLimiter, async (req, res) => {
  try {
    const payload = req.body;

    // Immediately respond with 200 OK to acknowledge receipt
    // Meta will retry if it doesn't get a 200 within 20 seconds
    res.status(200).json({ success: true });

    // Process the webhook asynchronously (don't block the response)
    const adminIds = await dbService.getAllAdminIds();
    
    for (const adminId of adminIds) {
      // Fire and forget — don't block
      handleWhatsAppWebhook(adminId, payload).catch((err) => {
        log.error({ err: err.message, adminId }, "Webhook processing error");
      });
    }
  } catch (e: any) {
    log.error({ err: e.message }, "Webhook POST error");
    // Always return 200 to prevent Meta from retrying
    res.status(200).json({ success: true });
  }
});

export default router;

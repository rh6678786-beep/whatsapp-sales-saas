import { Router } from "express";
import axios from "axios";
import crypto from "crypto";
import { dbService } from "../services/dbService.js";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth.js";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("route:ig-oauth");
const router = Router();

const FB_APP_ID = process.env.FACEBOOK_CLIENT_ID || "";
const FB_APP_SECRET = process.env.FACEBOOK_CLIENT_SECRET || "";
const BASE_URL = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
const FB_REDIRECT_URI = `${BASE_URL}/api/auth/instagram/callback`;

// In-memory state store — used for OAuth CSRF protection
// In production, this should use Redis
const oauthStateStore = new Map<string, { adminId: string; expiresAt: number }>();
const STATE_TTL = 10 * 60 * 1000; // 10 minutes

// Cleanup expired states
setInterval(() => {
  const now = Date.now();
  for (const [state, entry] of oauthStateStore) {
    if (entry.expiresAt < now) oauthStateStore.delete(state);
  }
}, 60 * 1000);

router.get("/auth/instagram/login", requireAuth, (req: AuthenticatedRequest, res) => {
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

  const fbOAuthUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${FB_APP_ID}&redirect_uri=${encodeURIComponent(FB_REDIRECT_URI)}&state=${state}&scope=instagram_basic,instagram_manage_messages,pages_show_list,pages_messaging&response_type=code`;
  res.redirect(fbOAuthUrl);
});

router.get("/auth/instagram/callback", async (req, res) => {
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
    const tokenRes = await axios.get("https://graph.facebook.com/v18.0/oauth/access_token", {
      params: {
        client_id: FB_APP_ID,
        client_secret: FB_APP_SECRET,
        redirect_uri: FB_REDIRECT_URI,
        code: code as string,
      },
    });

    const accessToken = tokenRes.data.access_token;
    const pagesRes = await axios.get("https://graph.facebook.com/v18.0/me/accounts", {
      params: { access_token: accessToken },
    });

    const page = pagesRes.data?.data?.[0];
    if (!page) {
      return res.send(`<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;"><p style="color:#ef4444;">No Facebook Page found. Create a Facebook Page first.</p><script>window.close();</script></body></html>`);
    }

    const pageAccessToken = page.access_token;
    const pageId = page.id;

    let igBusinessId = "";
    try {
      const igRes = await axios.get(`https://graph.facebook.com/v18.0/${pageId}`, {
        params: { access_token: pageAccessToken, fields: "instagram_business_account" },
      });
      igBusinessId = igRes.data?.instagram_business_account?.id || "";
    } catch {
      // No IG connected to this page
    }

    await dbService.updateSettings(adminId, {
      instagram: { igBusinessId, pageAccessToken, verifyToken: "", isActive: !!igBusinessId },
      facebook: { pageAccessToken, pageId, isActive: true },
    });

    log.info({ adminId, igBusinessId }, "Instagram connected");

    res.send(`
      <html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#fafafa;">
        <div style="text-align:center;">
          <div style="width:48px;height:48px;border-radius:24px;background:#10b981;color:white;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:24px;">✓</div>
          <h3 style="color:#1e293b;">Instagram Connected!</h3>
          <p style="color:#64748b;font-size:13px;">${igBusinessId ? "IG Business ID: " + igBusinessId : "No Instagram Business Account linked."}</p>
        </div>
        <script>
          window.opener?.postMessage({ type: 'instagram_oauth', igBusinessId: ${JSON.stringify(igBusinessId)}, pageAccessToken: ${JSON.stringify(pageAccessToken)} }, '*');
          window.opener?.postMessage({ type: 'FB_AUTH_SUCCESS' }, '*');
          setTimeout(() => window.close(), 2000);
        </script>
      </body></html>
    `);
  } catch (error: any) {
    log.error({ err: error?.response?.data || error?.message }, "IG OAuth failed");
    res.send(`<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;"><p style="color:#ef4444;">OAuth failed.</p><script>window.close();</script></body></html>`);
  }
});

export default router;

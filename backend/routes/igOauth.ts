import { Router } from "express";
import axios from "axios";
import { randomUUID } from "crypto";
import { dbService } from "../services/dbService.js";

const router = Router();

const FB_APP_ID = process.env.FACEBOOK_CLIENT_ID || "";
const FB_APP_SECRET = process.env.FACEBOOK_CLIENT_SECRET || "";
const FB_REDIRECT_URI = `${process.env.APP_URL || process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`}/api/auth/instagram/callback`;

router.get("/auth/facebook/login", (req, res) => {
  res.redirect("/api/auth/instagram/login");
});

router.get("/auth/instagram/login", (req, res) => {
  if (!FB_APP_ID) {
    return res.send(`
      <html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#fafafa;">
        <div style="text-align:center;max-width:400px;padding:40px;">
          <h2 style="color:#e11d48;">Facebook App Not Configured</h2>
          <p style="color:#64748b;margin-top:12px;">Set <code style="background:#f1f5f9;padding:2px 8px;border-radius:4px;">FACEBOOK_CLIENT_ID</code> and <code style="background:#f1f5f9;padding:2px 8px;border-radius:4px;">FACEBOOK_CLIENT_SECRET</code> in your <code style="background:#f1f5f9;padding:2px 8px;border-radius:4px;">.env</code> file to enable Instagram login.</p>
          <p style="color:#94a3b8;font-size:13px;margin-top:16px;">You can still connect manually via the Advanced Developer Setup below.</p>
          <script>window.opener?.postMessage({ type: 'instagram_oauth_error', error: 'Facebook App not configured' }, '*');</script>
        </div>
      </body></html>
    `);
  }
  const state = randomUUID();
  const fbOAuthUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${FB_APP_ID}&redirect_uri=${encodeURIComponent(FB_REDIRECT_URI)}&state=${state}&scope=instagram_basic,instagram_manage_messages,pages_show_list,pages_messaging&response_type=code`;
  res.redirect(fbOAuthUrl);
});

router.get("/auth/instagram/callback", async (req, res) => {
  const { code, state, error: fbError } = req.query;
  if (fbError) {
    return res.send(`<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;"><p style="color:#ef4444;">Facebook authorization failed: ${fbError}</p><script>window.close();</script></body></html>`);
  }
  if (!code) {
    return res.send(`<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;"><p style="color:#ef4444;">No authorization code received.</p><script>window.close();</script></body></html>`);
  }
  try {
    const tokenRes = await axios.get("https://graph.facebook.com/v18.0/oauth/access_token", {
      params: {
        client_id: FB_APP_ID,
        client_secret: FB_APP_SECRET,
        redirect_uri: FB_REDIRECT_URI,
        code,
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
    } catch { /* no IG connected to this page */ }

    const adminId = (req.query.state as string)?.split("_")?.[0] || "default-admin";

    await dbService.updateSettings(adminId, {
      instagram: { igBusinessId, pageAccessToken, verifyToken: "", isActive: !!igBusinessId },
      facebook: { pageAccessToken, pageId, isActive: true },
    });

    res.send(`
      <html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#fafafa;">
        <div style="text-align:center;">
          <div style="width:48px;height:48px;border-radius:24px;background:#10b981;color:white;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:24px;">✓</div>
          <h3 style="color:#1e293b;">Instagram Connected!</h3>
          <p style="color:#64748b;font-size:13px;">${igBusinessId ? 'IG Business ID: ' + igBusinessId : 'No Instagram Business Account linked to this page.'}</p>
        </div>
        <script>
          window.opener?.postMessage({
            type: 'instagram_oauth',
            igBusinessId: ${JSON.stringify(igBusinessId)},
            pageAccessToken: ${JSON.stringify(pageAccessToken)},
          }, '*');
          window.opener?.postMessage({
            type: 'FB_AUTH_SUCCESS'
          }, '*');
          setTimeout(() => window.close(), 2000);
        </script>
      </body></html>
    `);
  } catch (error: any) {
    console.error("[IG OAUTH ERROR]", error?.response?.data || error?.message);
    res.send(`
      <html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
        <p style="color:#ef4444;">OAuth failed: ${error?.response?.data?.error?.message || error?.message}</p>
        <script>window.close();</script>
      </body></html>
    `);
  }
});

export default router;

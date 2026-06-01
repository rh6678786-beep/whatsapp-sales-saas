import { Router } from "express";
import { dbService } from "../services/dbService.js";
import { getAdminId } from "../middleware/auth.js";
import { baseTemplate, reportEmailContent } from "../services/emailTemplates.js";
import { pool } from "../services/dbService.js";

const router = Router();

router.get("/email-report/settings", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const settings = await dbService.getSettings(adminId);
    res.json({
      notificationEmail: settings.notificationEmail || "",
      smtpHost: settings.smtpHost || "",
      smtpPort: settings.smtpPort || 587,
      smtpUser: settings.smtpUser || "",
      smtpPass: settings.smtpPass || "",
      emailReportsEnabled: settings.emailReportsEnabled ?? true,
      isSuperAdmin: adminId === "super-admin",
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/email-report/settings", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const { notificationEmail, smtpHost, smtpPort, smtpUser, smtpPass, emailReportsEnabled } = req.body;
    await dbService.updateSettings(adminId, {
      notificationEmail: notificationEmail || "",
      smtpHost: smtpHost || "",
      smtpPort: smtpPort || 587,
      smtpUser: smtpUser || "",
      smtpPass: smtpPass || "",
      emailReportsEnabled: emailReportsEnabled ?? true,
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/email-report/test", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const { sendTestEmail } = await import("../services/emailService.js");
    const result = await sendTestEmail(adminId);
    res.json(result);
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});

router.post("/email-report/send", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const { from, to } = req.body;
    if (!from || !to) return res.status(400).json({ error: "from and to are required" });

    const sessionsRes = await pool.query(
      `SELECT s.user_id, s.selected_product_id, s.state, s.last_message_at, s.metadata
       FROM "Session" s WHERE s.admin_id = $1 AND s.last_message_at >= $2 AND s.last_message_at <= $3
       AND (s.state = 'ORDER_CONFIRMED' OR s.state = 'DELIVERED')`,
      [adminId, new Date(from), new Date(to)]
    );

    const productsRes = await pool.query(`SELECT id, price, cost_price FROM "Product" WHERE admin_id = $1`, [adminId]);
    const productMap = new Map(productsRes.rows.map((p: any) => [p.id, p]));

    let revenue = 0, cost = 0;
    for (const s of sessionsRes.rows) {
      const p = s.selectedProductId ? productMap.get(s.selectedProductId) : null;
      revenue += p?.price || 0;
      cost += p?.costPrice || 0;
    }

    const settings = await dbService.getSettings(adminId);
    const storeName = settings.storeName || "Sales Agent";
    const notificationEmail = settings.notificationEmail || settings.email;
    const superSettings = await dbService.getSettings("default-admin");
    const smtpHost = superSettings.smtpHost;
    const smtpPort = superSettings.smtpPort || 587;
    const smtpUser = superSettings.smtpUser;
    const smtpPass = superSettings.smtpPass;

    if (!notificationEmail || !smtpHost || !smtpUser || !smtpPass) {
      return res.status(400).json({ error: "Email or SMTP not configured" });
    }

    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.default.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: `"${storeName}" <${smtpUser}>`,
      to: notificationEmail,
      subject: `Sales Report — ${from} to ${to}`,
      html: baseTemplate(reportEmailContent({ revenue, cost, profit: revenue - cost, orderCount: sessionsRes.rows.length, from, to }), storeName),
    });

    res.json({ success: true, orderCount: sessionsRes.rows.length, revenue, cost, profit: revenue - cost });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

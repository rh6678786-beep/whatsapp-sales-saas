import nodemailer from "nodemailer";
import { dbService } from "./dbService";
import { Order } from "../../src/types";

function extractPhone(userId: string): string {
  if (!userId) return "—";
  let cleaned = userId
    .replace(/^whatsapp:/, "")
    .replace(/^ig:/, "")
    .replace(/^fb:/, "")
    .replace(/^tg:/, "")
    .replace(/@.+$/, "")
    .replace(/[^\d+]/g, "");
  if (cleaned.startsWith("92") && !cleaned.startsWith("+92")) {
    cleaned = `+${cleaned}`;
  }
  if (cleaned.startsWith("+92")) {
    const num = cleaned.slice(3);
    if (num.startsWith("3")) return `0${num}`;
    return cleaned;
  }
  return cleaned;
}

function formatOrdersTable(orders: Order[], productNames: Map<string, string>): string {
  if (orders.length === 0) {
    return "<p style='color:#888; font-size:16px;'>No orders were confirmed today. 📭</p>";
  }

  let rows = "";
  for (const o of orders) {
    const productName = productNames.get(o.productId) || o.productId || "—";
    const name = o.customerName || "—";
    const phone = o.customerPhone || extractPhone(o.userId);
    const address = o.shippingAddress || "—";
    const amount = `Rs.${o.amount.toLocaleString()}`;
    rows += `<tr>
      <td style="padding:12px 16px;border-bottom:1px solid #eee;font-weight:600;">${name}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #eee;">${phone}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #eee;">${address}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #eee;">${productName}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #eee;text-align:right;font-weight:700;">${amount}</td>
    </tr>`;
  }

  const total = orders.reduce((sum, o) => sum + o.amount, 0);

  return `
    <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px;">
      <thead>
        <tr style="background:#f8f9fa;">
          <th style="padding:12px 16px;text-align:left;border-bottom:2px solid #ddd;">Customer Name</th>
          <th style="padding:12px 16px;text-align:left;border-bottom:2px solid #ddd;">Contact</th>
          <th style="padding:12px 16px;text-align:left;border-bottom:2px solid #ddd;">Address</th>
          <th style="padding:12px 16px;text-align:left;border-bottom:2px solid #ddd;">Product</th>
          <th style="padding:12px 16px;text-align:right;border-bottom:2px solid #ddd;">Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="background:#f0fdf4;font-weight:800;">
          <td colspan="4" style="padding:14px 16px;text-align:right;border-top:2px solid #22c55e;">Total:</td>
          <td style="padding:14px 16px;text-align:right;border-top:2px solid #22c55e;color:#16a34a;">Rs.${total.toLocaleString()}</td>
        </tr>
      </tfoot>
    </table>`;
}

function buildEmailHtml(orders: Order[], productNames: Map<string, string>, storeName: string): string {
  const orderCount = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + o.amount, 0);

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f5;padding:20px;margin:0;">
  <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#18181b,#27272a);padding:32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:24px;">${storeName}</h1>
      <p style="color:#a1a1aa;margin:8px 0 0;font-size:14px;">📋 Daily Order Summary</p>
    </div>
    <div style="padding:32px;">
      <div style="display:flex;gap:16px;margin-bottom:24px;">
        <div style="flex:1;background:#f0fdf4;border-radius:12px;padding:16px;text-align:center;border:1px solid #bbf7d0;">
          <div style="font-size:28px;font-weight:800;color:#16a34a;">${orderCount}</div>
          <div style="font-size:12px;color:#166534;font-weight:600;">Orders Today</div>
        </div>
        <div style="flex:1;background:#fef3c7;border-radius:12px;padding:16px;text-align:center;border:1px solid #fde68a;">
          <div style="font-size:28px;font-weight:800;color:#d97706;">Rs.${totalRevenue.toLocaleString()}</div>
          <div style="font-size:12px;color:#92400e;font-weight:600;">Total Revenue</div>
        </div>
      </div>
      ${formatOrdersTable(orders, productNames)}
      <p style="color:#a1a1aa;font-size:12px;margin-top:24px;text-align:center;border-top:1px solid #eee;padding-top:16px;">
        This is an automated daily report from your WhatsApp AI Sales Agent.<br>
        Generated on ${new Date().toLocaleDateString("en-PK", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
      </p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendDailyOrderReport(adminId: string): Promise<{ sent: boolean; orderCount: number; error?: string }> {
  try {
    const settings = await dbService.getSettings(adminId);
    const notificationEmail = settings.notificationEmail || settings.email;

    // SMTP settings always read from super admin (default-admin)
    const superSettings = await dbService.getSettings("default-admin");
    const smtpHost = superSettings.smtpHost;
    const smtpPort = superSettings.smtpPort || 587;
    const smtpUser = superSettings.smtpUser;
    const smtpPass = superSettings.smtpPass;

    if (!notificationEmail) {
      return { sent: false, orderCount: 0, error: "No notification email configured" };
    }

    if (!smtpHost || !smtpUser || !smtpPass) {
      return { sent: false, orderCount: 0, error: "SMTP not configured by super admin" };
    }

    const orders = await dbService.getTodayOrders(adminId);
    const products = await dbService.getAllProducts(adminId);
    const productNames = new Map(products.map(p => [p.id, p.name]));

    if (orders.length === 0) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });

      await transporter.sendMail({
        from: `"${settings.storeName || "Sales Agent"}" <${smtpUser}>`,
        to: notificationEmail,
        subject: `📋 ${settings.storeName || "Store"} — No Orders Today (${new Date().toLocaleDateString("en-PK")})`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f5;padding:20px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="font-size:48px;margin-bottom:16px;">📭</div>
    <h2 style="color:#18181b;margin:0;">No Orders Today</h2>
    <p style="color:#71717a;margin-top:8px;">${new Date().toLocaleDateString("en-PK", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
    <p style="color:#a1a1aa;font-size:14px;margin-top:16px;">Your AI sales agent didn't close any orders today. Check your WhatsApp connection and product catalog to ensure everything is active.</p>
  </div>
</body>
</html>`,
      });

      return { sent: true, orderCount: 0 };
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: `"${settings.storeName || "Sales Agent"}" <${smtpUser}>`,
      to: notificationEmail,
      subject: `📋 ${settings.storeName || "Store"} — ${orders.length} Order${orders.length > 1 ? "s" : ""} Today (${new Date().toLocaleDateString("en-PK")})`,
      html: buildEmailHtml(orders, productNames, settings.storeName || "Your Store"),
    });

    return { sent: true, orderCount: orders.length };
  } catch (error: any) {
    console.error(`[EMAIL REPORT][${adminId}] Error:`, error.message);
    return { sent: false, orderCount: 0, error: error.message };
  }
}

export async function sendTestEmail(adminId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const settings = await dbService.getSettings(adminId);
    const notificationEmail = settings.notificationEmail || settings.email;

    // SMTP settings always from super admin
    const superSettings = await dbService.getSettings("default-admin");
    const smtpHost = superSettings.smtpHost;
    const smtpPort = superSettings.smtpPort || 587;
    const smtpUser = superSettings.smtpUser;
    const smtpPass = superSettings.smtpPass;

    if (!notificationEmail) return { success: false, error: "No notification email configured" };
    if (!smtpHost || !smtpUser || !smtpPass) return { success: false, error: "SMTP not configured by super admin" };

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: `"${settings.storeName || "Sales Agent"}" <${smtpUser}>`,
      to: notificationEmail,
      subject: `✅ Test Email — ${settings.storeName || "Sales Agent"}`,
      text: `This is a test email from your WhatsApp AI Sales Agent.\n\nIf you're reading this, your email configuration is working correctly.\n\nThe daily order summary will be sent every night at 10:00 PM.`,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function sendDailyReportToAllAdmins(): Promise<{ sent: number; failed: number; errors: string[] }> {
  const adminIds = await dbService.getAllAdminIds();
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const adminId of adminIds) {
    const result = await sendDailyOrderReport(adminId);
    if (result.sent) {
      sent++;
      console.log(`[EMAIL CRON][${adminId}] Report sent — ${result.orderCount} orders`);
    } else {
      failed++;
      if (result.error) errors.push(`[${adminId}] ${result.error}`);
      console.log(`[EMAIL CRON][${adminId}] Skipped — ${result.error || "unknown"}`);
    }
  }

  return { sent, failed, errors };
}

import { Router } from "express";
import fs from "fs";
import path from "path";
import { dbService } from "../services/dbService.js";
import { getAdminId } from "../middleware/auth.js";

const router = Router();

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 0 }).format(n);
}

function groupByDate(rows: { date: string; amount: number }[]): { date: string; total: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const d = r.date;
    map.set(d, (map.get(d) || 0) + r.amount);
  }
  return Array.from(map.entries())
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

router.get("/stats/report", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: "from and to query parameters are required" });
    }
    const fromDate = new Date(from as string).getTime();
    const toDate = new Date(to as string).getTime();
    if (isNaN(fromDate) || isNaN(toDate)) {
      return res.status(400).json({ error: "Invalid date format. Use ISO date strings." });
    }

    const sessions = await dbService.getRecentSessions(adminId, 1000);
    const products = await dbService.getAllProducts(adminId);

    const filtered = sessions.filter(s => {
      const t = new Date(s.lastMessageAt).getTime();
      return t >= fromDate && t <= toDate && (s.state === 'ORDER_CONFIRMED' || s.state === 'DELIVERED');
    });

    const productMap = products.reduce((acc: any, p) => ({ ...acc, [p.id]: p }), {});
    let revenue = 0, cost = 0;

    filtered.forEach(s => {
      const p = s.selectedProductId ? productMap[s.selectedProductId] : null;
      revenue += p?.price || 0;
      cost += p?.costPrice || 0;
    });

    res.json({
      revenue,
      cost,
      profit: revenue - cost,
      orderCount: filtered.length,
      from: from as string,
      to: to as string
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/stats/report/pdf", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: "from and to query parameters are required" });
    }
    const fromDate = new Date(from as string).getTime();
    const toDate = new Date(to as string).getTime();
    if (isNaN(fromDate) || isNaN(toDate)) {
      return res.status(400).json({ error: "Invalid date format. Use ISO date strings." });
    }

    const [settings, sessions, products] = await Promise.all([
      dbService.getSettings(adminId),
      dbService.getRecentSessions(adminId, 1000),
      dbService.getAllProducts(adminId),
    ]);

    const storeName = settings.storeName || "Sales Report";

    const filtered = sessions.filter(s => {
      const t = new Date(s.lastMessageAt).getTime();
      return t >= fromDate && t <= toDate && (s.state === 'ORDER_CONFIRMED' || s.state === 'DELIVERED');
    });

    const productMap = products.reduce((acc: any, p) => ({ ...acc, [p.id]: p }), {});
    let revenue = 0, cost = 0;

    const rows = filtered.map(s => {
      const p = s.selectedProductId ? productMap[s.selectedProductId] : null;
      const customerName = (s.metadata as any)?.customerName || s.userId;
      const productName = p?.name || "N/A";
      const amount = p?.price || 0;
      const costPrice = p?.costPrice || 0;
      const profit = amount - costPrice;
      const status = s.state;
      const date = new Date(s.lastMessageAt).toLocaleDateString();
      revenue += amount;
      cost += costPrice;
      return { id: s.id, customerName, productName, amount, costPrice, profit, status, date };
    });

    const { default: PDFDocument } = await import('pdfkit');
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });

    const filename = `report-${from as string}-${to as string}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    doc.pipe(res);

    // Branded header
    const logoPath = settings.businessLogo
      ? path.join(process.cwd(), "uploads", path.basename(settings.businessLogo))
      : null;
    if (logoPath && fs.existsSync(logoPath)) {
      try { doc.image(logoPath, 40, 30, { width: 60 }); } catch {}
    }

    const headerY = logoPath && fs.existsSync(logoPath) ? 35 : 40;
    doc.fontSize(22).font('Helvetica-Bold').fillColor('#18181b')
      .text(storeName, logoPath && fs.existsSync(logoPath) ? 115 : 40, headerY, { align: 'left' });

    const periodLabel = `Period: ${from as string} – ${to as string}`;
    doc.fontSize(10).font('Helvetica').fillColor('#71717a')
      .text(periodLabel, { align: 'left' });

    // Summary cards
    const summaryY = doc.y + 20;
    const cardW = (doc.page.width - 40 - 40 - 24) / 3;
    const cards = [
      { label: "Total Revenue", value: formatCurrency(revenue), color: "#16a34a" },
      { label: "Total Cost", value: formatCurrency(cost), color: "#dc2626" },
      { label: "Profit", value: formatCurrency(revenue - cost), color: "#2563eb" },
    ];
    cards.forEach((card, i) => {
      const cx = 40 + i * (cardW + 12);
      doc.roundedRect(cx, summaryY, cardW, 52, 8).fillAndStroke('#f8fafc', '#e2e8f0');
      doc.fillColor('#71717a').fontSize(8).font('Helvetica')
        .text(card.label.toUpperCase(), cx + 12, summaryY + 8, { width: cardW - 24, align: 'left' });
      doc.fillColor(card.color).fontSize(16).font('Helvetica-Bold')
        .text(card.value, cx + 12, summaryY + 24, { width: cardW - 24, align: 'left' });
    });

    // Bar chart
    const chartY = summaryY + 72;
    const chartH = 100;
    const dailyData = groupByDate(rows);
    if (dailyData.length > 1) {
      doc.fillColor('#18181b').fontSize(12).font('Helvetica-Bold')
        .text("Daily Revenue Trend", 40, chartY);
      doc.fillColor('#71717a').fontSize(8).font('Helvetica')
        .text("Revenue per day in PKR", 40, doc.y + 2);

      const chartX = 40;
      const chartW = doc.page.width - 80;
      const chartTop = doc.y + 20;
      const maxVal = Math.max(...dailyData.map(d => d.total), 1);
      const barCount = dailyData.length;
      const barGap = 4;
      const barW = Math.min(20, (chartW - barGap * (barCount + 1)) / barCount);

      doc.roundedRect(chartX, chartTop, chartW, chartH, 4).fillColor('#f8fafc').fill();
      doc.rect(chartX, chartTop, chartW, chartH).fillAndStroke('#f8fafc', '#e2e8f0');

      dailyData.forEach((d, i) => {
        const barH = Math.max(3, (d.total / maxVal) * (chartH - 20));
        const bx = chartX + barGap + i * (barW + barGap);
        const by = chartTop + chartH - 10 - barH;

        doc.roundedRect(bx, by, barW, barH, 2).fillColor('#2563eb').fill();

        doc.fillColor('#71717a').fontSize(5).font('Helvetica')
          .text(d.date.slice(0, 5), bx, chartTop + chartH - 8, { width: barW, align: 'center' });

        doc.fillColor('#18181b').fontSize(5).font('Helvetica-Bold')
          .text(formatCurrency(d.total), bx, by - 7, { width: barW, align: 'center' });
      });

      doc.moveTo(0, chartTop + chartH + 20);
    }

    // Table
    const tableTop = Math.max(doc.y, dailyData.length > 1 ?  chartY + chartH + 40 : doc.y + 10);
    doc.y = tableTop;

    const colWidths = [70, 100, 120, 80, 70, 80, 80, 90];
    const headers = ['OrderID', 'Customer', 'Product', 'Amount', 'Cost', 'Profit', 'Status', 'Date'];
    const startX = 40;

    doc.fillColor('#18181b').fontSize(11).font('Helvetica-Bold')
      .text("Detailed Orders", startX, tableTop);
    doc.moveDown(0.5);

    const headerY2 = doc.y;
    const evenColor = '#f8fafc';
    const oddColor = '#ffffff';

    doc.fontSize(8).font('Helvetica-Bold');
    let x = startX;

    doc.roundedRect(startX - 2, headerY2 - 2, colWidths.reduce((a, b) => a + b, 0) + 4, 16, 4)
      .fillAndStroke('#18181b', '#18181b');

    doc.fillColor('#ffffff');
    x = startX;
    headers.forEach((h, i) => {
      doc.text(h, x, headerY2, { width: colWidths[i], align: 'left' });
      x += colWidths[i];
    });

    let y = headerY2 + 18;
    doc.fontSize(7.5).font('Helvetica');
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      doc.fillColor(i % 2 === 0 ? evenColor : oddColor);
      doc.rect(startX - 2, y - 2, colWidths.reduce((a, b) => a + b, 0) + 4, 16).fill();

      doc.fillColor('#18181b');
      x = startX;
      const vals = [row.id, row.customerName, row.productName, formatCurrency(row.amount), formatCurrency(row.costPrice), formatCurrency(row.profit), row.status, row.date];
      vals.forEach((v, i) => {
        doc.text(String(v), x, y, { width: colWidths[i], align: 'left' });
        x += colWidths[i];
      });
      y += 16;
      if (y > 530) { doc.addPage(); y = 40; }
    }

    // Summary footer
    doc.fillColor('#18181b');
    doc.rect(startX - 2, y - 2, colWidths.reduce((a, b) => a + b, 0) + 4, 18).fill();
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#ffffff');
    x = startX;
    const summaryLabels = ['', '', 'Total:', formatCurrency(revenue), formatCurrency(cost), formatCurrency(revenue - cost), '', ''];
    summaryLabels.forEach((v, i) => {
      doc.text(String(v), x, y + 2, { width: colWidths[i], align: 'left' });
      x += colWidths[i];
    });

    // Footer
    doc.fontSize(7).font('Helvetica').fillColor('#a1a1aa');
    doc.text(`Generated on ${new Date().toLocaleString()} | ${storeName}`, startX, doc.page.height - 30, { align: 'center', width: doc.page.width - 80 });

    doc.end();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/stats/report/csv", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: "from and to query parameters are required" });
    }
    const fromDate = new Date(from as string).getTime();
    const toDate = new Date(to as string).getTime();
    if (isNaN(fromDate) || isNaN(toDate)) {
      return res.status(400).json({ error: "Invalid date format. Use ISO date strings." });
    }

    const sessions = await dbService.getRecentSessions(adminId, 1000);
    const products = await dbService.getAllProducts(adminId);

    const filtered = sessions.filter(s => {
      const t = new Date(s.lastMessageAt).getTime();
      return t >= fromDate && t <= toDate && (s.state === 'ORDER_CONFIRMED' || s.state === 'DELIVERED');
    });

    const productMap = products.reduce((acc: any, p) => ({ ...acc, [p.id]: p }), {});

    const header = "OrderID,CustomerName,Product,Amount,Cost,Profit,Status,Date";
    const rows = filtered.map(s => {
      const p = s.selectedProductId ? productMap[s.selectedProductId] : null;
      const customerName = (s.metadata as any)?.customerName || s.userId;
      const productName = p?.name || "N/A";
      const amount = p?.price || 0;
      const cost = p?.costPrice || 0;
      const profit = amount - cost;
      const status = s.state;
      const date = s.lastMessageAt;
      return `"${s.id}","${customerName}","${productName}",${amount},${cost},${profit},"${status}","${date}"`;
    });

    const csv = [header, ...rows].join("\r\n");
    const filename = `report-${from as string}-${to as string}.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

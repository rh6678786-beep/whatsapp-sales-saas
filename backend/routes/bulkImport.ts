import { Router } from "express";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth.js";
import { dbService } from "../services/dbService.js";
import multer from "multer";
import Papa from "papaparse";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("route:bulk-import");
const router = Router();
router.use(requireAuth);

const MAX_IMPORT_ROWS = 5000;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === "text/csv" ||
      file.originalname.endsWith(".csv") ||
      file.mimetype === "application/json"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV and JSON files are supported"));
    }
  },
});

function parseCSV(content: string): Record<string, string>[] {
  const result = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  if (result.errors.length > 0) {
    log.warn({ errors: result.errors.slice(0, 5) }, "CSV parse had errors");
  }

  return result.data as Record<string, string>[];
}

interface ImportProduct {
  name: string;
  price: number;
  costPrice: number;
  stock: number;
  features?: string[];
  images?: string[];
  videos?: string[];
}

function parseProducts(data: Record<string, string>[]): { products: ImportProduct[]; errors: { row: number; error: string }[] } {
  const products: ImportProduct[] = [];
  const errors: { row: number; error: string }[] = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2; // +2 for header row and 0-index

    // Sanitize: prevent CSV injection (formulas like =cmd|...)
    const name = String(row.name || row.Name || row.NAME || "").replace(/^[=+\-@]/, "");
    const priceStr = String(row.price || row.Price || row.PRICE || "").replace(/[^0-9.]/g, "");
    const costStr = String(
      row.costprice || row.costPrice || row.CostPrice || row.COSTPRICE || row.cost_price || ""
    ).replace(/[^0-9.]/g, "");
    const stockStr = String(row.stock || row.Stock || row.STOCK || "").replace(/[^0-9]/g, "");

    if (!name) {
      errors.push({ row: rowNum, error: "Missing product name" });
      continue;
    }

    const price = parseFloat(priceStr);
    if (isNaN(price) || price <= 0) {
      errors.push({ row: rowNum, error: `Invalid price: "${priceStr}"` });
      continue;
    }

    const costPrice = parseFloat(costStr) || 0;
    const stock = parseInt(stockStr) || 10;

    products.push({
      name,
      price,
      costPrice,
      stock: Math.max(0, stock),
    });
  }

  return { products, errors };
}

// JSON-based import
router.post("/bulk-import/products", async (req: AuthenticatedRequest, res) => {
  try {
    const adminId = req.adminId!;
    const { data, format } = req.body;

    if (!data) {
      return res.status(400).json({ error: "data field is required (CSV or JSON array)" });
    }

    let parsed: Record<string, string>[];

    if (format === "csv" || (typeof data === "string" && (data.includes(",") || data.includes("\t")))) {
      parsed = parseCSV(typeof data === "string" ? data : String(data));
    } else if (Array.isArray(data)) {
      parsed = data as any;
    } else if (typeof data === "object") {
      parsed = [data as any];
    } else {
      return res.status(400).json({ error: "Invalid data format. Provide CSV string or JSON array." });
    }

    if (parsed.length === 0) {
      return res.status(400).json({ error: "No rows found in import data" });
    }

    if (parsed.length > MAX_IMPORT_ROWS) {
      return res.status(400).json({
        error: `Maximum ${MAX_IMPORT_ROWS} rows allowed. Found ${parsed.length}.`,
      });
    }

    const { products, errors } = parseProducts(parsed);

    let created = 0;
    const dbErrors: { row: number; error: string }[] = [...errors];

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      try {
        await dbService.addProduct(adminId, {
          name: p.name,
          price: p.price,
          costPrice: p.costPrice || 0,
          features: p.features || [],
          images: p.images || [],
          videos: p.videos || [],
          stock: p.stock ?? 10,
        });
        created++;
      } catch (err: any) {
        dbErrors.push({ row: i + 2, error: err.message });
      }
    }

    log.info({ adminId, created, errors: dbErrors.length, total: parsed.length }, "Bulk import completed");
    res.json({ created, errors: dbErrors, total: parsed.length });
  } catch (error: any) {
    log.error({ err: error, adminId: req.adminId }, "Bulk import failed");
    res.status(500).json({ error: "Import failed. Please check your data format." });
  }
});

// File upload import
router.post("/bulk-import/products/upload", upload.single("file"), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const content = req.file.buffer.toString("utf-8");
    const parsed = parseCSV(content);

    if (parsed.length === 0) {
      return res.status(400).json({ error: "No rows found in CSV file" });
    }

    if (parsed.length > MAX_IMPORT_ROWS) {
      return res.status(400).json({
        error: `Maximum ${MAX_IMPORT_ROWS} rows allowed. Found ${parsed.length}.`,
      });
    }

    const adminId = req.adminId!;
    const { products, errors } = parseProducts(parsed);

    let created = 0;
    const dbErrors: { row: number; error: string }[] = [...errors];

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      try {
        await dbService.addProduct(adminId, {
          name: p.name,
          price: p.price,
          costPrice: p.costPrice || 0,
          features: [],
          images: [],
          videos: [],
          stock: p.stock ?? 10,
        });
        created++;
      } catch (err: any) {
        dbErrors.push({ row: i + 2, error: err.message });
      }
    }

    log.info({ adminId, created, errors: dbErrors.length, total: parsed.length }, "File bulk import completed");
    res.json({ created, errors: dbErrors, total: parsed.length, filename: req.file.originalname });
  } catch (error: any) {
    log.error({ err: error, adminId: req.adminId }, "File import failed");
    res.status(500).json({ error: "Import failed. Check file format." });
  }
});

export default router;

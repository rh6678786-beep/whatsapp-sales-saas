import { Router } from "express";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth.js";
import { dbService } from "../services/dbService.js";
import multer from "multer";

const router = Router();
router.use(requireAuth);

router.post("/bulk-import/products", async (req: AuthenticatedRequest, res) => {
  try {
    const adminId = req.adminId!;
    const { data, format } = req.body;

    if (!data) {
      return res.status(400).json({ error: "data field is required (CSV or JSON array)" });
    }

    let products: { name: string; price: number; costPrice: number; stock?: number; features?: string[]; images?: string[]; videos?: string[] }[];

    if (format === "csv" || (typeof data === "string" && data.includes(","))) {
      const lines = (typeof data === "string" ? data : String(data)).split("\n").filter(Boolean);
      const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
      const nameIdx = headers.indexOf("name");
      const priceIdx = headers.indexOf("price");
      const costIdx = headers.indexOf("costprice") >= 0 ? headers.indexOf("costprice") : headers.indexOf("cost_price");
      const stockIdx = headers.indexOf("stock");
      if (nameIdx === -1 || priceIdx === -1) {
        return res.status(400).json({ error: "CSV must have at least 'name' and 'price' columns" });
      }
      products = lines.slice(1).map(line => {
        const cols = line.split(",").map(c => c.trim());
        return {
          name: cols[nameIdx],
          price: parseFloat(cols[priceIdx]) || 0,
          costPrice: costIdx >= 0 ? parseFloat(cols[costIdx]) || 0 : 0,
          stock: stockIdx >= 0 ? parseInt(cols[stockIdx]) || 10 : 10,
        };
      });
    } else {
      products = Array.isArray(data) ? data : [data];
    }

    let created = 0;
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (!p.name || p.price <= 0) {
        errors.push({ row: i + 1, error: "Invalid name or price" });
        continue;
      }
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
        errors.push({ row: i + 1, error: err.message });
      }
    }

    res.json({ created, errors, total: products.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_req, file, cb) => {
  if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv") || file.mimetype === "application/json") {
    cb(null, true);
  } else {
    cb(new Error("Only CSV and JSON files are supported"));
  }
}});

router.post("/bulk-import/products/upload", upload.single("file"), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const content = req.file.buffer.toString("utf-8");
    req.body = { data: content, format: req.file.mimetype === "application/json" ? "json" : "csv" };
    const adminId = req.adminId!;
    let products: any[];
    const lines = content.split("\n").filter(Boolean);
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    const nameIdx = headers.indexOf("name");
    const priceIdx = headers.indexOf("price");
    const costIdx = headers.indexOf("costprice") >= 0 ? headers.indexOf("costprice") : headers.indexOf("cost_price");
    const stockIdx = headers.indexOf("stock");
    if (nameIdx === -1 || priceIdx === -1) {
      return res.status(400).json({ error: "CSV must have at least 'name' and 'price' columns" });
    }
    products = lines.slice(1).map(line => {
      const cols = line.split(",").map(c => c.trim());
      return {
        name: cols[nameIdx],
        price: parseFloat(cols[priceIdx]) || 0,
        costPrice: costIdx >= 0 ? parseFloat(cols[costIdx]) || 0 : 0,
        stock: stockIdx >= 0 ? parseInt(cols[stockIdx]) || 10 : 10,
      };
    });

    let created = 0;
    const errors: { row: number; error: string }[] = [];
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (!p.name || p.price <= 0) {
        errors.push({ row: i + 1, error: "Invalid name or price" });
        continue;
      }
      try {
        await dbService.addProduct(adminId, {
          name: p.name, price: p.price, costPrice: p.costPrice || 0,
          features: [], images: [], videos: [], stock: p.stock ?? 10,
        });
        created++;
      } catch (err: any) {
        errors.push({ row: i + 1, error: err.message });
      }
    }
    res.json({ created, errors, total: products.length, filename: req.file.originalname });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

import { Router } from "express";

const router = Router();

router.get("/health", async (_req, res) => {
  try {
    const dbUrl = process.env.DATABASE_URL || "";
    const isSupabase = dbUrl.includes("supabase");
    const isLocal = dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1");
    let dbName = "Not connected";
    if (dbUrl) {
      if (isSupabase) dbName = "PostgreSQL (Supabase)";
      else if (isLocal) dbName = "PostgreSQL (Local)";
      else dbName = "PostgreSQL";
    }
    res.json({ status: "ok", database: dbName, connected: !!dbUrl });
  } catch {
    res.json({ status: "error", database: "Not connected", connected: false });
  }
});

export default router;

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

const connectionString = (process.env.DATABASE_URL || "").replace(/[?&]sslmode=[^&]*/g, "").replace(/[?&]$/, "");
const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 5 });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function isBase64(str: string): boolean {
  return str.startsWith("data:") || str.startsWith("data:image") || str.startsWith("data:video");
}

function base64ToFile(dataUri: string): { filename: string; buffer: Buffer } | null {
  const match = dataUri.match(/^data:(image\/\w+|video\/\w+);base64,(.+)$/);
  if (!match) return null;
  const mime = match[1];
  const ext = mime.split("/")[1].replace("jpeg", "jpg");
  const filename = `${randomUUID()}.${ext}`;
  const buffer = Buffer.from(match[2], "base64");
  return { filename, buffer };
}

async function migrate() {
  console.log("Starting base64 image migration...");

  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  const admins = await prisma.admin.findMany({ select: { adminId: true } });
  let totalMigrated = 0;

  for (const admin of admins) {
    const products = await prisma.product.findMany({ where: { adminId: admin.adminId } });

    for (const product of products) {
      let changed = false;
      const newImages: string[] = [];
      const newVideos: string[] = [];

      for (const img of product.images) {
        if (isBase64(img)) {
          const result = base64ToFile(img);
          if (result) {
            fs.writeFileSync(path.join(UPLOADS_DIR, result.filename), result.buffer);
            newImages.push(`/uploads/${result.filename}`);
            changed = true;
            totalMigrated++;
          } else {
            newImages.push(img);
          }
        } else {
          newImages.push(img);
        }
      }

      for (const vid of product.videos) {
        if (isBase64(vid)) {
          const result = base64ToFile(vid);
          if (result) {
            fs.writeFileSync(path.join(UPLOADS_DIR, result.filename), result.buffer);
            newVideos.push(`/uploads/${result.filename}`);
            changed = true;
            totalMigrated++;
          } else {
            newVideos.push(vid);
          }
        } else {
          newVideos.push(vid);
        }
      }

      if (changed) {
        await prisma.product.update({
          where: { id: product.id },
          data: { images: newImages, videos: newVideos },
        });
        console.log(`  Migrated product ${product.id} (${product.name})`);
      }
    }
  }

  console.log(`\nMigration complete! ${totalMigrated} files migrated to ${UPLOADS_DIR}`);
  await pool.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

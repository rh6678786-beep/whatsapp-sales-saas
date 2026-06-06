import { Router } from "express";
import multer from "multer";
import { getAdminId } from "../middleware/auth.js";
import { logAction } from "../services/auditLogService.js";
import { uploadFile } from "../services/storageService.js";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("route:upload");
const router = Router();

const ALLOWED_MIMES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "video/mp4", "video/webm",
  "application/pdf", "text/plain", "text/csv",
];

const MAX_SIZE = 50 * 1024 * 1024;

const FILE_SIGNATURES: Record<string, { offset: number; bytes: number[] }[]> = {
  "image/jpeg": [{ offset: 0, bytes: [0xFF, 0xD8, 0xFF] }],
  "image/png": [{ offset: 0, bytes: [0x89, 0x50, 0x4E, 0x47] }],
  "image/gif": [{ offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] }],
  "image/webp": [{ offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }, { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] }],
  "video/mp4": [{ offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }],
  "application/pdf": [{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }],
};

/**
 * Validate file content by checking magic bytes.
 * Works with both buffer (memory storage) and file path (disk storage).
 */
function validateFileBuffer(buffer: Buffer, mimetype: string): boolean {
  const sigs = FILE_SIGNATURES[mimetype];
  if (!sigs || sigs.length === 0) return true;
  for (const sig of sigs) {
    if (buffer.length < sig.offset + sig.bytes.length) return false;
    if (!sig.bytes.every((b, i) => buffer[sig.offset + i] === b)) return false;
  }
  return true;
}

// Use memory storage so we get the buffer for validation and cloud upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed. Allowed: images, videos, PDF, text, CSV`));
    }
  },
});

router.post("/upload", upload.array("files", 10), async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const validFiles: { original: string; url: string }[] = [];
    const rejectedFiles: string[] = [];

    for (const f of files) {
      // Validate content via magic bytes (using buffer instead of file path)
      if (!validateFileBuffer(f.buffer, f.mimetype)) {
        rejectedFiles.push(f.originalname);
        continue;
      }

      // Upload to cloud storage (or local fallback)
      const url = await uploadFile(f.buffer, f.originalname, f.mimetype);
      validFiles.push({ original: f.originalname, url });
    }

    if (rejectedFiles.length > 0) {
      logAction(adminId, "upload", "file", undefined,
        { valid: validFiles.map(v => v.original), rejected: rejectedFiles },
        req.ip
      ).catch((auditErr) => log.warn({ err: auditErr, adminId }, "Audit log write failed"));
      return res.status(400).json({
        error: `Content validation failed for: ${rejectedFiles.join(", ")}`,
        validFiles: validFiles.map(v => v.url),
        rejectedFiles,
      });
    }

    logAction(adminId, "upload", "file", undefined,
      { files: validFiles.map(v => v.original), urls: validFiles.map(v => v.url) },
      req.ip
    ).catch((auditErr) => log.warn({ err: auditErr, adminId }, "Audit log write failed"));
    res.json({ urls: validFiles.map(v => v.url) });
  } catch (error: any) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: `File too large. Maximum size is ${MAX_SIZE / 1024 / 1024}MB` });
    }
    if (error.message?.includes("File type")) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;

/**
 * Cloud Storage Service
 * 
 * Uploads product images and videos to Supabase Storage (cloud) instead of
 * storing them on the local filesystem. Falls back to local storage if
 * Supabase is not configured.
 * 
 * Files are stored in a "products" bucket with UUID-based filenames and
 * served via Supabase's built-in CDN for fast loading.
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("storage:service");

// ---- Configuration ----

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const STORAGE_BUCKET = process.env.STORAGE_BUCKET || "products";

// Local fallback directory (used when Supabase is not configured)
const LOCAL_UPLOADS_DIR = path.join(process.cwd(), "uploads");

/** Whether Supabase Storage is fully configured */
export const isCloudStorageConfigured = (): boolean => {
  return !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
};

// ---- Supabase Storage Client (lazy initialized) ----

let _supabase: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (_supabase) return _supabase;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  _supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  return _supabase;
}

/**
 * Ensures the storage bucket exists. Creates it if missing.
 */
async function ensureBucket(): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const { data: existingBucket } = await supabase.storage.getBucket(STORAGE_BUCKET);
    if (!existingBucket) {
      const { error: createError } = await supabase.storage.createBucket(STORAGE_BUCKET, {
        public: true,
        fileSizeLimit: 50 * 1024 * 1024, // 50 MB
      });
      if (createError) {
        log.warn({ err: createError.message }, "Failed to create storage bucket");
        return false;
      }
      log.info({ bucket: STORAGE_BUCKET }, "Created storage bucket");
    }
    return true;
  } catch (err: any) {
    log.warn({ err: err.message }, "Failed to ensure storage bucket");
    return false;
  }
}

// ---- Local Fallback ----

function ensureLocalDir() {
  if (!fs.existsSync(LOCAL_UPLOADS_DIR)) {
    fs.mkdirSync(LOCAL_UPLOADS_DIR, { recursive: true });
  }
}

// ---- Public API ----

/**
 * Upload a file to cloud storage (or local fallback).
 * 
 * @param buffer - The file contents as a Buffer
 * @param originalname - The original filename (used for extension detection)
 * @param mimetype - The MIME type of the file
 * @returns The public URL of the uploaded file
 */
export async function uploadFile(
  buffer: Buffer,
  originalname: string,
  mimetype: string
): Promise<string> {
  const ext = path.extname(originalname) || ".jpg";
  const filename = `${randomUUID()}${ext}`;

  // Try Supabase Storage first
  if (isCloudStorageConfigured()) {
    const supabase = getSupabaseClient()!;
    const bucketReady = await ensureBucket();
    
    if (bucketReady) {
      try {
        const { error } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(filename, buffer, {
            contentType: mimetype,
            upsert: false,
          });

        if (!error) {
          // Get public URL
          const { data: publicUrlData } = supabase.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(filename);

          if (publicUrlData?.publicUrl) {
            log.info({ filename, bucket: STORAGE_BUCKET }, "File uploaded to Supabase Storage");
            return publicUrlData.publicUrl;
          }
        }

        log.warn({ err: error?.message, filename }, "Supabase upload failed, falling back to local");
      } catch (err: any) {
        log.warn({ err: err.message }, "Supabase upload error, falling back to local");
      }
    }
  }

  // Fallback: save locally
  ensureLocalDir();
  const filePath = path.join(LOCAL_UPLOADS_DIR, filename);
  fs.writeFileSync(filePath, buffer);
  log.info({ filename }, "File saved locally (cloud not configured or failed)");
  return `/uploads/${filename}`;
}

/**
 * Delete a file from cloud storage (or local fallback).
 * 
 * @param url - The public URL of the file to delete
 */
export async function deleteFile(url: string): Promise<void> {
  // Extract filename from URL
  const filename = extractFilename(url);
  if (!filename) return;

  // Try Supabase Storage
  if (isCloudStorageConfigured()) {
    const supabase = getSupabaseClient()!;
    try {
      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove([filename]);

      if (!error) {
        log.info({ filename }, "File deleted from Supabase Storage");
        return;
      }
    } catch (err: any) {
      log.warn({ err: err.message }, "Supabase delete failed");
    }
  }

  // Fallback: delete locally
  const localPath = path.join(LOCAL_UPLOADS_DIR, filename);
  if (fs.existsSync(localPath)) {
    fs.unlinkSync(localPath);
    log.info({ filename }, "File deleted locally");
  }
}

/**
 * Extract filename from a URL (works for both Supabase and local URLs).
 */
function extractFilename(url: string): string | null {
  // Handle Supabase Storage URLs: .../storage/v1/object/public/products/filename
  const supabaseMatch = url.match(/\/storage\/v1\/object\/public\/[^/]+\/([^?]+)/);
  if (supabaseMatch) return supabaseMatch[1];

  // Handle local URLs: /uploads/filename
  const localMatch = url.match(/\/uploads\/([^?]+)/);
  if (localMatch) return localMatch[1];

  return null;
}

export default {
  uploadFile,
  deleteFile,
  isCloudStorageConfigured,
};

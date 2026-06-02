import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createChildLogger } from '../lib/logger.js';

const log = createChildLogger('filevalidation');

/**
 * File Upload Validation Middleware
 * 
 * Validates:
 * - File type (MIME type)
 * - File size
 * - File name (no directory traversal)
 * - Magic bytes (prevent disguised executables)
 */

interface FileValidationConfig {
  maxSize?: number;
  allowedMimes?: string[];
  allowedExtensions?: string[];
  scanForMalware?: boolean;
}

const DEFAULT_CONFIG: FileValidationConfig = {
  maxSize: 10 * 1024 * 1024, // 10 MB
  allowedMimes: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/quicktime',
    'application/pdf'
  ],
  allowedExtensions: [
    'jpg', 'jpeg', 'png', 'webp', 'gif',
    'mp4', 'mov', 'pdf'
  ],
  scanForMalware: false // Can be enabled with ClamAV
};

/**
 * Magic bytes signatures for file types
 * Used to verify file is what it claims to be
 */
const MAGIC_BYTES: { [key: string]: Buffer } = {
  'image/jpeg': Buffer.from([0xFF, 0xD8, 0xFF]),
  'image/png': Buffer.from([0x89, 0x50, 0x4E, 0x47]),
  'image/gif': Buffer.from([0x47, 0x49, 0x46]),
  'image/webp': Buffer.from([0x52, 0x49, 0x46, 0x46]),
  'video/mp4': Buffer.from([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]),
};

/**
 * Dangerous file extensions
 */
const DANGEROUS_EXTENSIONS = [
  'exe', 'bat', 'cmd', 'com', 'scr', 'vbs', 'js',
  'jar', 'zip', 'rar', '7z', 'tar', 'gz',
  'sh', 'bash', 'py', 'pl', 'rb', 'php',
  'asp', 'aspx', 'jsp', 'cfm', 'cgi'
];

/**
 * Validate file extension
 */
export function validateExtension(filename: string, allowed: string[]): boolean {
  const ext = path.extname(filename).toLowerCase().replace(/^\./, '');
  
  // Check if extension is dangerous
  if (DANGEROUS_EXTENSIONS.includes(ext)) {
    return false;
  }
  
  // Check if extension is in allowed list
  return allowed.includes(ext);
}

/**
 * Validate file size
 */
export function validateFileSize(size: number, maxSize: number): boolean {
  return size > 0 && size <= maxSize;
}

/**
 * Validate MIME type by checking magic bytes
 */
export function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const magicBytes = MAGIC_BYTES[mimeType];
  
  // If we don't have magic bytes signature, accept it
  if (!magicBytes) {
    return true;
  }
  
  // Check if file starts with expected magic bytes
  return buffer.slice(0, magicBytes.length).equals(magicBytes);
}

/**
 * Sanitize filename (prevent directory traversal)
 */
export function sanitizeFilename(filename: string): string {
  // Remove path separators
  let safe = filename.replace(/\.\./g, '').replace(/[\/\\]/g, '');
  
  // Remove special characters but keep extension
  const ext = path.extname(filename);
  const name = path.basename(filename, ext)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 200);
  
  return `${name}${ext}`.toLowerCase();
}

/**
 * Generate safe filename with UUID
 */
export function generateSafeFilename(originalFilename: string): string {
  const ext = path.extname(originalFilename).toLowerCase();
  const uuid = crypto.randomUUID();
  return `${uuid}${ext}`;
}

/**
 * Validate uploaded file
 */
export function validateUploadedFile(
  file: Express.Multer.File,
  config: FileValidationConfig = DEFAULT_CONFIG
): { valid: boolean; error?: string } {
  // Validate file exists
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  // Validate filename
  if (!file.filename || file.filename.length === 0) {
    return { valid: false, error: 'Invalid filename' };
  }

  // Check for directory traversal
  if (file.filename.includes('..') || file.filename.includes('/') || file.filename.includes('\\')) {
    return { valid: false, error: 'Invalid filename (directory traversal detected)' };
  }

  // Validate extension
  if (config.allowedExtensions && !validateExtension(file.filename, config.allowedExtensions)) {
    return { valid: false, error: `File type not allowed. Allowed: ${config.allowedExtensions.join(', ')}` };
  }

  // Validate file size
  if (config.maxSize && !validateFileSize(file.size, config.maxSize)) {
    return { valid: false, error: `File too large. Maximum: ${config.maxSize / 1024 / 1024}MB` };
  }

  // Validate MIME type
  if (config.allowedMimes && !config.allowedMimes.includes(file.mimetype)) {
    return { valid: false, error: `MIME type not allowed. Allowed: ${config.allowedMimes.join(', ')}` };
  }

  // Validate magic bytes if buffer available
  if (file.buffer && !validateMagicBytes(file.buffer, file.mimetype)) {
    return { valid: false, error: 'File content does not match declared type' };
  }

  return { valid: true };
}

/**
 * File upload validation middleware
 * 
 * Usage:
 * router.post('/upload', fileValidationMiddleware, handler);
 */
export function fileValidationMiddleware(config?: FileValidationConfig) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  return (req: Request, res: Response, next: NextFunction) => {
    // Get file from request (multer populates req.file or req.files)
    const file = (req as any).file;
    
    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Validate file
    const validation = validateUploadedFile(file, finalConfig);
    
    if (!validation.valid) {
      log.warn({ filename: file.filename, error: validation.error }, 'File validation failed');
      return res.status(400).json({ error: validation.error });
    }

    // Generate safe filename
    const safeFilename = generateSafeFilename(file.originalname);
    (req as any).file.filename = safeFilename;
    (req as any).file.originalname = file.originalname;

    log.info({ filename: safeFilename, size: file.size }, 'File validated successfully');
    next();
  };
}

/**
 * Deep scan for malware using ClamAV (optional)
 * Requires clamscan npm package
 */
export async function scanForMalware(filePath: string): Promise<boolean> {
  try {
    // This would require installing clamscan package
    // import NodeClam from 'clamscan';
    // const clamscan = await new NodeClam().init({
    //   clamdscan: { host: 'localhost', port: 3310 }
    // });
    // const { isInfected } = await clamscan.scanFile(filePath);
    // return !isInfected;
    
    log.info({ filePath }, 'Malware scanning not configured');
    return true;
  } catch (err) {
    log.error({ err, filePath }, 'Malware scan error');
    return false;
  }
}

export default {
  validateExtension,
  validateFileSize,
  validateMagicBytes,
  sanitizeFilename,
  generateSafeFilename,
  validateUploadedFile,
  fileValidationMiddleware,
  scanForMalware
};

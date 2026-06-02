import { z } from "zod";

// Reengagement schema
export const reEngagementSchema = z.object({
  enabled: z.boolean().optional(),
  message: z.string().max(1000).optional(),
  interval: z.number().int().min(1).max(90).optional(),
});

// Payment config schema — matches the actual PaymentConfig interface in paymentService.ts
const jazzCashFieldsSchema = z.object({
  merchantId: z.string().max(100).optional(),
  merchantPassword: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
}).optional();

const easyPaisaFieldsSchema = z.object({
  merchantId: z.string().max(100).optional(),
  merchantPassword: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
}).optional();

const bankTransferFieldsSchema = z.object({
  accountTitle: z.string().max(200).optional(),
  accountNumber: z.string().max(50).optional(),
  bankName: z.string().max(200).optional(),
  branchCode: z.string().max(50).optional(),
  isActive: z.boolean().optional(),
}).optional();

export const paymentConfigSchema = z.object({
  jazzCash: jazzCashFieldsSchema,
  easyPaisa: easyPaisaFieldsSchema,
  bankTransfer: bankTransferFieldsSchema,
}).optional();

// Proactive config schema
export const proactiveConfigSchema = z.object({
  enabled: z.boolean().optional(),
  triggers: z.array(z.string()).optional(),
  frequency: z.number().int().min(1).max(7).optional(),
});

// Memory config schema
export const memoryConfigSchema = z.object({
  enabled: z.boolean().optional(),
  maxMessages: z.number().int().min(5).max(1000).optional(),
  summarizeAt: z.number().int().min(5).max(100).optional(),
});

export const updateSettingsSchema = z.object({
  storeName: z.string().min(1).max(100).optional(),
  geminiApiKey: z.string().max(500).optional(),
  geminiModel: z.enum(['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-flash-latest']).optional(),
  language: z.enum(['ur', 'en', 'ar', 'hi', 'bn', 'es', 'fr', 'zh']).optional(),
  email: z.string().email().optional(),
  phone: z.string().regex(/^[+0-9-() ]+$/).max(20).optional(),
  address: z.string().max(500).optional(),
  businessLogo: z.string().url().optional(),
  jazzCashNumber: z.string().regex(/^[0-9+]+$/).max(20).optional(),
  advanceAmount: z.number().int().min(0).max(1000000).optional(),
  notificationEmail: z.string().email().optional(),
  smtpHost: z.string().max(255).optional(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  smtpUser: z.string().max(255).optional(),
  smtpPass: z.string().max(500).optional(),
  reEngagement: reEngagementSchema.optional(),
  paymentConfig: paymentConfigSchema.optional(),
  proactiveConfig: proactiveConfigSchema.optional(),
  memoryConfig: memoryConfigSchema.optional(),
}).strict(); // Use strict() instead of passthrough()

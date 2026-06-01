import { z } from "zod";
export const updateSettingsSchema = z.object({
  storeName: z.string().max(100).optional(),
  geminiApiKey: z.string().optional(),
  geminiModel: z.string().optional(),
  language: z.string().max(10).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  businessLogo: z.string().optional(),
  jazzCashNumber: z.string().optional(),
  advanceAmount: z.number().int().min(0).optional(),
  notificationEmail: z.string().email().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
}).passthrough().optional();

import { z } from "zod";
export const sendBroadcastSchema = z.object({
  message: z.string().min(1).max(5000),
  targetAudience: z.enum(["all", "active", "inactive", "nonBuyers"]).optional(),
  scheduledAt: z.string().optional(),
});

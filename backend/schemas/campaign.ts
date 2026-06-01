import { z } from "zod";
export const createCampaignSchema = z.object({
  name: z.string().min(1).max(100),
  trigger: z.enum(["abandoned_cart", "new_session", "post_purchase", "manual"]),
  enabled: z.boolean().optional(),
  steps: z.array(z.object({
    day: z.number().int().min(0),
    message: z.string().min(1),
    aiGenerated: z.boolean().optional(),
  })).min(1),
});

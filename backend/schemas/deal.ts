import { z } from "zod";
export const createDealSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  productIds: z.array(z.string()).min(1),
  discountPrice: z.number().positive().optional(),
  image: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isActive: z.boolean().optional(),
});

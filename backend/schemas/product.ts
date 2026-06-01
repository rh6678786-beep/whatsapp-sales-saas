import { z } from "zod";
export const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  price: z.number().positive(),
  costPrice: z.number().min(0),
  features: z.array(z.string()).optional(),
  images: z.array(z.string()).optional(),
  videos: z.array(z.string()).optional(),
  stock: z.number().int().min(0).optional(),
});
export const updateProductSchema = createProductSchema.partial();

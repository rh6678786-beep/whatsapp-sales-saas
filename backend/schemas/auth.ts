import { z } from "zod";
export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  storeName: z.string().min(1).max(100).optional(),
});
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

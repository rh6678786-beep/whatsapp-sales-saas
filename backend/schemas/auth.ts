import { z } from "zod";
export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  storeName: z.string().min(1).max(100).optional(),
});
export const loginSchema = z.object({
  adminId: z.string().min(1),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(32),
  newPassword: z.string().min(8),
});

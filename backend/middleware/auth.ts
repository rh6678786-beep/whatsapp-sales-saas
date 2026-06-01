import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../services/authService.js";

export interface AuthenticatedRequest extends Request {
  adminId?: string;
}

export function getAdminId(req: Request): string {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const payload = verifyToken(authHeader.slice(7));
    if (payload) return payload.adminId;
    throw new Error("Invalid or expired token");
  }
  const headerId = req.headers["x-admin-id"] as string | undefined;
  if (headerId) {
    const payload = verifyToken(headerId);
    if (payload) return payload.adminId;
  }
  throw new Error("Authentication required");
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  try {
    req.adminId = getAdminId(req);
    next();
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
}

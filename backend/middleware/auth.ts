import { Request, Response, NextFunction } from "express";
import { verifyToken, AuthPayload } from "../services/authService.js";
import { verifyTeamToken, TeamAuthPayload } from "../services/teamAuthService.js";
import { AuthenticationError, InvalidTokenError, ForbiddenError } from "../lib/errors.js";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("auth-middleware");

export interface AuthenticatedRequest extends Request {
  adminId?: string;
  authPayload?: AuthPayload;
  teamPayload?: TeamAuthPayload;
  isTeamMember?: boolean;
}

function extractToken(req: Request): string | null {
  // Only accept Bearer token from Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  return null;
}

export function getAdminId(req: Request): string {
  const token = extractToken(req);
  if (!token) {
    throw new AuthenticationError("Authentication required. Provide a Bearer token in the Authorization header.");
  }

  const payload = verifyToken(token);
  if (!payload) {
    // Try team token
    const teamPayload = verifyTeamToken(token);
    if (!teamPayload) {
      throw new InvalidTokenError("Invalid or expired token");
    }
    return teamPayload.adminId;
  }
  return payload.adminId;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  try {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ error: "Authentication required. Provide a Bearer token." });
      return;
    }

    // Try admin token first
    const payload = verifyToken(token);
    if (payload) {
      req.adminId = payload.adminId;
      req.authPayload = payload;
      req.isTeamMember = false;
      next();
      return;
    }

    // Try team token
    const teamPayload = verifyTeamToken(token);
    if (teamPayload) {
      req.adminId = teamPayload.adminId;
      req.teamPayload = teamPayload;
      req.isTeamMember = true;
      next();
      return;
    }

    res.status(401).json({ error: "Invalid or expired token" });
  } catch (err: any) {
    log.warn({ err, path: req.path }, "Authentication failed");
    res.status(401).json({ error: err.message || "Authentication required" });
  }
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.isTeamMember) {
      res.status(403).json({ error: "Admin access required. Team members cannot perform this action." });
      return;
    }
    next();
  });
}

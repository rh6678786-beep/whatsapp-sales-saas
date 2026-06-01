import { Request, Response, NextFunction } from "express";
import { verifyTeamToken, TeamAuthPayload } from "../services/teamAuthService.js";

const ROLE_HIERARCHY: Record<string, number> = {
  viewer: 0,
  agent: 1,
  manager: 2,
  admin: 3,
};

export interface TeamAuthenticatedRequest extends Request {
  teamMember?: TeamAuthPayload;
}

export function getTeamMemberId(req: Request): TeamAuthPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Authentication required");
  }
  const payload = verifyTeamToken(authHeader.slice(7));
  if (!payload) throw new Error("Invalid or expired team token");
  return payload;
}

export function requireTeamAuth(req: TeamAuthenticatedRequest, res: Response, next: NextFunction): void {
  try {
    req.teamMember = getTeamMemberId(req);
    next();
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
}

export function requireTeamPermission(...allowedRoles: string[]) {
  return (req: TeamAuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      const payload = getTeamMemberId(req);
      if (!allowedRoles.includes(payload.role)) {
        res.status(403).json({ error: "Insufficient permissions" });
        return;
      }
      req.teamMember = payload;
      next();
    } catch (err: any) {
      res.status(401).json({ error: err.message });
    }
  };
}

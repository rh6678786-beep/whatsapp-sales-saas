import { Request, Response, NextFunction } from "express";
import { logAction } from "../services/auditLogService.js";
import { getAdminId } from "./auth.js";

export function createAuditMiddleware(action: string, entity: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      if (res.statusCode < 400) {
        const adminId = (req as any).adminId || getAdminId(req);
        const entityId = req.params.id || req.params.entityId || body?.id || undefined;
        const ip = req.ip || req.socket.remoteAddress;
        logAction(adminId, action, entity, entityId, { method: req.method, path: req.path }, ip).catch(() => {});
      }
      return originalJson(body);
    };
    next();
  };
}

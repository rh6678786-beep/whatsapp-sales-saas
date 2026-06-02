import { pool } from "./dbService.js";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("audit");

export async function logAction(
  adminId: string,
  action: string,
  entity: string,
  entityId?: string,
  details?: any,
  ipAddress?: string,
  memberId?: string,
) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (admin_id, member_id, action, entity, entity_id, details, ip_address, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [adminId, memberId || null, action, entity, entityId || null, details ? JSON.stringify(details) : null, ipAddress || null]
    );
  } catch (err: any) {
    log.error({ err: err.message, adminId, action, entity }, "Failed to log action");
  }
}

export async function getAuditLogs(adminId: string, limit = 50, offset = 0) {
  const [rowsResult, countResult] = await Promise.all([
    pool.query(
      `SELECT id, admin_id, member_id, action, entity, entity_id, details, ip_address, created_at
       FROM audit_logs
       WHERE admin_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [adminId, limit, offset]
    ),
    pool.query(
      `SELECT COUNT(*) as total FROM audit_logs WHERE admin_id = $1`,
      [adminId]
    ),
  ]);
  return {
    logs: rowsResult.rows.map(r => ({
      id: r.id,
      adminId: r.admin_id,
      memberId: r.member_id,
      action: r.action,
      entity: r.entity,
      entityId: r.entity_id,
      details: r.details,
      ipAddress: r.ip_address,
      createdAt: r.created_at,
    })),
    total: parseInt(countResult.rows[0].total, 10),
    limit,
    offset,
  };
}

export async function getAuditLogsByEntity(adminId: string, entity: string, entityId: string) {
  const result = await pool.query(
    `SELECT id, admin_id, member_id, action, entity, entity_id, details, ip_address, created_at
     FROM audit_logs
     WHERE admin_id = $1 AND entity = $2 AND entity_id = $3
     ORDER BY created_at DESC`,
    [adminId, entity, entityId]
  );
  return result.rows.map(r => ({
    id: r.id,
    adminId: r.admin_id,
    memberId: r.member_id,
    action: r.action,
    entity: r.entity,
    entityId: r.entity_id,
    details: r.details,
    ipAddress: r.ip_address,
    createdAt: r.created_at,
  }));
}

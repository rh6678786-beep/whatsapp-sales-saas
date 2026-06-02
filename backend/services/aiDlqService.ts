import { prisma } from '../services/dbService.js';

/**
 * Log a failed AI request to the Dead Letter Queue.
 * This persists the payload and error details for later manual review or reprocessing.
 */
export async function logAiDlq(
  adminId: string,
  operation: string,
  payload: any,
  errorMessage: string
): Promise<void> {
  try {
    await prisma.aiDlq.create({
      data: {
        adminId,
        operation,
        payload,
        errorMessage,
      },
    });
    console.info(`[AI DLQ] Logged failed operation '${operation}' for admin ${adminId}`);
  } catch (e) {
    console.error('[AI DLQ] Failed to log dead letter entry:', e);
  }
}

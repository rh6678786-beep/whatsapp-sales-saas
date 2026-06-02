import { prisma } from '../services/dbService.js';
import { createChildLogger } from '../lib/logger.js';

const log = createChildLogger('ai:dlq');

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
    // Verify prisma is available and has aiDlq model
    if (!prisma || !prisma.aiDlq) {
      log.warn({ adminId, operation }, 'AI DLQ table not available, skipping');
      return;
    }
    await prisma.aiDlq.create({
      data: {
        adminId,
        operation,
        payload,
        errorMessage,
      },
    });
    log.info({ adminId, operation, errorMessage: errorMessage.substring(0, 100) }, 'Logged failed AI request to DLQ');
  } catch (e) {
    log.error({ err: e, adminId, operation }, 'Failed to log dead letter entry');
  }
}

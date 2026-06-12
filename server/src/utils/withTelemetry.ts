import { v4 as uuidv4 } from 'uuid';
import logger from './logger';
import { sanitizeForLog } from './sanitizeForLog';

interface TelemetryContext {
  sessionId?: string;
  userId?: string;
}

export async function withTelemetry<T>(
  service: string,
  method: string,
  payload: Record<string, unknown>,
  fn: () => Promise<T>,
  ctx: TelemetryContext = {}
): Promise<T> {
  const operationId = uuidv4();
  const start = Date.now();

  logger.info({
    type: 'service_start',
    operationId,
    sessionId: ctx.sessionId,
    userId: ctx.userId,
    service,
    method,
    payload: sanitizeForLog(payload),
  });

  try {
    const result = await fn();
    logger.info({
      type: 'service_end',
      operationId,
      sessionId: ctx.sessionId,
      service,
      method,
      status: 'success',
      durationMs: Date.now() - start,
    });
    return result;
  } catch (err) {
    logger.error({
      type: 'service_end',
      operationId,
      sessionId: ctx.sessionId,
      service,
      method,
      status: 'error',
      durationMs: Date.now() - start,
      error:
        err instanceof Error
          ? { message: err.message, stack: err.stack }
          : { message: String(err) },
    });
    throw err;
  }
}

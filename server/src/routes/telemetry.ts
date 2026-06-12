import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { telemetrySchema } from '../validators/telemetry';
import logger from '../utils/logger';
import { sanitizeForLog } from '../utils/sanitizeForLog';
import { AppError } from '../utils/AppError';

const router = Router();

router.post(
  '/',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = telemetrySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid telemetry payload');
    }

    const safe = sanitizeForLog(parsed.data as Record<string, unknown>);
    logger.info({ ...safe, source: 'frontend' });

    res.status(204).end();
  })
);

export default router;

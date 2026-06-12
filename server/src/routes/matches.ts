import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { LearningService } from '../services/LearningService';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { meaningfulSchema } from '../validators/learning';

const router = Router();

function param(req: Request, name: string): string {
  const v = req.params[name];
  if (!v) throw new AppError(400, 'MISSING_PARAM', `Missing route parameter: ${name}`);
  return Array.isArray(v) ? v[0] ?? '' : v;
}

router.patch(
  '/:id/meaningful',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    const parsed = meaningfulSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request body');

    const match = await LearningService.setMeaningful(
      param(req, 'id'),
      req.auth.userId,
      parsed.data.meaningful
    );
    res.json(match);
  })
);

export default router;

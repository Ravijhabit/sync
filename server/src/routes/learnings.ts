import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { LearningService } from '../services/LearningService';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { createLearningSchema, reviewLearningSchema } from '../validators/learning';
import { getIo } from '../socket/server';

const router = Router();

function param(req: Request, name: string): string {
  const v = req.params[name];
  if (!v) throw new AppError(400, 'MISSING_PARAM', `Missing route parameter: ${name}`);
  return Array.isArray(v) ? v[0] ?? '' : v;
}

router.post(
  '/',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    const parsed = createLearningSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request body');

    const learning = await LearningService.create(req.auth.userId, parsed.data, getIo());
    res.status(201).json(learning);
  })
);

router.get(
  '/:id',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    const learning = await LearningService.getById(param(req, 'id'), req.auth.userId);
    res.json(learning);
  })
);

router.patch(
  '/:id/review',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    const parsed = reviewLearningSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request body');

    const learning = await LearningService.review(param(req, 'id'), req.auth.userId, parsed.data);
    res.json(learning);
  })
);

export default router;

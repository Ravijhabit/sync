import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { AuthService } from '../services/AuthService';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

const router = Router();

router.get(
  '/me',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');

    const user = await AuthService.getMe(req.auth.userId);
    res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: user.company,
        bio: user.bio,
        interests: user.interests,
        avatarUrl: user.avatarUrl ?? null,
        createdAt: user.createdAt,
      },
      sessionId: req.auth.sessionId,
    });
  })
);

export default router;

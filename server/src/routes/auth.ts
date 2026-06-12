import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthService } from '../services/AuthService';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { joinSchema, loginSchema } from '../validators/auth';

const router = Router();

const authRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env['NODE_ENV'] === 'test',
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' } },
});

function toUserResponse(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  company: string;
  bio: string;
  interests: string[];
  avatarUrl?: string | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    company: user.company,
    bio: user.bio,
    interests: user.interests,
    avatarUrl: user.avatarUrl ?? null,
    createdAt: user.createdAt,
  };
}

router.post(
  '/join',
  authRateLimit,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = joinSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const { user, token, sessionId, cookieOptions } = await AuthService.join(parsed.data);
    res.cookie('token', token, cookieOptions);

    res.status(201).json({ user: toUserResponse(user), sessionId });
  })
);

router.post(
  '/login',
  authRateLimit,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const { user, token, sessionId, cookieOptions } = await AuthService.login(parsed.data);
    res.cookie('token', token, cookieOptions);

    res.status(200).json({ user: toUserResponse(user), sessionId });
  })
);

export default router;

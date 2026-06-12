import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { EventService } from '../services/EventService';
import { LeaderboardService } from '../services/LeaderboardService';
import { RatingService } from '../services/RatingService';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

const router = Router();

function param(req: Request, name: string): string {
  const v = req.params[name];
  if (!v) throw new AppError(400, 'MISSING_PARAM', `Missing route parameter: ${name}`);
  return Array.isArray(v) ? v[0] ?? '' : v;
}

// â”€â”€â”€ Event listing (public) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const events = await EventService.listActive();
    res.json(events);
  })
);

// â”€â”€â”€ Event detail â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get(
  '/:id',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    const event = await EventService.getById(param(req, 'id'), {
      userId: req.auth.userId,
      sessionId: req.auth.sessionId,
    });
    res.json(event);
  })
);

// â”€â”€â”€ Attendees â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get(
  '/:id/attendees',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    const page = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? '20'), 10)));

    const result = await EventService.getAttendees(param(req, 'id'), page, limit, {
      userId: req.auth.userId,
      sessionId: req.auth.sessionId,
    });
    res.json(result);
  })
);

// â”€â”€â”€ Leaderboard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get(
  '/:eventId/leaderboard',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    const eventId = param(req, 'eventId');
    await LeaderboardService.assertVisible(eventId);

    const page = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? '20'), 10)));

    const entries = await LeaderboardService.getRanked(eventId, page, limit);
    res.json({ entries, total: entries.length, page, limit });
  })
);

// â”€â”€â”€ User stats within event â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get(
  '/:eventId/users/:userId/stats',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    const stats = await LeaderboardService.getUserStats(param(req, 'userId'), param(req, 'eventId'));
    res.json(stats);
  })
);

// â”€â”€â”€ Ratings received â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get(
  '/:eventId/users/:userId/ratings/received',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    const result = await RatingService.getReceived(param(req, 'userId'), param(req, 'eventId'));
    res.json(result);
  })
);

// â”€â”€â”€ Ratings given â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get(
  '/:eventId/users/:userId/ratings/given',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    const result = await RatingService.getGiven(param(req, 'userId'), param(req, 'eventId'));
    res.json(result);
  })
);

export default router;

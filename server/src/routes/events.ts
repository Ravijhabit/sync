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

// Event listing (public)
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const events = await EventService.listActive();
    res.json(events);
  })
);

// Event detail
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

// Attendees
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

// Leaderboard 
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

// User stats within event
router.get(
  '/:eventId/users/:userId/stats',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    const stats = await LeaderboardService.getUserStats(param(req, 'userId'), param(req, 'eventId'));
    res.json(stats);
  })
);

// Ratings received
router.get(
  '/:eventId/users/:userId/ratings/received',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    const result = await RatingService.getReceived(param(req, 'userId'), param(req, 'eventId'));
    res.json(result);
  })
);

// Ratings given
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

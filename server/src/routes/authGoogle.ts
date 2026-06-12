import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import type { User } from '@prisma/client';

const router = Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env['NODE_ENV'] === 'production',
  sameSite: 'strict' as const,
  path: '/',
};

router.get('/google', (req: Request, res: Response, next: NextFunction) =>
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res, next)
);

router.get(
  '/google/callback',
  (req: Request, res: Response, next: NextFunction) =>
    passport.authenticate('google', { session: false, failureRedirect: '/?auth=failed' })(req, res, next),
  (req: Request, res: Response, _next: NextFunction) => {
    const user = req.user as User | undefined;
    if (!user) {
      res.redirect('/?auth=failed');
      return;
    }

    const secret = process.env['JWT_SECRET'];
    if (!secret) {
      res.redirect('/?auth=failed');
      return;
    }

    const sessionId = uuidv4();
    const token = jwt.sign({ userId: user.id, sessionId }, secret, { expiresIn: '24h' });

    res.cookie('token', token, COOKIE_OPTIONS);
    res.redirect(process.env['CLIENT_URL'] ?? '/');
  }
);

export default router;

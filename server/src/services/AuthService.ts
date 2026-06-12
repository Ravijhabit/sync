import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { withTelemetry } from '../utils/withTelemetry';
import type { JoinBody, LoginBody } from '../validators/auth';

export interface JwtPayload {
  userId: string;
  sessionId: string;
}

function signToken(userId: string, sessionId: string): string {
  const secret = process.env['JWT_SECRET'];
  if (!secret) throw new Error('JWT_SECRET not set');
  return jwt.sign({ userId, sessionId }, secret, { expiresIn: '24h' });
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env['NODE_ENV'] === 'production',
  sameSite: 'strict' as const,
  path: '/',
};

export const AuthService = {
  async join(body: JoinBody) {
    return withTelemetry('AuthService', 'join', { eventId: body.eventId }, async () => {
      const existing = await prisma.user.findUnique({ where: { email: body.email } });

      let user = existing;
      if (!user) {
        user = await prisma.user.create({
          data: {
            name: body.name,
            email: body.email,
            role: body.role,
            company: body.company,
            bio: body.bio,
            interests: body.interests,
          },
        });
      }

      await prisma.userEvent.upsert({
        where: { userId_eventId: { userId: user.id, eventId: body.eventId } },
        update: {},
        create: { userId: user.id, eventId: body.eventId, status: 'IDLE' },
      });

      const sessionId = uuidv4();
      const token = signToken(user.id, sessionId);
      return { user, token, sessionId, cookieOptions: COOKIE_OPTIONS };
    });
  },

  async login(body: LoginBody) {
    return withTelemetry('AuthService', 'login', {}, async () => {
      const user = await prisma.user.findUnique({ where: { email: body.email } });
      if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'No account found for this email');

      const sessionId = uuidv4();
      const token = signToken(user.id, sessionId);
      return { user, token, sessionId, cookieOptions: COOKIE_OPTIONS };
    });
  },

  async getMe(userId: string) {
    return withTelemetry('AuthService', 'getMe', { userId }, async () => {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new AppError(401, 'UNAUTHORIZED', 'User not found');
      return user;
    });
  },

  verifyToken(token: string): JwtPayload {
    const secret = process.env['JWT_SECRET'];
    if (!secret) throw new Error('JWT_SECRET not set');
    return jwt.verify(token, secret) as JwtPayload;
  },
};

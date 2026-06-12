import request from 'supertest';
import passport from 'passport';
import { Strategy } from 'passport-google-oauth20';
import type { Request, Response, NextFunction } from 'express';
import app from '../src/app';
import { testPrisma, cleanDatabase } from './factories';

const MOCK_PROFILE = {
  id: 'google-123',
  displayName: 'OAuth User',
  emails: [{ value: 'oauth@example.com' }],
  photos: [{ value: 'https://example.com/avatar.jpg' }],
  provider: 'google' as const,
  _raw: '',
  _json: {} as Record<string, unknown>,
};

// Override the google strategy with a mock that skips real OAuth
beforeAll(() => {
  passport.use(
    'google',
    new Strategy(
      {
        clientID: 'mock-client-id',
        clientSecret: 'mock-client-secret',
        callbackURL: 'http://localhost:4000/api/auth/google/callback',
      },
      (_accessToken, _refreshToken, profile, done) => {
        done(null, profile);
      }
    )
  );

  // Patch authenticate to call verify directly without redirecting to Google
  jest.spyOn(passport, 'authenticate').mockImplementation(
    (strategy: string | string[], options?: object) => {
      if (strategy === 'google' && (options as { session?: boolean })?.session === false) {
        return (req: Request, _res: Response, next: NextFunction) => {
          (req as unknown as { user?: typeof MOCK_PROFILE }).user = MOCK_PROFILE;
          next();
        };
      }
      // For the initiation route, just simulate a redirect
      return (_req: Request, res: Response) => {
        (res as { redirect: (url: string) => void }).redirect('https://accounts.google.com/mock');
      };
    }
  );
});

afterAll(() => {
  jest.restoreAllMocks();
});

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await testPrisma.$disconnect();
});

describe('GET /api/auth/google/callback (mocked)', () => {
  it('creates a user on first login and sets a JWT cookie', async () => {
    const res = await request(app).get('/api/auth/google/callback');

    expect(res.status).toBe(302);
    const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
    expect(cookies?.[0]).toContain('token=');
    expect(cookies?.[0]).toContain('HttpOnly');

    const user = await testPrisma.user.findUnique({ where: { email: 'oauth@example.com' } });
    expect(user).not.toBeNull();
    expect(user?.name).toBe('OAuth User');
    expect(user?.avatarUrl).toBe('https://example.com/avatar.jpg');
  });

  it('does not create a duplicate user on second login', async () => {
    await request(app).get('/api/auth/google/callback');
    await request(app).get('/api/auth/google/callback');

    const count = await testPrisma.user.count({ where: { email: 'oauth@example.com' } });
    expect(count).toBe(1);
  });

  it('updates avatarUrl if it changed on return login', async () => {
    await request(app).get('/api/auth/google/callback');

    jest.spyOn(passport, 'authenticate').mockImplementationOnce(
      (_strategy, options) => {
        if ((options as { session?: boolean })?.session === false) {
          return (req: Request, _res: Response, next: NextFunction) => {
            (req as unknown as { user?: object }).user = {
              ...MOCK_PROFILE,
              photos: [{ value: 'https://example.com/new-avatar.jpg' }],
            };
            next();
          };
        }
        return (_req: Request, res: Response) => {
          (res as { redirect: (url: string) => void }).redirect('/');
        };
      }
    );

    await request(app).get('/api/auth/google/callback');
    const user = await testPrisma.user.findUnique({ where: { email: 'oauth@example.com' } });
    expect(user?.avatarUrl).toBe('https://example.com/new-avatar.jpg');
  });
});

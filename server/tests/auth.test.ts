import request from 'supertest';
import app from '../src/app';
import { testPrisma, createTestUser, createTestEvent, cleanDatabase } from './factories';

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await testPrisma.$disconnect();
});

describe('POST /api/auth/join', () => {
  let eventId: string;

  beforeEach(async () => {
    const event = await createTestEvent();
    eventId = event.id;
  });

  it('creates a user and sets a JWT cookie', async () => {
    const res = await request(app)
      .post('/api/auth/join')
      .send({
        name: 'Alice',
        email: 'alice@example.com',
        role: 'Backend Engineer',
        company: 'ACME',
        bio: 'Hello',
        interests: ['AI'],
        eventId,
      });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: 'Alice', email: 'alice@example.com' });
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie'][0]).toContain('token=');
    expect(res.headers['set-cookie'][0]).toContain('HttpOnly');
  });

  it('returns 400 on missing required fields', async () => {
    const res = await request(app).post('/api/auth/join').send({ email: 'bad@test.com' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('is idempotent for duplicate email', async () => {
    const body = {
      name: 'Bob',
      email: 'bob@example.com',
      role: 'PM',
      company: 'Corp',
      bio: '',
      interests: [],
      eventId,
    };
    const r1 = await request(app).post('/api/auth/join').send(body);
    const r2 = await request(app).post('/api/auth/join').send(body);
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    expect(r1.body.user.id).toBe(r2.body.user.id);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await createTestUser({ email: 'known@example.com' });
  });

  it('returns 200 and sets cookie for known email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'known@example.com' });

    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('returns 404 for unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('USER_NOT_FOUND');
  });
});

describe('GET /api/users/me', () => {
  let cookie: string;

  beforeEach(async () => {
    const event = await createTestEvent();
    const res = await request(app)
      .post('/api/auth/join')
      .send({
        name: 'Charlie',
        email: 'charlie@example.com',
        role: 'Engineer',
        company: 'Startup',
        bio: '',
        interests: [],
        eventId: event.id,
      });
    cookie = res.headers['set-cookie'][0] as string;
  });

  it('returns user profile with valid cookie', async () => {
    const res = await request(app).get('/api/users/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: 'charlie@example.com' });
  });

  it('returns 401 with no cookie', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 with tampered token', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Cookie', 'token=notavalidjwt');
    expect(res.status).toBe(401);
  });
});

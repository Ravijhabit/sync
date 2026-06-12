import request from 'supertest';
import app from '../src/app';
import {
  testPrisma,
  createTestUser,
  createTestEvent,
  createTestUserEvent,
  createTestPrompt,
  createTestMatch,
  createTestLearning,
  cleanDatabase,
} from './factories';

let cookie1: string;
let cookie2: string;
let userId1: string;
let userId2: string;
let matchId: string;
let eventId: string;

beforeEach(async () => {
  await cleanDatabase();

  const event = await createTestEvent({ status: 'ONGOING' });
  eventId = event.id;

  const u1 = await createTestUser({ email: 'l1@test.com' });
  const u2 = await createTestUser({ email: 'l2@test.com' });
  userId1 = u1.id;
  userId2 = u2.id;

  await createTestUserEvent(userId1, eventId);
  await createTestUserEvent(userId2, eventId);

  const r1 = await request(app).post('/api/auth/login').send({ email: 'l1@test.com' });
  const r2 = await request(app).post('/api/auth/login').send({ email: 'l2@test.com' });
  cookie1 = r1.headers['set-cookie'][0] as string;
  cookie2 = r2.headers['set-cookie'][0] as string;

  const prompt = await createTestPrompt();
  const match = await createTestMatch(userId1, userId2, eventId, prompt.id, { status: 'COMPLETED' });
  matchId = match.id;
});

afterAll(async () => {
  await testPrisma.$disconnect();
});

describe('POST /api/learnings', () => {
  it('creates a learning and returns 201', async () => {
    const res = await request(app)
      .post('/api/learnings')
      .set('Cookie', cookie1)
      .send({ matchId, targetId: userId2, content: 'Learned X', justification: 'Because Y' });

    expect(res.status).toBe(201);
    expect(res.body.matchId).toBe(matchId);
  });

  it('returns 409 on duplicate submission', async () => {
    await request(app)
      .post('/api/learnings')
      .set('Cookie', cookie1)
      .send({ matchId, targetId: userId2, content: 'First', justification: 'Y' });

    const res = await request(app)
      .post('/api/learnings')
      .set('Cookie', cookie1)
      .send({ matchId, targetId: userId2, content: 'Second', justification: 'Y' });

    expect(res.status).toBe(409);
  });

  it('returns 403 when event is COMPLETED', async () => {
    await testPrisma.event.update({ where: { id: eventId }, data: { status: 'COMPLETED' } });

    const res = await request(app)
      .post('/api/learnings')
      .set('Cookie', cookie1)
      .send({ matchId, targetId: userId2, content: 'X', justification: 'Y' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('EVENT_COMPLETED');
  });

  it('returns 400 on missing fields', async () => {
    const res = await request(app)
      .post('/api/learnings')
      .set('Cookie', cookie1)
      .send({ matchId });
    expect(res.status).toBe(400);
  });

  it('returns 401 with no cookie', async () => {
    const res = await request(app).post('/api/learnings').send({});
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/learnings/:id/review', () => {
  let learningId: string;

  beforeEach(async () => {
    const l = await createTestLearning(matchId, userId1, userId2);
    learningId = l.id;
  });

  it('allows target to review', async () => {
    const res = await request(app)
      .patch(`/api/learnings/${learningId}/review`)
      .set('Cookie', cookie2)
      .send({ rating: 8, feedback: 'Great insight', isCorrect: true });

    expect(res.status).toBe(200);
    expect(res.body.rating).toBe(8);
    expect(res.body.isCorrect).toBe(true);
  });

  it('returns 403 when non-target tries to review', async () => {
    const res = await request(app)
      .patch(`/api/learnings/${learningId}/review`)
      .set('Cookie', cookie1)
      .send({ rating: 5, feedback: 'Hmm', isCorrect: false });

    expect(res.status).toBe(403);
  });

  it('returns 403 when event is COMPLETED', async () => {
    await testPrisma.event.update({ where: { id: eventId }, data: { status: 'COMPLETED' } });

    const res = await request(app)
      .patch(`/api/learnings/${learningId}/review`)
      .set('Cookie', cookie2)
      .send({ rating: 7, feedback: 'Ok', isCorrect: true });

    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/matches/:id/meaningful', () => {
  it('sets meaningful flag for participant', async () => {
    const res = await request(app)
      .patch(`/api/matches/${matchId}/meaningful`)
      .set('Cookie', cookie1)
      .send({ meaningful: true });

    expect(res.status).toBe(200);
    const updated = await testPrisma.match.findUnique({ where: { id: matchId } });
    expect(updated?.user1Meaningful).toBe(true);
  });

  it('returns 403 when non-participant tries to set flag', async () => {
    const outsider = await createTestUser({ email: 'outsider@test.com' });
    await createTestUserEvent(outsider.id, eventId);
    const r = await request(app).post('/api/auth/login').send({ email: 'outsider@test.com' });
    const outsiderCookie = r.headers['set-cookie'][0] as string;

    const res = await request(app)
      .patch(`/api/matches/${matchId}/meaningful`)
      .set('Cookie', outsiderCookie)
      .send({ meaningful: true });

    expect(res.status).toBe(403);
  });
});

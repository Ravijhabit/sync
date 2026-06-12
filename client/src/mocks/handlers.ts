import { http, HttpResponse } from 'msw';
import {
  mockUser,
  mockEventOngoing,
  mockEventUpcoming,
  mockLearning,
  mockLeaderboardEntries,
  mockUserStats,
  mockReceivedRatings,
} from './fixtures';

export const handlers = [
  http.post('/api/auth/join', () =>
    HttpResponse.json({ user: mockUser, sessionId: 'session-abc' }, { status: 201 })
  ),

  http.post('/api/auth/login', () =>
    HttpResponse.json({ user: mockUser, sessionId: 'session-abc' }, { status: 200 })
  ),

  http.get('/api/users/me', () =>
    HttpResponse.json({ user: mockUser, sessionId: 'session-abc' })
  ),

  http.get('/api/events', () =>
    HttpResponse.json([mockEventOngoing, mockEventUpcoming])
  ),

  http.get('/api/events/:id', ({ params }) => {
    const event = params['id'] === 'event-1' ? mockEventOngoing : mockEventUpcoming;
    return HttpResponse.json(event);
  }),

  http.get('/api/events/:id/attendees', () =>
    HttpResponse.json({ total: 42, attendees: [] })
  ),

  http.get('/api/events/:id/leaderboard', () =>
    HttpResponse.json({ entries: mockLeaderboardEntries, total: 2, page: 1, limit: 50 })
  ),

  http.get('/api/events/:eventId/users/:userId/stats', () =>
    HttpResponse.json(mockUserStats)
  ),

  http.get('/api/events/:eventId/users/:userId/ratings/received', () =>
    HttpResponse.json(mockReceivedRatings)
  ),

  http.post('/api/learnings', () =>
    HttpResponse.json(mockLearning, { status: 201 })
  ),

  http.get('/api/learnings/:id', () =>
    HttpResponse.json(mockLearning)
  ),

  http.patch('/api/learnings/:id/review', () =>
    HttpResponse.json({ ...mockLearning, rating: 8, isCorrect: true })
  ),

  http.patch('/api/matches/:id/meaningful', () =>
    HttpResponse.json({ ok: true })
  ),

  http.post('/api/telemetry', () =>
    new HttpResponse(null, { status: 204 })
  ),
];

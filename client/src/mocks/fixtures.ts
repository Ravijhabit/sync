import type { User, Event, Learning, LeaderboardEntry, UserStats, ReceivedRating } from '../services/types';

export const mockUser: User = {
  id: 'user-1',
  name: 'Alice Dev',
  email: 'alice@example.com',
  role: 'Frontend Engineer',
  company: 'Acme Corp',
  bio: 'Loves React and TypeScript.',
  interests: ['TypeScript', 'React', 'Open Source'],
  createdAt: '2026-06-12T10:00:00.000Z',
};

export const mockPartnerUser: User = {
  id: 'user-2',
  name: 'Bob Backend',
  email: 'bob@example.com',
  role: 'Backend Engineer',
  company: 'Techco',
  bio: 'Go and Rust enthusiast.',
  interests: ['Go', 'Rust', 'Cloud'],
  createdAt: '2026-06-12T10:00:00.000Z',
};

export const mockEventOngoing: Event = {
  id: 'event-1',
  name: 'HackFest 2026',
  venue: 'Main Hall',
  description: 'Annual hackathon.',
  startTime: '2026-06-12T09:00:00.000Z',
  endTime: '2026-06-12T17:00:00.000Z',
  status: 'ONGOING',
};

export const mockEventUpcoming: Event = {
  id: 'event-2',
  name: 'DevConf 2026',
  venue: 'Online',
  description: 'Developer conference.',
  startTime: '2026-07-01T09:00:00.000Z',
  endTime: '2026-07-01T17:00:00.000Z',
  status: 'UPCOMING',
};

export const mockEventClosing: Event = {
  ...mockEventOngoing,
  status: 'CLOSING',
};

export const mockEventCompleted: Event = {
  ...mockEventOngoing,
  status: 'COMPLETED',
};

export const mockLearning: Learning = {
  id: 'learning-1',
  matchId: 'match-1',
  learnerId: 'user-1',
  targetId: 'user-2',
  content: 'Bob values async communication over meetings.',
  justification: 'He mentioned it three times during our conversation.',
  submittedAt: '2026-06-12T11:00:00.000Z',
};

export const mockLeaderboardEntries: LeaderboardEntry[] = [
  {
    id: 'user-2',
    name: 'Bob Backend',
    role: 'Backend Engineer',
    company: 'Techco',
    bayesianScore: 8.43,
    avgRating: 9.0,
    totalReviews: 3,
    totalConversations: 3,
  },
  {
    id: 'user-1',
    name: 'Alice Dev',
    role: 'Frontend Engineer',
    company: 'Acme Corp',
    bayesianScore: 8.39,
    avgRating: 10.0,
    totalReviews: 1,
    totalConversations: 1,
  },
];

export const mockUserStats: UserStats = {
  totalConversations: 1,
  avgRating: 10.0,
  meaningfulCount: 1,
  casualCount: 0,
};

export const mockReceivedRatings: ReceivedRating[] = [
  {
    learningId: 'learning-2',
    content: 'Alice is great at breaking down complex problems.',
    justification: 'She explained the architecture clearly.',
    rating: 10,
    feedback: 'Spot on!',
    isCorrect: true,
    reviewerName: 'Bob Backend',
    reviewerRole: 'Backend Engineer',
    reviewerCompany: 'Techco',
    matchDate: '2026-06-12T11:00:00.000Z',
  },
];

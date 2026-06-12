import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env['DATABASE_URL_TEST'] ?? '' } },
});

export { prisma as testPrisma };

export const createTestUser = (overrides: Partial<{
  name: string;
  email: string;
  role: string;
  company: string;
  bio: string;
  interests: string[];
}> = {}) =>
  prisma.user.create({
    data: {
      name: 'Test User',
      email: `${uuidv4()}@test.com`,
      role: 'Backend Engineer',
      company: 'ACME',
      bio: '',
      interests: [],
      ...overrides,
    },
  });

export const createTestEvent = (overrides: Partial<{
  name: string;
  venue: string;
  status: 'UPCOMING' | 'ONGOING' | 'CLOSING' | 'COMPLETED';
  startTime: Date;
  endTime: Date;
}> = {}) => {
  const now = new Date();
  return prisma.event.create({
    data: {
      name: 'Test Event',
      venue: 'Test Venue',
      description: '',
      startTime: new Date(now.getTime() - 60 * 60 * 1000),
      endTime: new Date(now.getTime() + 2 * 60 * 60 * 1000),
      status: 'ONGOING',
      ...overrides,
    },
  });
};

export const createTestUserEvent = (userId: string, eventId: string, status: 'IDLE' | 'ENGAGED' | 'OFFLINE' = 'IDLE') =>
  prisma.userEvent.create({
    data: { userId, eventId, status },
  });

export const createTestPrompt = (overrides: Partial<{
  text: string;
  followUp: string;
  category: 'FAILURE' | 'CONVICTION' | 'SURPRISE' | 'CRAFT' | 'IMPACT' | 'FUTURE' | 'UNLEARNING' | 'PEOPLE';
  depth: 'SURFACE' | 'MID' | 'DEEP';
  energy: 'REFLECTIVE' | 'ENERGISING' | 'PROVOCATIVE' | 'COLLABORATIVE';
  audience: 'ANY' | 'TECHNICAL' | 'NON_TECHNICAL' | 'CROSS_FUNCTIONAL';
  tags: string[];
}> = {}) =>
  prisma.conversationPrompt.create({
    data: {
      text: 'What is a challenge you faced recently?',
      followUp: 'Can you walk me through one specific moment?',
      category: 'CRAFT',
      depth: 'SURFACE',
      energy: 'REFLECTIVE',
      audience: 'ANY',
      tags: [],
      ...overrides,
    },
  });

export const createTestMatch = (
  user1Id: string,
  user2Id: string,
  eventId: string,
  promptId: string,
  overrides: Partial<{
    status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  }> = {}
) =>
  prisma.match.create({
    data: {
      eventId,
      user1Id,
      user2Id,
      promptId,
      status: 'PENDING',
      ...overrides,
    },
  });

export const createTestLearning = (
  matchId: string,
  learnerId: string,
  targetId: string,
  overrides: Partial<{
    content: string;
    justification: string;
    rating: number;
    feedback: string;
    isCorrect: boolean;
  }> = {}
) =>
  prisma.learning.create({
    data: {
      matchId,
      learnerId,
      targetId,
      content: 'I learned something interesting about them.',
      justification: 'It stood out because it was unexpected.',
      ...overrides,
    },
  });

export async function cleanDatabase() {
  await prisma.$executeRaw`TRUNCATE learnings, matches, conversation_prompts, user_events, users, events CASCADE`;
}

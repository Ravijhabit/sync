import prisma from '../lib/prisma';
import { withTelemetry } from '../utils/withTelemetry';
import logger from '../utils/logger';
import type { ConversationPrompt, PromptDepth, PromptAudience } from '@prisma/client';

const TECHNICAL_ROLES = new Set([
  'Backend Engineer',
  'Frontend Engineer',
  'Full Stack Engineer',
  'Software Engineer',
  'Data Engineer',
  'DevOps Engineer',
  'ML Engineer',
  'Platform Engineer',
  'Engineering Manager',
]);

function isTechnical(role: string): boolean {
  return TECHNICAL_ROLES.has(role);
}

function depthsForCount(count: number): PromptDepth[] {
  if (count === 0) return ['SURFACE'];
  if (count < 3) return ['SURFACE', 'MID'];
  return ['SURFACE', 'MID', 'DEEP'];
}

function audienceFilter(roleA: string, roleB: string): PromptAudience[] {
  const techA = isTechnical(roleA);
  const techB = isTechnical(roleB);
  if (techA && techB) return ['TECHNICAL', 'ANY'];
  if (!techA && !techB) return ['NON_TECHNICAL', 'ANY'];
  return ['CROSS_FUNCTIONAL', 'ANY'];
}

function scoreByTagOverlap(prompt: ConversationPrompt, interests: Set<string>): number {
  return prompt.tags.filter((t) => interests.has(t)).length;
}

export const PromptSelectionService = {
  async select(
    userA: { id: string; role: string; interests: string[] },
    userB: { id: string; role: string; interests: string[] },
    eventId: string
  ): Promise<ConversationPrompt> {
    return withTelemetry('PromptSelectionService', 'select', { eventId }, async () => {
      const [countA, countB, usedPromptIds] = await Promise.all([
        prisma.match.count({
          where: {
            eventId,
            status: 'COMPLETED',
            OR: [{ user1Id: userA.id }, { user2Id: userA.id }],
          },
        }),
        prisma.match.count({
          where: {
            eventId,
            status: 'COMPLETED',
            OR: [{ user1Id: userB.id }, { user2Id: userB.id }],
          },
        }),
        prisma.match.findMany({
          where: {
            eventId,
            OR: [
              { user1Id: userA.id },
              { user2Id: userA.id },
              { user1Id: userB.id },
              { user2Id: userB.id },
            ],
          },
          select: { promptId: true },
        }),
      ]);

      const usedIds = new Set(usedPromptIds.map((m) => m.promptId));
      const minCount = Math.min(countA, countB);
      const eligibleDepths = depthsForCount(minCount);
      const eligibleAudiences = audienceFilter(userA.role, userB.role);

      const candidates = await prisma.conversationPrompt.findMany({
        where: {
          depth: { in: eligibleDepths },
          audience: { in: eligibleAudiences },
          id: { notIn: [...usedIds] },
        },
      });

      const interests = new Set([...userA.interests, ...userB.interests]);

      if (candidates.length > 0) {
        const scored = candidates
          .map((p) => ({ prompt: p, score: scoreByTagOverlap(p, interests) }))
          .sort((a, b) => b.score - a.score);

        const top3 = scored.slice(0, 3);
        const picked = top3[Math.floor(Math.random() * top3.length)];
        if (picked) return picked.prompt;
      }

      logger.warn({ type: 'prompt_pool_exhausted', eventId });

      const fallback = await prisma.conversationPrompt.findFirst({
        where: { depth: 'SURFACE', audience: 'ANY' },
        orderBy: { id: 'asc' },
      });

      if (!fallback) throw new Error('No conversation prompts available');
      return fallback;
    });
  },
};

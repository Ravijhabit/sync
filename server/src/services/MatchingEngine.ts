import { Server } from 'socket.io';
import prisma from '../lib/prisma';
import { PromptSelectionService } from './PromptSelectionService';
import { withTelemetry } from '../utils/withTelemetry';
import logger from '../utils/logger';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from '../socket/types';

type IoType = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export const MatchingEngine = {
  async handleIdle(userId: string, eventId: string, io: IoType) {
    return withTelemetry('MatchingEngine', 'handleIdle', { userId, eventId }, async () => {
      const event = await prisma.event.findUnique({ where: { id: eventId } });
      if (!event) return null;

      if (event.status === 'CLOSING' || event.status === 'COMPLETED') {
        logger.warn({ type: 'matching_rejected', reason: 'event_not_ongoing', userId, eventId });
        return null;
      }

      await prisma.userEvent.update({
        where: { userId_eventId: { userId, eventId } },
        data: { status: 'IDLE' },
      });

      const idleUsers = await prisma.userEvent.findMany({
        where: { eventId, status: 'IDLE', userId: { not: userId } },
        include: {
          user: { select: { id: true, role: true, company: true, interests: true } },
        },
      });

      if (idleUsers.length === 0) {
        logger.info({ type: 'no_idle_candidates', userId, eventId });
        return null;
      }

      const existingMatchUserIds = await prisma.match.findMany({
        where: {
          eventId,
          status: { not: 'CANCELLED' },
          OR: [{ user1Id: userId }, { user2Id: userId }],
        },
        select: { user1Id: true, user2Id: true },
      });

      const priorPairs = new Set(
        existingMatchUserIds.flatMap((m) => [m.user1Id, m.user2Id]).filter((id) => id !== userId)
      );

      const candidates = idleUsers.filter((ue) => !priorPairs.has(ue.userId));

      if (candidates.length === 0) {
        logger.info({ type: 'no_eligible_candidates', userId, eventId });
        return null;
      }

      const randomIndex = Math.floor(Math.random() * candidates.length);
      const candidateUe = candidates[randomIndex];
      if (!candidateUe) return null;

      const candidateUser = candidateUe.user;
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, interests: true },
      });
      if (!currentUser) return null;

      const prompt = await PromptSelectionService.select(currentUser, candidateUser, eventId);

      const match = await prisma.$transaction(async (tx) => {
        const latestCandidate = await tx.userEvent.findUnique({
          where: { userId_eventId: { userId: candidateUser.id, eventId } },
        });
        if (!latestCandidate || latestCandidate.status !== 'IDLE') return null;

        const newMatch = await tx.match.create({
          data: {
            eventId,
            user1Id: userId,
            user2Id: candidateUser.id,
            promptId: prompt.id,
            status: 'PENDING',
          },
        });

        await tx.userEvent.update({
          where: { userId_eventId: { userId, eventId } },
          data: { status: 'ENGAGED' },
        });
        await tx.userEvent.update({
          where: { userId_eventId: { userId: candidateUser.id, eventId } },
          data: { status: 'ENGAGED' },
        });

        return newMatch;
      });

      if (!match) {
        logger.warn({ type: 'match_transaction_failed', userId, eventId });
        return null;
      }

      const currentUserFull = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, company: true, interests: true },
      });

      const partnerHintsForUser1 = {
        partnerId: candidateUser.id,
        role: candidateUser.role,
        company: candidateUser.company,
        interests: candidateUser.interests,
      };
      const partnerHintsForUser2 = {
        partnerId: userId,
        role: currentUser.role,
        company: currentUserFull?.company ?? '',
        interests: currentUser.interests ?? [],
      };
      const promptPayload = {
        id: prompt.id,
        text: prompt.text,
        followUp: prompt.followUp,
        category: prompt.category,
        depth: prompt.depth,
        energy: prompt.energy,
      };

      io.to(`user:${userId}`).emit('match:found', {
        matchId: match.id,
        partnerHints: partnerHintsForUser1,
        prompt: promptPayload,
      });
      io.to(`user:${candidateUser.id}`).emit('match:found', {
        matchId: match.id,
        partnerHints: partnerHintsForUser2,
        prompt: promptPayload,
      });

      return match;
    });
  },
};

import { Server } from 'socket.io';
import prisma from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { withTelemetry } from '../utils/withTelemetry';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from '../socket/types';

type IoType = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export const MatchService = {
  async confirmMatch(matchId: string, userId: string, io: IoType) {
    return withTelemetry('MatchService', 'confirmMatch', { matchId, userId }, async () => {
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
          prompt: true,
          user1: { select: { role: true, company: true, interests: true } },
          user2: { select: { role: true, company: true, interests: true } },
        },
      });
      if (!match) throw new AppError(404, 'MATCH_NOT_FOUND', `Match ${matchId} not found`);
      if (match.status !== 'PENDING') return;

      const isUser1 = match.user1Id === userId;
      const partnerId = isUser1 ? match.user2Id : match.user1Id;

      io.to(`user:${partnerId}`).emit('match:partner_ready', { matchId });

      const pendingPartnerCheck = await prisma.match.findUnique({ where: { id: matchId } });
      const partnerAlreadyConfirmed = pendingPartnerCheck?.status === 'ACTIVE';

      if (partnerAlreadyConfirmed) return;

      const updatedMatch = await prisma.match.update({
        where: { id: matchId, status: 'PENDING' },
        data: { status: 'ACTIVE', startedAt: new Date() },
      });

      await Promise.all([
        prisma.userEvent.update({
          where: {
            userId_eventId: { userId: match.user1Id, eventId: match.eventId },
          },
          data: { status: 'ENGAGED' },
        }),
        prisma.userEvent.update({
          where: {
            userId_eventId: { userId: match.user2Id, eventId: match.eventId },
          },
          data: { status: 'ENGAGED' },
        }),
      ]);

      const promptPayload = {
        id: match.prompt.id,
        text: match.prompt.text,
        followUp: match.prompt.followUp,
        category: match.prompt.category,
        depth: match.prompt.depth,
        energy: match.prompt.energy,
      };

      io.to(`user:${match.user1Id}`).emit('match:active', {
        matchId: updatedMatch.id,
        prompt: promptPayload,
      });
      io.to(`user:${match.user2Id}`).emit('match:active', {
        matchId: updatedMatch.id,
        prompt: promptPayload,
      });
    });
  },

  async endConversation(matchId: string, userId: string, io: IoType) {
    return withTelemetry('MatchService', 'endConversation', { matchId, userId }, async () => {
      const match = await prisma.match.findUnique({ where: { id: matchId } });
      if (!match) throw new AppError(404, 'MATCH_NOT_FOUND', `Match ${matchId} not found`);
      if (match.status !== 'ACTIVE') return;

      await prisma.$transaction([
        prisma.match.update({
          where: { id: matchId },
          data: { status: 'COMPLETED', completedAt: new Date() },
        }),
        prisma.userEvent.update({
          where: { userId_eventId: { userId: match.user1Id, eventId: match.eventId } },
          data: { status: 'IDLE' },
        }),
        prisma.userEvent.update({
          where: { userId_eventId: { userId: match.user2Id, eventId: match.eventId } },
          data: { status: 'IDLE' },
        }),
      ]);

      io.to(`user:${match.user1Id}`).emit('match:ended', { matchId });
      io.to(`user:${match.user2Id}`).emit('match:ended', { matchId });
    });
  },

  async cancelMatch(matchId: string, disconnectedUserId: string, io: IoType) {
    return withTelemetry('MatchService', 'cancelMatch', { matchId, disconnectedUserId }, async () => {
      const match = await prisma.match.findUnique({ where: { id: matchId } });
      if (!match) return;
      if (!['PENDING', 'ACTIVE'].includes(match.status)) return;

      const partnerId =
        match.user1Id === disconnectedUserId ? match.user2Id : match.user1Id;

      await prisma.$transaction([
        prisma.match.update({
          where: { id: matchId },
          data: { status: 'CANCELLED' },
        }),
        prisma.userEvent.update({
          where: { userId_eventId: { userId: partnerId, eventId: match.eventId } },
          data: { status: 'IDLE' },
        }),
      ]);

      io.to(`user:${partnerId}`).emit('match:cancelled', { matchId });
    });
  },
};

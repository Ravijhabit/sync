import { Server } from 'socket.io';
import prisma from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { withTelemetry } from '../utils/withTelemetry';
import type { CreateLearningBody, ReviewLearningBody } from '../validators/learning';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from '../socket/types';

type IoType = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export const LearningService = {
  async create(learnerId: string, body: CreateLearningBody, io: IoType) {
    return withTelemetry('LearningService', 'create', { matchId: body.matchId }, async () => {
      const match = await prisma.match.findUnique({
        where: { id: body.matchId },
        include: { event: true },
      });
      if (!match) throw new AppError(404, 'MATCH_NOT_FOUND', 'Match not found');
      if (match.event.status === 'COMPLETED') {
        throw new AppError(403, 'EVENT_COMPLETED', 'Event is completed — no further submissions');
      }

      const existing = await prisma.learning.findUnique({
        where: { matchId_learnerId: { matchId: body.matchId, learnerId } },
      });
      if (existing) throw new AppError(409, 'DUPLICATE_LEARNING', 'Learning already submitted for this match');

      const learning = await prisma.learning.create({
        data: {
          matchId: body.matchId,
          learnerId,
          targetId: body.targetId,
          content: body.content,
          justification: body.justification,
        },
      });

      io.to(`user:${body.targetId}`).emit('learning:review_ready', { learningId: learning.id });

      return learning;
    });
  },

  async getById(learningId: string, requesterId: string) {
    return withTelemetry('LearningService', 'getById', { learningId }, async () => {
      const learning = await prisma.learning.findUnique({ where: { id: learningId } });
      if (!learning) throw new AppError(404, 'LEARNING_NOT_FOUND', 'Learning not found');
      if (learning.learnerId !== requesterId && learning.targetId !== requesterId) {
        throw new AppError(403, 'FORBIDDEN', 'Access denied');
      }
      return learning;
    });
  },

  async review(learningId: string, reviewerId: string, body: ReviewLearningBody) {
    return withTelemetry('LearningService', 'review', { learningId }, async () => {
      const learning = await prisma.learning.findUnique({
        where: { id: learningId },
        include: { match: { include: { event: true } } },
      });
      if (!learning) throw new AppError(404, 'LEARNING_NOT_FOUND', 'Learning not found');
      if (learning.match.event.status === 'COMPLETED') {
        throw new AppError(403, 'EVENT_COMPLETED', 'Event is completed — no further reviews');
      }
      if (learning.targetId !== reviewerId) {
        throw new AppError(403, 'FORBIDDEN', 'Only the target can review this learning');
      }

      return prisma.learning.update({
        where: { id: learningId },
        data: {
          rating: body.rating,
          feedback: body.feedback,
          isCorrect: body.isCorrect,
          reviewedAt: new Date(),
        },
      });
    });
  },

  async setMeaningful(matchId: string, userId: string, meaningful: boolean) {
    return withTelemetry('LearningService', 'setMeaningful', { matchId }, async () => {
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: { event: true },
      });
      if (!match) throw new AppError(404, 'MATCH_NOT_FOUND', 'Match not found');
      if (match.event.status === 'COMPLETED') {
        throw new AppError(403, 'EVENT_COMPLETED', 'Event is completed');
      }

      const isUser1 = match.user1Id === userId;
      const isUser2 = match.user2Id === userId;
      if (!isUser1 && !isUser2) throw new AppError(403, 'FORBIDDEN', 'Not a participant in this match');

      return prisma.match.update({
        where: { id: matchId },
        data: isUser1 ? { user1Meaningful: meaningful } : { user2Meaningful: meaningful },
      });
    });
  },
};

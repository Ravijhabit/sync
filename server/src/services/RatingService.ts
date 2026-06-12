import prisma from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { withTelemetry } from '../utils/withTelemetry';

export const RatingService = {
  async getReceived(userId: string, eventId: string) {
    return withTelemetry('RatingService', 'getReceived', { userId, eventId }, async () => {
      const event = await prisma.event.findUnique({ where: { id: eventId } });
      if (!event) throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
      if (event.status === 'ONGOING' || event.status === 'CLOSING') {
        throw new AppError(403, 'RATINGS_HIDDEN', 'Received ratings are hidden until the event ends');
      }

      const learnings = await prisma.learning.findMany({
        where: { targetId: userId, match: { eventId } },
        include: {
          learner: { select: { name: true, role: true, company: true } },
          match: { select: { createdAt: true } },
        },
        orderBy: { submittedAt: 'desc' },
      });

      return learnings.map((l) => ({
        id: l.id,
        content: l.content,
        justification: l.justification,
        rating: l.rating,
        feedback: l.feedback,
        isCorrect: l.isCorrect,
        submittedAt: l.submittedAt,
        reviewedAt: l.reviewedAt,
        reviewer: l.learner,
        matchDate: l.match.createdAt,
      }));
    });
  },

  async getGiven(userId: string, eventId: string) {
    return withTelemetry('RatingService', 'getGiven', { userId, eventId }, async () => {
      const learnings = await prisma.learning.findMany({
        where: { learnerId: userId, match: { eventId } },
        include: {
          target: { select: { name: true, role: true, company: true } },
          match: { select: { createdAt: true } },
        },
        orderBy: { submittedAt: 'desc' },
      });

      return learnings.map((l) => ({
        id: l.id,
        content: l.content,
        justification: l.justification,
        rating: l.rating,
        feedback: l.feedback,
        isCorrect: l.isCorrect,
        submittedAt: l.submittedAt,
        target: l.target,
        matchDate: l.match.createdAt,
      }));
    });
  },
};

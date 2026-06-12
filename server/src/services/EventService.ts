import prisma from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { withTelemetry } from '../utils/withTelemetry';
import type { EventStatus } from '@prisma/client';

export interface TelemetryCtx {
  userId?: string;
  sessionId?: string;
}

export const EventService = {
  async listActive(ctx: TelemetryCtx = {}) {
    return withTelemetry('EventService', 'listActive', {}, async () => {
      const statuses: EventStatus[] = ['UPCOMING', 'ONGOING'];
      return prisma.event.findMany({
        where: { status: { in: statuses } },
        orderBy: { startTime: 'asc' },
      });
    }, ctx);
  },

  async getById(eventId: string, ctx: TelemetryCtx = {}) {
    return withTelemetry('EventService', 'getById', { eventId }, async () => {
      const event = await prisma.event.findUnique({ where: { id: eventId } });
      if (!event) throw new AppError(404, 'EVENT_NOT_FOUND', `Event ${eventId} not found`);
      return event;
    }, ctx);
  },

  async getAttendees(
    eventId: string,
    page: number,
    limit: number,
    ctx: TelemetryCtx = {}
  ) {
    return withTelemetry('EventService', 'getAttendees', { eventId }, async () => {
      const [total, attendees] = await Promise.all([
        prisma.userEvent.count({ where: { eventId } }),
        prisma.userEvent.findMany({
          where: { eventId },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                role: true,
                company: true,
                avatarUrl: true,
              },
            },
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { joinedAt: 'asc' },
        }),
      ]);

      return {
        total,
        page,
        limit,
        attendees: attendees.map((ue) => ({ ...ue.user, status: ue.status })),
      };
    }, ctx);
  },
};

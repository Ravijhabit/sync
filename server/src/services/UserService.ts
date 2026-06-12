import { Server } from 'socket.io';
import prisma from '../lib/prisma';
import { withTelemetry } from '../utils/withTelemetry';
import { MatchService } from './MatchService';
import logger from '../utils/logger';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from '../socket/types';

type IoType = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const offlineTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const UserService = {
  async resolveEventId(userId: string): Promise<string | null> {
    const ue = await prisma.userEvent.findFirst({
      where: { userId, status: { not: 'OFFLINE' } },
      orderBy: { joinedAt: 'desc' },
    });
    return ue?.eventId ?? null;
  },

  async setIdle(userId: string, eventId: string) {
    return withTelemetry('UserService', 'setIdle', { userId, eventId }, async () => {
      await prisma.userEvent.update({
        where: { userId_eventId: { userId, eventId } },
        data: { status: 'IDLE' },
      });
    });
  },

  async setEngaged(userId: string, eventId: string) {
    await prisma.userEvent.update({
      where: { userId_eventId: { userId, eventId } },
      data: { status: 'ENGAGED' },
    });
  },

  async setOffline(userId: string, eventId: string) {
    await prisma.userEvent.update({
      where: { userId_eventId: { userId, eventId } },
      data: { status: 'OFFLINE' },
    });
  },

  async handleDisconnect(userId: string, eventId: string, io: IoType) {
    return withTelemetry('UserService', 'handleDisconnect', { userId, eventId }, async () => {
      const ue = await prisma.userEvent.findUnique({
        where: { userId_eventId: { userId, eventId } },
      });
      if (!ue) return;

      if (ue.status === 'ENGAGED') {
        const activeMatch = await prisma.match.findFirst({
          where: {
            eventId,
            status: 'ACTIVE',
            OR: [{ user1Id: userId }, { user2Id: userId }],
          },
        });
        if (activeMatch) {
          await MatchService.cancelMatch(activeMatch.id, userId, io);
        }
      } else if (ue.status === 'IDLE') {
        const timer = setTimeout(async () => {
          offlineTimers.delete(userId);
          try {
            await UserService.setOffline(userId, eventId);
            io.to(`user:${userId}`).emit('user:offline', { userId });
            logger.info({ type: 'user_offline', userId, eventId });
          } catch (err) {
            logger.error({ type: 'offline_timer_error', userId, err });
          }
        }, 2 * 60 * 1000);

        offlineTimers.set(userId, timer);
      }
    });
  },

  cancelOfflineTimer(userId: string) {
    const timer = offlineTimers.get(userId);
    if (timer) {
      clearTimeout(timer);
      offlineTimers.delete(userId);
    }
  },

  async getCurrentState(
    userId: string,
    eventId: string
  ): Promise<
    | { type: 'PENDING_MATCH'; payload: object }
    | { type: 'ACTIVE_MATCH'; payload: object }
    | { type: 'EVENT_CLOSING'; payload: object }
    | { type: 'EVENT_COMPLETED'; payload: object }
    | { type: 'USER_OFFLINE'; payload: object }
    | null
  > {
    const [ue, event] = await Promise.all([
      prisma.userEvent.findUnique({ where: { userId_eventId: { userId, eventId } } }),
      prisma.event.findUnique({ where: { id: eventId } }),
    ]);

    if (!ue || !event) return null;

    if (ue.status === 'OFFLINE') {
      return { type: 'USER_OFFLINE', payload: { userId } };
    }

    if (event.status === 'COMPLETED') {
      return { type: 'EVENT_COMPLETED', payload: { eventId } };
    }

    if (event.status === 'CLOSING') {
      const secondsRemaining = Math.max(
        0,
        Math.floor((event.endTime.getTime() - Date.now()) / 1000)
      );
      return { type: 'EVENT_CLOSING', payload: { eventId, secondsRemaining } };
    }

    const activeMatch = await prisma.match.findFirst({
      where: {
        eventId,
        status: { in: ['PENDING', 'ACTIVE'] },
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
      include: {
        prompt: true,
        user1: { select: { role: true, company: true, interests: true } },
        user2: { select: { role: true, company: true, interests: true } },
      },
    });

    if (!activeMatch) return null;

    const partner = activeMatch.user1Id === userId ? activeMatch.user2 : activeMatch.user1;
    const partnerHints = {
      role: partner.role,
      company: partner.company,
      interests: partner.interests,
    };
    const prompt = {
      id: activeMatch.prompt.id,
      text: activeMatch.prompt.text,
      followUp: activeMatch.prompt.followUp,
      category: activeMatch.prompt.category,
      depth: activeMatch.prompt.depth,
      energy: activeMatch.prompt.energy,
    };

    if (activeMatch.status === 'PENDING') {
      return {
        type: 'PENDING_MATCH',
        payload: { matchId: activeMatch.id, partnerHints, prompt },
      };
    }

    return {
      type: 'ACTIVE_MATCH',
      payload: { matchId: activeMatch.id, prompt },
    };
  },
};

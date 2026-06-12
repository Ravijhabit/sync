import { Server } from 'socket.io';
import prisma from '../lib/prisma';
import logger from '../utils/logger';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from '../socket/types';

type IoType = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export class EventTimerService {
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor(private readonly io: IoType) {}

  async init() {
    const events = await prisma.event.findMany({
      where: { status: { not: 'COMPLETED' } },
    });

    for (const event of events) {
      this.scheduleEvent(event);
    }

    logger.info({ type: 'event_timer_init', count: events.length });
  }

  private scheduleEvent(event: {
    id: string;
    startTime: Date;
    endTime: Date;
    status: string;
  }) {
    const now = Date.now();
    const { id: eventId, startTime, endTime, status } = event;
    const closingTime = endTime.getTime() - 2 * 60 * 1000;

    if (status === 'UPCOMING' && startTime.getTime() > now) {
      this.scheduleTimer(startTime.getTime() - now, () =>
        this.transitionOngoing(eventId)
      );
    }

    if (['UPCOMING', 'ONGOING'].includes(status) && closingTime > now) {
      this.scheduleTimer(closingTime - now, () =>
        this.transitionClosing(eventId, endTime)
      );
    }

    if (['UPCOMING', 'ONGOING', 'CLOSING'].includes(status) && endTime.getTime() > now) {
      this.scheduleTimer(endTime.getTime() - now, () =>
        this.transitionCompleted(eventId)
      );
    }
  }

  private scheduleTimer(delayMs: number, fn: () => Promise<void>) {
    const t = setTimeout(() => {
      fn().catch((err) =>
        logger.error({ type: 'event_timer_error', err })
      );
    }, delayMs);
    this.timers.push(t);
  }

  private async transitionOngoing(eventId: string) {
    await prisma.event.update({
      where: { id: eventId },
      data: { status: 'ONGOING' },
    });
    logger.info({ type: 'event_status', eventId, status: 'ONGOING' });
  }

  private async transitionClosing(eventId: string, endTime: Date) {
    await prisma.event.update({
      where: { id: eventId },
      data: { status: 'CLOSING' },
    });
    const secondsRemaining = Math.max(0, Math.floor((endTime.getTime() - Date.now()) / 1000));
    this.io.to(`event:${eventId}`).emit('event:closing', { eventId, secondsRemaining });
    logger.info({ type: 'event_status', eventId, status: 'CLOSING', secondsRemaining });
  }

  private async transitionCompleted(eventId: string) {
    await prisma.event.update({
      where: { id: eventId },
      data: { status: 'COMPLETED' },
    });
    this.io.to(`event:${eventId}`).emit('event:completed', { eventId });
    logger.info({ type: 'event_status', eventId, status: 'COMPLETED' });
  }

  destroy() {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }
}

import { EventTimerService } from '../src/services/EventTimerService';
import { testPrisma, createTestEvent, cleanDatabase } from './factories';
import { Server } from 'socket.io';

let mockIo: Server;
const emits: { room: string; event: string; payload: unknown }[] = [];

beforeAll(() => {
  mockIo = {
    to: (room: string) => ({
      emit: (event: string, payload: unknown) => {
        emits.push({ room, event, payload });
      },
    }),
  } as unknown as Server;
});

beforeEach(async () => {
  // doNotFake keeps setImmediate/nextTick real so Prisma I/O can proceed
  jest.useFakeTimers({ doNotFake: ['setImmediate', 'clearImmediate', 'nextTick'] });
  emits.length = 0;
  await cleanDatabase();
});

afterEach(async () => {
  jest.useRealTimers();
});

afterAll(async () => {
  await testPrisma.$disconnect();
});

describe('EventTimerService', () => {
  it('transitions UPCOMING → ONGOING → CLOSING → COMPLETED', async () => {
    const now = Date.now();
    const event = await createTestEvent({
      status: 'UPCOMING',
      startTime: new Date(now + 1_000),
      endTime: new Date(now + 200_000),
    });

    const svc = new EventTimerService(mockIo);
    await svc.init();

    await jest.advanceTimersByTimeAsync(1_000);

    let dbEvent = await testPrisma.event.findUnique({ where: { id: event.id } });
    expect(dbEvent?.status).toBe('ONGOING');

    await jest.advanceTimersByTimeAsync(79_000);

    dbEvent = await testPrisma.event.findUnique({ where: { id: event.id } });
    expect(dbEvent?.status).toBe('CLOSING');
    expect(emits.some((e) => e.event === 'event:closing')).toBe(true);

    await jest.advanceTimersByTimeAsync(120_000);

    dbEvent = await testPrisma.event.findUnique({ where: { id: event.id } });
    expect(dbEvent?.status).toBe('COMPLETED');
    expect(emits.some((e) => e.event === 'event:completed')).toBe(true);

    svc.destroy();
  });

  it('is resilient to restart — schedules remaining timers from now', async () => {
    const now = Date.now();
    const event = await createTestEvent({
      status: 'ONGOING',
      startTime: new Date(now - 60_000),
      endTime: new Date(now + 60_000),
    });

    const svc = new EventTimerService(mockIo);
    await svc.init();

    await jest.advanceTimersByTimeAsync(60_000);

    const dbEvent = await testPrisma.event.findUnique({ where: { id: event.id } });
    expect(dbEvent?.status).toBe('COMPLETED');

    svc.destroy();
  });
});

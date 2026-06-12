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
  jest.useFakeTimers();
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

    jest.advanceTimersByTime(1_000);
    await Promise.resolve();

    let dbEvent = await testPrisma.event.findUnique({ where: { id: event.id } });
    expect(dbEvent?.status).toBe('ONGOING');

    jest.advanceTimersByTime(79_000);
    await Promise.resolve();

    dbEvent = await testPrisma.event.findUnique({ where: { id: event.id } });
    expect(dbEvent?.status).toBe('CLOSING');
    expect(emits.some((e) => e.event === 'event:closing')).toBe(true);

    jest.advanceTimersByTime(120_000);
    await Promise.resolve();

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

    jest.advanceTimersByTime(60_000);
    await Promise.resolve();

    const dbEvent = await testPrisma.event.findUnique({ where: { id: event.id } });
    expect(dbEvent?.status).toBe('COMPLETED');

    svc.destroy();
  });
});

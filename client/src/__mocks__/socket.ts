import { EventEmitter } from 'events';
import type { AppSocket } from '../hooks/types';

class MockSocket extends EventEmitter {
  connected = false;
  id = 'mock-socket-id';

  connect() {
    this.connected = true;
    this.emit('connect');
    return this;
  }

  disconnect() {
    this.connected = false;
    this.emit('disconnect');
    return this;
  }

  on(event: string, listener: (...args: unknown[]) => void): this {
    return super.on(event, listener);
  }

  off(event: string, listener: (...args: unknown[]) => void): this {
    return super.off(event, listener);
  }
}

export const mockSocket = new MockSocket() as unknown as AppSocket & MockSocket;

export function createMockSocket(): AppSocket & MockSocket {
  return new MockSocket() as unknown as AppSocket & MockSocket;
}

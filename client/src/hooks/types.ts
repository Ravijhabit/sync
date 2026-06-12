import type { Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '../socket/types';
import type React from 'react';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface SocketContextValue {
  socket: AppSocket | null;
  connected: boolean;
}

export interface SocketProviderProps {
  children: React.ReactNode;
}

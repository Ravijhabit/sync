import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../services/AuthService';
import { UserService } from '../services/UserService';
import { MatchingEngine } from '../services/MatchingEngine';
import { MatchService } from '../services/MatchService';
import logger from '../utils/logger';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from './types';

type SyncServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type SyncSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

let io: SyncServer;

export function initSocketServer(httpServer: HttpServer): SyncServer {
  io = new Server(httpServer, {
    cors: {
      origin: process.env['CLIENT_URL'],
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const cookies = socket.request.headers.cookie ?? '';
      const tokenMatch = cookies.match(/(?:^|;\s*)token=([^;]+)/);
      const token = tokenMatch?.[1];
      if (!token) return next(new Error('UNAUTHORIZED'));

      const payload = AuthService.verifyToken(token);
      socket.data.userId = payload.userId;
      socket.data.sessionId = payload.sessionId;
      next();
    } catch {
      next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', async (socket: SyncSocket) => {
    const { userId, sessionId } = socket.data;

    try {
      const eventId = await UserService.resolveEventId(userId);
      if (!eventId) {
        socket.disconnect();
        return;
      }
      socket.data.eventId = eventId;

      await socket.join(`event:${eventId}`);
      await socket.join(`user:${userId}`);

      UserService.cancelOfflineTimer(userId);

      logger.info({ type: 'socket_connect', userId, sessionId, eventId });

      await reconnectHandler(socket, userId, eventId);
    } catch (err) {
      logger.error({ type: 'socket_connect_error', userId, err });
      socket.disconnect();
      return;
    }

    socket.on('user:set_idle', async () => {
      try {
        await MatchingEngine.handleIdle(userId, socket.data.eventId, io);
      } catch (err) {
        logger.error({ type: 'socket_handler_error', event: 'user:set_idle', userId, err });
      }
    });

    socket.on('user:found_partner', async ({ matchId }) => {
      try {
        await MatchService.confirmMatch(matchId, userId, io);
      } catch (err) {
        logger.error({ type: 'socket_handler_error', event: 'user:found_partner', userId, err });
      }
    });

    socket.on('user:end_conversation', async ({ matchId }) => {
      try {
        await MatchService.endConversation(matchId, userId, io);
      } catch (err) {
        logger.error({ type: 'socket_handler_error', event: 'user:end_conversation', userId, err });
      }
    });

    socket.on('disconnect', async () => {
      logger.info({ type: 'socket_disconnect', userId });
      try {
        await UserService.handleDisconnect(userId, socket.data.eventId, io);
      } catch (err) {
        logger.error({ type: 'socket_disconnect_error', userId, err });
      }
    });
  });

  return io;
}

async function reconnectHandler(socket: SyncSocket, userId: string, eventId: string): Promise<void> {
  const state = await UserService.getCurrentState(userId, eventId);
  if (!state) return;

  if (state.type === 'PENDING_MATCH') {
    const p = state.payload as Parameters<ServerToClientEvents['match:found']>[0];
    socket.emit('match:found', p);
  } else if (state.type === 'ACTIVE_MATCH') {
    const p = state.payload as Parameters<ServerToClientEvents['match:active']>[0];
    socket.emit('match:active', p);
  } else if (state.type === 'EVENT_CLOSING') {
    const p = state.payload as Parameters<ServerToClientEvents['event:closing']>[0];
    socket.emit('event:closing', p);
  } else if (state.type === 'EVENT_COMPLETED') {
    const p = state.payload as Parameters<ServerToClientEvents['event:completed']>[0];
    socket.emit('event:completed', p);
  } else if (state.type === 'USER_OFFLINE') {
    socket.emit('user:offline', { userId });
  }
}

export function getIo(): SyncServer {
  return io;
}

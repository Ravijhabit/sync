import 'dotenv/config';
import http from 'http';
import app from './app';
import { initSocketServer } from './socket/server';
import { EventTimerService } from './services/EventTimerService';
import logger from './utils/logger';

const PORT = process.env['PORT'] ?? 4000;

const server = http.createServer(app);
const io = initSocketServer(server);

server.listen(PORT, async () => {
  logger.info({ type: 'server_start', port: PORT });

  const timerService = new EventTimerService(io);
  await timerService.init();
});

export { server };

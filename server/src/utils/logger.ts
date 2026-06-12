import pino, { LoggerOptions } from 'pino';

const options: LoggerOptions =
  process.env['NODE_ENV'] !== 'production'
    ? {
        level: process.env['LOG_LEVEL'] ?? 'info',
        transport: { target: 'pino-pretty', options: { colorize: true } },
      }
    : { level: process.env['LOG_LEVEL'] ?? 'info' };

const logger = pino(options);

export default logger;

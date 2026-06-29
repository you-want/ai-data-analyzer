import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import * as winston from 'winston';

export interface LogEntry {
  timestamp: string;
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  service: string;
  environment: string;
  requestId?: string;
  userId?: string;
  workspaceId?: string;
  message: string;
  error?: {
    name?: string;
    message?: string;
    stack?: string;
  };
  metadata?: Record<string, unknown>;
}

@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
        winston.format.json(),
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(
              ({
                timestamp,
                level,
                message,
                ...meta
              }: {
                timestamp: string;
                level: string;
                message: string;
                [key: string]: unknown;
              }) => {
                const metaStr = Object.keys(meta).length
                  ? ` ${JSON.stringify(meta)}`
                  : '';
                return `${timestamp} [${level}] ${message}${metaStr}`;
              },
            ),
          ),
        }),
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          maxsize: 1024 * 1024 * 10,
          maxFiles: 5,
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
          maxsize: 1024 * 1024 * 10,
          maxFiles: 5,
        }),
      ],
    });
  }

  log(message: string, context?: string) {
    this.logger.info(message, { service: context || 'app' });
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, {
      service: context || 'app',
      error: { stack: trace },
    });
  }

  warn(message: string, context?: string) {
    this.logger.warn(message, { service: context || 'app' });
  }

  debug(message: string, context?: string) {
    this.logger.debug(message, { service: context || 'app' });
  }

  verbose(message: string, context?: string) {
    this.logger.verbose(message, { service: context || 'app' });
  }

  info(message: string, context?: string, metadata?: Record<string, unknown>) {
    this.logger.info(message, {
      service: context || 'app',
      metadata,
    });
  }

  logWithContext(
    message: string,
    context: {
      userId?: string;
      workspaceId?: string;
      requestId?: string;
      service?: string;
    },
    level: 'trace' | 'debug' | 'info' | 'warn' | 'error' = 'info',
  ) {
    this.logger.log(level, message, {
      service: context.service || 'app',
      userId: context.userId,
      workspaceId: context.workspaceId,
      requestId: context.requestId,
      environment: process.env.NODE_ENV || 'development',
      metadata: {},
    });
  }
}

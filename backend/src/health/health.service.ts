import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { User } from '../auth/entities/user.entity';

interface HealthCheckError {
  message?: string;
}

@Injectable()
export class HealthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private configService: ConfigService,
  ) {}

  async deepHealthCheck() {
    const checks: Record<string, { status: 'up' | 'down'; message?: string }> =
      {};

    try {
      await this.userRepository.query('SELECT 1');
      checks.database = { status: 'up', message: 'PostgreSQL connection OK' };
    } catch (error) {
      const err = error as HealthCheckError;
      checks.database = {
        status: 'down',
        message: `PostgreSQL connection failed: ${err.message}`,
      };
    }

    try {
      const redis = new Redis({
        host: this.configService.get('REDIS_HOST', 'localhost'),
        port: Number(this.configService.get('REDIS_PORT', 6379)),
        password: this.configService.get('REDIS_PASSWORD') || undefined,
      });
      await redis.ping();
      await redis.quit();
      checks.redis = { status: 'up', message: 'Redis connection OK' };
    } catch (error) {
      const err = error as HealthCheckError;
      checks.redis = {
        status: 'down',
        message: `Redis connection failed: ${err.message}`,
      };
    }

    try {
      const bullRedis = new Redis({
        host: this.configService.get('REDIS_HOST', 'localhost'),
        port: Number(this.configService.get('REDIS_PORT', 6379)),
        password: this.configService.get('REDIS_PASSWORD') || undefined,
      });
      await bullRedis.ping();
      await bullRedis.quit();
      checks.queue = { status: 'up', message: 'BullMQ connection OK' };
    } catch (error) {
      const err = error as HealthCheckError;
      checks.queue = {
        status: 'down',
        message: `BullMQ connection failed: ${err.message}`,
      };
    }

    const allUp = Object.values(checks).every((c) => c.status === 'up');

    return {
      status: allUp ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    };
  }
}

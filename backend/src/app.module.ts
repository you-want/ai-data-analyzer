import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AnalysisModule } from './analysis/analysis.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalysisResultsModule } from './analysis-results/analysis-results.module';
import { OpenAIModule } from './openai/openai.module';
import { DataModule } from './data/data.module';
import { MultiAgentModule } from './multi-agent/multi-agent.module';
import { BullModule } from '@nestjs/bullmq';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { AuthModule } from './auth/auth.module';
import { CodeExecutionModule } from './code-execution/code-execution.module';
import { KnowledgeBaseModule } from './knowledge-base/knowledge-base.module';
import { BillingModule } from './billing/billing.module';
import { TenantContextInterceptor } from './tenant/tenant-context.interceptor';
import { TenantModule } from './tenant/tenant.module';
import { LoggerModule } from './logger/logger.module';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';
import { MetricsInterceptor } from './metrics/metrics.interceptor';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { CryptoModule } from './crypto/crypto.module';
import { SupportModule } from './support/support.module';
import { TenacityModule } from './tenacity/tenacity.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        const redisPassword = configService.get<string>('REDIS_PASSWORD');
        const redisHost = configService.get<string>('REDIS_HOST', 'localhost');
        const redisPort = Number(configService.get<number>('REDIS_PORT', 6379));
        console.log('[DEBUG] BullModule config:', {
          host: redisHost,
          port: redisPort,
          hasPassword: !!redisPassword,
        });
        const config: Record<string, unknown> = {
          host: redisHost,
          port: redisPort,
        };
        if (redisPassword) {
          config.password = redisPassword;
        }
        return {
          connection: config,
        };
      },
      inject: [ConfigService],
    }),
    AnalysisModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const redisPassword = configService.get<string>('REDIS_PASSWORD');
        const store = await redisStore({
          socket: {
            host: configService.get<string>('REDIS_HOST', 'localhost'),
            port: Number(configService.get<number>('REDIS_PORT', 6379)),
          },
          ...(redisPassword && { password: redisPassword }),
        });
        return {
          store,
          ttl: 3600000,
        };
      },
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DATABASE_HOST', 'localhost'),
        port: Number(config.get('DATABASE_PORT', 5432)),
        username: config.get<string>('DATABASE_USER'),
        password: config.get<string>('DATABASE_PASSWORD'),
        database: config.get<string>('DATABASE_NAME'),
        autoLoadEntities: true,
        synchronize: false,
        logging: ['error'],
        retryAttempts: 15,
        retryDelay: 3000,
      }),
    }),
    AnalysisResultsModule,
    OpenAIModule,
    DataModule,
    AuthModule,
    CodeExecutionModule,
    KnowledgeBaseModule,
    BillingModule,
    MultiAgentModule,
    TenantModule,
    LoggerModule,
    HealthModule,
    MetricsModule,
    CryptoModule,
    SupportModule,
    TenacityModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantContextInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

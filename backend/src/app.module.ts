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

@Module({
  imports: [
    AnalysisModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const store = await redisStore({
          socket: {
            host: configService.get('REDIS_HOST', 'localhost'),
            port: Number(configService.get('REDIS_PORT', 6379)),
          },
        });
        return {
          store,
          ttl: 3600000, // 默认 1 小时缓存 (ms)
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
    BullModule.forRoot({
      connection: {
        host: 'localhost',
        port: 6379,
      },
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
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantContextInterceptor,
    },
  ],
})
export class AppModule {}

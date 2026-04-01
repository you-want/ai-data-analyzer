import 'dotenv/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);

  // 开启微服务监听 (混合应用模式)
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.REDIS,
    options: {
      host: configService.get<string>('REDIS_HOST', 'localhost'),
      port: Number(configService.get<number>('REDIS_PORT', 6379)),
    },
  });

  // 开启 CORS 允许前端跨域请求
  app.enableCors({
    origin: 'http://localhost:3000', // 允许 Next.js 前端地址
    credentials: true,
  });

  // 启用全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // 自动剔除 DTO 中未定义的属性，增加安全性
    }),
  );

  await app.startAllMicroservices(); // 启动微服务
  new Logger('Bootstrap').log(`Microservice is listening via Redis transport`);

  const port = configService.get<number>('PORT') || 3001; // 防止和前端3000冲突
  await app.listen(port);
  new Logger('Bootstrap').log(`API listening on http://localhost:${port}`);
}
void bootstrap();

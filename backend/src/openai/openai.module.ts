import { Module } from '@nestjs/common';
import { OpenAIService } from './openai.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule], // 确保 ConfigModule 可用（如果是全局配置也可省略，但显式导入更安全）
  providers: [OpenAIService],
  exports: [OpenAIService], // 重要：导出服务供其他模块使用
})
export class OpenAIModule {}

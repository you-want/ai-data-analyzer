import { Module } from '@nestjs/common';
import { OpenAIService } from './openai.service';
import { ClaudeService } from './claude.service';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [ConfigModule], // 确保 ConfigModule 可用
  providers: [
    OpenAIService,
    ClaudeService,
    {
      provide: 'LLM_SERVICE', // 依赖注入的 Token
      useFactory: (
        configService: ConfigService,
        openai: OpenAIService,
        claude: ClaudeService,
      ) => {
        const activeModel = configService.get<string>('ACTIVE_LLM_PROVIDER');
        // 根据环境变量决定使用哪个模型服务，这里默认为 openai
        if (activeModel === 'claude') {
          return claude;
        }
        return openai;
      },
      inject: [ConfigService, OpenAIService, ClaudeService],
    },
  ],
  // 将原有的 OpenAIService 和 新的 LLM_SERVICE 一起导出，
  // 保证旧代码兼容的同时，允许新代码使用 LLM_SERVICE
  exports: [OpenAIService, 'LLM_SERVICE'],
})
export class OpenAIModule {}

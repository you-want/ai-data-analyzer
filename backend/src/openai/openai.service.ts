import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class OpenAIService {
  private readonly openai: OpenAI;
  private readonly logger = new Logger(OpenAIService.name);
  private readonly defaultModel: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const baseURL = this.configService.get<string>('OPENAI_BASE_URL');
    this.defaultModel =
      this.configService.get<string>('OPENAI_MODEL') || 'gpt-3.5-turbo';

    if (!apiKey) {
      this.logger.error('OPENAI_API_KEY is not defined');
      throw new Error('OPENAI_API_KEY is not defined');
    }

    this.openai = new OpenAI({
      apiKey,
      baseURL,
    });
  }

  /**
   * 发送聊天请求
   * @param content 用户输入的内容
   * @param model 模型名称，默认为 gpt-3.5-turbo
   */
  async chat(content: string, model?: string): Promise<string> {
    try {
      const completion = await this.openai.chat.completions.create({
        messages: [{ role: 'user', content }],
        model: model || this.defaultModel,
      });

      return completion.choices[0]?.message?.content || '';
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`OpenAI API call failed: ${errorMessage}`);
      throw error;
    }
  }
}

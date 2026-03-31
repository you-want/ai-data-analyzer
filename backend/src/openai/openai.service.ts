import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ILLMService } from './llm.interface';

@Injectable()
export class OpenAIService implements ILLMService {
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

  async chat(prompt: string, model?: string): Promise<string> {
    try {
      const targetModel =
        model ||
        this.configService.get<string>('OPENAI_MODEL') ||
        'gpt-3.5-turbo';

      this.logger.debug(`Sending prompt to OpenAI (Model: ${targetModel})`);
      this.logger.debug(`Prompt content: ${prompt.substring(0, 100)}...`);

      const response = await this.openai.chat.completions.create({
        model: targetModel,
        messages: [
          {
            role: 'system',
            content: '你是一个专业的数据分析AI助手。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const result = response.choices[0]?.message?.content || '';
      this.logger.debug(`OpenAI Response: ${result.substring(0, 100)}...`);
      return result;
    } catch (error) {
      this.logger.error('Failed to call OpenAI API', error);
      throw error;
    }
  }

  async chatStream(
    prompt: string,
    model?: string,
  ): Promise<AsyncIterable<string>> {
    try {
      const targetModel =
        model ||
        this.configService.get<string>('OPENAI_MODEL') ||
        'gpt-3.5-turbo';

      this.logger.debug(
        `Sending streaming prompt to OpenAI (Model: ${targetModel})`,
      );

      const response = await this.openai.chat.completions.create({
        model: targetModel,
        messages: [
          {
            role: 'system',
            content: '你是一个专业的数据分析AI助手。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        stream: true,
      });

      return {
        async *[Symbol.asyncIterator]() {
          for await (const chunk of response) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              yield content;
            }
          }
        },
      };
    } catch (error) {
      this.logger.error('Failed to call OpenAI API for streaming', error);
      throw error;
    }
  }
}

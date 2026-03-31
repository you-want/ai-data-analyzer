import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { ILLMService } from './llm.interface';

@Injectable()
export class ClaudeService implements ILLMService {
  private readonly anthropic: Anthropic;
  private readonly logger = new Logger(ClaudeService.name);

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');

    // 如果没有配置 Key，这里可能在真实使用时会报错，但在演示和依赖注入注册时是没问题的
    if (!apiKey) {
      this.logger.warn('ANTHROPIC_API_KEY is not configured.');
    }

    this.anthropic = new Anthropic({
      apiKey: apiKey || 'dummy-key-for-init',
    });
  }

  async chat(prompt: string, model?: string): Promise<string> {
    try {
      this.logger.debug(
        `Sending prompt to Claude (Model: ${model || 'claude-3-5-sonnet-20240620'})`,
      );

      const response = await this.anthropic.messages.create({
        model: model || 'claude-3-5-sonnet-20240620',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      // 注意：Anthropic SDK 返回的内容结构是一个数组，我们通常取第一个 text block
      const firstBlock = response.content[0];
      if (firstBlock.type === 'text') {
        return firstBlock.text;
      }
      return '';
    } catch (error) {
      this.logger.error('Failed to call Claude API', error);
      throw error;
    }
  }

  async chatStream(
    prompt: string,
    model?: string,
  ): Promise<AsyncIterable<string>> {
    try {
      this.logger.debug(
        `Sending streaming prompt to Claude (Model: ${model || 'claude-3-5-sonnet-20240620'})`,
      );

      const stream = await this.anthropic.messages.create({
        model: model || 'claude-3-5-sonnet-20240620',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      });

      return {
        async *[Symbol.asyncIterator]() {
          for await (const chunk of stream) {
            if (
              chunk.type === 'content_block_delta' &&
              chunk.delta.type === 'text_delta'
            ) {
              yield chunk.delta.text;
            }
          }
        },
      };
    } catch (error) {
      this.logger.error('Failed to call Claude API for streaming', error);
      throw error;
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { ChatResult, ILLMService, TokenUsage } from './llm.interface';

@Injectable()
export class ClaudeService implements ILLMService {
  private readonly anthropic: Anthropic;
  private readonly logger = new Logger(ClaudeService.name);

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');

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

  async chatWithUsage(prompt: string, model?: string): Promise<ChatResult> {
    try {
      const targetModel = model || 'claude-3-5-sonnet-20240620';
      this.logger.debug(`Sending prompt to Claude (Model: ${targetModel})`);

      const response = await this.anthropic.messages.create({
        model: targetModel,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      const firstBlock = response.content[0];
      const result = firstBlock.type === 'text' ? firstBlock.text : '';

      const tokenUsage: TokenUsage = {
        promptTokens:
          response.usage?.input_tokens ?? this.estimateTokens(prompt),
        completionTokens:
          response.usage?.output_tokens ?? this.estimateTokens(result),
        totalTokens:
          (response.usage?.input_tokens ?? 0) +
            (response.usage?.output_tokens ?? 0) ||
          this.estimateTokens(prompt) + this.estimateTokens(result),
      };

      this.logger.debug(`Claude Response: ${result.substring(0, 100)}...`);
      this.logger.debug(`Token Usage: ${JSON.stringify(tokenUsage)}`);

      return {
        content: result,
        usage: tokenUsage,
        model: targetModel,
      };
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

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}

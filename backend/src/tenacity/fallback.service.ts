import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ILLMService } from '../openai/llm.interface';
import { OpenAIService } from '../openai/openai.service';
import { ClaudeService } from '../openai/claude.service';

export type ServiceLevel = 'primary' | 'fallback' | 'stub';

export interface FallbackConfig {
  enabled: boolean;
  maxRetries: number;
  retryDelayMs: number;
  errorThreshold: number;
  cooldownSeconds: number;
}

@Injectable()
export class FallbackService {
  private readonly logger = new Logger(FallbackService.name);
  private readonly config: FallbackConfig;
  private readonly errorCounts = new Map<string, number>();
  private readonly lastErrorTimes = new Map<string, number>();
  private readonly circuitBreakers = new Map<
    string,
    {
      state: 'closed' | 'open' | 'half-open';
      lastTransition: number;
    }
  >();

  constructor(
    private readonly configService: ConfigService,
    private readonly openaiService: OpenAIService,
    private readonly claudeService: ClaudeService,
  ) {
    this.config = {
      enabled: this.configService.get<boolean>('FALLBACK_ENABLED', true),
      maxRetries: this.configService.get<number>('FALLBACK_MAX_RETRIES', 2),
      retryDelayMs: this.configService.get<number>(
        'FALLBACK_RETRY_DELAY_MS',
        1000,
      ),
      errorThreshold: this.configService.get<number>(
        'FALLBACK_ERROR_THRESHOLD',
        5,
      ),
      cooldownSeconds: this.configService.get<number>(
        'FALLBACK_COOLDOWN_SECONDS',
        30,
      ),
    };
  }

  async withFallback<T>(
    operation: () => Promise<T>,
    fallback: () => Promise<T>,
    serviceName: string,
  ): Promise<T> {
    if (!this.config.enabled) {
      return operation();
    }

    const breaker = this.getCircuitBreaker(serviceName);

    if (breaker.state === 'open') {
      if (
        Date.now() - breaker.lastTransition >
        this.config.cooldownSeconds * 1000
      ) {
        breaker.state = 'half-open';
        breaker.lastTransition = Date.now();
      } else {
        this.logger.warn(
          `Circuit breaker is open for ${serviceName}, using fallback`,
        );
        return fallback();
      }
    }

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await operation();
        this.recordSuccess(serviceName);
        return result;
      } catch (error) {
        this.logger.warn(
          `Attempt ${attempt + 1} failed for ${serviceName}: ${(error as Error).message}`,
        );
        this.recordError(serviceName);

        if (attempt >= this.config.maxRetries) {
          this.logger.warn(
            `All ${this.config.maxRetries + 1} attempts failed for ${serviceName}, switching to fallback`,
          );
          return fallback();
        }

        await this.delay(this.config.retryDelayMs * (attempt + 1));
      }
    }

    return fallback();
  }

  getLLMProvider(preferred?: 'openai' | 'claude'): ILLMService {
    if (!this.config.enabled) {
      return preferred === 'claude' ? this.claudeService : this.openaiService;
    }

    const openaiHealth = this.getServiceHealth('openai');
    const claudeHealth = this.getServiceHealth('claude');

    if (preferred === 'claude') {
      if (claudeHealth.level === 'primary') {
        return this.claudeService;
      }
      if (openaiHealth.level === 'primary') {
        this.logger.warn('Claude is degraded, falling back to OpenAI');
        return this.openaiService;
      }
    } else {
      if (openaiHealth.level === 'primary') {
        return this.openaiService;
      }
      if (claudeHealth.level === 'primary') {
        this.logger.warn('OpenAI is degraded, falling back to Claude');
        return this.claudeService;
      }
    }

    this.logger.error('All LLM providers are degraded, using stub response');
    return this.createStubLLM();
  }

  getServiceHealth(serviceName: string): {
    level: ServiceLevel;
    errorCount: number;
    lastError: number | null;
  } {
    const breaker = this.getCircuitBreaker(serviceName);
    const errorCount = this.errorCounts.get(serviceName) ?? 0;
    const lastError = this.lastErrorTimes.get(serviceName) ?? null;

    let level: ServiceLevel = 'primary';
    if (breaker.state === 'open') {
      level = 'stub';
    } else if (errorCount >= this.config.errorThreshold) {
      level = 'fallback';
    }

    return { level, errorCount, lastError };
  }

  resetService(serviceName: string): void {
    this.errorCounts.set(serviceName, 0);
    const breaker = this.getCircuitBreaker(serviceName);
    breaker.state = 'closed';
    breaker.lastTransition = Date.now();
    this.logger.log(`Reset circuit breaker for ${serviceName}`);
  }

  private getCircuitBreaker(serviceName: string): {
    state: 'closed' | 'open' | 'half-open';
    lastTransition: number;
  } {
    let breaker = this.circuitBreakers.get(serviceName);
    if (!breaker) {
      breaker = { state: 'closed', lastTransition: Date.now() };
      this.circuitBreakers.set(serviceName, breaker);
    }
    return breaker;
  }

  private recordError(serviceName: string): void {
    const current = this.errorCounts.get(serviceName) ?? 0;
    this.errorCounts.set(serviceName, current + 1);
    this.lastErrorTimes.set(serviceName, Date.now());

    if (current + 1 >= this.config.errorThreshold) {
      const breaker = this.getCircuitBreaker(serviceName);
      breaker.state = 'open';
      breaker.lastTransition = Date.now();
      this.logger.error(`Circuit breaker opened for ${serviceName}`);
    }
  }

  private recordSuccess(serviceName: string): void {
    this.errorCounts.set(serviceName, 0);
    const breaker = this.getCircuitBreaker(serviceName);
    breaker.state = 'closed';
    breaker.lastTransition = Date.now();
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private createStubLLM(): ILLMService {
    return {
      async chat(prompt: string): Promise<string> {
        return Promise.resolve(
          `[Service Unavailable] 服务暂时不可用，请稍后重试。\n\nPrompt received: ${prompt.substring(0, 100)}...`,
        );
      },
      async chatWithUsage(): Promise<{
        content: string;
        usage: {
          promptTokens: number;
          completionTokens: number;
          totalTokens: number;
        };
        model: string;
      }> {
        return Promise.resolve({
          content: '[Service Unavailable] 服务暂时不可用，请稍后重试。',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          model: 'stub',
        });
      },
    };
  }
}

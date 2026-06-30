import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  Get,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Supervisor } from './supervisor.service';
import { ContextStoreService } from './context-store.service';
import type {
  MultiAgentAnalyzeRequest,
  MultiAgentAnalyzeResponse,
} from './types/agent.types';
import type { Response } from 'express';

@Controller('multi-agent')
export class MultiAgentController {
  private readonly logger = new Logger(MultiAgentController.name);

  constructor(
    private readonly supervisor: Supervisor,
    private readonly contextStoreService: ContextStoreService,
    @InjectQueue('multi-agent-queue')
    private readonly multiAgentQueue: Queue<MultiAgentAnalyzeRequest>,
  ) {}

  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  async analyze(
    @Body() request: MultiAgentAnalyzeRequest,
    @Query('async') asyncMode?: string,
  ): Promise<
    MultiAgentAnalyzeResponse | { analysisId: string; status: string }
  > {
    this.logger.log(
      `收到多智能体分析请求, prompt: ${request.prompt.substring(0, 100)}...`,
    );

    if (asyncMode === 'true' || asyncMode === '1') {
      const analysisId = `ma_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      request.options = request.options || {};

      await this.multiAgentQueue.add('analyze', {
        ...request,
        analysisId,
      });

      this.logger.log(`多智能体异步任务已入队: ${analysisId}`);
      return { analysisId, status: 'queued' };
    }

    const result = await this.supervisor.analyze(request);
    return result;
  }

  @Get('progress/:analysisId')
  @HttpCode(HttpStatus.OK)
  async getProgress(@Param('analysisId') analysisId: string) {
    const progress = await this.contextStoreService.getProgress(analysisId);
    const result = await this.contextStoreService.getResult(analysisId);

    return {
      analysisId,
      progress,
      result,
    };
  }

  @Get('result/:analysisId')
  @HttpCode(HttpStatus.OK)
  async getResult(@Param('analysisId') analysisId: string) {
    const result = await this.contextStoreService.getResult(analysisId);
    if (!result) {
      return {
        analysisId,
        status: 'pending',
        message: '任务处理中或结果已过期',
      };
    }
    return result;
  }

  @Get('stream/:analysisId')
  streamProgress(
    @Param('analysisId') analysisId: string,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const interval = setInterval(() => {
      this.contextStoreService
        .getProgress(analysisId)
        .then((progress) => {
          if (progress) {
            res.write(
              `data: ${JSON.stringify({ type: 'progress', ...progress })}\n\n`,
            );
          }
        })
        .catch(() => {});
      this.contextStoreService
        .getResult(analysisId)
        .then((result) => {
          if (result) {
            res.write(
              `data: ${JSON.stringify({ type: 'result', ...result })}\n\n`,
            );
            clearInterval(interval);
            res.end();
          }
        })
        .catch(() => {});
    }, 1000);

    res.on('close', () => {
      clearInterval(interval);
    });
  }

  @Post('health')
  @HttpCode(HttpStatus.OK)
  health(): { status: string; message: string } {
    return {
      status: 'ok',
      message: 'Multi-Agent service is up and running!',
    };
  }
}

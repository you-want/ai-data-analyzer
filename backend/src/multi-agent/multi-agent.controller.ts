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
  AgentProgressEvent,
  AgentTaskUpdateEvent,
} from './types/agent.types';
import type { Response } from 'express';

/**
 * SSE 连接管理器 —— 将多智能体事件桥接到 SSE 客户端
 */
class SseClientRegistry {
  private clients = new Map<
    string,
    {
      write: (chunk: string) => boolean;
      ended: boolean;
      analysisId: string;
    }
  >();

  register(
    analysisId: string,
    write: (chunk: string) => boolean,
  ): string {
    const id = `sse_${analysisId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    this.clients.set(id, { write, ended: false, analysisId });
    return id;
  }

  unregister(id: string): void {
    const client = this.clients.get(id);
    if (client) {
      client.ended = true;
      this.clients.delete(id);
    }
  }

  broadcast(event: AgentProgressEvent | AgentTaskUpdateEvent): void {
    for (const [, client] of this.clients) {
      if (!client.ended) {
        try {
          const isTaskUpdate = (event as AgentTaskUpdateEvent).taskId !== undefined;
          client.write(
            `data: ${JSON.stringify({
              type: isTaskUpdate ? 'task_update' : 'progress',
              ...event,
            })}\n\n`,
          );
        } catch {
          // 客户端已断开
        }
      }
    }
  }

  broadcastError(analysisId: string, error: string): void {
    for (const [, client] of this.clients) {
      if (!client.ended && client.analysisId === analysisId) {
        try {
          client.write(
            `data: ${JSON.stringify({ type: 'error', analysisId, error })}\n\n`,
          );
        } catch {
          // ignore
        }
      }
    }
  }

  /** 广播分析完成事件 */
  broadcastComplete(analysisId: string, result: unknown): void {
    for (const [clientId, client] of this.clients) {
      if (!client.ended && client.analysisId === analysisId) {
        try {
          client.write(
            `data: ${JSON.stringify({ type: 'complete', analysisId, result })}\n\n`,
          );
          this.unregister(clientId); // 完成后关闭该客户端
        } catch {
          // ignore
        }
      }
    }
  }

  closeAll(): void {
    for (const client of this.clients.values()) {
      client.ended = true;
    }
    this.clients.clear();
  }
}

const sseRegistry = new SseClientRegistry();

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

    const result = await this.supervisor.analyze(
      request,
      // 进度回调 -> 桥接到 SSE
      (event) => sseRegistry.broadcast(event),
      // 任务更新回调 -> 桥接到 SSE
      (event) => sseRegistry.broadcast(event),
    );

    // 完成后通知 SSE 客户端
    sseRegistry.broadcastComplete(result.analysisId, result);

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

  /**
   * SSE 流式推送：连接后等待异步任务完成，实时推送 progress / task_update / error / complete。
   * 适用于异步模式（async=true）的场景。
   */
  @Get('stream/:analysisId')
  streamProgress(
    @Param('analysisId') analysisId: string,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // 注册 SSE 客户端
    const writeFn = res.write.bind(res);
    const clientId = sseRegistry.register(analysisId, writeFn);

    // 先推送当前已有的进度/结果（如果任务已完成或出错）
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
          sseRegistry.unregister(clientId);
          res.end();
        }
      })
      .catch(() => {});

    // 客户端断开时清理
    res.on('close', () => {
      sseRegistry.unregister(clientId);
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

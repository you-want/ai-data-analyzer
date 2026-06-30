import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { CodeExecutionWrapperService } from './code-execution-wrapper.service';
import type { ExecRequest, ExecResponse } from './types/exec.types';

interface CodeExecutionJobData {
  execId: string;
  request: ExecRequest;
  dataset: Record<string, unknown>[];
}

@Processor('code-execution-queue')
export class CodeExecutionProcessor extends WorkerHost {
  private readonly logger = new Logger(CodeExecutionProcessor.name);

  constructor(
    private readonly codeExecutionService: CodeExecutionWrapperService,
    @Inject('CACHE_MANAGER') private readonly cacheManager: Cache,
  ) {
    super();
  }

  async process(job: Job<CodeExecutionJobData>): Promise<ExecResponse> {
    const { execId, request, dataset } = job.data;
    this.logger.log(`开始处理代码执行任务: ${execId}`);

    try {
      await this.cacheManager.set(
        `exec_status:${execId}`,
        JSON.stringify({
          status: 'running',
          startedAt: new Date().toISOString(),
        }),
        3600000,
      );

      const result = await this.codeExecutionService.execute(request, dataset);

      await this.cacheManager.set(
        `exec_result:${execId}`,
        JSON.stringify(result),
        86400000,
      );

      this.logger.log(`代码执行任务完成: ${execId}`);
      return result;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`代码执行任务失败: ${execId}`, err.stack);

      const failureResult: ExecResponse = {
        ok: false,
        stderr: err.message,
        metrics: { durationMs: 0 },
        engine: 'python-subprocess',
      };

      await this.cacheManager.set(
        `exec_result:${execId}`,
        JSON.stringify(failureResult),
        86400000,
      );

      throw error;
    }
  }
}

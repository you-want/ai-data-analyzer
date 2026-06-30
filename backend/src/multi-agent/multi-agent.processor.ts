import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { Supervisor } from './supervisor.service';
import type { MultiAgentAnalyzeRequest } from './types/agent.types';

@Processor('multi-agent-queue')
export class MultiAgentProcessor extends WorkerHost {
  private readonly logger = new Logger(MultiAgentProcessor.name);

  constructor(
    private readonly supervisor: Supervisor,
    @Inject('CACHE_MANAGER') private readonly cacheManager: Cache,
  ) {
    super();
  }

  async process(job: Job<MultiAgentAnalyzeRequest>): Promise<any> {
    const { analysisId } = job.data;
    this.logger.log(`开始处理多智能体异步任务: ${analysisId}`);

    const updateProgress = (event: unknown) => {
      this.cacheManager
        .set(`ma_progress:${analysisId}`, JSON.stringify(event), 3600000)
        .catch(() => {});
    };

    const updateTask = (event: { taskId: string }) => {
      this.cacheManager
        .set(
          `ma_task:${analysisId}:${event.taskId}`,
          JSON.stringify(event),
          3600000,
        )
        .catch(() => {});
    };

    try {
      const result = await this.supervisor.analyze(
        job.data,
        updateProgress,
        updateTask,
      );

      await this.cacheManager.set(
        `ma_result:${analysisId}`,
        JSON.stringify(result),
        86400000,
      );

      this.logger.log(`多智能体异步任务完成: ${analysisId}`);
      return result;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`多智能体异步任务失败: ${analysisId}`, err.stack);

      await this.cacheManager.set(
        `ma_result:${analysisId}`,
        JSON.stringify({
          analysisId,
          status: 'FAILED',
          error: err.message,
        }),
        86400000,
      );

      throw error;
    }
  }
}

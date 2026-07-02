import { Injectable, Inject } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import type { AnalysisRunContext } from './types/agent.types';

const CONTEXT_TTL = 3600000;
const PROGRESS_TTL = 3600000;
const RESULT_TTL = 86400000;

@Injectable()
export class ContextStoreService {
  constructor(@Inject('CACHE_MANAGER') private readonly cacheManager: Cache) {}

  async saveContext(
    analysisId: string,
    context: AnalysisRunContext,
  ): Promise<void> {
    await this.cacheManager.set(
      `ma_context:${analysisId}`,
      JSON.stringify(context),
      CONTEXT_TTL,
    );
  }

  async getContext(analysisId: string): Promise<AnalysisRunContext | null> {
    const data = await this.cacheManager.get<string>(
      `ma_context:${analysisId}`,
    );
    if (!data) return null;
    try {
      return JSON.parse(data) as AnalysisRunContext;
    } catch {
      return null;
    }
  }

  async deleteContext(analysisId: string): Promise<void> {
    await this.cacheManager.del(`ma_context:${analysisId}`);
    await this.cacheManager.del(`ma_progress:${analysisId}`);
    await this.cacheManager.del(`ma_result:${analysisId}`);
  }

  async saveProgress(analysisId: string, progress: unknown): Promise<void> {
    await this.cacheManager.set(
      `ma_progress:${analysisId}`,
      JSON.stringify(progress),
      PROGRESS_TTL,
    );
  }

  async getProgress(analysisId: string): Promise<unknown> {
    const data = await this.cacheManager.get<string>(
      `ma_progress:${analysisId}`,
    );
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async saveResult(analysisId: string, result: unknown): Promise<void> {
    await this.cacheManager.set(
      `ma_result:${analysisId}`,
      JSON.stringify(result),
      RESULT_TTL,
    );
  }

  async getResult(analysisId: string): Promise<unknown> {
    const data = await this.cacheManager.get<string>(`ma_result:${analysisId}`);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async saveTaskUpdate(
    analysisId: string,
    taskId: string,
    update: unknown,
  ): Promise<void> {
    await this.cacheManager.set(
      `ma_task:${analysisId}:${taskId}`,
      JSON.stringify(update),
      PROGRESS_TTL,
    );
  }

  async getTaskUpdates(analysisId: string): Promise<unknown[]> {
    const progress = await this.getProgress(analysisId);
    if (!progress) {
      return [];
    }

    const context = await this.getContext(analysisId);
    if (!context) {
      return [];
    }

    const plan = (context as unknown as Record<string, unknown>).plan as
      | { tasks?: unknown[] }
      | undefined;
    const tasks = plan?.tasks as unknown[] || [];

    const updates: unknown[] = [];
    for (const task of tasks) {
      const taskObj = task as Record<string, unknown>;
      const taskId = taskObj.id as string;
      if (taskId) {
        const taskUpdate = await this.cacheManager.get<string>(
          `ma_task:${analysisId}:${taskId}`,
        );
        if (taskUpdate) {
          try {
            updates.push(JSON.parse(taskUpdate));
          } catch {
            updates.push(taskUpdate);
          }
        }
      }
    }

    return updates;
  }
}

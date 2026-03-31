import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AnalysisService } from './analysis.service';
import { Logger } from '@nestjs/common';

@Processor('analysis-queue')
export class AnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalysisProcessor.name);

  constructor(private readonly analysisService: AnalysisService) {
    super();
  }

  async process(
    job: Job<{ data: unknown; prompt: string }, any, string>,
  ): Promise<any> {
    this.logger.log(`正在处理后台分析任务: ${job.id}`);
    const { data, prompt } = job.data;

    try {
      // 在这里简单模拟一下处理过程，实际上你会调用更复杂的分析逻辑
      const dataString = JSON.stringify(data);
      const combinedPrompt = `${prompt}\n数据内容: ${dataString}`;

      const result = await this.analysisService.analyzeText(combinedPrompt);
      this.logger.log(`任务 ${job.id} 处理完成`);

      return result;
    } catch (error) {
      this.logger.error(`任务 ${job.id} 处理失败`, error);
      throw error;
    }
  }
}

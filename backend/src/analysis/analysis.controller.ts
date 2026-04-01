import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Sse,
  MessageEvent,
  Query,
  BadRequestException,
  Param,
} from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { AnalyzeTextDto } from './dto/analyze-text.dto';
import { Observable } from 'rxjs';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { z } from 'zod';

const UploadDataSchema = z.object({
  prompt: z.string().min(5, '分析提示词太短'),
  data: z
    .array(
      z.object({
        id: z.number().int().positive(),
        value: z.number().min(0, '数据值不能为负数'),
      }),
    )
    .min(1, '上传的数据不能为空'),
});

@Controller('analysis')
export class AnalysisController {
  constructor(
    private readonly analysisService: AnalysisService,
    @InjectQueue('analysis-queue') private analysisQueue: Queue,
  ) {}

  // 提供一个 POST 接口，路径为 /analysis/text
  @Post('text')
  @HttpCode(HttpStatus.OK) // 返回 200 状态码@Post('text')
  async analyzeText(@Body() analyzeTextDto: AnalyzeTextDto) {
    // 调用 Service 层的方法
    const result = await this.analysisService.analyzeText(
      analyzeTextDto.content,
    );

    return {
      success: true,
      data: result,
    };
  }

  @Post('upload-async')
  async uploadAndAnalyzeAsync(
    @Body() payload: { data: any[]; prompt: string },
  ) {
    // 0. 使用 Zod 进行数据验证
    const validationResult = UploadDataSchema.safeParse(payload);
    if (!validationResult.success) {
      throw new BadRequestException(validationResult.error.format());
    }

    // 1. 将数据和 prompt 推入队列
    const job = await this.analysisQueue.add('analyze-job', {
      data: payload.data,
      prompt: payload.prompt,
    });

    // 2. 立即响应，告知前端任务已受理
    return {
      message: '分析任务已提交',
      taskId: job.id,
    };
  }

  @Sse('stream')
  streamAnalysis(@Query('prompt') prompt: string): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      void (async () => {
        try {
          const stream = await this.analysisService.analyzeTextStream(prompt);
          for await (const chunk of stream) {
            subscriber.next({ data: chunk } as MessageEvent);
          }
          subscriber.complete();
        } catch (err) {
          subscriber.error(err);
        }
      })();
    });
  }

  @Post('structured')
  @HttpCode(HttpStatus.OK)
  async analyzeStructured(@Body() payload: { prompt: string }) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result = await this.analysisService.analyzeWithStructuredOutput(
      payload.prompt,
    );

    return {
      success: true,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: result,
    };
  }

  // 健康检查接口
  @Get('status')
  getStatus(): string {
    return 'Analysis service is up and running!';
  }

  // 模拟的查询任务状态接口 (用于 SWR 轮询)
  @Get('status/:id')
  getTaskStatus(@Param('id') id: string) {
    // 这里简单模拟一个状态返回，实际项目中应从 Redis 或数据库查询真实状态
    return {
      taskId: id,
      status: 'completed', // pending, processing, completed, failed
      result: {
        summary: `任务 ${id} 的模拟分析结果`,
        confidenceScore: 0.95,
      },
    };
  }

  // 接收用户对 AI 分析结果的反馈 (RLHF 基础)
  @Post('feedback')
  @HttpCode(HttpStatus.OK)
  submitFeedback(
    @Body()
    payload: {
      insightId: string;
      type: 'up' | 'down';
      comment?: string;
    },
  ) {
    // 在实际项目中，这里会将反馈存入数据库，关联到具体的 AnalysisResult
    console.log(
      `[Feedback Received] InsightID: ${payload.insightId}, Type: ${payload.type}, Comment: ${payload.comment || 'N/A'}`,
    );
    return {
      success: true,
      message: '反馈已记录，感谢您的评价！',
    };
  }
}

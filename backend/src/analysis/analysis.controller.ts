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
  Logger,
} from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AnalysisService } from './analysis.service';
import * as crypto from 'crypto';
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
  @HttpCode(HttpStatus.OK) // 返回 200 状态码
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

  // --- 微服务接口 (Redis Transport) ---
  // 其他服务或网关可以通过 ClientProxy.send({ cmd: 'analyze_text_microservice' }, data) 来调用此方法
  @MessagePattern({ cmd: 'analyze_text_microservice' })
  async handleAnalyzeTextMicroservice(@Payload() data: { content: string }) {
    Logger.log(`收到微服务调用请求: analyze_text_microservice`);
    const result = await this.analysisService.analyzeText(data.content);
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
  async analyzeStructured(
    @Body() payload: { prompt: string; userId?: string },
  ) {
    // 如果没有传入 userId，则使用一个随机 ID 兜底
    const userId = payload.userId || Math.random().toString(36).substring(7);

    // 基于用户 ID 进行稳定的哈希路由，确保同一个用户始终命中同一个实验组
    const userHash = crypto.createHash('md5').update(userId).digest('hex');
    const hashInt = parseInt(userHash.substring(0, 8), 16);
    const isExperimentGroup = hashInt % 100 < 20; // 20% 的流量进入实验组

    let result;

    if (isExperimentGroup) {
      Logger.log(`[A/B Test] User ${userId} 命中实验组 (Prompt V2)`);
      // 传递标识，让 Service 使用实验版 Prompt 和模型
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      result = await this.analysisService.analyzeWithStructuredOutput(
        payload.prompt,
        { useExperiment: true },
      );
    } else {
      Logger.log(`[A/B Test] User ${userId} 命中对照组 (Prompt V1)`);
      // 维持原有稳定逻辑
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      result = await this.analysisService.analyzeWithStructuredOutput(
        payload.prompt,
        { useExperiment: false },
      );
    }

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
    // 记录用户对 AI 洞察的评价
    Logger.log(
      `[用户反馈] 洞察ID: ${payload.insightId}, 评价: ${payload.type}, 补充建议: ${payload.comment || '无'}`,
    );

    // 在生产环境中，此处应将 payload 存入数据库 (如 AnalysisResult 表)
    // 并定期拉取 type === 'down' 的记录，交给人工复核团队 (Human-in-the-loop)

    return {
      success: true,
      message: '反馈已记录，感谢您的评价！',
    };
  }
}

/**
 * Multi-Agent Controller
 * 提供 HTTP 接口触发多智能体分析流程
 */

import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Supervisor } from './supervisor.service';
import type {
  MultiAgentAnalyzeRequest,
  MultiAgentAnalyzeResponse,
} from './types/agent.types';

@Controller('multi-agent')
export class MultiAgentController {
  private readonly logger = new Logger(MultiAgentController.name);

  constructor(private readonly supervisor: Supervisor) {}

  /**
   * 同步执行多智能体分析（等待全部完成后返回）
   */
  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  async analyze(
    @Body() request: MultiAgentAnalyzeRequest,
  ): Promise<MultiAgentAnalyzeResponse> {
    this.logger.log(
      `收到多智能体分析请求, prompt: ${request.prompt.substring(0, 100)}...`,
    );

    const result = await this.supervisor.analyze(request);

    return result;
  }

  /**
   * 健康检查
   */
  @Post('health')
  @HttpCode(HttpStatus.OK)
  health(): { status: string; message: string } {
    return {
      status: 'ok',
      message: 'Multi-Agent service is up and running!',
    };
  }
}

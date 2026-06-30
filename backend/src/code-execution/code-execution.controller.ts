import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CodeExecutionWrapperService } from './code-execution-wrapper.service';
import type { ExecRequest, ExecResponse } from './types/exec.types';

@Controller('code-execution')
export class CodeExecutionController {
  constructor(private readonly codeExecutionService: CodeExecutionWrapperService) {}

  @Post('execute')
  @HttpCode(HttpStatus.OK)
  execute(@Body() body: { request: ExecRequest; dataset: Record<string, unknown>[] }): Promise<ExecResponse> {
    return this.codeExecutionService.execute(body.request, body.dataset);
  }

  @Post('health')
  @HttpCode(HttpStatus.OK)
  health(): { status: string } {
    return { status: 'ok' };
  }
}

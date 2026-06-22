import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CodeExecutionService } from './code-execution.service';
import type { ExecRequest, ExecResponse } from './types/exec.types';

class ExecuteCodeDto {
  request: ExecRequest;
  dataset: Record<string, unknown>[];
}

@Controller('code-execution')
export class CodeExecutionController {
  constructor(private readonly codeExecutionService: CodeExecutionService) {}

  @Post('execute')
  @HttpCode(HttpStatus.OK)
  execute(@Body() body: ExecuteCodeDto): Promise<ExecResponse> {
    return this.codeExecutionService.execute(body.request, body.dataset);
  }

  @Post('health')
  @HttpCode(HttpStatus.OK)
  health(): { status: string } {
    return { status: 'ok' };
  }
}

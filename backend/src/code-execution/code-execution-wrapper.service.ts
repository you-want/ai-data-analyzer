import { Injectable, Logger } from '@nestjs/common';
import { CodeExecutionService } from './code-execution.service';
import { DockerCodeExecutionService } from './docker-code-execution.service';
import type {
  ExecRequest,
  ExecResponse,
  ExecutionLimits,
} from './types/exec.types';

type StructuredRow = Record<string, unknown>;

@Injectable()
export class CodeExecutionWrapperService {
  private readonly logger = new Logger(CodeExecutionWrapperService.name);

  constructor(
    private readonly dockerService: DockerCodeExecutionService,
    private readonly fallbackService: CodeExecutionService,
  ) {}

  async execute(
    request: ExecRequest,
    dataset: StructuredRow[],
    limits?: ExecutionLimits,
  ): Promise<ExecResponse> {
    try {
      this.assertRequestIsSafe(request);
    } catch (error) {
      const err = error as Error;
      return this.buildFailure(err.message, 0);
    }

    if (this.dockerService.isDockerAvailable()) {
      try {
        const result = await this.dockerService.execute(request, dataset, limits);
        if (result.ok) {
          return result;
        }
        this.logger.warn(`Docker 执行失败，降级到子进程: ${result.stderr}`);
      } catch (error) {
        const err = error as Error;
        this.logger.warn(`Docker 执行异常，降级到子进程: ${err.message}`);
      }
    }

    return this.fallbackService.execute(request, dataset, limits);
  }

  private assertRequestIsSafe(request: ExecRequest): void {
    if (request.language === 'sql') {
      this.assertSqlIsSafe(request.code);
      return;
    }

    this.assertPythonCodeIsSafe(request.code);
  }

  private assertPythonCodeIsSafe(code: string): void {
    const importMatches = [
      ...code.matchAll(/^\s*(?:from|import)\s+([a-zA-Z0-9_.]+)/gm),
    ];
    const allowedModules = new Set([
      'math',
      'statistics',
      'json',
      'collections',
      'itertools',
      'functools',
      're',
      'datetime',
      'decimal',
      'fractions',
      'random',
    ]);

    for (const match of importMatches) {
      const moduleName = match[1]?.split('.')[0];
      if (moduleName && !allowedModules.has(moduleName)) {
        throw new Error(`Python 执行器禁止导入模块: ${moduleName}`);
      }
    }

    const blockedPatterns = [
      /\b__import__\s*\(/,
      /\beval\s*\(/,
      /\bexec\s*\(/,
      /\bopen\s*\(/,
      /\bcompile\s*\(/,
      /\binput\s*\(/,
      /\bglobals\s*\(/,
      /\blocals\s*\(/,
      /\bgetattr\s*\(/,
      /\bsetattr\s*\(/,
    ];

    if (blockedPatterns.some((pattern) => pattern.test(code))) {
      throw new Error('Python 执行器检测到不允许的危险调用');
    }
  }

  private assertSqlIsSafe(code: string): void {
    const normalized = this.normalizeSqlQuery(code).toLowerCase();
    if (!normalized.startsWith('select ') && !normalized.startsWith('with ')) {
      throw new Error('SQL 执行器当前只允许 SELECT / WITH 查询');
    }

    const blockedKeywords = [
      'insert ',
      'update ',
      'delete ',
      'drop ',
      'alter ',
      'create ',
      'attach ',
      'pragma ',
      'vacuum ',
      'replace ',
      'truncate ',
    ];

    if (blockedKeywords.some((keyword) => normalized.includes(keyword))) {
      throw new Error('SQL 执行器检测到危险语句，只允许只读查询');
    }
  }

  private normalizeSqlQuery(sql: string): string {
    const trimmed = sql.trim().replace(/;+\s*$/g, '');
    if (!trimmed) {
      throw new Error('SQL 语句不能为空');
    }
    if (trimmed.includes(';')) {
      throw new Error('SQL 执行器不允许一次提交多条语句');
    }
    return trimmed;
  }

  private buildFailure(
    stderr: string,
    durationMs: number,
  ): ExecResponse {
    return {
      ok: false,
      stderr,
      metrics: { durationMs },
      engine: 'validation',
    };
  }
}
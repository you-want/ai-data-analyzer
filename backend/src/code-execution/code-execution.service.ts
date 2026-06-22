import { Injectable, Logger } from '@nestjs/common';
import { mkdtemp, rm, writeFile, readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import type {
  ExecRequest,
  ExecResponse,
  ExecutionLimits,
} from './types/exec.types';

type StructuredRow = Record<string, unknown>;

@Injectable()
export class CodeExecutionService {
  private readonly logger = new Logger(CodeExecutionService.name);
  private readonly defaultTimeoutMs = 15000;
  private readonly defaultMaxOutputBytes = 16 * 1024;
  private readonly defaultMaxResultRows = 200;

  async execute(
    request: ExecRequest,
    dataset: StructuredRow[],
    limits?: ExecutionLimits,
  ): Promise<ExecResponse> {
    try {
      this.assertRequestIsSafe(request);
    } catch (error) {
      const err = error as Error;
      return this.buildFailure(err.message, 0, 'local-fallback');
    }

    const hasPython = await this.hasPythonRuntime();
    if (!hasPython) {
      return this.buildFailure(
        '本机未检测到 python3，已跳过代码执行。',
        0,
        'local-fallback',
      );
    }

    const startedAt = Date.now();
    const workspace = await mkdtemp(join(tmpdir(), 'ai-data-analyzer-exec-'));
    const timeoutMs = limits?.timeoutMs ?? this.defaultTimeoutMs;
    const maxOutputBytes = limits?.maxOutputBytes ?? this.defaultMaxOutputBytes;
    const maxResultRows = limits?.maxResultRows ?? this.defaultMaxResultRows;

    try {
      const dataPath = join(workspace, 'dataset.json');
      const paramsPath = join(workspace, 'params.json');
      const resultPath = join(workspace, 'result.json');
      const scriptPath = join(workspace, 'script.py');

      await writeFile(dataPath, JSON.stringify(dataset), 'utf8');
      await writeFile(
        paramsPath,
        JSON.stringify(request.inputs.params ?? {}, null, 2),
        'utf8',
      );
      await writeFile(
        scriptPath,
        request.language === 'sql'
          ? this.wrapSqlScript(request.code, {
              dataPath,
              paramsPath,
              resultPath,
              maxResultRows,
            })
          : this.wrapPythonScript(request.code, {
              dataPath,
              paramsPath,
              resultPath,
            }),
        'utf8',
      );

      const execution = await this.runPython(scriptPath, timeoutMs);
      const durationMs = Date.now() - startedAt;

      if (!execution.ok) {
        return {
          ok: false,
          stdout: execution.stdout.slice(0, maxOutputBytes),
          stderr: execution.stderr.slice(0, maxOutputBytes),
          metrics: { durationMs },
          engine: 'python-subprocess',
        };
      }

      const resultRaw = await readFile(resultPath, 'utf8');
      const parsed = JSON.parse(resultRaw) as Record<string, unknown>;
      this.assertExpectedResultKeys(request, parsed);

      return {
        ok: true,
        stdout: execution.stdout.slice(0, maxOutputBytes),
        stderr: execution.stderr.slice(0, maxOutputBytes),
        results: parsed,
        artifacts: [],
        metrics: { durationMs },
        engine: 'python-subprocess',
      };
    } catch (error) {
      const err = error as Error;
      this.logger.warn(`代码执行失败: ${err.message}`);
      return this.buildFailure(
        err.message,
        Date.now() - startedAt,
        'python-subprocess',
      );
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  }

  private async hasPythonRuntime(): Promise<boolean> {
    try {
      await access('/usr/bin/python3', constants.X_OK);
      return true;
    } catch {
      return new Promise((resolve) => {
        const child = spawn('python3', ['--version']);
        child.on('error', () => resolve(false));
        child.on('exit', (code) => resolve(code === 0));
      });
    }
  }

  private async runPython(
    scriptPath: string,
    timeoutMs: number,
  ): Promise<{ ok: boolean; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn('python3', ['-I', scriptPath], {
        env: {},
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let settled = false;

      const timer = setTimeout(() => {
        if (!settled) {
          child.kill('SIGKILL');
          settled = true;
          resolve({
            ok: false,
            stdout,
            stderr: `${stderr}\nExecution timed out after ${timeoutMs}ms`,
          });
        }
      }, timeoutMs);

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8');
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8');
      });
      child.on('error', (error) => {
        clearTimeout(timer);
        if (!settled) {
          settled = true;
          reject(error);
        }
      });
      child.on('exit', (code) => {
        clearTimeout(timer);
        if (!settled) {
          settled = true;
          resolve({
            ok: code === 0,
            stdout,
            stderr,
          });
        }
      });
    });
  }

  private wrapPythonScript(
    userCode: string,
    paths: {
      dataPath: string;
      paramsPath: string;
      resultPath: string;
    },
  ): string {
    const escapedDataPath = JSON.stringify(paths.dataPath);
    const escapedParamsPath = JSON.stringify(paths.paramsPath);
    const escapedResultPath = JSON.stringify(paths.resultPath);

    return [
      'import json',
      'from pathlib import Path',
      `DATASET_PATH = Path(${escapedDataPath})`,
      `PARAMS_PATH = Path(${escapedParamsPath})`,
      `RESULT_PATH = Path(${escapedResultPath})`,
      'with DATASET_PATH.open("r", encoding="utf-8") as fh:',
      '    DATASET = json.load(fh)',
      'with PARAMS_PATH.open("r", encoding="utf-8") as fh:',
      '    PARAMS = json.load(fh)',
      'RESULT = {}',
      'def write_result(payload):',
      '    global RESULT',
      '    RESULT = payload',
      userCode,
      'with RESULT_PATH.open("w", encoding="utf-8") as fh:',
      '    json.dump(RESULT, fh, ensure_ascii=False)',
      '',
    ].join('\n');
  }

  private wrapSqlScript(
    sqlQuery: string,
    paths: {
      dataPath: string;
      paramsPath: string;
      resultPath: string;
      maxResultRows: number;
    },
  ): string {
    const escapedDataPath = JSON.stringify(paths.dataPath);
    const escapedParamsPath = JSON.stringify(paths.paramsPath);
    const escapedResultPath = JSON.stringify(paths.resultPath);
    const escapedSql = JSON.stringify(this.normalizeSqlQuery(sqlQuery));

    return [
      'import json',
      'import sqlite3',
      'from pathlib import Path',
      `DATASET_PATH = Path(${escapedDataPath})`,
      `PARAMS_PATH = Path(${escapedParamsPath})`,
      `RESULT_PATH = Path(${escapedResultPath})`,
      `QUERY = ${escapedSql}`,
      `MAX_RESULT_ROWS = ${String(paths.maxResultRows)}`,
      'with DATASET_PATH.open("r", encoding="utf-8") as fh:',
      '    DATASET = json.load(fh)',
      'with PARAMS_PATH.open("r", encoding="utf-8") as fh:',
      '    PARAMS = json.load(fh)',
      'conn = sqlite3.connect(":memory:")',
      'conn.row_factory = sqlite3.Row',
      'def infer_sqlite_type(values):',
      '    clean_values = [value for value in values if value is not None]',
      '    if not clean_values:',
      '        return "TEXT"',
      '    if all(isinstance(value, bool) for value in clean_values):',
      '        return "INTEGER"',
      '    if all(isinstance(value, int) and not isinstance(value, bool) for value in clean_values):',
      '        return "INTEGER"',
      '    if all(isinstance(value, (int, float)) and not isinstance(value, bool) for value in clean_values):',
      '        return "REAL"',
      '    return "TEXT"',
      'columns = list(DATASET[0].keys()) if DATASET else list(PARAMS.get("columns", []))',
      'if columns:',
      '    column_defs = []',
      '    for column in columns:',
      '        values = [row.get(column) for row in DATASET]',
      '        sqlite_type = infer_sqlite_type(values)',
      '        escaped_name = column.replace(chr(34), chr(34) + chr(34))',
      '        column_defs.append(f\'"{escaped_name}" {sqlite_type}\')',
      '    conn.execute(f\'CREATE TABLE dataset ({", ".join(column_defs)})\')',
      '    placeholders = ", ".join(["?"] * len(columns))',
      '    escaped_columns = ", ".join([f\'"{column.replace(chr(34), chr(34) + chr(34))}"\' for column in columns])',
      '    if DATASET:',
      '        conn.executemany(',
      "            f'INSERT INTO dataset ({escaped_columns}) VALUES ({placeholders})',",
      '            [[row.get(column) for column in columns] for row in DATASET],',
      '        )',
      'cursor = conn.execute(QUERY)',
      'rows = [dict(row) for row in cursor.fetchall()]',
      'column_names = [item[0] for item in cursor.description] if cursor.description else []',
      'result = {',
      '    "rows": rows[:MAX_RESULT_ROWS],',
      '    "rowCount": len(rows),',
      '    "columns": column_names,',
      '    "truncated": len(rows) > MAX_RESULT_ROWS,',
      '    "query": QUERY,',
      '}',
      'with RESULT_PATH.open("w", encoding="utf-8") as fh:',
      '    json.dump(result, fh, ensure_ascii=False)',
      'conn.close()',
      '',
    ].join('\n');
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

  private assertExpectedResultKeys(
    request: ExecRequest,
    results: Record<string, unknown>,
  ): void {
    const expectedKeys = request.expected?.resultKeys ?? [];
    const missingKeys = expectedKeys.filter((key) => !(key in results));
    if (missingKeys.length > 0) {
      throw new Error(`执行结果缺少预期字段: ${missingKeys.join(', ')}`);
    }
  }

  private buildFailure(
    stderr: string,
    durationMs: number,
    engine: ExecResponse['engine'],
  ): ExecResponse {
    return {
      ok: false,
      stderr,
      metrics: { durationMs },
      engine,
    };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Docker from 'dockerode';
import type {
  ExecRequest,
  ExecResponse,
  ExecutionLimits,
} from './types/exec.types';

type StructuredRow = Record<string, unknown>;

@Injectable()
export class DockerCodeExecutionService {
  private readonly logger = new Logger(DockerCodeExecutionService.name);
  private readonly defaultTimeoutMs = 15000;
  private readonly defaultMaxOutputBytes = 16 * 1024;
  private readonly defaultMaxResultRows = 200;
  private readonly sandboxImage = 'ai-data-analyzer-sandbox:latest';
  private readonly docker: InstanceType<typeof Docker>;
  private readonly dockerEnabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const dockerHost = this.configService.get<string>('DOCKER_HOST', '/var/run/docker.sock');
    this.dockerEnabled = this.configService.get<boolean>('DOCKER_ENABLED', true);

    if (this.dockerEnabled) {
      try {
        this.docker = new Docker({ socketPath: dockerHost });
        this.docker.ping().catch(() => {
          this.logger.warn('Docker daemon 不可用，将降级到子进程执行');
        });
      } catch {
        this.dockerEnabled = false;
        this.logger.warn('Docker 初始化失败，将降级到子进程执行');
      }
    }
  }

  isDockerAvailable(): boolean {
    return this.dockerEnabled;
  }

  async execute(
    request: ExecRequest,
    dataset: StructuredRow[],
    limits?: ExecutionLimits,
  ): Promise<ExecResponse> {
    if (!this.dockerEnabled) {
      return {
        ok: false,
        stderr: 'Docker 不可用',
        metrics: { durationMs: 0 },
        engine: 'docker-disabled',
      };
    }

    const startedAt = Date.now();
    const workspace = await mkdtemp(join(tmpdir(), 'ai-data-analyzer-docker-exec-'));
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
              dataPath: '/workspace/dataset.json',
              paramsPath: '/workspace/params.json',
              resultPath: '/workspace/result.json',
              maxResultRows,
            })
          : this.wrapPythonScript(request.code, {
              dataPath: '/workspace/dataset.json',
              paramsPath: '/workspace/params.json',
              resultPath: '/workspace/result.json',
            }),
        'utf8',
      );

      const execution = await this.runInDocker(workspace, timeoutMs);
      const durationMs = Date.now() - startedAt;

      if (!execution.ok) {
        return {
          ok: false,
          stdout: execution.stdout.slice(0, maxOutputBytes),
          stderr: execution.stderr.slice(0, maxOutputBytes),
          metrics: { durationMs },
          engine: 'docker',
        };
      }

      const resultRaw = await readFile(resultPath, 'utf8');
      const parsed = JSON.parse(resultRaw) as Record<string, unknown>;

      return {
        ok: true,
        stdout: execution.stdout.slice(0, maxOutputBytes),
        stderr: execution.stderr.slice(0, maxOutputBytes),
        results: parsed,
        artifacts: [],
        metrics: { durationMs },
        engine: 'docker',
      };
    } catch (error) {
      const err = error as Error;
      this.logger.warn(`Docker 代码执行失败: ${err.message}`);
      return {
        ok: false,
        stderr: err.message,
        metrics: { durationMs: Date.now() - startedAt },
        engine: 'docker',
      };
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  }

  private async runInDocker(
    workspace: string,
    timeoutMs: number,
  ): Promise<{ ok: boolean; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const containerOptions: Docker.ContainerCreateOptions = {
        Image: this.sandboxImage,
        WorkingDir: '/workspace',
        Volumes: {
          '/workspace': {},
        },
        HostConfig: {
          Binds: [`${workspace}:/workspace`],
          NetworkMode: 'none',
          Memory: 256 * 1024 * 1024,
          MemorySwap: 256 * 1024 * 1024,
          CpuPeriod: 100000,
          CpuQuota: 50000,
          ReadonlyRootfs: true,
        },
      };

      let stdout = '';
      let stderr = '';
      let settled = false;
      let container: Docker.Container | null = null;

      const timer = setTimeout(() => {
        if (!settled && container) {
          settled = true;
          container.remove({ force: true }).catch(() => {});
          resolve({
            ok: false,
            stdout,
            stderr: `${stderr}\nExecution timed out after ${timeoutMs}ms`,
          });
        }
      }, timeoutMs);

      this.docker
        .createContainer(containerOptions)
        .then((c) => {
          container = c;
          return container.start();
        })
        .then(() => {
          return container?.wait();
        })
        .then((waitResult) => {
          clearTimeout(timer);
          if (settled) return;

          const exitCode = waitResult?.StatusCode ?? -1;

          return Promise.all([
            container?.logs({ stdout: true, stderr: false, tail: 100 }),
            container?.logs({ stdout: false, stderr: true, tail: 100 }),
          ]).then(([stdoutBuffer, stderrBuffer]) => {
            stdout = stdoutBuffer?.toString('utf8') ?? '';
            stderr = stderrBuffer?.toString('utf8') ?? '';

            settled = true;
            container?.remove().catch(() => {});

            resolve({
              ok: exitCode === 0,
              stdout,
              stderr,
            });
          });
        })
        .catch((error) => {
          clearTimeout(timer);
          if (!settled) {
            settled = true;
            container?.remove({ force: true }).catch(() => {});
            resolve({
              ok: false,
              stdout,
              stderr: `Docker 执行错误: ${(error as Error).message}`,
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
}
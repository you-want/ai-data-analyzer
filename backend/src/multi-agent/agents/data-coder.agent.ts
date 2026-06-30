/**
 * Data Coder Agent - 数据处理与计算
 * 职责：
 * - 把任务转成可执行的计算（优先工具调用，其次代码执行器，最后才是"口算"）
 * - 输出结构化结果：指标表、分组统计、异常点列表、字段映射等
 *
 * 注意：第一版不需要真的"写 TypeScript 代码并跑"，先做到"输出结构化计算结果 + 可复核的计算过程"即可
 */

import { Injectable, Logger } from '@nestjs/common';
import type {
  Agent,
  AgentResult,
  AnalysisRunContext,
  DataCoderAgentInput,
  DataCoderAgentOutput,
  AgentTask,
} from '../types/agent.types';
import { CodeExecutionWrapperService } from '../../code-execution/code-execution-wrapper.service';
import type { ExecRequest } from '../../code-execution/types/exec.types';

@Injectable()
export class DataCoderAgent implements Agent<
  DataCoderAgentInput,
  DataCoderAgentOutput
> {
  private readonly logger = new Logger(DataCoderAgent.name);
  readonly role = 'data_coder' as const;

  constructor(private readonly codeExecutionService: CodeExecutionWrapperService) {}

  async run(
    input: DataCoderAgentInput,
    context: AnalysisRunContext,
  ): Promise<AgentResult<DataCoderAgentOutput>> {
    const { task, data } = input;
    this.logger.log(`开始数据处理任务: ${task.id}, 类型: ${task.type}`);
    void context;

    try {
      const executionRequest = this.buildExecutionRequest(task, data);
      const execution = await this.codeExecutionService.execute(
        executionRequest,
        data,
      );

      const output = execution.ok
        ? this.buildOutputFromExecution(task, execution.results ?? {})
        : this.buildFallbackOutput(task, data);

      return {
        success: true,
        data: output,
        summary: `完成数据计算: ${output.resultKey}, ${output.processDescription || '处理成功'}`,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Data Coder Agent 执行失败: ${err.message}`);
      return {
        success: false,
        error: {
          message: err.message,
          code: 'DATA_CODER_ERROR',
          retryable: true,
        },
      };
    }
  }

  private buildExecutionRequest(
    task: AgentTask,
    data: Record<string, unknown>[],
  ): ExecRequest {
    const numericField = this.findPrimaryNumericField(data);
    const dimensionField = this.findPrimaryDimensionField(data, numericField);

    if (task.type === 'data_profile') {
      return {
        language: 'python',
        code: `
result = {"rowCount": len(DATASET), "columns": list(DATASET[0].keys()) if DATASET else []}
profile = {}
missing = {}
for column in result["columns"]:
    values = [row.get(column) for row in DATASET]
    clean_values = [value for value in values if value is not None and value != ""]
    missing[column] = len(values) - len(clean_values)
    numeric_values = []
    for value in clean_values:
        try:
            numeric_values.append(float(value))
        except (TypeError, ValueError):
            pass
    if numeric_values and len(numeric_values) == len(clean_values):
        profile[column] = {
            "type": "number",
            "count": len(clean_values),
            "min": min(numeric_values),
            "max": max(numeric_values),
            "avg": sum(numeric_values) / len(numeric_values),
        }
    else:
        unique_values = []
        for value in clean_values:
            rendered = str(value)
            if rendered not in unique_values:
                unique_values.append(rendered)
        profile[column] = {
            "type": "string",
            "count": len(clean_values),
            "unique": len(unique_values),
            "sample": unique_values[:5],
        }
result["missing"] = missing
result["profile"] = profile
write_result(result)
`,
        inputs: {
          params: {
            taskId: task.id,
          },
        },
        expected: {
          resultKeys: ['rowCount', 'columns', 'missing', 'profile'],
        },
      };
    }

    return {
      language: 'sql',
      code: `
WITH aggregated AS (
  SELECT
    CAST("${this.escapeSqlIdentifier(dimensionField)}" AS TEXT) AS dimension,
    SUM(CAST("${this.escapeSqlIdentifier(numericField)}" AS REAL)) AS value
  FROM dataset
  GROUP BY 1
)
SELECT
  dimension,
  value
FROM aggregated
ORDER BY dimension ASC
`,
      inputs: {
        params: {
          metricField: numericField,
          dimensionField: dimensionField,
        },
      },
      expected: {
        resultKeys: [
          'metricField',
          'dimensionField',
          'table',
          'total',
          'average',
        ],
      },
    };
  }

  private calculateFieldStats(
    data: Record<string, unknown>[],
    fields: string[],
  ): Record<string, unknown> {
    const stats: Record<string, unknown> = {};

    for (const field of fields) {
      const values = data.map((row) => row[field]).filter((v) => v != null);
      const numericValues = values
        .map((v) => Number(v))
        .filter((v) => !isNaN(v));

      if (numericValues.length > 0) {
        // 数值字段
        stats[field] = {
          type: 'number',
          count: numericValues.length,
          min: Math.min(...numericValues),
          max: Math.max(...numericValues),
          avg: numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
        };
      } else {
        // 字符串字段
        const uniqueValues = new Set(values.map(String));
        stats[field] = {
          type: 'string',
          count: values.length,
          unique: uniqueValues.size,
          sample: Array.from(uniqueValues).slice(0, 5),
        };
      }
    }

    return stats;
  }

  private buildOutputFromExecution(
    task: AgentTask,
    results: Record<string, unknown>,
  ): DataCoderAgentOutput {
    if (task.type === 'data_profile') {
      return {
        resultKey: `profile_${task.id}`,
        result: results,
        processDescription: '通过受控 Python 执行器生成数据画像与缺失统计',
      };
    }

    const rows = Array.isArray(results.rows)
      ? (results.rows as Array<Record<string, unknown>>)
      : [];
    const table = rows.map((row, index) => {
      const value = Number(row.value ?? 0);
      const previous = index > 0 ? Number(rows[index - 1]?.value ?? 0) : null;
      const rawDimension = row.dimension;
      const dimension =
        typeof rawDimension === 'string'
          ? rawDimension
          : typeof rawDimension === 'number' ||
              typeof rawDimension === 'boolean' ||
              typeof rawDimension === 'bigint'
            ? rawDimension.toString()
            : typeof rawDimension === 'undefined' || rawDimension === null
              ? 'unknown'
              : JSON.stringify(rawDimension);
      return {
        dimension,
        value,
        mom:
          previous && previous !== 0
            ? Number((((value - previous) / previous) * 100).toFixed(2))
            : null,
      };
    });
    const total = table.reduce((sum, row) => sum + row.value, 0);

    return {
      resultKey: `metrics_${task.id}`,
      result: {
        metricField: results.metricField,
        dimensionField: results.dimensionField,
        total,
        average: table.length ? total / table.length : 0,
        table,
        rowCount: results.rowCount,
        query: results.query,
      },
      processDescription: '通过受控 SQL 执行器完成聚合、排序与环比计算',
    };
  }

  private buildFallbackOutput(
    task: AgentTask,
    data: Record<string, unknown>[],
  ): DataCoderAgentOutput {
    const fields = Object.keys(data[0] || {});
    const numericField = this.findPrimaryNumericField(data);
    const dimensionField = this.findPrimaryDimensionField(data, numericField);

    if (task.type === 'data_profile') {
      return {
        resultKey: `profile_${task.id}`,
        result: {
          rowCount: data.length,
          columns: fields,
          profile: this.calculateFieldStats(data, fields),
        },
        processDescription: '执行器不可用，改用本地兜底统计逻辑',
      };
    }

    const grouped = new Map<string, number>();
    for (const row of data) {
      const rawDimension = row[dimensionField];
      const key =
        typeof rawDimension === 'object' && rawDimension !== null
          ? JSON.stringify(rawDimension)
          : typeof rawDimension === 'undefined' || rawDimension === null
            ? 'unknown'
            : typeof rawDimension === 'string'
              ? rawDimension
              : typeof rawDimension === 'number' ||
                  typeof rawDimension === 'boolean' ||
                  typeof rawDimension === 'bigint'
                ? rawDimension.toString()
                : 'unknown';
      const value = Number(row[numericField] ?? 0);
      grouped.set(
        key,
        (grouped.get(key) ?? 0) + (Number.isFinite(value) ? value : 0),
      );
    }

    const table = Array.from(grouped.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([dimension, value], index, rows) => {
        const previous = rows[index - 1]?.[1];
        return {
          dimension,
          value,
          mom:
            previous && previous !== 0
              ? Number((((value - previous) / previous) * 100).toFixed(2))
              : null,
        };
      });

    return {
      resultKey: `metrics_${task.id}`,
      result: {
        metricField: numericField,
        dimensionField,
        total: table.reduce((sum, row) => sum + row.value, 0),
        average: table.length
          ? table.reduce((sum, row) => sum + row.value, 0) / table.length
          : 0,
        table,
      },
      processDescription: '执行器不可用，改用本地兜底聚合逻辑',
    };
  }

  private findPrimaryNumericField(data: Record<string, unknown>[]): string {
    const fields = Object.keys(data[0] || {});
    const numericField = fields.find((field) =>
      data.some((row) => Number.isFinite(Number(row[field]))),
    );

    return numericField ?? fields[0] ?? 'value';
  }

  private findPrimaryDimensionField(
    data: Record<string, unknown>[],
    numericField: string,
  ): string {
    const fields = Object.keys(data[0] || {});
    const preferred = fields.find(
      (field) =>
        field !== numericField &&
        /(date|time|month|day|week|year|region|name|category)/i.test(field),
    );

    return (
      preferred ??
      fields.find((field) => field !== numericField) ??
      numericField
    );
  }

  private escapeSqlIdentifier(identifier: string): string {
    return identifier.replaceAll('"', '""');
  }
}

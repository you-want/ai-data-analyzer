/**
 * Data Coder Agent - 数据处理与计算
 * 职责：
 * - 把任务转成可执行的计算（优先工具调用，其次代码执行器，最后才是"口算"）
 * - 输出结构化结果：指标表、分组统计、异常点列表、字段映射等
 *
 * 注意：第一版不需要真的"写 TypeScript 代码并跑"，先做到"输出结构化计算结果 + 可复核的计算过程"即可
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import type { ILLMService } from '../../openai/llm.interface';
import { z } from 'zod';
import type {
  Agent,
  AgentResult,
  AnalysisRunContext,
  DataCoderAgentInput,
  DataCoderAgentOutput,
  AgentTask,
} from '../types/agent.types';

// Data Coder Agent 输出的 Zod Schema 验证
const DataCoderOutputSchema = z.object({
  resultKey: z.string().describe('结果存储的 key'),
  result: z.record(z.string(), z.unknown()).describe('计算结果'),
  processDescription: z.string().optional().describe('计算过程描述'),
});

const DATA_CODER_SYSTEM_PROMPT = `你是一个数据处理专家（Data Coder Agent）。你的职责是：
1. 根据任务要求，对输入数据进行计算和处理
2. 输出结构化的计算结果
3. 描述计算过程，便于复核

可用的计算类型：
- 聚合计算：求和、平均、最大、最小、计数
- 分组统计：按字段分组后聚合
- 时间序列：同比、环比、趋势分析
- 异常检测：识别异常值、离群点
- 数据转换：格式化、归一化、标准化

输出要求：
- 必须返回严格的 JSON 格式
- resultKey 用于标识结果，格式如 "metrics_monthly_sales"
- result 包含实际计算结果
- processDescription 简要描述计算步骤

示例输出格式：
{
  "resultKey": "metrics_monthly_sales",
  "result": {
    "total": 1250000,
    "average": 104166.67,
    "max": { "value": 180000, "month": "2024-03" },
    "min": { "value": 45000, "month": "2024-02" },
    "growth": [
      { "month": "2024-01", "value": 80000, "mom": null },
      { "month": "2024-02", "value": 45000, "mom": -43.75 },
      { "month": "2024-03", "value": 180000, "mom": 300 }
    ]
  },
  "processDescription": "按月份分组，计算销售额总和、平均值，识别最大最小值，并计算环比增长率"
}`;

@Injectable()
export class DataCoderAgent implements Agent<
  DataCoderAgentInput,
  DataCoderAgentOutput
> {
  private readonly logger = new Logger(DataCoderAgent.name);
  readonly role = 'data_coder' as const;

  constructor(
    @Inject('LLM_SERVICE') private readonly llmService: ILLMService,
  ) {}

  async run(
    input: DataCoderAgentInput,
    context: AnalysisRunContext,
  ): Promise<AgentResult<DataCoderAgentOutput>> {
    const { task, data } = input;
    this.logger.log(
      `开始数据处理任务: ${task.id}, 类型: ${task.type}, 上下文: ${JSON.stringify(context)}`,
    );

    try {
      // 构建数据上下文（控制 Token）
      const dataContext = this.buildDataContext(data, task);

      const fullPrompt = `${DATA_CODER_SYSTEM_PROMPT}

【任务要求】
任务ID: ${task.id}
任务类型: ${task.type}
任务输入: ${JSON.stringify(task.inputs, null, 2)}

【数据上下文】
${dataContext}

请根据任务要求处理数据，并输出结构化结果。`;

      // 调用 LLM
      const response = await this.llmService.chat(fullPrompt);

      // 解析并验证输出
      const parsed = this.parseAndValidate(response);

      if (!parsed.success) {
        return {
          success: false,
          error: {
            message: parsed.error || 'Data Coder Agent 输出解析失败',
            code: 'DATA_CODER_PARSE_ERROR',
            retryable: true,
          },
        };
      }

      const output = parsed.data;

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

  /**
   * 构建数据上下文（控制 Token 消耗）
   */
  private buildDataContext(
    data: Record<string, unknown>[],
    task: AgentTask,
  ): string {
    if (!data || data.length === 0) {
      return '无数据';
    }

    // 获取字段信息
    const fields = Object.keys(data[0] || {});
    const rowCount = data.length;

    // 根据任务类型决定数据采样策略
    let sampleData: Record<string, unknown>[];
    if (task.type === 'data_profile') {
      // 数据画像需要更多样本
      sampleData = data.slice(0, 10);
    } else if (task.type === 'compute_metrics') {
      // 指标计算需要完整数据摘要
      sampleData = data.slice(0, 5);
    } else {
      // 默认采样
      sampleData = data.slice(0, 5);
    }

    // 计算字段统计信息
    const fieldStats = this.calculateFieldStats(data, fields);

    return `数据行数: ${rowCount}
字段列表: ${fields.join(', ')}

字段统计:
${JSON.stringify(fieldStats, null, 2)}

数据样例:
${JSON.stringify(sampleData, null, 2)}`;
  }

  /**
   * 计算字段统计信息
   */
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

  /**
   * 解析并验证 LLM 输出
   */
  private parseAndValidate(
    response: string,
  ):
    | { success: true; data: DataCoderAgentOutput }
    | { success: false; error: string } {
    try {
      // 清理可能的 Markdown 代码块包裹
      const cleaned = response
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();

      const parsed: unknown = JSON.parse(cleaned);
      const validated = DataCoderOutputSchema.parse(parsed);

      return { success: true, data: validated };
    } catch (error) {
      const err = error as Error;
      this.logger.warn(`Data Coder 输出验证失败: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
}

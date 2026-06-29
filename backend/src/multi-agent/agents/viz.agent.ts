/**
 * Viz Agent - 图表编排
 * 职责：
 * - 根据 Data Coder 的结构化结果，生成前端可消费的图表配置（例如 ECharts option）
 * - 强制要求图表来源数据可追溯（引用 resultKey / 数据表名 / 字段名）
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import type { ILLMService } from '../../openai/llm.interface';
import { z } from 'zod';
import type {
  Agent,
  AgentResult,
  AnalysisRunContext,
  VizAgentInput,
  VizAgentOutput,
  ChartConfig,
} from '../types/agent.types';

// Chart Config Schema
const ChartConfigSchema: z.ZodType<ChartConfig> = z.object({
  id: z.string(),
  library: z.literal('echarts'),
  option: z.record(z.string(), z.unknown()),
  dataRef: z.object({
    resultKey: z.string(),
    fields: z.array(z.string()).optional(),
  }),
});

// Viz Agent 输出的 Zod Schema 验证
const VizOutputSchema = z.object({
  charts: z.array(ChartConfigSchema),
});

const VIZ_AGENT_SYSTEM_PROMPT = `你是一个数据可视化专家（Viz Agent）。你的职责是：
1. 根据数据处理结果，生成合适的图表配置
2. 使用 ECharts 作为图表库
3. 确保图表与数据字段正确对应

可用的图表类型：
- line: 折线图（适合趋势、时间序列）
- bar: 柱状图（适合对比、分布）
- pie: 饼图（适合占比、构成）
- scatter: 散点图（适合相关性）
- radar: 雷达图（适合多维度对比）

输出要求：
- 必须返回严格的 JSON 格式
- 每个图表必须有唯一 id
- option 必须是合法的 ECharts 配置
- dataRef 必须引用正确的 resultKey 和字段名

示例输出格式：
{
  "charts": [
    {
      "id": "line_sales_trend",
      "library": "echarts",
      "option": {
        "xAxis": { "type": "category", "data": ["1月", "2月", "3月"] },
        "yAxis": { "type": "value" },
        "series": [{ "type": "line", "data": [800, 450, 1800] }]
      },
      "dataRef": { "resultKey": "monthly_sales", "fields": ["month", "amount"] }
    }
  ]
}`;

@Injectable()
export class VizAgent implements Agent<VizAgentInput, VizAgentOutput> {
  private readonly logger = new Logger(VizAgent.name);
  readonly role = 'viz' as const;

  constructor(
    @Inject('LLM_SERVICE') private readonly llmService: ILLMService,
  ) {}

  async run(
    input: VizAgentInput,
    context: AnalysisRunContext,
  ): Promise<AgentResult<VizAgentOutput>> {
    const { task, dataResults } = input;
    this.logger.log(
      `开始图表编排任务: ${task.id}, 类型: ${task.type}, 上下文: ${JSON.stringify(context)}`,
    );

    try {
      // 构建数据结果上下文
      const dataContext = this.buildDataContext(dataResults, task);

      const fullPrompt = `${VIZ_AGENT_SYSTEM_PROMPT}

【任务要求】
任务ID: ${task.id}
任务输入: ${JSON.stringify(task.inputs, null, 2)}

【数据结果】
${dataContext}

请根据数据特点选择合适的图表类型，并生成 ECharts 配置。`;

      let output: VizAgentOutput;
      try {
        const response = await this.llmService.chat(fullPrompt);
        const parsed = this.parseAndValidate(response);

        if (!parsed.success) {
          throw new Error(parsed.error || 'Viz Agent 输出解析失败');
        }

        output = parsed.data;
      } catch (error) {
        const err = error as Error;
        this.logger.warn(`Viz Agent 使用规则兜底: ${err.message}`);
        output = this.buildFallbackCharts(dataResults, task);
      }

      return {
        success: true,
        data: output,
        summary: `生成了 ${output.charts.length} 个图表配置`,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Viz Agent 执行失败: ${err.message}`);
      return {
        success: false,
        error: {
          message: err.message,
          code: 'VIZ_ERROR',
          retryable: true,
        },
      };
    }
  }

  /**
   * 构建数据上下文
   */
  private buildDataContext(
    dataResults: Record<string, unknown>,
    task: import('../types/agent.types').AgentTask,
  ): string {
    const requestedKeys = task.inputs.resultKeys as string[] | undefined;
    const chartsRequested = task.inputs.charts as string[] | undefined;

    let context = '';

    // 添加数据结果
    if (requestedKeys && requestedKeys.length > 0) {
      for (const key of requestedKeys) {
        if (dataResults[key]) {
          context += `\n[${key}]:\n${JSON.stringify(dataResults[key], null, 2)}\n`;
        }
      }
    } else {
      // 默认展示所有数据结果
      context = JSON.stringify(dataResults, null, 2);
    }

    // 添加图表需求
    if (chartsRequested && chartsRequested.length > 0) {
      context += `\n需要的图表: ${chartsRequested.join(', ')}`;
    }

    return context || '无数据';
  }

  /**
   * 解析并验证 LLM 输出
   */
  private parseAndValidate(
    response: string,
  ):
    | { success: true; data: VizAgentOutput }
    | { success: false; error: string } {
    try {
      // 清理可能的 Markdown 代码块包裹
      const cleaned = response
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();

      const parsed: unknown = JSON.parse(cleaned);
      const validated = VizOutputSchema.parse(parsed);

      return { success: true, data: validated };
    } catch (error) {
      const err = error as Error;
      this.logger.warn(`Viz 输出验证失败: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  private buildFallbackCharts(
    dataResults: Record<string, unknown>,
    task: import('../types/agent.types').AgentTask,
  ): VizAgentOutput {
    const requestedKeys =
      (task.inputs.resultKeys as string[] | undefined) ?? [];
    const resultKey =
      requestedKeys[0] ??
      Object.keys(dataResults).find((key) => key.startsWith('metrics_')) ??
      Object.keys(dataResults)[0] ??
      'unknown_result';
    const source = dataResults[resultKey] as
      | { table?: Array<Record<string, unknown>> }
      | undefined;
    const rows = source?.table ?? [];
    const xData = rows.map((row) =>
      this.normalizeAxisLabel(row.dimension ?? row.month ?? row.name ?? 'item'),
    );
    const seriesData = rows.map((row) => Number(row.value ?? row.total ?? 0));

    return {
      charts: [
        {
          id: 'trend_overview',
          library: 'echarts',
          option: {
            tooltip: { trigger: 'axis' },
            xAxis: { type: 'category', data: xData },
            yAxis: { type: 'value' },
            series: [{ type: 'line', data: seriesData, smooth: true }],
          },
          dataRef: {
            resultKey,
            fields: ['dimension', 'value'],
          },
        },
      ],
    };
  }

  private normalizeAxisLabel(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return value.toString();
    }
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }
    return 'item';
  }
}

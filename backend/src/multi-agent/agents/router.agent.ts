/**
 * Router Agent - 路由与任务拆解
 * 职责：
 * - 从用户输入中提取：目标（Goal）、数据范围（Scope）、输出形态、约束
 * - 生成一个结构化的任务计划（Plan），每一步明确交给哪个 Worker
 * - 识别风险与缺失信息并生成澄清问题（可选）
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import type { ILLMService } from '../../openai/llm.interface';
import { z } from 'zod';
import type {
  Agent,
  AgentResult,
  AnalysisRunContext,
  RouterAgentOutput,
} from '../types/agent.types';

// Router Agent 输出的 Zod Schema 验证
const RouterOutputSchema = z.object({
  goal: z.string().describe('分析目标'),
  tasks: z.array(
    z.object({
      id: z.string(),
      type: z.enum([
        'data_profile',
        'compute_metrics',
        'chart_spec',
        'review',
        'final_report',
      ]),
      inputs: z.record(z.string(), z.unknown()),
    }),
  ),
  risks: z.array(z.string()).optional(),
  clarificationNeeded: z.boolean().optional(),
  clarificationQuestion: z.string().optional(),
});

const ROUTER_SYSTEM_PROMPT = `你是一个智能任务路由器（Router Agent）。你的职责是：
1. 理解用户的分析意图
2. 将复杂任务拆解为多个可执行的子任务
3. 为每个子任务指定执行角色和输入参数

可用的任务类型：
- data_profile: 数据画像分析（统计字段分布、缺失值、异常值等）
- compute_metrics: 计算指标（聚合、同比、环比、增长率等）
- chart_spec: 生成图表配置（折线图、柱状图、饼图等）
- review: 结果审阅与质量检查
- final_report: 生成最终报告

输出要求：
- 必须返回严格的 JSON 格式
- 任务之间要有逻辑顺序
- 每个任务的 inputs 要明确具体
- 如果用户意图不清晰，设置 clarificationNeeded 为 true

示例输出格式：
{
  "goal": "分析销售趋势并找出异常月份",
  "tasks": [
    { "id": "t1", "type": "data_profile", "inputs": { "focus": ["date", "amount"] } },
    { "id": "t2", "type": "compute_metrics", "inputs": { "metrics": ["MoM", "YoY"] } },
    { "id": "t3", "type": "chart_spec", "inputs": { "charts": ["line_sales", "bar_growth"] } },
    { "id": "t4", "type": "review", "inputs": { "checks": ["unit", "outlier"] } },
    { "id": "t5", "type": "final_report", "inputs": { "style": "bullet", "audience": "business" } }
  ],
  "risks": ["数据量较大，可能需要采样"]
}`;

@Injectable()
export class RouterAgent implements Agent<string, RouterAgentOutput> {
  private readonly logger = new Logger(RouterAgent.name);
  readonly role = 'router' as const;

  constructor(
    @Inject('LLM_SERVICE') private readonly llmService: ILLMService,
  ) {}

  async run(
    userPrompt: string,
    context: AnalysisRunContext,
  ): Promise<AgentResult<RouterAgentOutput>> {
    this.logger.log(`开始路由分析任务: ${context.analysisId}`);

    try {
      // 构建数据摘要（节省 Token）
      const dataSummary = this.buildDataSummary(context.rawData);

      const fullPrompt = `${ROUTER_SYSTEM_PROMPT}

【用户请求】
${userPrompt}

【数据摘要】
${dataSummary}

请根据用户请求和数据情况，生成任务计划。`;

      let output: RouterAgentOutput;
      try {
        const response = await this.llmService.chat(fullPrompt);
        const parsed = this.parseAndValidate(response);
        if (!parsed.success) {
          throw new Error(parsed.error || 'Router Agent 输出解析失败');
        }
        output = parsed.data;
      } catch (error) {
        const err = error as Error;
        this.logger.warn(`Router Agent 使用规则兜底: ${err.message}`);
        output = this.buildFallbackPlan(userPrompt, context.rawData ?? []);
      }

      // 检查是否需要澄清
      if (output.clarificationNeeded) {
        return {
          success: true,
          data: output,
          summary: `需要用户澄清: ${output.clarificationQuestion}`,
        };
      }

      return {
        success: true,
        data: output,
        summary: `已生成包含 ${output.tasks.length} 个任务的执行计划`,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Router Agent 执行失败: ${err.message}`);
      return {
        success: false,
        error: {
          message: err.message,
          code: 'ROUTER_ERROR',
          retryable: true,
        },
      };
    }
  }

  /**
   * 构建数据摘要（节省 Token）
   */
  private buildDataSummary(data?: Record<string, unknown>[]): string {
    if (!data || data.length === 0) {
      return '无数据';
    }

    const sample = data.slice(0, 3);
    const fields = Object.keys(data[0] || {});
    const rowCount = data.length;

    return `数据行数: ${rowCount}
字段列表: ${fields.join(', ')}
数据样例:
${JSON.stringify(sample, null, 2)}`;
  }

  /**
   * 解析并验证 LLM 输出
   */
  private parseAndValidate(
    response: string,
  ):
    | { success: true; data: RouterAgentOutput }
    | { success: false; error: string } {
    try {
      // 清理可能的 Markdown 代码块包裹
      const cleaned = response
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();

      const parsed: unknown = JSON.parse(cleaned);
      const validated = RouterOutputSchema.parse(parsed);

      return { success: true, data: validated };
    } catch (error) {
      const err = error as Error;
      this.logger.warn(`Router 输出验证失败: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  private buildFallbackPlan(
    userPrompt: string,
    data: Record<string, unknown>[],
  ): RouterAgentOutput {
    const fields = Object.keys(data[0] || {});
    const numericFields = fields.filter((field) =>
      data.some((row) => Number.isFinite(Number(row[field]))),
    );
    const dimensionField =
      fields.find((field) =>
        /(date|time|month|day|week|year|region|name|category)/i.test(field),
      ) ?? fields.find((field) => !numericFields.includes(field));

    return {
      goal: userPrompt,
      tasks: [
        {
          id: 't1',
          type: 'data_profile',
          inputs: { focus: fields.slice(0, 5) },
        },
        {
          id: 't2',
          type: 'compute_metrics',
          inputs: {
            metricField: numericFields[0] ?? fields[0] ?? 'value',
            dimensionField: dimensionField ?? fields[0] ?? 'dimension',
          },
        },
        {
          id: 't3',
          type: 'chart_spec',
          inputs: {
            charts: ['trend_overview'],
            resultKeys: ['metrics_t2'],
          },
        },
        {
          id: 't4',
          type: 'review',
          inputs: { checks: ['unit', 'outlier', 'chart_consistency'] },
        },
        {
          id: 't5',
          type: 'final_report',
          inputs: { style: 'bullet', audience: 'business' },
        },
      ],
      risks:
        fields.length === 0
          ? ['数据为空，结果会比较像空气分析']
          : ['当前使用规则兜底计划，建议补充真实大模型配置以获得更细任务拆解'],
    };
  }
}

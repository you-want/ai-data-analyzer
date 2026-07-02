/**
 * Writer Agent - 报告生成专家
 * 职责：
 * - 根据分析过程和结果，生成结构化、专业的分析报告
 * - 支持多种报告风格：bullet（要点式）、paragraph（段落式）、business（商务报告）
 * - 确保报告包含分析概述、关键发现、数据洞察、建议与结论
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import type { ILLMService } from '../../openai/llm.interface';
import { z } from 'zod';
import type {
  Agent,
  AgentResult,
  AnalysisRunContext,
  WriterAgentInput,
  WriterAgentOutput,
  ChartConfig,
} from '../types/agent.types';

const WriterOutputSchema = z.object({
  report: z.string(),
  highlights: z.array(z.string()).optional(),
});

const WRITER_SYSTEM_PROMPT = `你是一个专业的数据分析报告撰写专家（Writer Agent）。你的职责是：
1. 根据分析过程和结果，生成清晰、专业的分析报告
2. 报告结构必须包含：分析概述、关键发现、数据洞察、建议与结论
3. 根据目标受众选择合适的语言风格
4. 将图表配置转换为自然语言描述

报告风格：
- bullet: 简洁的要点式，适合快速阅读
- paragraph: 详细的段落式，适合深入分析
- business: 正式的商务报告，适合管理层汇报

输出要求：
- 必须返回严格的 JSON 格式
- report 字段包含完整报告内容（Markdown 格式）
- highlights 字段列出 3-5 个核心要点
- 语言要专业但易懂，避免技术术语堆砌

示例输出格式：
{
  "report": "# 销售趋势分析报告\\n\\n## 分析概述\\n...",
  "highlights": ["销售额同比增长 23%", "Q3 出现明显下滑"]
}`;

@Injectable()
export class WriterAgent implements Agent<WriterAgentInput, WriterAgentOutput> {
  private readonly logger = new Logger(WriterAgent.name);
  readonly role = 'writer' as const;

  constructor(
    @Inject('LLM_SERVICE') private readonly llmService: ILLMService,
  ) {}

  async run(
    input: WriterAgentInput,
    context: AnalysisRunContext,
  ): Promise<AgentResult<WriterAgentOutput>> {
    this.logger.log(`开始报告生成任务`);

    try {
      const chartDescriptions = this.buildChartDescriptions(input.charts);
      const summaries = context.summaries
        .map((s) => `- [${s.role}] ${s.text}`)
        .join('\n');
      const artifacts = Object.keys(context.artifacts);

      const fullPrompt = `${WRITER_SYSTEM_PROMPT}

【分析目标】
${context.plan?.goal || input.userPrompt}

【分析过程摘要】
${summaries}

【生成的产物】
${artifacts.join(', ')}

【图表描述】
${chartDescriptions || '无图表'}

【审阅结果】
状态: ${input.reviewResult.status}
问题: ${input.reviewResult.issues?.length || 0} 个
建议: ${input.reviewResult.suggestions?.join(', ') || '无'}

【用户原始请求】
${input.userPrompt}

【报告风格】
${input.style || 'bullet'}
【目标受众】
${input.audience || '业务人员'}

请生成一份结构清晰、重点突出的分析报告。`;

      let output: WriterAgentOutput;
      try {
        const response = await this.llmService.chat(fullPrompt);
        const parsed = this.parseAndValidate(response);

        if (!parsed.success) {
          throw new Error(parsed.error || 'Writer Agent 输出解析失败');
        }

        output = parsed.data;
      } catch (error) {
        const err = error as Error;
        this.logger.warn(`Writer Agent 使用规则兜底: ${err.message}`);
        output = this.buildFallbackReport(input, context);
      }

      return {
        success: true,
        data: output,
        summary: `报告生成完成，${output.highlights?.length || 0} 个核心要点`,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Writer Agent 执行失败: ${err.message}`);
      return {
        success: false,
        error: {
          message: err.message,
          code: 'WRITER_ERROR',
          retryable: true,
        },
      };
    }
  }

  private buildChartDescriptions(charts: ChartConfig[]): string {
    if (!charts || charts.length === 0) {
      return '无图表';
    }

    return charts
      .map((chart) => {
        const option = chart.option as Record<string, unknown>;
        const series = (option.series as Array<Record<string, unknown>>) || [];
        const chartType = series[0]?.type as string || 'unknown';
        const xAxis = option.xAxis as Record<string, unknown>;
        const yAxis = option.yAxis as Record<string, unknown>;

        return `- 图表 [${chart.id}]: ${chartType}
          - 数据来源: ${chart.dataRef.resultKey}
          - X轴: ${xAxis?.type || 'category'}
          - Y轴: ${yAxis?.type || 'value'}
          - 字段: ${chart.dataRef.fields?.join(', ') || '未知'}`;
      })
      .join('\n');
  }

  private parseAndValidate(
    response: string,
  ):
    | { success: true; data: WriterAgentOutput }
    | { success: false; error: string } {
    try {
      const cleaned = response
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();

      const parsed: unknown = JSON.parse(cleaned);
      const validated = WriterOutputSchema.parse(parsed);

      return { success: true, data: validated };
    } catch (error) {
      const err = error as Error;
      this.logger.warn(`Writer 输出验证失败: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  private buildFallbackReport(
    input: WriterAgentInput,
    context: AnalysisRunContext,
  ): WriterAgentOutput {
    const planSummary =
      context.plan?.tasks
        .map((task) => `- ${task.type}: ${task.status}`)
        .join('\n') ?? '- 暂无任务';
    const artifactSummary = Object.entries(context.artifacts)
      .filter(([key]) => key !== 'retrieved_context')
      .map(([key, value]) => `- ${key}: ${this.summarizeArtifact(value)}`)
      .join('\n');

    const highlights = [
      `分析目标: ${context.plan?.goal ?? input.userPrompt}`,
      `任务数: ${context.plan?.tasks.length ?? 0}`,
      `审阅状态: ${input.reviewResult.status}`,
    ];

    const report = [
      `# 分析报告`,
      ``,
      `## 分析概述`,
      `- 目标：${context.plan?.goal ?? input.userPrompt}`,
      `- 状态：${context.status}`,
      `- 风格：${input.style || 'bullet'}`,
      ``,
      `## 关键发现`,
      ...highlights.map((h) => `- ${h}`),
      ``,
      `## 任务执行`,
      planSummary,
      ``,
      `## 关键产物`,
      artifactSummary || '- 目前还没有产物',
      ``,
      `## 审阅结果`,
      `- 状态: ${input.reviewResult.status}`,
      `- 问题: ${input.reviewResult.issues?.length || 0} 个`,
      `- 建议: ${input.reviewResult.suggestions?.join(', ') || '无'}`,
      ``,
      `## 建议与结论`,
      `- 当前报告由规则兜底生成，适合本地开发和离线验证。`,
      `- 如果要更像"会写 PPT 的分析师"，补上真实大模型配置即可。`,
    ].join('\n');

    return {
      report,
      highlights,
    };
  }

  private summarizeArtifact(value: unknown): string {
    if (Array.isArray(value)) {
      return `数组(${value.length})`;
    }
    if (value && typeof value === 'object') {
      return `对象字段: ${Object.keys(value).slice(0, 5).join(', ')}`;
    }
    return String(value);
  }
}
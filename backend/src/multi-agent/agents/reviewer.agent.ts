/**
 * Reviewer Agent - 审阅与守门
 * 职责：
 * - 校验链路：数据结果是否自洽、图表与数据是否匹配、单位/口径是否一致
 * - 失败时输出"可执行的修复指令"（回到 Supervisor 触发重跑某一步），而不是输出长篇解释
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import type { ILLMService } from '../../openai/llm.interface';
import { z } from 'zod';
import type {
  Agent,
  AgentResult,
  AnalysisRunContext,
  ReviewerAgentInput,
  ReviewerAgentOutput,
} from '../types/agent.types';

// Reviewer Agent 输出的 Zod Schema 验证
const ReviewerOutputSchema = z.object({
  status: z.enum(['pass', 'fail']),
  issues: z
    .array(
      z.object({
        type: z.string(),
        message: z.string(),
        fix: z
          .object({
            rerunTaskId: z.string(),
            reason: z.string().optional(),
          })
          .optional(),
      }),
    )
    .optional(),
  suggestions: z.array(z.string()).optional(),
});

const REVIEWER_SYSTEM_PROMPT = `你是一个质量审阅专家（Reviewer Agent）。你的职责是：
1. 校验数据处理结果的自洽性
2. 检查图表配置与数据是否匹配
3. 验证单位、口径、字段映射是否正确
4. 发现问题时，输出可执行的修复指令

检查维度：
- 数据一致性：计算结果是否合理，是否有明显错误
- 图表匹配：图表数据引用是否正确，字段映射是否准确
- 单位口径：数值单位是否统一，计算口径是否一致
- 异常检测：是否有异常值、离群点未处理

输出要求：
- 必须返回严格的 JSON 格式
- status 为 'pass' 表示通过，'fail' 表示需要修复
- issues 数组列出发现的问题
- 每个 issue 必须包含 type、message，以及可选的 fix 指令
- fix.rerunTaskId 指定需要重跑的任务 ID

示例输出格式：
{
  "status": "fail",
  "issues": [
    {
      "type": "chart_mismatch",
      "message": "line_sales 的 xAxis 使用 date，但数据表字段是 month",
      "fix": { "rerunTaskId": "t3", "reason": "图表字段映射错误" }
    }
  ],
  "suggestions": ["建议增加数据采样说明"]
}`;

@Injectable()
export class ReviewerAgent implements Agent<
  ReviewerAgentInput,
  ReviewerAgentOutput
> {
  private readonly logger = new Logger(ReviewerAgent.name);
  readonly role = 'reviewer' as const;

  constructor(
    @Inject('LLM_SERVICE') private readonly llmService: ILLMService,
  ) {}

  async run(
    input: ReviewerAgentInput,
    context: AnalysisRunContext,
  ): Promise<AgentResult<ReviewerAgentOutput>> {
    const { task, dataResults, charts } = input;
    this.logger.log(
      `开始审阅任务: ${task.id}, 类型: ${task.type}, 上下文: ${JSON.stringify(context)}`,
    );

    try {
      // 构建审阅上下文
      const reviewContext = this.buildReviewContext(dataResults, charts);

      const fullPrompt = `${REVIEWER_SYSTEM_PROMPT}

【审阅内容】
${reviewContext}

请对数据处理结果和图表配置进行全面审阅。`;

      let output: ReviewerAgentOutput;
      try {
        const response = await this.llmService.chat(fullPrompt);
        const parsed = this.parseAndValidate(response);

        if (!parsed.success) {
          throw new Error(parsed.error || 'Reviewer Agent 输出解析失败');
        }

        output = parsed.data;
      } catch (error) {
        const err = error as Error;
        this.logger.warn(`Reviewer Agent 使用规则兜底: ${err.message}`);
        output = this.buildFallbackReview(dataResults, charts);
      }

      return {
        success: true,
        data: output,
        summary:
          output.status === 'pass'
            ? '审阅通过'
            : `发现 ${output.issues?.length || 0} 个问题`,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Reviewer Agent 执行失败: ${err.message}`);
      return {
        success: false,
        error: {
          message: err.message,
          code: 'REVIEWER_ERROR',
          retryable: true,
        },
      };
    }
  }

  /**
   * 构建审阅上下文
   */
  private buildReviewContext(
    dataResults: Record<string, unknown>,
    charts: import('../types/agent.types').ChartConfig[],
  ): string {
    let context = '【数据处理结果】\n';
    context += JSON.stringify(dataResults, null, 2);

    if (charts && charts.length > 0) {
      context += '\n\n【图表配置】\n';
      context += JSON.stringify(charts, null, 2);
    }

    return context;
  }

  /**
   * 解析并验证 LLM 输出
   */
  private parseAndValidate(
    response: string,
  ):
    | { success: true; data: ReviewerAgentOutput }
    | { success: false; error: string } {
    try {
      // 清理可能的 Markdown 代码块包裹
      const cleaned = response
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();

      const parsed: unknown = JSON.parse(cleaned);
      const validated = ReviewerOutputSchema.parse(parsed);

      return { success: true, data: validated };
    } catch (error) {
      const err = error as Error;
      this.logger.warn(`Reviewer 输出验证失败: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  private buildFallbackReview(
    dataResults: Record<string, unknown>,
    charts: import('../types/agent.types').ChartConfig[],
  ): ReviewerAgentOutput {
    const issues: ReviewerAgentOutput['issues'] = [];

    for (const chart of charts) {
      const resultKey = chart.dataRef.resultKey;
      if (!dataResults[resultKey]) {
        issues.push({
          type: 'missing_data_ref',
          message: `图表 ${chart.id} 引用了不存在的结果 ${resultKey}`,
        });
      }
    }

    return issues.length
      ? {
          status: 'fail',
          issues,
          suggestions: ['先修复图表引用，再让 Reviewer 扮演严格监工'],
        }
      : {
          status: 'pass',
          suggestions: ['规则兜底审阅通过，没有发现明显的数据引用问题'],
        };
  }
}

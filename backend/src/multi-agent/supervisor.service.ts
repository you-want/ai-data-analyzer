/**
 * Supervisor - 多智能体编排器
 * 职责：
 * - 理解用户意图、拆解任务
 * - 调度 Worker（Router/DataCoder/Viz/Reviewer）
 * - 合并产出、兜底重试
 * - 管理共享上下文与状态机
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import type { ILLMService } from '../openai/llm.interface';
import {
  type AnalysisRunContext,
  type AgentTask,
  type MultiAgentAnalyzeRequest,
  type MultiAgentAnalyzeResponse,
  type AgentProgressEvent,
  type AgentTaskUpdateEvent,
  type DataCoderAgentOutput,
  type VizAgentOutput,
  type ChartConfig,
  RunStatus,
} from './types/agent.types';
import { RouterAgent } from './agents/router.agent';
import { DataCoderAgent } from './agents/data-coder.agent';
import { VizAgent } from './agents/viz.agent';
import { ReviewerAgent } from './agents/reviewer.agent';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';
import { BillingService } from '../billing/billing.service';

// 默认配置
const DEFAULT_MAX_STEPS = 20;
const DEFAULT_MAX_TOKENS = 100000;
const DEFAULT_MAX_RETRIES = 3;

@Injectable()
export class Supervisor {
  private readonly logger = new Logger(Supervisor.name);

  constructor(
    private readonly routerAgent: RouterAgent,
    private readonly dataCoderAgent: DataCoderAgent,
    private readonly vizAgent: VizAgent,
    private readonly reviewerAgent: ReviewerAgent,
    private readonly knowledgeBaseService: KnowledgeBaseService,
    private readonly billingService: BillingService,
    @Inject('LLM_SERVICE') private readonly llmService: ILLMService,
  ) {}

  /**
   * 执行多智能体分析流程
   */
  async analyze(
    request: MultiAgentAnalyzeRequest,
    onProgress?: (event: AgentProgressEvent) => void,
    onTaskUpdate?: (event: AgentTaskUpdateEvent) => void,
  ): Promise<MultiAgentAnalyzeResponse> {
    const analysisId = this.generateAnalysisId();
    const maxSteps = request.options?.maxSteps ?? DEFAULT_MAX_STEPS;
    const maxTokens = request.options?.maxTokens ?? DEFAULT_MAX_TOKENS;
    const enableReview = request.options?.enableReview ?? true;
    const enableCharts = request.options?.enableCharts ?? true;

    this.logger.log(`开始多智能体分析: ${analysisId}`);

    if (request.workspaceId) {
      await this.billingService.guardAnalysisAccess({
        workspaceId: request.workspaceId,
        userId: request.userId,
        route: 'multi-agent.analyze',
      });
      await this.billingService.startJob(request.workspaceId);
    }

    // 初始化上下文
    const context: AnalysisRunContext = {
      analysisId,
      datasetId: request.datasetId,
      userPrompt: request.prompt,
      rawData: request.data,
      status: RunStatus.ROUTED,
      artifacts: {},
      summaries: [],
      tokenBudget: { maxTokens, usedTokens: 0 },
      maxSteps,
      currentStep: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      if (request.workspaceId) {
        const retrieved = await this.knowledgeBaseService.query(
          request.workspaceId,
          request.prompt,
          4,
        );
        if (retrieved.length > 0) {
          context.artifacts['retrieved_context'] =
            this.knowledgeBaseService.buildContextPack(retrieved);
        }
      }

      // Step 1: Router Agent 生成任务计划
      this.emitProgress(context, '正在分析用户意图...', onProgress);
      const routerResult = await this.routerAgent.run(request.prompt, context);

      if (!routerResult.success || !routerResult.data) {
        return this.buildErrorResponse(
          context,
          routerResult.error?.message || 'Router Agent 失败',
        );
      }

      // 检查是否需要澄清
      if (routerResult.data.clarificationNeeded) {
        return {
          analysisId,
          status: RunStatus.FAILED,
          error: `需要澄清: ${routerResult.data.clarificationQuestion}`,
        };
      }

      // 更新上下文
      context.plan = {
        goal: routerResult.data.goal,
        tasks: routerResult.data.tasks.map((t) => ({
          ...t,
          status: 'pending' as const,
        })),
        createdAt: new Date().toISOString(),
      };
      context.status = RunStatus.EXECUTING;

      // 添加摘要
      if (routerResult.summary) {
        context.summaries.push({
          role: 'router',
          text: routerResult.summary,
          at: new Date().toISOString(),
        });
      }

      this.emitProgress(
        context,
        `已生成任务计划: ${context.plan.tasks.length} 个任务`,
        onProgress,
      );

      // Step 2: 执行任务计划
      await this.executePlan(context, onTaskUpdate, enableCharts);

      // Step 3: Review（如果启用）
      if (enableReview) {
        context.status = RunStatus.REVIEWING;
        this.emitProgress(context, '正在进行质量审阅...', onProgress);
        await this.executeReview(context, onTaskUpdate);
      }

      // Step 4: 生成最终报告
      context.status = RunStatus.FINALIZING;
      this.emitProgress(context, '正在生成最终报告...', onProgress);
      const report = await this.generateReport(context);

      // 完成
      context.status = RunStatus.DONE;
      context.artifacts['report'] = report;

      this.emitProgress(context, '分析完成', onProgress);

      if (request.workspaceId) {
        await this.knowledgeBaseService.ingestReport({
          workspaceId: request.workspaceId,
          analysisId,
          datasetId: request.datasetId,
          report,
          metadata: {
            source: 'multi-agent',
            userPrompt: request.prompt,
          },
        });

        await this.billingService.recordUsage({
          workspaceId: request.workspaceId,
          userId: request.userId,
          eventType: 'llm',
          eventKey: `${analysisId}:report`,
          units: {
            tokens: this.estimateTokens(report),
          },
          metadata: {
            taskCount: context.plan?.tasks.length ?? 0,
          },
        });
      }

      return {
        analysisId,
        status: RunStatus.DONE,
        plan: context.plan,
        artifacts: context.artifacts,
        report,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`多智能体分析失败: ${err.message}`, err.stack);
      return this.buildErrorResponse(context, err.message);
    } finally {
      if (request.workspaceId) {
        await this.billingService.finishJob(request.workspaceId);
      }
    }
  }

  /**
   * 执行任务计划
   */
  private async executePlan(
    context: AnalysisRunContext,
    onTaskUpdate?: (event: AgentTaskUpdateEvent) => void,
    enableCharts = true,
  ): Promise<void> {
    if (!context.plan) return;

    const tasks = context.plan.tasks;

    for (const task of tasks) {
      // 检查步数限制
      if (
        context.currentStep !== undefined &&
        context.maxSteps !== undefined &&
        context.currentStep >= context.maxSteps
      ) {
        this.logger.warn(`达到最大步数限制: ${context.maxSteps}`);
        break;
      }

      // 跳过图表任务（如果禁用）
      if (!enableCharts && task.type === 'chart_spec') {
        task.status = 'skipped';
        continue;
      }

      // 更新任务状态
      task.status = 'running';
      task.startedAt = new Date().toISOString();
      context.currentStep = (context.currentStep || 0) + 1;

      this.emitTaskUpdate(context, task, onTaskUpdate);

      try {
        const result = await this.executeTask(task, context);

        if (result.success) {
          task.status = 'success';
          task.outputs = result.data as Record<string, unknown>;
          task.finishedAt = new Date().toISOString();

          // 存储产物
          if (result.data) {
            const output = result.data as
              | DataCoderAgentOutput
              | VizAgentOutput
              | Record<string, unknown>;
            if ('resultKey' in output) {
              context.artifacts[output.resultKey as string] = output.result;
            } else if ('charts' in output) {
              context.artifacts['charts'] = output.charts;
            } else {
              context.artifacts[task.id] = output;
            }
          }

          // 添加摘要
          if (result.summary) {
            const role = this.getRoleForTaskType(task.type);
            if (role) {
              context.summaries.push({
                role,
                text: result.summary,
                at: new Date().toISOString(),
              });
            }
          }
        } else {
          task.status = 'failed';
          task.error = {
            message: result.error?.message || '任务执行失败',
            code: result.error?.code,
          };
          task.finishedAt = new Date().toISOString();
        }
      } catch (error) {
        const err = error as Error;
        task.status = 'failed';
        task.error = { message: err.message };
        task.finishedAt = new Date().toISOString();
      }

      this.emitTaskUpdate(context, task, onTaskUpdate);
    }
  }

  /**
   * 执行单个任务
   */
  private async executeTask(
    task: AgentTask,
    context: AnalysisRunContext,
  ): Promise<{
    success: boolean;
    data?: unknown;
    error?: { message: string; code?: string };
    summary?: string;
  }> {
    const maxRetries = DEFAULT_MAX_RETRIES;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        switch (task.type) {
          case 'data_profile':
          case 'compute_metrics': {
            const result = await this.dataCoderAgent.run(
              { task, data: context.rawData || [] },
              context,
            );
            if (result.success) {
              return {
                success: true,
                data: result.data,
                summary: result.summary,
              };
            }
            lastError = new Error(result.error?.message);
            break;
          }

          case 'chart_spec': {
            const result = await this.vizAgent.run(
              {
                task,
                dataResults: context.artifacts,
              },
              context,
            );
            if (result.success) {
              return {
                success: true,
                data: result.data,
                summary: result.summary,
              };
            }
            lastError = new Error(result.error?.message);
            break;
          }

          case 'final_report':
            // 报告生成在 generateReport 中处理
            return { success: true, data: {} };

          case 'review': {
            const result = await this.reviewerAgent.run(
              {
                task,
                dataResults: context.artifacts,
                charts: (context.artifacts['charts'] as ChartConfig[]) || [],
              },
              context,
            );
            if (result.success) {
              return {
                success: true,
                data: result.data,
                summary: result.summary,
              };
            }
            lastError = new Error(result.error?.message);
            break;
          }

          default:
            return {
              success: false,
              error: {
                message: `未知任务类型: ${task.type}`,
                code: 'UNKNOWN_TASK_TYPE',
              },
            };
        }
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `任务 ${task.id} 第 ${attempt + 1} 次尝试失败: ${lastError.message}`,
        );
      }
    }

    return {
      success: false,
      error: {
        message: lastError?.message || '任务执行失败',
        code: 'TASK_FAILED',
      },
    };
  }

  /**
   * 执行审阅
   */
  private async executeReview(
    context: AnalysisRunContext,
    onTaskUpdate?: (event: AgentTaskUpdateEvent) => void,
  ): Promise<void> {
    if (!context.plan) return;

    // 找到审阅任务
    const reviewTask = context.plan.tasks.find((t) => t.type === 'review');
    if (!reviewTask) {
      this.logger.log('无审阅任务，跳过');
      return;
    }

    reviewTask.status = 'running';
    reviewTask.startedAt = new Date().toISOString();
    this.emitTaskUpdate(context, reviewTask, onTaskUpdate);

    try {
      const charts = (context.artifacts['charts'] as ChartConfig[]) || [];
      const result = await this.reviewerAgent.run(
        {
          task: reviewTask,
          dataResults: context.artifacts,
          charts,
        },
        context,
      );

      if (result.success && result.data) {
        const reviewOutput = result.data;

        if (reviewOutput.status === 'pass') {
          reviewTask.status = 'success';
          reviewTask.outputs = reviewOutput as unknown as Record<
            string,
            unknown
          >;
        } else {
          // 审阅失败，尝试修复
          reviewTask.status = 'failed';
          reviewTask.outputs = reviewOutput as unknown as Record<
            string,
            unknown
          >;

          // 处理需要重跑的任务
          if (reviewOutput.issues) {
            for (const issue of reviewOutput.issues) {
              if (issue.fix?.rerunTaskId) {
                const taskToRerun = context.plan.tasks.find(
                  (t) => t.id === issue.fix!.rerunTaskId,
                );
                if (taskToRerun) {
                  this.logger.log(
                    `重跑任务 ${taskToRerun.id}: ${issue.message}`,
                  );
                  taskToRerun.status = 'pending';
                  taskToRerun.retryCount = (taskToRerun.retryCount || 0) + 1;

                  // 限制重试次数
                  if (taskToRerun.retryCount <= DEFAULT_MAX_RETRIES) {
                    await this.executeTask(taskToRerun, context);
                  }
                }
              }
            }
          }
        }
      } else {
        reviewTask.status = 'failed';
        reviewTask.error = { message: result.error?.message || '审阅失败' };
      }
    } catch (error) {
      const err = error as Error;
      reviewTask.status = 'failed';
      reviewTask.error = { message: err.message };
    }

    reviewTask.finishedAt = new Date().toISOString();
    this.emitTaskUpdate(context, reviewTask, onTaskUpdate);
  }

  /**
   * 生成最终报告
   */
  private async generateReport(context: AnalysisRunContext): Promise<string> {
    const summaries = context.summaries
      .map((s) => `- [${s.role}] ${s.text}`)
      .join('\n');
    const artifacts = Object.keys(context.artifacts);
    const retrievedContext =
      typeof context.artifacts['retrieved_context'] === 'string'
        ? context.artifacts['retrieved_context']
        : '无';

    const prompt = `你是一个数据分析报告撰写专家。请根据以下分析过程和结果，生成一份清晰、专业的分析报告。

【分析目标】
${context.plan?.goal || context.userPrompt}

【分析过程摘要】
${summaries}

【生成的产物】
${artifacts.join(', ')}

【历史上下文 / 知识库召回】
${retrievedContext}

【用户原始请求】
${context.userPrompt}

请生成一份结构清晰、重点突出的分析报告，包含：
1. 分析概述
2. 关键发现
3. 数据洞察
4. 建议与结论`;

    try {
      const report = await this.llmService.chat(prompt);
      return report;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`生成报告失败: ${err.message}`);
      return this.buildFallbackReport(context);
    }
  }

  /**
   * 获取任务类型对应的角色
   */
  private getRoleForTaskType(
    taskType: string,
  ): 'router' | 'data_coder' | 'viz' | 'reviewer' | 'writer' | undefined {
    switch (taskType) {
      case 'data_profile':
      case 'compute_metrics':
        return 'data_coder';
      case 'chart_spec':
        return 'viz';
      case 'review':
        return 'reviewer';
      case 'final_report':
        return 'writer';
      default:
        return undefined;
    }
  }

  /**
   * 生成分析 ID
   */
  private generateAnalysisId(): string {
    return `ma_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 构建错误响应
   */
  private buildErrorResponse(
    context: AnalysisRunContext,
    message: string,
  ): MultiAgentAnalyzeResponse {
    return {
      analysisId: context.analysisId,
      status: RunStatus.FAILED,
      plan: context.plan,
      artifacts: context.artifacts,
      error: message,
    };
  }

  /**
   * 发送进度事件
   */
  private emitProgress(
    context: AnalysisRunContext,
    message: string,
    callback?: (event: AgentProgressEvent) => void,
  ): void {
    if (!callback) return;

    const currentTask = context.plan?.tasks.find((t) => t.status === 'running');

    callback({
      analysisId: context.analysisId,
      status: context.status,
      currentTask: currentTask
        ? {
            id: currentTask.id,
            type: currentTask.type,
            status: currentTask.status,
          }
        : undefined,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 发送任务更新事件
   */
  private emitTaskUpdate(
    context: AnalysisRunContext,
    task: AgentTask,
    callback?: (event: AgentTaskUpdateEvent) => void,
  ): void {
    if (!callback) return;

    callback({
      analysisId: context.analysisId,
      taskId: task.id,
      taskType: task.type,
      status: task.status,
      outputs: task.outputs,
      error: task.error,
      timestamp: new Date().toISOString(),
    });
  }

  private buildFallbackReport(context: AnalysisRunContext): string {
    const planSummary =
      context.plan?.tasks
        .map((task) => `- ${task.type}: ${task.status}`)
        .join('\n') ?? '- 暂无任务';
    const artifactSummary = Object.entries(context.artifacts)
      .filter(([key]) => key !== 'retrieved_context')
      .map(([key, value]) => `- ${key}: ${this.summarizeArtifact(value)}`)
      .join('\n');

    return [
      `# 分析报告`,
      ``,
      `## 我刚刚干了什么`,
      `- 目标：${context.plan?.goal ?? context.userPrompt}`,
      `- 状态：${context.status}`,
      ``,
      `## 任务执行`,
      planSummary,
      ``,
      `## 关键产物`,
      artifactSummary || '- 目前还没有产物，像极了周一早上的脑子',
      ``,
      `## 总结`,
      `- 当前报告由规则兜底生成，适合本地开发和离线验证。`,
      `- 如果要更像“会写 PPT 的分析师”，补上真实大模型配置即可。`,
    ].join('\n');
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

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}

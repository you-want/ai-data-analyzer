/**
 * 多智能体系统核心类型定义
 * 定义 Agent 接口、共享上下文、状态机等
 */

// Agent 角色枚举
export type AgentRole = 'router' | 'data_coder' | 'viz' | 'reviewer' | 'writer';

// 任务状态枚举
export type TaskStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

// 运行状态枚举（状态机）
export enum RunStatus {
  /** Router 已生成 plan */
  ROUTED = 'ROUTED',
  /** Supervisor 按 tasks 执行（可并行） */
  EXECUTING = 'EXECUTING',
  /** Reviewer 审阅与决策（通过/重跑/降级） */
  REVIEWING = 'REVIEWING',
  /** Writer 汇总产出（文本 + 图表元数据） */
  FINALIZING = 'FINALIZING',
  /** 完成 */
  DONE = 'DONE',
  /** 失败 */
  FAILED = 'FAILED',
}

// Agent 任务定义
export interface AgentTask {
  id: string;
  type: string; // data_profile | compute_metrics | chart_spec | review | final_report
  status: TaskStatus;
  inputs: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  error?: { message: string; code?: string };
  startedAt?: string;
  finishedAt?: string;
  tokens?: { input?: number; output?: number; total?: number };
  retryCount?: number;
}

// 任务计划
export interface AnalysisPlan {
  goal: string;
  tasks: AgentTask[];
  createdAt: string;
}

// 分析运行上下文（共享上下文）
export interface AnalysisRunContext {
  analysisId: string;
  datasetId?: string;
  userPrompt: string;
  rawData?: Record<string, unknown>[];
  status: RunStatus;
  plan?: AnalysisPlan;
  /** 可复用的产物：清洗后的表、聚合后的表、图表 option、异常列表 */
  artifacts: Record<string, unknown>;
  /** 每完成一个 task，就产出 3~8 行摘要供后续 Agent 使用 */
  summaries: Array<{ role: AgentRole; text: string; at: string }>;
  /** Token 预算控制 */
  tokenBudget?: {
    maxTokens: number;
    usedTokens: number;
  };
  /** 最大步数控制 */
  maxSteps?: number;
  currentStep?: number;
  createdAt: string;
  updatedAt: string;
}

// Agent 输入输出接口
export interface Agent<Input = unknown, Output = unknown> {
  role: AgentRole;
  run(input: Input, context: AnalysisRunContext): Promise<AgentResult<Output>>;
}

// Agent 执行结果
export interface AgentResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    retryable?: boolean;
  };
  tokens?: {
    input: number;
    output: number;
    total: number;
  };
  summary?: string;
}

// Router Agent 输出：任务计划
export interface RouterAgentOutput {
  goal: string;
  tasks: Array<{
    id: string;
    type: string;
    inputs: Record<string, unknown>;
  }>;
  risks?: string[];
  clarificationNeeded?: boolean;
  clarificationQuestion?: string;
}

// Data Coder Agent 输入
export interface DataCoderAgentInput {
  task: AgentTask;
  data: Record<string, unknown>[];
}

// Data Coder Agent 输出
export interface DataCoderAgentOutput {
  resultKey: string;
  result: Record<string, unknown>;
  processDescription?: string;
}

// Viz Agent 输入
export interface VizAgentInput {
  task: AgentTask;
  dataResults: Record<string, unknown>;
}

// 图表配置
export interface ChartConfig {
  id: string;
  library: 'echarts';
  option: Record<string, unknown>;
  dataRef: {
    resultKey: string;
    fields?: string[];
  };
}

// Viz Agent 输出
export interface VizAgentOutput {
  charts: ChartConfig[];
}

// Reviewer Agent 输入
export interface ReviewerAgentInput {
  task: AgentTask;
  dataResults: Record<string, unknown>;
  charts: ChartConfig[];
}

// Reviewer Agent 输出
export interface ReviewerAgentOutput {
  status: 'pass' | 'fail';
  issues?: Array<{
    type: string;
    message: string;
    fix?: {
      rerunTaskId: string;
      reason?: string;
    };
  }>;
  suggestions?: string[];
}

// Writer Agent 输入
export interface WriterAgentInput {
  userPrompt: string;
  dataResults: Record<string, unknown>;
  charts: ChartConfig[];
  reviewResult: ReviewerAgentOutput;
  style?: 'bullet' | 'paragraph' | 'business';
  audience?: string;
}

// Writer Agent 输出
export interface WriterAgentOutput {
  report: string;
  highlights?: string[];
}

// 多智能体分析请求
export interface MultiAgentAnalyzeRequest {
  prompt: string;
  data: Record<string, unknown>[];
  datasetId?: string;
  options?: {
    maxSteps?: number;
    maxTokens?: number;
    enableReview?: boolean;
    enableCharts?: boolean;
  };
}

// 多智能体分析响应
export interface MultiAgentAnalyzeResponse {
  analysisId: string;
  status: RunStatus;
  plan?: AnalysisPlan;
  artifacts?: Record<string, unknown>;
  report?: string;
  error?: string;
}

// WebSocket 事件类型
export interface AgentProgressEvent {
  analysisId: string;
  status: RunStatus;
  currentTask?: {
    id: string;
    type: string;
    status: TaskStatus;
  };
  message: string;
  timestamp: string;
}

export interface AgentTaskUpdateEvent {
  analysisId: string;
  taskId: string;
  status: TaskStatus;
  outputs?: Record<string, unknown>;
  error?: { message: string; code?: string };
  timestamp: string;
}

'use client';

import { useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import TaskStatusViewer from './TaskStatusViewer';
import { BACKEND_URL } from '@/lib/backend';
import { useAuth } from './providers/AuthProvider';

interface AgentTask {
  id: string;
  type: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  error?: { message: string; code?: string };
}

export default function MultiAgentForm() {
  const { isAuthenticated, user, activeWorkspaceId } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [reportPreview, setReportPreview] = useState<string | null>(null);

  const sampleData = useMemo(
    () => [
      { month: '2024-01', sales: 100000, region: '北京' },
      { month: '2024-02', sales: 120000, region: '北京' },
      { month: '2024-03', sales: 80000, region: '北京' },
      { month: '2024-04', sales: 150000, region: '北京' },
      { month: '2024-01', sales: 90000, region: '上海' },
      { month: '2024-02', sales: 110000, region: '上海' },
      { month: '2024-03', sales: 130000, region: '上海' },
      { month: '2024-04', sales: 160000, region: '上海' },
    ],
    [],
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    if (!isAuthenticated || !user || !activeWorkspaceId) {
      setError('请先登录并选择工作空间，再启动多智能体分析。');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysisId(null);
    setTasks([]);
    setReportPreview(null);

    const socket = io(`${BACKEND_URL}/multi-agent`, {
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('WebSocket connected');
      socket.emit('start_multi_analysis', {
        prompt,
        data: sampleData,
        workspaceId: activeWorkspaceId,
        userId: user.id,
        options: { maxSteps: 10, enableReview: true, enableCharts: true },
      });
    });

    socket.on('agent_progress', (event: { analysisId?: string; status: string; message: string }) => {
      console.log('Progress:', event);
      if (!analysisId && event.analysisId) {
        setAnalysisId(event.analysisId);
      }
    });

    socket.on('task_update', (event: { taskId: string; status: string; taskType?: string; outputs?: Record<string, unknown>; error?: { message: string; code?: string } }) => {
      console.log('Task update:', event);
      const taskStatus = event.status as 'pending' | 'running' | 'success' | 'failed' | 'skipped';
      setTasks(prev => {
        const existingIndex = prev.findIndex(t => t.id === event.taskId);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            status: taskStatus,
            outputs: event.outputs,
            error: event.error,
          };
          return updated;
        }
        return [...prev, {
          id: event.taskId,
          type: event.taskType || 'unknown',
          status: taskStatus,
          inputs: {},
          outputs: event.outputs,
          error: event.error,
        }];
      });
    });

    socket.on('analysis_complete', (result) => {
      console.log('Analysis complete:', result);
      setReportPreview(typeof result?.report === 'string' ? result.report : null);
      setIsAnalyzing(false);
      socket.close();
    });

    socket.on('analysis_error', (error) => {
      console.error('Analysis error:', error);
      setError(error.message || '分析过程中发生错误');
      setIsAnalyzing(false);
      socket.close();
    });

    socket.on('connect_error', (err) => {
      console.error('Connection error:', err);
      setError('无法连接到多智能体服务');
      setIsAnalyzing(false);
    });
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="multi-prompt"
            className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2"
          >
            多智能体分析请求
          </label>
          <textarea
            id="multi-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="例如：分析销售趋势并找出异常月份，生成可视化图表..."
            className="w-full px-4 py-3 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-zinc-800 dark:text-zinc-100 transition-all"
            rows={4}
            disabled={isAnalyzing}
          />
        </div>

        <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
          {isAuthenticated
            ? `当前会把分析结果挂到 workspace ${activeWorkspaceId}，发起人是 ${user?.name}。`
            : '请先在首页登录，不然这套 SaaS 能力就像还没插电的机甲。'}
        </div>

        <button
          type="submit"
          disabled={isAnalyzing || !prompt.trim() || !isAuthenticated}
          className="w-full px-6 py-3 bg-linear-to-r from-blue-600 to-purple-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
        >
          {isAnalyzing ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              多智能体协作分析中...
            </span>
          ) : (
            '开始多智能体分析'
          )}
        </button>
      </form>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {analysisId && (
        <TaskStatusViewer mode="multi" analysisId={analysisId} tasks={tasks} />
      )}

      {reportPreview && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-950">
          <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-zinc-100">
            最终报告预览
          </h3>
          <pre className="whitespace-pre-wrap text-sm leading-7 text-gray-700 dark:text-zinc-200">
            {reportPreview}
          </pre>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { io, Socket } from 'socket.io-client';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface AgentTask {
  id: string;
  type: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  error?: { message: string; code?: string };
  startedAt?: string;
  finishedAt?: string;
}

interface AgentProgressEvent {
  analysisId: string;
  status: string;
  currentTask?: {
    id: string;
    type: string;
    status: string;
  };
  message: string;
  timestamp: string;
}

interface AgentTaskUpdateEvent {
  analysisId: string;
  taskId: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  outputs?: Record<string, unknown>;
  error?: { message: string; code?: string };
  timestamp: string;
}

interface TaskStatusViewerProps {
  jobId?: string;
  analysisId?: string;
  mode?: 'single' | 'multi';
  tasks?: Array<{
    id: string;
    type: string;
    status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
    inputs?: Record<string, unknown>;
    outputs?: Record<string, unknown>;
    error?: { message: string; code?: string };
  }>;
}

export default function TaskStatusViewer({ 
  jobId, 
  analysisId, 
  mode = 'single',
  tasks: externalTasks 
}: TaskStatusViewerProps) {
  const [internalTasks, setInternalTasks] = useState<AgentTask[]>([]);
  const [currentStatus, setCurrentStatus] = useState<string>('');
  const [progressMessages, setProgressMessages] = useState<string[]>([]);
  const socketRef = useRef<Socket | null>(null);

  // 使用外部传入的任务或内部状态的任务
  const tasks = externalTasks && externalTasks.length > 0 ? externalTasks : internalTasks;

  // 单任务模式：使用原有的轮询方式
  const { data, error, isLoading } = useSWR(
    mode === 'single' && jobId ? `http://localhost:3001/analysis/status/${jobId}` : null,
    fetcher,
    { refreshInterval: 2000 }
  );

  // 多智能体模式：使用 WebSocket 实时推送
  useEffect(() => {
    if (mode === 'multi' && analysisId) {
      const newSocket = io('http://localhost:3001/multi-agent', {
        transports: ['websocket'],
      });

      newSocket.on('connect', () => {
        console.log('WebSocket connected');
      });

      newSocket.on('agent_progress', (event: AgentProgressEvent) => {
        setCurrentStatus(event.status);
        setProgressMessages(prev => [...prev, `[${event.status}] ${event.message}`]);
      });

      // 只有在没有外部任务时才更新内部状态
      if (!externalTasks || externalTasks.length === 0) {
        newSocket.on('task_update', (event: AgentTaskUpdateEvent) => {
          setInternalTasks(prev => {
            const existingIndex = prev.findIndex(t => t.id === event.taskId);
            if (existingIndex >= 0) {
              const updated = [...prev];
              updated[existingIndex] = {
                ...updated[existingIndex],
                status: event.status,
                outputs: event.outputs,
                error: event.error,
              };
              return updated;
            }
            return prev;
          });
        });
      }

      newSocket.on('analysis_complete', () => {
        setCurrentStatus('DONE');
        setProgressMessages(prev => [...prev, '[DONE] 分析完成']);
      });

      newSocket.on('analysis_error', (error) => {
        setCurrentStatus('FAILED');
        setProgressMessages(prev => [...prev, `[FAILED] ${error.message}`]);
      });

      socketRef.current = newSocket;

      return () => {
        newSocket.close();
      };
    }
  }, [mode, analysisId, externalTasks]);

  // 单任务模式渲染
  if (mode === 'single') {
    if (isLoading) return <div className="text-gray-500">加载中...</div>;
    if (error) return <div className="text-red-500">获取状态失败</div>;

    return (
      <div className="mt-4 p-4 border border-gray-200 dark:border-zinc-700 rounded-md">
        <p className="font-semibold text-black dark:text-zinc-100">
          当前任务状态：{data?.status}
        </p>
        {data?.status === 'completed' && (
          <div className="mt-2 text-green-600 dark:text-green-400">
            <p>分析结果: {JSON.stringify(data.result)}</p>
          </div>
        )}
      </div>
    );
  }

  // 多智能体模式渲染
  return (
    <div className="mt-4 p-4 border border-gray-200 dark:border-zinc-700 rounded-md">
      <h3 className="font-semibold text-black dark:text-zinc-100 mb-3">
        多智能体任务状态
      </h3>
      
      {/* 当前状态 */}
      <div className="mb-4">
        <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
          currentStatus === 'DONE' ? 'bg-green-100 text-green-700' :
          currentStatus === 'FAILED' ? 'bg-red-100 text-red-700' :
          currentStatus === 'EXECUTING' ? 'bg-blue-100 text-blue-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {currentStatus || '等待中'}
        </span>
      </div>

      {/* 任务列表 */}
      {tasks.length > 0 && (
        <div className="space-y-2 mb-4">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-zinc-800 rounded"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-black dark:text-zinc-100">
                    {task.type}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-zinc-400">
                    {task.id}
                  </span>
                </div>
                {task.error && (
                  <div className="text-xs text-red-500 mt-1">
                    {task.error.message}
                  </div>
                )}
              </div>
              <span
                className={`px-2 py-1 rounded text-xs ${
                  task.status === 'success'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                    : task.status === 'failed'
                    ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                    : task.status === 'running'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                    : task.status === 'skipped'
                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300'
                }`}
              >
                {task.status === 'success' && '✓ '}
                {task.status === 'failed' && '✗ '}
                {task.status === 'running' && '⏳ '}
                {task.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 进度消息 */}
      {progressMessages.length > 0 && (
        <div className="mt-4 p-3 bg-gray-50 dark:bg-zinc-800 rounded max-h-48 overflow-y-auto">
          <h4 className="text-sm font-medium text-black dark:text-zinc-100 mb-2">
            执行日志
          </h4>
          <div className="space-y-1">
            {progressMessages.map((msg, idx) => (
              <div key={idx} className="text-xs text-gray-600 dark:text-gray-400">
                {msg}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

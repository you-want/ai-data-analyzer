'use client';

import useSWR from 'swr';
import { apiFetch } from '@/lib/backend';
import { useAuth } from './providers/AuthProvider';

interface UsageSummary {
  subscription: {
    plan: string;
    status: string;
  };
  limits: {
    monthlyTokens: number;
    monthlyRequests: number;
    concurrentJobs: number;
    requestsPerMinute: number;
  };
  usage: {
    tokens: number;
    requests: number;
    execSeconds: number;
  };
}

export default function WorkspaceStatusPanel() {
  const { accessToken, activeWorkspaceId, isAuthenticated } = useAuth();

  const { data, error, isLoading } = useSWR<UsageSummary>(
    isAuthenticated && accessToken && activeWorkspaceId
      ? ['billing-usage', activeWorkspaceId]
      : null,
    () =>
      apiFetch<UsageSummary>('/billing/usage', {
        accessToken: accessToken || undefined,
        workspaceId: activeWorkspaceId || undefined,
      }),
  );

  if (!isAuthenticated) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        先登录并选择工作空间，这里才能展示套餐额度和用量。不然它只能像财务一样沉默地盯着你。
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        正在读取工作空间套餐与用量...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
        读取计费信息失败：{error instanceof Error ? error.message : '未知错误'}
      </div>
    );
  }

  const tokenUsageRate = Math.min(
    100,
    Math.round((data.usage.tokens / data.limits.monthlyTokens) * 100),
  );
  const requestUsageRate = Math.min(
    100,
    Math.round((data.usage.requests / data.limits.monthlyRequests) * 100),
  );

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-zinc-100">
            工作空间套餐与用量
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            套餐：{data.subscription.plan} / 状态：{data.subscription.status}
          </p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
          并发上限 {data.limits.concurrentJobs}
        </span>
      </div>

      <div className="mt-5 space-y-4">
        <UsageBar
          label="本月 Token"
          current={data.usage.tokens}
          total={data.limits.monthlyTokens}
          percentage={tokenUsageRate}
        />
        <UsageBar
          label="本月请求数"
          current={data.usage.requests}
          total={data.limits.monthlyRequests}
          percentage={requestUsageRate}
        />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-sm text-gray-600 dark:text-zinc-300">
        <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-zinc-950">
          <div className="text-xs text-gray-500 dark:text-zinc-500">执行器耗时</div>
          <div className="mt-1 font-medium">{data.usage.execSeconds.toFixed(1)} s</div>
        </div>
        <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-zinc-950">
          <div className="text-xs text-gray-500 dark:text-zinc-500">每分钟限流</div>
          <div className="mt-1 font-medium">{data.limits.requestsPerMinute} req/min</div>
        </div>
      </div>
    </div>
  );
}

function UsageBar({
  label,
  current,
  total,
  percentage,
}: {
  label: string;
  current: number;
  total: number;
  percentage: number;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-gray-700 dark:text-zinc-200">{label}</span>
        <span className="text-gray-500 dark:text-zinc-400">
          {current.toLocaleString()} / {total.toLocaleString()}
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 dark:bg-zinc-800">
        <div
          className="h-2 rounded-full bg-linear-to-r from-cyan-400 to-blue-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

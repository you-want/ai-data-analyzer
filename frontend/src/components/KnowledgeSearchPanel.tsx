'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/backend';
import { useAuth } from './providers/AuthProvider';

interface QueryResponse {
  items: Array<{
    chunkId: string;
    chunkType: string;
    content: string;
    score: number;
  }>;
  contextPack: string;
}

export default function KnowledgeSearchPanel() {
  const { isAuthenticated, accessToken, activeWorkspaceId } = useAuth();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QueryResponse | null>(null);

  const handleSearch = async () => {
    if (!query.trim() || !accessToken || !activeWorkspaceId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = await apiFetch<QueryResponse>(
        `/knowledge-base/query?q=${encodeURIComponent(query)}&topK=5`,
        {
          accessToken,
          workspaceId: activeWorkspaceId,
        },
      );
      setResult(payload);
    } catch (searchError) {
      setError(
        searchError instanceof Error ? searchError.message : '检索失败，请稍后重试',
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        登录后才能查工作空间知识库，不然系统只能靠缘分回忆历史报告。
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-zinc-100">
            知识库检索
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            试着问问历史报告，比如“上次销售异常主要发生在哪个月”。
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="输入检索问题..."
          className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          className="rounded-xl bg-linear-to-r from-violet-500 to-indigo-500 px-5 py-3 text-sm font-medium text-white transition hover:from-violet-400 hover:to-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? '检索中...' : '检索'}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-5 space-y-4">
          <div className="rounded-xl bg-gray-50 p-4 text-xs leading-6 text-gray-600 dark:bg-zinc-950 dark:text-zinc-300">
            <div className="mb-2 text-sm font-medium text-gray-900 dark:text-zinc-100">
              Context Pack
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap font-mono">
              {result.contextPack || '当前还没有可引用的知识块'}
            </pre>
          </div>

          <div className="space-y-3">
            {result.items.map((item) => (
              <div
                key={item.chunkId}
                className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium uppercase tracking-wide text-blue-600 dark:text-blue-300">
                    {item.chunkType}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-zinc-500">
                    score {item.score.toFixed(3)}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-7 text-gray-700 dark:text-zinc-200">
                  {item.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

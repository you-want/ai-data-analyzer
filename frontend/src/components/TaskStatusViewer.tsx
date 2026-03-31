"use client";

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function TaskStatusViewer({ jobId }: { jobId: string }) {
  // 每隔 2 秒自动轮询后端 /analysis/status/:jobId 接口
  const { data, error, isLoading } = useSWR(
    `http://localhost:3001/analysis/status/${jobId}`, 
    fetcher, 
    { refreshInterval: 2000 }
  );

  if (isLoading) return <div className="text-gray-500">加载中...</div>;
  if (error) return <div className="text-red-500">获取状态失败</div>;

  return (
    <div className="mt-4 p-4 border border-gray-200 dark:border-zinc-700 rounded-md">
      <p className="font-semibold text-black dark:text-zinc-100">当前任务状态：{data?.status}</p>
      {data?.status === 'completed' && (
        <div className="mt-2 text-green-600 dark:text-green-400">
          <p>分析结果: {JSON.stringify(data.result)}</p>
        </div>
      )}
    </div>
  );
}

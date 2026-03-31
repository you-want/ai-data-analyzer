// frontend/src/app/dashboard/page.tsx (Server Component)
import AnalysisForm from '@/components/AnalysisForm';
import UploadForm from '@/components/UploadForm';
import TaskStatusViewer from '@/components/TaskStatusViewer';

export default async function DashboardPage() {
  // 服务端获取基础状态 (极快)
  // 为了防止后端没启动导致构建/渲染失败，我们加一个 try catch
  let statusText = '未知';
  try {
    const res = await fetch('http://localhost:3001/analysis/status', { cache: 'no-store' });
    if (res.ok) {
      statusText = await res.text();
    } else {
      statusText = '后端响应异常';
    }
  } catch (error) {
    console.error('后端连接失败:', error);
    statusText = '后端未连接 (请确保 nestjs 在 3001 端口运行)';
  }

  return (
    <div className="min-h-screen p-8 bg-white text-black dark:bg-zinc-900 dark:text-zinc-100">
      <header className="mb-8 border-b border-gray-200 dark:border-zinc-700 pb-4">
        <h1 className="text-3xl font-bold">AI 智能数据分析终端</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">后端连接状态: {statusText}</p>
      </header>
      
      <main className="space-y-12">
        <section>
          <h2 className="text-xl font-semibold mb-4">1. 快速分析 (Client Component)</h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">请输入您的业务数据和分析需求，我们的 AI Agent 将为您生成专业洞察。</p>
          <AnalysisForm />
        </section>

        <section className="border-t border-gray-200 dark:border-zinc-800 pt-8">
          <h2 className="text-xl font-semibold mb-4">2. 数据上传 (Server Actions)</h2>
          <p className="text-gray-700 dark:text-gray-300">使用 Next.js Server Actions 直接上传文件到后端微服务。</p>
          <UploadForm />
        </section>

        <section className="border-t border-gray-200 dark:border-zinc-800 pt-8">
          <h2 className="text-xl font-semibold mb-4">3. 异步任务状态轮询 (SWR)</h2>
          <p className="text-gray-700 dark:text-gray-300">演示 SWR 如何在客户端优雅地轮询后端异步任务。</p>
          {/* 这里可以传入一个模拟的 jobId，实际使用中由上传接口返回 */}
          <TaskStatusViewer jobId="demo-job-123" />
        </section>
      </main>
    </div>
  );
}

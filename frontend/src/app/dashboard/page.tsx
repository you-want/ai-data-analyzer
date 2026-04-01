// frontend/src/app/dashboard/page.tsx (Server Component)
import AnalysisForm from '@/components/AnalysisForm';
import UploadForm from '@/components/UploadForm';
import TaskStatusViewer from '@/components/TaskStatusViewer';
import MetricCard from '@/components/MetricCard';
import AdvancedSalesChart from '@/components/charts/AdvancedSalesChart';
import DataGalaxy3D from '@/components/charts/DataGalaxy3D';
import UserRadarChart from '@/components/charts/UserRadarChart';
import KnowledgeGraphChart from '@/components/charts/KnowledgeGraphChart';

export default async function DashboardPage() {
  // 服务端获取基础状态 (极快)
  // 为了防止后端没启动导致构建/渲染失败，我们加一个 try catch
  let statusText = '未知';
  let isConnected = false;
  try {
    const res = await fetch('http://localhost:3001/analysis/status', { cache: 'no-store' });
    if (res.ok) {
      statusText = await res.text();
      isConnected = true;
    } else {
      statusText = '后端响应异常';
    }
  } catch (error) {
    console.error('后端连接失败:', error);
    statusText = '后端未连接 (请确保 nestjs 在 3001 端口运行)';
  }

  return (
    <div className="space-y-8">
      {/* 欢迎模块 & 状态展示 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">欢迎回来，数据分析师 👋</h2>
          <p className="text-gray-500 dark:text-zinc-400 mt-1">今天的数据准备好进行 AI 深度分析了吗？</p>
        </div>
        <div className="flex items-center gap-3 bg-gray-50 dark:bg-zinc-950 px-4 py-2 rounded-lg border border-gray-100 dark:border-zinc-800">
          <div className="flex flex-col">
            <span className="text-xs text-gray-500 dark:text-zinc-500">NestJS 引擎状态</span>
            <span className="text-sm font-medium text-gray-900 dark:text-zinc-200">{statusText}</span>
          </div>
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
        </div>
      </div>

      {/* 核心指标卡片区域 (Grid 布局) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="今日分析任务" 
          value="24" 
          trend="12%" 
          isPositive={true} 
          icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>}
        />
        <MetricCard 
          title="已处理数据量" 
          value="1.2 GB" 
          trend="8.5%" 
          isPositive={true} 
          icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>}
        />
        <MetricCard 
          title="AI 洞察生成数" 
          value="156" 
          trend="2.4%" 
          isPositive={false} 
          icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
        />
        <MetricCard 
          title="队列排队中" 
          value="0" 
          icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
        />
      </div>

      {/* 数据可视化区域 1：基础趋势与 3D 概览 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[450px]">
        {/* 左侧：2D 复杂图表 (ECharts) */}
        <AdvancedSalesChart />

        {/* 右侧：3D 数据星系 (Three.js / React Three Fiber) */}
        <DataGalaxy3D />
      </div>

      {/* 数据可视化区域 2：进阶多维分析与图谱 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[450px]">
        {/* 左侧：多维特征雷达图 (ECharts) */}
        <UserRadarChart />

        {/* 右侧：AI 知识图谱 (ECharts Force Graph) */}
        <KnowledgeGraphChart />
      </div>

      {/* 业务功能操作区 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 左侧：数据上传与轮询状态 */}
        <div className="space-y-8">
          <section className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800">
            <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-zinc-100">批量数据上传</h2>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mb-6">上传您的 CSV/JSON 业务数据文件，引擎将自动排队解析并生成初步画像。</p>
            <UploadForm />
          </section>

          <section className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800">
            <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-zinc-100">后台任务状态监听</h2>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mb-6">通过 SWR 轮询，实时追踪您的数据分析进度。</p>
            <TaskStatusViewer jobId="demo-job-123" />
          </section>
        </div>

        {/* 右侧：自然语言交互分析 */}
        <section className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 flex flex-col h-full">
          <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-zinc-100">AI 数据洞察对话</h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mb-6">直接输入您想了解的数据趋势或具体指标问题，让大模型为您解答。</p>
          <div className="flex-1">
            <AnalysisForm />
          </div>
        </section>
      </div>
    </div>
  );
}

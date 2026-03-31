import React from 'react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-zinc-950 text-black dark:text-zinc-100">
      {/* 左侧边栏 (Sidebar) */}
      <aside className="w-64 bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800 p-4 hidden md:flex flex-col">
        <div className="mb-8 px-2">
          <h2 className="text-2xl font-bold bg-linear-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            AI Analyzer
          </h2>
          <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1">智能数据洞察引擎</p>
        </div>
        
        <nav className="flex-1">
          <ul className="space-y-2">
            <li>
              <a href="/dashboard" className="block p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg font-medium transition-colors">
                总览面板
              </a>
            </li>
            <li>
              <a href="#" className="block p-3 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800/50 hover:text-gray-900 dark:hover:text-zinc-200 rounded-lg font-medium transition-colors">
                数据源管理
              </a>
            </li>
            <li>
              <a href="#" className="block p-3 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800/50 hover:text-gray-900 dark:hover:text-zinc-200 rounded-lg font-medium transition-colors">
                分析报告历史
              </a>
            </li>
            <li>
              <a href="#" className="block p-3 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800/50 hover:text-gray-900 dark:hover:text-zinc-200 rounded-lg font-medium transition-colors">
                系统设置
              </a>
            </li>
          </ul>
        </nav>
        
        {/* 底部用户信息 */}
        <div className="border-t border-gray-200 dark:border-zinc-800 pt-4 mt-auto">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-linear-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
              A
            </div>
            <div>
              <p className="text-sm font-medium">Admin User</p>
              <p className="text-xs text-gray-500 dark:text-zinc-500">Pro Plan</p>
            </div>
          </div>
        </div>
      </aside>

      {/* 右侧主体区 */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* 顶部 Header */}
        <header className="h-16 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-gray-200 dark:border-zinc-800 flex items-center px-6 justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-gray-800 dark:text-zinc-100">控制台</h1>
            <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded-full border border-green-200 dark:border-green-800">
              系统运行正常
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <button className="text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
            </button>
            <button className="text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </button>
          </div>
        </header>

        {/* 核心内容滚动区 */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
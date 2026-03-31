"use client"; // 声明为客户端组件

import { useState } from 'react';

// 定义分析结果的类型接口
interface AnalysisResult {
  success: boolean;
  data?: {
    summary: string;
    confidenceScore: number;
    [key: string]: unknown;
  };
  message?: string;
}

export default function AnalysisForm() {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async () => { 
    setLoading(true);
    try {
      // 这里的 fetch 发生在浏览器端
      const res = await fetch('http://localhost:3001/analysis/structured', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const data = await res.json();
      setResult(data);
    } catch (error) {
      console.error("分析失败", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 max-w-xl mt-6">
      <textarea 
        className="w-full p-3 border border-gray-300 dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 text-black dark:text-zinc-100 dark:bg-zinc-800"
        rows={4}
        placeholder="例如：请分析2023年Q1销售额为100万，Q2销售额为150万的数据趋势"
        value={prompt} 
        onChange={(e) => setPrompt(e.target.value)} 
      />
      <button 
        className="bg-black dark:bg-white text-white dark:text-black font-semibold px-6 py-2 rounded-md hover:bg-gray-800 dark:hover:bg-gray-200 disabled:bg-gray-400 disabled:dark:bg-zinc-600 transition-colors"
        onClick={handleSubmit}
        disabled={loading || !prompt}
      >
        {loading ? 'AI 分析中...' : '开始智能分析'}
      </button>

      {/* 渲染后端返回的结构化 JSON 数据 */}
      {result && result.success && result.data && (
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md text-black dark:text-blue-100">
          <h3 className="font-bold mb-2 text-blue-900 dark:text-blue-200">分析摘要：</h3>
          <p>{result.data.summary}</p>
          <p className="text-sm text-gray-500 dark:text-blue-300/70 mt-2">信心指数: {result.data.confidenceScore}</p>
        </div>
      )}
      
      {result && !result.success && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-200">
          <p>分析出错，请重试或检查后端服务。</p>
        </div>
      )}
    </div>
  );
}

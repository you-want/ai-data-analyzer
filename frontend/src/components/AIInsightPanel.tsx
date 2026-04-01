"use client";

import React from 'react';
import FeedbackWidget from './FeedbackWidget';

interface AIInsightPanelProps {
  summary: string;
  confidenceScore: number;
  insightId?: string; // 模拟的分析任务 ID
}

export default function AIInsightPanel({ summary, confidenceScore, insightId = "demo-insight-123" }: AIInsightPanelProps) {
  return (
    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-900/20 p-6 rounded-xl border border-indigo-100 dark:border-indigo-800/50 relative overflow-hidden">
      {/* 装饰性图标 */}
      <div className="absolute top-4 right-4 text-indigo-200 dark:text-indigo-800/50">
        <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20">
          <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"></path>
        </svg>
      </div>
      
      <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-200 mb-4 flex items-center gap-2">
        <span>✨ AI 深度洞察</span>
      </h3>
      
      <div className="prose prose-indigo dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
        {/* 这里可以替换为 ReactMarkdown，这里先用普通段落展示 */}
        <p className="whitespace-pre-wrap leading-relaxed">{summary}</p>
        
        <div className="mt-4 flex items-center gap-2">
          <span className="text-xs px-2 py-1 bg-white/50 dark:bg-black/20 rounded-md text-indigo-600 dark:text-indigo-300 font-medium border border-indigo-100 dark:border-indigo-800/30">
            信心指数: {(confidenceScore * 100).toFixed(0)}%
          </span>
        </div>
      </div>
      
      {/* 反馈接口区 */}
      <FeedbackWidget insightId={insightId} />
    </div>
  );
}

"use client";

import { useState } from 'react';

interface FeedbackWidgetProps {
  insightId: string;
}

export default function FeedbackWidget({ insightId }: FeedbackWidgetProps) {
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleFeedback = async (type: 'up' | 'down') => {
    if (submitting || feedback) return; // 防止重复提交
    setSubmitting(true);
    try {
      const res = await fetch('http://localhost:3001/analysis/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insightId, type })
      });
      if (res.ok) {
        setFeedback(type);
      }
    } catch (error) {
      console.error('提交反馈失败', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-indigo-100/50 dark:border-indigo-900/30 flex items-center justify-between">
      <span className="text-sm text-indigo-600/80 dark:text-indigo-300/80">这个分析对您有帮助吗？</span>
      <div className="flex gap-2">
        <button 
          onClick={() => handleFeedback('up')}
          disabled={submitting || feedback !== null}
          className={`p-2 rounded-full transition-colors ${
            feedback === 'up' 
              ? 'bg-indigo-200 text-indigo-700 dark:bg-indigo-800 dark:text-indigo-200' 
              : 'hover:bg-indigo-100 text-indigo-400 dark:hover:bg-indigo-900/50 dark:text-indigo-400'
          } ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-label="赞"
        >
          👍 
        </button>
        <button 
          onClick={() => handleFeedback('down')}
          disabled={submitting || feedback !== null}
          className={`p-2 rounded-full transition-colors ${
            feedback === 'down' 
              ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300' 
              : 'hover:bg-red-50 text-red-400 dark:hover:bg-red-900/20 dark:text-red-400'
          } ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-label="踩"
        >
          👎
        </button>
      </div>
    </div>
  );
}

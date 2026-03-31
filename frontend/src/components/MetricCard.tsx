import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  trend?: string;
  isPositive?: boolean;
  icon?: React.ReactNode;
}

export default function MetricCard({ title, value, trend, isPositive, icon }: MetricCardProps) {
  return (
    <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 transition-all hover:shadow-md">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-sm font-medium text-gray-500 dark:text-zinc-400">{title}</h3>
        {icon && <div className="text-gray-400 dark:text-zinc-500">{icon}</div>}
      </div>
      
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-bold text-gray-900 dark:text-zinc-100">{value}</span>
        
        {trend && (
          <span className={`text-sm font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${
            isPositive 
              ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' 
              : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
          }`}>
            {isPositive ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>
            )}
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}
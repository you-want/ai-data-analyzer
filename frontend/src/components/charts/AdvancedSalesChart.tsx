"use client";

import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';

interface EChartsComponentProps {
  title?: string;
  data?: Record<string, unknown>[];
}

export default function AdvancedSalesChart({ title = '全渠道销售趋势与预测', data }: EChartsComponentProps) {
  // 模拟一些复杂数据用于展示 ECharts 的强大能力
  const xAxisData = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const onlineSales = [120, 132, 101, 134, 90, 230, 210, 250, 300, 280, 400, 350];
  const offlineSales = [220, 182, 191, 234, 290, 330, 310, 280, 250, 300, 320, 380];
  
  // 动态主题配置
  // 实际项目中可以通过 next-themes 拿到当前是 dark 还是 light
  const isDark = false; // 简化的判断逻辑

  const option = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        label: {
          backgroundColor: '#6a7985'
        }
      }
    },
    legend: {
      data: ['线上销售', '线下销售', '总销售预测'],
      textStyle: {
        color: isDark ? '#A1A1AA' : '#4B5563'
      }
    },
    toolbox: {
      feature: {
        saveAsImage: { title: '保存' },
        magicType: { type: ['line', 'bar'], title: { line: '折线', bar: '柱状' } }
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: [
      {
        type: 'category',
        boundaryGap: false,
        data: xAxisData,
        axisLabel: {
          color: isDark ? '#A1A1AA' : '#6B7280'
        }
      }
    ],
    yAxis: [
      {
        type: 'value',
        axisLabel: {
          color: isDark ? '#A1A1AA' : '#6B7280'
        },
        splitLine: {
          lineStyle: {
            color: isDark ? '#27272A' : '#F3F4F6'
          }
        }
      }
    ],
    series: [
      {
        name: '线上销售',
        type: 'line',
        stack: 'Total',
        smooth: true,
        lineStyle: {
          width: 0
        },
        showSymbol: false,
        areaStyle: {
          opacity: 0.8,
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59, 130, 246, 0.8)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0.1)' }
            ]
          }
        },
        emphasis: {
          focus: 'series'
        },
        data: onlineSales
      },
      {
        name: '线下销售',
        type: 'line',
        stack: 'Total',
        smooth: true,
        lineStyle: {
          width: 0
        },
        showSymbol: false,
        areaStyle: {
          opacity: 0.8,
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(16, 185, 129, 0.8)' },
              { offset: 1, color: 'rgba(16, 185, 129, 0.1)' }
            ]
          }
        },
        emphasis: {
          focus: 'series'
        },
        data: offlineSales
      }
    ]
  }), [isDark]);

  return (
    <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 flex flex-col h-full">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-zinc-100 mb-4">{title}</h3>
      <div className="flex-1 min-h-[300px]">
        <ReactECharts 
          option={option} 
          style={{ height: '100%', width: '100%' }} 
          theme={isDark ? 'dark' : 'light'}
        />
      </div>
    </div>
  );
}
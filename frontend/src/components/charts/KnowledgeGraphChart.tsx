"use client";

import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';

export default function KnowledgeGraphChart() {
  const isDark = false;

  const option = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: {
      formatter: '{b}'
    },
    animationDurationUpdate: 1500,
    animationEasingUpdate: 'quinticInOut',
    series: [
      {
        type: 'graph',
        layout: 'force',
        symbolSize: 50,
        roam: true, // 允许拖拽和缩放
        label: {
          show: true,
          position: 'right',
          formatter: '{b}',
          color: isDark ? '#E4E4E7' : '#374151'
        },
        edgeSymbol: ['circle', 'arrow'],
        edgeSymbolSize: [4, 10],
        edgeLabel: {
          show: true,
          fontSize: 10,
          formatter: '{c}',
          color: isDark ? '#A1A1AA' : '#6B7280'
        },
        force: {
          repulsion: 300,
          edgeLength: [50, 150]
        },
        data: [
          { name: '旗舰手机', symbolSize: 60, itemStyle: { color: '#3B82F6' } }, // Node 0
          { name: '降噪耳机', symbolSize: 40, itemStyle: { color: '#10B981' } }, // Node 1
          { name: '智能手表', symbolSize: 40, itemStyle: { color: '#F59E0B' } }, // Node 2
          { name: '年轻极客', symbolSize: 70, itemStyle: { color: '#8B5CF6' } }, // Node 3
          { name: '商务精英', symbolSize: 50, itemStyle: { color: '#EC4899' } }, // Node 4
          { name: '春季促销', symbolSize: 45, itemStyle: { color: '#EF4444' } }, // Node 5
        ],
        links: [
          { source: '年轻极客', target: '旗舰手机', value: '偏好购买', lineStyle: { color: '#8B5CF6', width: 2, curveness: 0.2 } },
          { source: '年轻极客', target: '智能手表', value: '高频搭配', lineStyle: { color: '#8B5CF6', width: 1, curveness: 0.2 } },
          { source: '商务精英', target: '旗舰手机', value: '商务复购', lineStyle: { color: '#EC4899', width: 2, curveness: -0.2 } },
          { source: '商务精英', target: '降噪耳机', value: '刚需配件', lineStyle: { color: '#EC4899', width: 1, curveness: 0.2 } },
          { source: '春季促销', target: '智能手表', value: '带动销量', lineStyle: { color: '#EF4444', width: 2, curveness: 0 } },
          { source: '春季促销', target: '旗舰手机', value: '核心爆款', lineStyle: { color: '#EF4444', width: 3, curveness: 0.1 } },
        ],
        lineStyle: {
          opacity: 0.7,
          width: 1.5,
          curveness: 0.1
        }
      }
    ]
  }), [isDark]);

  return (
    <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 flex flex-col h-full">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-zinc-100 mb-1">AI 知识图谱与实体关系 (Graph)</h3>
      <p className="text-xs text-gray-500 dark:text-zinc-400 mb-4">商品、用户与营销活动的潜在关联网络</p>
      <div className="flex-1 min-h-[300px]">
        <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
      </div>
    </div>
  );
}

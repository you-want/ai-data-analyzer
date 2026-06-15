/**
 * 多智能体系统测试脚本
 * 用于验证多智能体架构的基本功能
 */

import { Test, TestingModule } from '@nestjs/testing';
import { MultiAgentModule } from './multi-agent.module';
import { Supervisor } from './supervisor.service';
import type { MultiAgentAnalyzeRequest } from './types/agent.types';

describe('MultiAgent System', () => {
  let supervisor: Supervisor;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [MultiAgentModule],
    }).compile();

    supervisor = module.get<Supervisor>(Supervisor);
  });

  it('应该能够执行多智能体分析流程', async () => {
    const request: MultiAgentAnalyzeRequest = {
      prompt: '分析销售数据的趋势和异常',
      data: [
        { month: '2024-01', sales: 100000, region: '北京' },
        { month: '2024-02', sales: 120000, region: '北京' },
        { month: '2024-03', sales: 80000, region: '北京' },
        { month: '2024-01', sales: 90000, region: '上海' },
        { month: '2024-02', sales: 110000, region: '上海' },
        { month: '2024-03', sales: 150000, region: '上海' },
      ],
      options: {
        maxSteps: 10,
        enableReview: true,
        enableCharts: true,
      },
    };

    const progressEvents: any[] = [];
    const taskUpdates: any[] = [];

    const result = await supervisor.analyze(
      request,
      (event) => progressEvents.push(event),
      (event) => taskUpdates.push(event),
    );

    // 验证基本结构
    expect(result.analysisId).toBeDefined();
    expect(result.status).toBeDefined();
    expect(result.plan).toBeDefined();
    expect(result.plan?.tasks.length).toBeGreaterThan(0);

    // 验证进度事件
    expect(progressEvents.length).toBeGreaterThan(0);
    console.log('进度事件:', progressEvents);

    // 验证任务更新
    expect(taskUpdates.length).toBeGreaterThan(0);
    console.log('任务更新:', taskUpdates);

    // 如果成功，验证产物
    if (result.status === 'DONE') {
      expect(result.report).toBeDefined();
      expect(result.artifacts).toBeDefined();
      console.log('分析报告:', result.report?.substring(0, 200));
    }

    console.log('分析结果:', {
      analysisId: result.analysisId,
      status: result.status,
      taskCount: result.plan?.tasks.length,
      error: result.error,
    });
  }, 60000); // 60秒超时
});

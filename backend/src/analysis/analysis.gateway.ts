import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { AnalysisService } from './analysis.service';

@WebSocketGateway({ cors: true, namespace: '/agent' })
export class AnalysisGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly analysisService: AnalysisService) {}

  @SubscribeMessage('start_analysis')
  async handleStartAnalysis(
    @MessageBody() payload: { prompt: string },
  ): Promise<void> {
    const { prompt } = payload;

    // 模拟 Agent 的多步执行过程，并实时向前端发送进度

    this.server.emit('agent_progress', {
      step: 1,
      message: '接收到任务，正在准备请求大模型...',
    });

    try {
      this.server.emit('agent_progress', {
        step: 2,
        message: '正在请求大模型...',
      });

      // 实际调用分析服务
      const result = await this.analysisService.analyzeText(prompt);

      this.server.emit('agent_progress', { step: 3, message: '分析完成！' });
      this.server.emit('agent_result', { result });
    } catch (error) {
      const err = error as Error;
      this.server.emit('agent_error', {
        message: '分析过程中发生错误',
        error: err.message,
      });
    }
  }
}

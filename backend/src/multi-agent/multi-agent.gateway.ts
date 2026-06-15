/**
 * Multi-Agent WebSocket Gateway
 * 用于实时推送多智能体执行进度与任务状态
 */

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { Supervisor } from './supervisor.service';
import type { MultiAgentAnalyzeRequest } from './types/agent.types';

@WebSocketGateway({ cors: true, namespace: '/multi-agent' })
export class MultiAgentGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MultiAgentGateway.name);

  constructor(private readonly supervisor: Supervisor) {}

  @SubscribeMessage('start_multi_analysis')
  async handleStartMultiAnalysis(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: MultiAgentAnalyzeRequest,
  ): Promise<void> {
    this.logger.log(`收到多智能体分析请求: ${client.id}`);

    try {
      const result = await this.supervisor.analyze(
        payload,
        // 进度回调 -> 通过 WebSocket 推送
        (event) => {
          client.emit('agent_progress', event);
        },
        // 任务更新回调 -> 通过 WebSocket 推送
        (event) => {
          client.emit('task_update', event);
        },
      );

      // 发送最终结果
      client.emit('analysis_complete', result);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`多智能体分析失败: ${err.message}`);
      client.emit('analysis_error', {
        message: '多智能体分析过程中发生错误',
        error: err.message,
      });
    }
  }
}

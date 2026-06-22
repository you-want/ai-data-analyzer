/**
 * Multi-Agent Module
 * 多智能体系统模块，整合 Router/DataCoder/Viz/Reviewer Agent 与 Supervisor
 */

import { Module } from '@nestjs/common';
import { OpenAIModule } from '../openai/openai.module';
import { RouterAgent } from './agents/router.agent';
import { DataCoderAgent } from './agents/data-coder.agent';
import { VizAgent } from './agents/viz.agent';
import { ReviewerAgent } from './agents/reviewer.agent';
import { Supervisor } from './supervisor.service';
import { MultiAgentController } from './multi-agent.controller';
import { MultiAgentGateway } from './multi-agent.gateway';
import { CodeExecutionModule } from '../code-execution/code-execution.module';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    OpenAIModule,
    CodeExecutionModule,
    KnowledgeBaseModule,
    BillingModule,
  ],
  controllers: [MultiAgentController],
  providers: [
    RouterAgent,
    DataCoderAgent,
    VizAgent,
    ReviewerAgent,
    Supervisor,
    MultiAgentGateway,
  ],
  exports: [Supervisor],
})
export class MultiAgentModule {}

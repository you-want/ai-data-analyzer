import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OpenAIModule } from '../openai/openai.module';
import { RouterAgent } from './agents/router.agent';
import { DataCoderAgent } from './agents/data-coder.agent';
import { VizAgent } from './agents/viz.agent';
import { ReviewerAgent } from './agents/reviewer.agent';
import { Supervisor } from './supervisor.service';
import { MultiAgentController } from './multi-agent.controller';
import { MultiAgentGateway } from './multi-agent.gateway';
import { MultiAgentProcessor } from './multi-agent.processor';
import { ContextStoreService } from './context-store.service';
import { CodeExecutionModule } from '../code-execution/code-execution.module';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'multi-agent-queue',
    }),
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
    MultiAgentProcessor,
    ContextStoreService,
  ],
  exports: [Supervisor, ContextStoreService],
})
export class MultiAgentModule {}

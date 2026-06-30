import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CodeExecutionController } from './code-execution.controller';
import { CodeExecutionService } from './code-execution.service';
import { DockerCodeExecutionService } from './docker-code-execution.service';
import { CodeExecutionWrapperService } from './code-execution-wrapper.service';
import { CodeExecutionProcessor } from './code-execution.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'code-execution-queue',
    }),
  ],
  controllers: [CodeExecutionController],
  providers: [
    CodeExecutionService,
    DockerCodeExecutionService,
    CodeExecutionWrapperService,
    CodeExecutionProcessor,
  ],
  exports: [CodeExecutionWrapperService],
})
export class CodeExecutionModule {}

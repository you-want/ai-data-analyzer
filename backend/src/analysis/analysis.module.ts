import { Module } from '@nestjs/common';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';
import { OpenAIModule } from '../openai/openai.module';
import { AnalysisGateway } from './analysis.gateway';
import { BullModule } from '@nestjs/bullmq';
import { AnalysisProcessor } from './analysis.processor';

@Module({
  imports: [
    OpenAIModule,
    BullModule.registerQueue({
      name: 'analysis-queue',
    }),
  ],
  controllers: [AnalysisController],
  providers: [AnalysisService, AnalysisGateway, AnalysisProcessor],
  exports: [AnalysisService],
})
export class AnalysisModule {}

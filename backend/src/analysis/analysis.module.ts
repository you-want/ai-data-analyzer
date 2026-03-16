import { Module } from '@nestjs/common';
import { AnalysisController } from './analysis.controller';

@Module({
  controllers: [AnalysisController],
})
export class AnalysisModule {}

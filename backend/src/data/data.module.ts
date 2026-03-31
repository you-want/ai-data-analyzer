import { Module } from '@nestjs/common';
import { DataController } from './data.controller';
import { AnalysisModule } from '../analysis/analysis.module';

@Module({
  imports: [AnalysisModule],
  controllers: [DataController],
})
export class DataModule {}

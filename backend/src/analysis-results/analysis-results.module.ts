import { Module } from '@nestjs/common';
import { AnalysisResultsService } from './analysis-results.service';
import { AnalysisResultsController } from './analysis-results.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalysisResult } from './entities/analysis-result.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AnalysisResult])],
  controllers: [AnalysisResultsController],
  providers: [AnalysisResultsService],
})
export class AnalysisResultsModule {}

import { Module } from '@nestjs/common';
import { AnalysisResultsService } from './analysis-results.service';
import { AnalysisResultsController } from './analysis-results.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalysisResult } from './entities/analysis-result.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([AnalysisResult]), AuthModule],
  controllers: [AnalysisResultsController],
  providers: [AnalysisResultsService],
})
export class AnalysisResultsModule {}

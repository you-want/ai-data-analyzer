import { Controller, Get } from '@nestjs/common';
import { AnalysisService } from './analysis.service';

@Controller('analysis')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Get()
  getAnalysis(): string {
    return this.analysisService.getAnalysisResult();
  }

  @Get('status')
  getStatus(): string {
    return 'Analysis service is up and running!';
  }
}

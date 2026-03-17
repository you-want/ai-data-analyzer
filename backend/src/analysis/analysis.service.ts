import { Injectable } from '@nestjs/common';

@Injectable()
export class AnalysisService {
  getAnalysisResult(): string {
    return 'This is a detailed analysis result from the AnalysisService.';
  }
}

import { Test, TestingModule } from '@nestjs/testing';
import { AnalysisResultsService } from './analysis-results.service';

describe('AnalysisResultsService', () => {
  let service: AnalysisResultsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AnalysisResultsService],
    }).compile();

    service = module.get<AnalysisResultsService>(AnalysisResultsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

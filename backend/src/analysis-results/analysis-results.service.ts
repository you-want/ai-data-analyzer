import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalysisResult } from './entities/analysis-result.entity';

@Injectable()
export class AnalysisResultsService {
  constructor(
    @InjectRepository(AnalysisResult)
    private readonly analysisResultRepository: Repository<AnalysisResult>,
  ) {}

  async create(data: Partial<AnalysisResult>): Promise<AnalysisResult> {
    const entity = this.analysisResultRepository.create(data);
    return this.analysisResultRepository.save(entity);
  }

  async findAll(): Promise<AnalysisResult[]> {
    return this.analysisResultRepository.find();
  }

  async findOne(id: string): Promise<AnalysisResult | null> {
    return this.analysisResultRepository.findOne({ where: { id } });
  }

  async update(
    id: string,
    data: Partial<AnalysisResult>,
  ): Promise<AnalysisResult | null> {
    await this.analysisResultRepository.update(id, data as any);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.analysisResultRepository.delete(id);
  }
}

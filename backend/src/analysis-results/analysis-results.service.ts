import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalysisResult } from './entities/analysis-result.entity';
import { TenantRlsService } from '../tenant/tenant-rls.service';

@Injectable()
export class AnalysisResultsService {
  constructor(
    @InjectRepository(AnalysisResult)
    private readonly analysisResultRepository: Repository<AnalysisResult>,
    private readonly tenantRlsService: TenantRlsService,
  ) {}

  async create(
    workspaceId: string,
    userId: string,
    data: Partial<AnalysisResult>,
  ): Promise<AnalysisResult> {
    return this.tenantRlsService.runWithTenant(
      { workspaceId, userId },
      async (manager) => {
        const repository = manager.getRepository(AnalysisResult);
        const entity = repository.create({
          ...data,
          workspaceId,
          userId,
        });
        return repository.save(entity);
      },
    );
  }

  async findAll(workspaceId: string): Promise<AnalysisResult[]> {
    return this.tenantRlsService.runWithTenant(
      { workspaceId },
      async (manager) =>
        manager.getRepository(AnalysisResult).find({
          where: { workspaceId },
          order: { createdAt: 'DESC' },
        }),
    );
  }

  async findOne(workspaceId: string, id: string): Promise<AnalysisResult> {
    return this.tenantRlsService.runWithTenant(
      { workspaceId },
      async (manager) => {
        const result = await manager.getRepository(AnalysisResult).findOne({
          where: { id, workspaceId },
        });
        if (!result) {
          throw new NotFoundException('分析结果不存在');
        }
        return result;
      },
    );
  }

  async update(
    workspaceId: string,
    id: string,
    data: Partial<AnalysisResult>,
  ): Promise<AnalysisResult> {
    return this.tenantRlsService.runWithTenant(
      { workspaceId },
      async (manager) => {
        const repository = manager.getRepository(AnalysisResult);
        const result = await repository.findOne({
          where: { id, workspaceId },
        });
        if (!result) {
          throw new NotFoundException('分析结果不存在');
        }

        Object.assign(result, data);
        await repository.save(result);
        return result;
      },
    );
  }

  async remove(workspaceId: string, id: string): Promise<void> {
    await this.tenantRlsService.runWithTenant(
      { workspaceId },
      async (manager) => {
        const repository = manager.getRepository(AnalysisResult);
        const result = await repository.findOne({
          where: { id, workspaceId },
        });
        if (!result) {
          throw new NotFoundException('分析结果不存在');
        }
        await repository.delete({ id, workspaceId });
      },
    );
  }
}

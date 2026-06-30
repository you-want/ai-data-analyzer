import { Injectable } from '@nestjs/common';
import {
  Repository,
  EntityManager,
  ObjectLiteral,
  FindManyOptions,
  FindOneOptions,
  DeleteResult,
  UpdateResult,
  InsertResult,
  FindOptionsWhere,
  DeepPartial,
} from 'typeorm';
import { TenantContextService } from './tenant-context.service';

@Injectable()
export class TenantQueryWrapperService {
  constructor(private readonly tenantContextService: TenantContextService) {}

  wrapRepository<T extends ObjectLiteral>(
    repository: Repository<T>,
    manager?: EntityManager,
  ): TenantWrappedRepository<T> {
    return new TenantWrappedRepository<T>(
      repository,
      this.tenantContextService,
      manager,
    );
  }

  getCurrentWorkspaceId(): string | undefined {
    return this.tenantContextService.getWorkspaceId();
  }

  ensureWorkspaceFilter<T extends ObjectLiteral>(
    options: FindManyOptions<T> | FindOneOptions<T>,
  ): void {
    const workspaceId = this.getCurrentWorkspaceId();
    if (!workspaceId) {
      return;
    }

    if (!options.where) {
      options.where = { workspaceId } as unknown as FindManyOptions<T>['where'];
    } else if (
      typeof options.where === 'object' &&
      !Array.isArray(options.where)
    ) {
      (options.where as Record<string, unknown>).workspaceId = workspaceId;
    }
  }
}

export class TenantWrappedRepository<T extends ObjectLiteral> {
  constructor(
    private readonly repository: Repository<T>,
    private readonly tenantContextService: TenantContextService,
    private readonly manager?: EntityManager,
  ) {}

  private getRepo(): Repository<T> {
    return (
      this.manager?.getRepository(this.repository.target) ?? this.repository
    );
  }

  private getWorkspaceId(): string | undefined {
    return this.tenantContextService.getWorkspaceId();
  }

  async find(options?: FindManyOptions<T>): Promise<T[]> {
    const opts = options ? { ...options } : {};
    this.applyWorkspaceFilter(opts);
    return this.getRepo().find(opts);
  }

  async findOne(options?: FindOneOptions<T>): Promise<T | null> {
    const opts = options ? { ...options } : {};
    this.applyWorkspaceFilter(opts);
    return this.getRepo().findOne(opts);
  }

  async findOneBy(where: FindOptionsWhere<T>): Promise<T | null> {
    const workspaceId = this.getWorkspaceId();
    if (workspaceId && typeof where === 'object' && !Array.isArray(where)) {
      return this.getRepo().findOneBy({
        ...(where as Record<string, unknown>),
        workspaceId,
      } as unknown as FindOptionsWhere<T>);
    }
    return this.getRepo().findOneBy(where);
  }

  async findByIds(ids: string[]): Promise<T[]> {
    const workspaceId = this.getWorkspaceId();
    if (workspaceId) {
      return this.getRepo().find({
        where: {
          id: { $in: ids },
          workspaceId,
        } as unknown as FindManyOptions<T>['where'],
      });
    }
    return this.getRepo().findByIds(ids);
  }

  async save(entity: T): Promise<T> {
    const workspaceId = this.getWorkspaceId();
    if (workspaceId && typeof entity === 'object') {
      (entity as Record<string, unknown>).workspaceId = workspaceId;
    }
    return this.getRepo().save(entity);
  }

  async saveMany(entities: T[]): Promise<T[]> {
    const workspaceId = this.getWorkspaceId();
    if (workspaceId) {
      entities.forEach((entity) => {
        if (typeof entity === 'object') {
          (entity as Record<string, unknown>).workspaceId = workspaceId;
        }
      });
    }
    return this.getRepo().save(entities);
  }

  async update(
    criteria: FindOptionsWhere<T>,
    partialEntity: Partial<T>,
  ): Promise<UpdateResult> {
    const workspaceId = this.getWorkspaceId();
    if (
      workspaceId &&
      typeof criteria === 'object' &&
      !Array.isArray(criteria)
    ) {
      return this.getRepo().update(
        {
          ...(criteria as Record<string, unknown>),
          workspaceId,
        } as unknown as FindOptionsWhere<T>,
        partialEntity,
      );
    }
    return this.getRepo().update(criteria, partialEntity);
  }

  async delete(criteria: FindOptionsWhere<T>): Promise<DeleteResult> {
    const workspaceId = this.getWorkspaceId();
    if (
      workspaceId &&
      typeof criteria === 'object' &&
      !Array.isArray(criteria)
    ) {
      return this.getRepo().delete({
        ...(criteria as Record<string, unknown>),
        workspaceId,
      } as unknown as FindOptionsWhere<T>);
    }
    return this.getRepo().delete(criteria);
  }

  async insert(entity: Partial<T>): Promise<InsertResult> {
    const workspaceId = this.getWorkspaceId();
    if (workspaceId && typeof entity === 'object') {
      (entity as Record<string, unknown>).workspaceId = workspaceId;
    }
    return this.getRepo().insert(entity);
  }

  async count(options?: FindManyOptions<T>): Promise<number> {
    const opts = options ? { ...options } : {};
    this.applyWorkspaceFilter(opts);
    return this.getRepo().count(opts);
  }

  create(entity: DeepPartial<T>): T {
    const workspaceId = this.getWorkspaceId();
    if (workspaceId && typeof entity === 'object') {
      (entity as Record<string, unknown>).workspaceId = workspaceId;
    }
    return this.getRepo().create(entity);
  }

  async findAndCount(options?: FindManyOptions<T>): Promise<[T[], number]> {
    const opts = options ? { ...options } : {};
    this.applyWorkspaceFilter(opts);
    return this.getRepo().findAndCount(opts);
  }

  private applyWorkspaceFilter(options: FindManyOptions<T>): void {
    const workspaceId = this.getWorkspaceId();
    if (!workspaceId) {
      return;
    }

    if (!options.where) {
      options.where = { workspaceId } as unknown as FindManyOptions<T>['where'];
    } else if (
      typeof options.where === 'object' &&
      !Array.isArray(options.where)
    ) {
      (options.where as Record<string, unknown>).workspaceId = workspaceId;
    }
  }
}

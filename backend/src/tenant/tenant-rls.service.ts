import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
import { TenantContextService } from './tenant-context.service';

@Injectable()
export class TenantRlsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  isRuntimeEnabled(): boolean {
    return (
      this.configService.get<string>('ENABLE_DB_RLS', 'false').toLowerCase() ===
      'true'
    );
  }

  async runWithTenant<T>(
    input: {
      workspaceId?: string;
      userId?: string;
      workspaceRole?: string;
    },
    callback: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    if (!this.isRuntimeEnabled()) {
      return callback(this.dataSource.manager);
    }

    const snapshot = this.tenantContextService.getSnapshot();
    const workspaceId = input.workspaceId ?? snapshot.workspaceId ?? '';
    const userId = input.userId ?? snapshot.userId ?? '';
    const workspaceRole = input.workspaceRole ?? snapshot.workspaceRole ?? '';

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.query(
        `SELECT
          set_config('app.current_workspace_id', $1, true),
          set_config('app.current_user_id', $2, true),
          set_config('app.current_workspace_role', $3, true)`,
        [workspaceId, userId, workspaceRole],
      );
      const result = await callback(queryRunner.manager);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}

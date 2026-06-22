import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

const RLS_TABLES = [
  'analysis_results',
  'knowledge_chunks',
  'subscriptions',
  'billing_ledger',
  'workspace_audit_logs',
  'memberships',
] as const;

@Injectable()
export class TenantRlsBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TenantRlsBootstrapService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.dataSource.options.type !== 'postgres') {
      return;
    }

    const enabled =
      this.configService.get<string>('ENABLE_DB_RLS', 'false').toLowerCase() ===
      'true';

    try {
      for (const table of RLS_TABLES) {
        await this.dataSource.query(
          `ALTER TABLE "${table}" ${enabled ? 'ENABLE' : 'DISABLE'} ROW LEVEL SECURITY`,
        );
      }

      this.logger.log(
        `${enabled ? '已启用' : '已关闭'}数据库级 RLS。覆盖表: ${RLS_TABLES.join(', ')}`,
      );
    } catch (error) {
      const err = error as Error;
      this.logger.error(`初始化 RLS 状态失败: ${err.message}`);
    }
  }
}

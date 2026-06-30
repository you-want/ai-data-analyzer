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
  'support_ticket',
  'workspace_invitations',
] as const;

const RLS_POLICIES = [
  {
    table: 'analysis_results',
    policy: `
      CREATE POLICY IF NOT EXISTS "analysis_results_workspace_access" ON analysis_results
      FOR ALL USING (workspace_id = current_setting('app.current_workspace_id')::uuid);
    `,
  },
  {
    table: 'knowledge_chunks',
    policy: `
      CREATE POLICY IF NOT EXISTS "knowledge_chunks_workspace_access" ON knowledge_chunks
      FOR ALL USING (workspace_id = current_setting('app.current_workspace_id')::uuid);
    `,
  },
  {
    table: 'subscriptions',
    policy: `
      CREATE POLICY IF NOT EXISTS "subscriptions_workspace_access" ON subscriptions
      FOR ALL USING (workspace_id = current_setting('app.current_workspace_id')::uuid);
    `,
  },
  {
    table: 'billing_ledger',
    policy: `
      CREATE POLICY IF NOT EXISTS "billing_ledger_workspace_access" ON billing_ledger
      FOR ALL USING (workspace_id = current_setting('app.current_workspace_id')::uuid);
    `,
  },
  {
    table: 'workspace_audit_logs',
    policy: `
      CREATE POLICY IF NOT EXISTS "workspace_audit_logs_workspace_access" ON workspace_audit_logs
      FOR ALL USING (workspace_id = current_setting('app.current_workspace_id')::uuid);
    `,
  },
  {
    table: 'memberships',
    policy: `
      CREATE POLICY IF NOT EXISTS "memberships_workspace_access" ON memberships
      FOR ALL USING (workspace_id = current_setting('app.current_workspace_id')::uuid);
    `,
  },
  {
    table: 'support_ticket',
    policy: `
      CREATE POLICY IF NOT EXISTS "support_ticket_workspace_access" ON support_ticket
      FOR ALL USING (workspace_id = current_setting('app.current_workspace_id')::uuid);
    `,
  },
  {
    table: 'workspace_invitations',
    policy: `
      CREATE POLICY IF NOT EXISTS "workspace_invitations_workspace_access" ON workspace_invitations
      FOR ALL USING (workspace_id = current_setting('app.current_workspace_id')::uuid);
    `,
  },
];

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
      await this.dataSource.query(`SET search_path = public;`);

      for (const table of RLS_TABLES) {
        await this.dataSource.query(
          `ALTER TABLE "${table}" ${enabled ? 'ENABLE' : 'DISABLE'} ROW LEVEL SECURITY`,
        );

        if (enabled) {
          const policy = RLS_POLICIES.find((p) => p.table === table);
          if (policy) {
            await this.dataSource.query(policy.policy);
          }
        }
      }

      this.logger.log(
        `${enabled ? '已启用' : '已关闭'}数据库级 RLS。覆盖表: ${RLS_TABLES.join(', ')}`,
      );
    } catch (error) {
      const err = error as Error;
      this.logger.error(`初始化 RLS 状态失败: ${err.message}`);
    }
  }

  async ensureRlsPolicies(): Promise<void> {
    if (this.dataSource.options.type !== 'postgres') {
      return;
    }

    const enabled =
      this.configService.get<string>('ENABLE_DB_RLS', 'false').toLowerCase() ===
      'true';

    if (!enabled) {
      return;
    }

    try {
      await this.dataSource.query(`SET search_path = public;`);

      for (const { policy } of RLS_POLICIES) {
        await this.dataSource.query(policy);
      }

      this.logger.log('RLS 策略已确保');
    } catch (error) {
      const err = error as Error;
      this.logger.error(`确保 RLS 策略失败: ${err.message}`);
    }
  }
}

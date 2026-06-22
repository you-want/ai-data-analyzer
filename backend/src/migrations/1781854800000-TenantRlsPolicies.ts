import { MigrationInterface, QueryRunner } from 'typeorm';

const RLS_TABLES = [
  'analysis_results',
  'knowledge_chunks',
  'subscriptions',
  'billing_ledger',
  'workspace_audit_logs',
] as const;

export class TenantRlsPolicies1781854800000 implements MigrationInterface {
  name = 'TenantRlsPolicies1781854800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "app"`);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION app.current_workspace_id()
      RETURNS uuid
      LANGUAGE sql
      STABLE
      AS $$
        SELECT NULLIF(current_setting('app.current_workspace_id', true), '')::uuid
      $$;
    `);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION app.current_user_id()
      RETURNS uuid
      LANGUAGE sql
      STABLE
      AS $$
        SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid
      $$;
    `);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION app.current_workspace_role()
      RETURNS text
      LANGUAGE sql
      STABLE
      AS $$
        SELECT NULLIF(current_setting('app.current_workspace_role', true), '')
      $$;
    `);

    for (const table of RLS_TABLES) {
      await queryRunner.query(`
        DROP POLICY IF EXISTS "${table}_tenant_isolation_select" ON "${table}"
      `);
      await queryRunner.query(`
        DROP POLICY IF EXISTS "${table}_tenant_isolation_modify" ON "${table}"
      `);
      await queryRunner.query(`
        CREATE POLICY "${table}_tenant_isolation_select"
        ON "${table}"
        FOR SELECT
        USING ("workspaceId" = app.current_workspace_id())
      `);
      await queryRunner.query(`
        CREATE POLICY "${table}_tenant_isolation_modify"
        ON "${table}"
        FOR ALL
        USING ("workspaceId" = app.current_workspace_id())
        WITH CHECK (
          "workspaceId" = app.current_workspace_id()
          OR "workspaceId" IS NULL
        )
      `);
    }

    await queryRunner.query(`
      DROP POLICY IF EXISTS "memberships_tenant_isolation_select" ON "memberships"
    `);
    await queryRunner.query(`
      DROP POLICY IF EXISTS "memberships_tenant_isolation_modify" ON "memberships"
    `);
    await queryRunner.query(`
      CREATE POLICY "memberships_tenant_isolation_select"
      ON "memberships"
      FOR SELECT
      USING (
        "userId" = app.current_user_id()
        OR "workspaceId" = app.current_workspace_id()
      )
    `);
    await queryRunner.query(`
      CREATE POLICY "memberships_tenant_isolation_modify"
      ON "memberships"
      FOR ALL
      USING ("workspaceId" = app.current_workspace_id())
      WITH CHECK ("workspaceId" = app.current_workspace_id())
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP POLICY IF EXISTS "memberships_tenant_isolation_modify" ON "memberships"
    `);
    await queryRunner.query(`
      DROP POLICY IF EXISTS "memberships_tenant_isolation_select" ON "memberships"
    `);

    for (const table of RLS_TABLES) {
      await queryRunner.query(`
        DROP POLICY IF EXISTS "${table}_tenant_isolation_modify" ON "${table}"
      `);
      await queryRunner.query(`
        DROP POLICY IF EXISTS "${table}_tenant_isolation_select" ON "${table}"
      `);
    }

    await queryRunner.query(
      `DROP FUNCTION IF EXISTS app.current_workspace_role()`,
    );
    await queryRunner.query(`DROP FUNCTION IF EXISTS app.current_user_id()`);
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS app.current_workspace_id()`,
    );
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class PlatformUpgrade1781799000000 implements MigrationInterface {
  name = 'PlatformUpgrade1781799000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(255) NOT NULL, "name" character varying(120) NOT NULL, "passwordHash" character varying(255), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_users_email" UNIQUE ("email"), CONSTRAINT "PK_users_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "workspaces" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "ownerUserId" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_workspaces_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "memberships" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "workspaceId" uuid NOT NULL, "role" character varying(20) NOT NULL DEFAULT 'member', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_memberships_user_workspace" UNIQUE ("userId", "workspaceId"), CONSTRAINT "PK_memberships_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "knowledge_chunks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "datasetId" uuid, "analysisId" character varying(80), "chunkType" character varying(40) NOT NULL, "content" text NOT NULL, "embedding" jsonb NOT NULL DEFAULT '[]'::jsonb, "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_knowledge_chunks_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "subscriptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "plan" character varying(40) NOT NULL DEFAULT 'free', "status" character varying(40) NOT NULL DEFAULT 'active', "stripeCustomerId" character varying(120), "stripeSubscriptionId" character varying(120), "currentPeriodEnd" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_subscriptions_workspace" UNIQUE ("workspaceId"), CONSTRAINT "PK_subscriptions_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "billing_ledger" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "userId" uuid, "eventType" character varying(30) NOT NULL, "eventKey" character varying(120) NOT NULL, "amount" numeric(12,4), "units" jsonb NOT NULL DEFAULT '{}'::jsonb, "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_billing_ledger_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_billing_workspace_event" ON "billing_ledger" ("workspaceId", "eventKey")`,
    );
    await queryRunner.query(
      `ALTER TABLE "memberships" ADD CONSTRAINT "FK_memberships_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "memberships" ADD CONSTRAINT "FK_memberships_workspace" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "analysis_results" ADD COLUMN IF NOT EXISTS "workspaceId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "analysis_results" ADD COLUMN IF NOT EXISTS "userId" uuid`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "analysis_results" DROP COLUMN IF EXISTS "userId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "analysis_results" DROP COLUMN IF EXISTS "workspaceId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_billing_workspace_event"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "billing_ledger"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "subscriptions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_chunks"`);
    await queryRunner.query(
      `ALTER TABLE "memberships" DROP CONSTRAINT IF EXISTS "FK_memberships_workspace"`,
    );
    await queryRunner.query(
      `ALTER TABLE "memberships" DROP CONSTRAINT IF EXISTS "FK_memberships_user"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "memberships"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "workspaces"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}

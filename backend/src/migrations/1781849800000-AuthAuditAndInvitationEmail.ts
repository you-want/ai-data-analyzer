import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuthAuditAndInvitationEmail1781849800000 implements MigrationInterface {
  name = 'AuthAuditAndInvitationEmail1781849800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "workspace_invitations" ADD COLUMN IF NOT EXISTS "invitedEmail" character varying(255)`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "workspace_audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid, "actorUserId" uuid, "action" character varying(80) NOT NULL, "targetType" character varying(80), "targetId" character varying(120), "metadata" jsonb NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_workspace_audit_logs_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_workspace_audit_logs_workspace_created_at" ON "workspace_audit_logs" ("workspaceId", "createdAt")`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_audit_logs" ADD CONSTRAINT "FK_workspace_audit_logs_workspace" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_audit_logs" ADD CONSTRAINT "FK_workspace_audit_logs_actor_user" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "workspace_audit_logs" DROP CONSTRAINT IF EXISTS "FK_workspace_audit_logs_actor_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_audit_logs" DROP CONSTRAINT IF EXISTS "FK_workspace_audit_logs_workspace"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_workspace_audit_logs_workspace_created_at"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "workspace_audit_logs"`);
    await queryRunner.query(
      `ALTER TABLE "workspace_invitations" DROP COLUMN IF EXISTS "invitedEmail"`,
    );
  }
}

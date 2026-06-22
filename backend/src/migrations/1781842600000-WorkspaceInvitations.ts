import { MigrationInterface, QueryRunner } from 'typeorm';

export class WorkspaceInvitations1781842600000 implements MigrationInterface {
  name = 'WorkspaceInvitations1781842600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "workspace_invitations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "createdByUserId" uuid NOT NULL, "acceptedByUserId" uuid, "tokenHash" character varying(128) NOT NULL, "role" character varying(20) NOT NULL DEFAULT 'member', "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "acceptedAt" TIMESTAMP WITH TIME ZONE, "revokedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_workspace_invitations_token_hash" UNIQUE ("tokenHash"), CONSTRAINT "PK_workspace_invitations_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_invitations" ADD CONSTRAINT "FK_workspace_invitations_workspace" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_invitations" ADD CONSTRAINT "FK_workspace_invitations_created_by_user" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_invitations" ADD CONSTRAINT "FK_workspace_invitations_accepted_by_user" FOREIGN KEY ("acceptedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "workspace_invitations" DROP CONSTRAINT IF EXISTS "FK_workspace_invitations_accepted_by_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_invitations" DROP CONSTRAINT IF EXISTS "FK_workspace_invitations_created_by_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_invitations" DROP CONSTRAINT IF EXISTS "FK_workspace_invitations_workspace"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "workspace_invitations"`);
  }
}

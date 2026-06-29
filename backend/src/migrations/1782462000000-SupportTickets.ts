import { MigrationInterface, QueryRunner } from 'typeorm';

export class SupportTickets1782462000000 implements MigrationInterface {
  name = 'SupportTickets1782462000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "support_tickets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid, "userId" uuid NOT NULL, "category" character varying(20) NOT NULL, "priority" character varying(20) NOT NULL DEFAULT 'P2', "subject" character varying(255) NOT NULL, "description" text NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'open', "resolution" text, "assignedTo" uuid, "attachments" jsonb NOT NULL DEFAULT '[]'::jsonb, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_support_tickets_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_support_tickets_workspace" ON "support_tickets" ("workspaceId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_support_tickets_user" ON "support_tickets" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_support_tickets_status" ON "support_tickets" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_support_tickets_priority" ON "support_tickets" ("priority")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_support_tickets_category" ON "support_tickets" ("category")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_support_tickets_created_at" ON "support_tickets" ("createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_support_tickets_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_support_tickets_category"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_support_tickets_priority"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_support_tickets_status"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_support_tickets_user"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_support_tickets_workspace"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "support_tickets"`);
  }
}

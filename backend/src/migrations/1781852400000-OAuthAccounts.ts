import { MigrationInterface, QueryRunner } from 'typeorm';

export class OAuthAccounts1781852400000 implements MigrationInterface {
  name = 'OAuthAccounts1781852400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "oauth_accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "provider" character varying(20) NOT NULL, "providerAccountId" character varying(120) NOT NULL, "email" character varying(255), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_oauth_accounts_provider_account" UNIQUE ("provider", "providerAccountId"), CONSTRAINT "PK_oauth_accounts_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_oauth_accounts_user_provider" ON "oauth_accounts" ("userId", "provider")`,
    );
    await queryRunner.query(
      `ALTER TABLE "oauth_accounts" ADD CONSTRAINT "FK_oauth_accounts_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "oauth_accounts" DROP CONSTRAINT IF EXISTS "FK_oauth_accounts_user"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_oauth_accounts_user_provider"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "oauth_accounts"`);
  }
}

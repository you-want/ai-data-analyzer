import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1773713720042 implements MigrationInterface {
  name = 'Init1773713720042';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "analysis_results" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "taskName" text NOT NULL, "inputData" jsonb, "outputData" jsonb NOT NULL, "modelId" text, "status" character varying(50) NOT NULL DEFAULT 'pending', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_56560e3511c57e1db64a3ad93eb" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "analysis_results"`);
  }
}

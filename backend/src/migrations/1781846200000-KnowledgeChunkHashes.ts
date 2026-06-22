import { MigrationInterface, QueryRunner } from 'typeorm';

export class KnowledgeChunkHashes1781846200000 implements MigrationInterface {
  name = 'KnowledgeChunkHashes1781846200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "knowledge_chunks" ADD COLUMN IF NOT EXISTS "contentHash" character varying(64)`,
    );
    await queryRunner.query(
      `UPDATE "knowledge_chunks" SET "contentHash" = md5("workspaceId"::text || ':' || lower(regexp_replace(trim("content"), '\\s+', ' ', 'g'))) WHERE "contentHash" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "knowledge_chunks" ALTER COLUMN "contentHash" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_knowledge_chunks_workspace_content_hash" ON "knowledge_chunks" ("workspaceId", "contentHash")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_knowledge_chunks_workspace_content_hash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "knowledge_chunks" DROP COLUMN IF EXISTS "contentHash"`,
    );
  }
}

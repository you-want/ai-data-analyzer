import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVectorIndexToKnowledgeChunks1782827860411 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector;`);

    await queryRunner.query(`
      ALTER TABLE knowledge_chunks 
      ALTER COLUMN embedding TYPE vector(64);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding 
      ON knowledge_chunks 
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_knowledge_chunks_embedding;`,
    );

    await queryRunner.query(
      `ALTER TABLE knowledge_chunks ALTER COLUMN embedding TYPE double precision[];`,
    );

    await queryRunner.query(`DROP EXTENSION IF EXISTS vector;`);
  }
}

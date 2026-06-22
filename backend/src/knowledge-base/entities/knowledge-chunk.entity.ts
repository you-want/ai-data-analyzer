import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('knowledge_chunks')
@Index(['workspaceId', 'contentHash'], { unique: true })
export class KnowledgeChunk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workspaceId: string;

  @Column({ type: 'uuid', nullable: true })
  datasetId?: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  analysisId?: string | null;

  @Column({ type: 'varchar', length: 40 })
  chunkType: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  contentHash?: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  embedding: number[];

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;
}

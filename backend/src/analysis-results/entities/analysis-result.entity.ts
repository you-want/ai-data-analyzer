import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('analysis_results')
export class AnalysisResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  taskName: string;

  @Column({ type: 'jsonb', nullable: true })
  inputData?: Record<string, unknown>;

  @Column({ type: 'jsonb' })
  outputData: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  modelId?: string;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}

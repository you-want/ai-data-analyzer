import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('billing_ledger')
@Index(['workspaceId', 'eventKey'], { unique: true })
export class BillingLedger {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workspaceId: string;

  @Column({ type: 'uuid', nullable: true })
  userId?: string | null;

  @Column({ type: 'varchar', length: 30 })
  eventType: 'llm' | 'exec' | 'storage';

  @Column({ type: 'varchar', length: 120 })
  eventKey: string;

  @Column({ type: 'numeric', precision: 12, scale: 4, nullable: true })
  amount?: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  units: Record<string, unknown>;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;
}

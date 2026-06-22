import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type BillingPlan = 'free' | 'pro' | 'team';

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  workspaceId: string;

  @Column({ type: 'varchar', length: 40, default: 'free' })
  plan: BillingPlan;

  @Column({ type: 'varchar', length: 40, default: 'active' })
  status: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  stripeCustomerId?: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  stripeSubscriptionId?: string | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  currentPeriodEnd?: Date | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}

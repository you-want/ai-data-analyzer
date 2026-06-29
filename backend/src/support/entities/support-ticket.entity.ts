import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export const TicketPriority = {
  P0: 'P0',
  P1: 'P1',
  P2: 'P2',
  P3: 'P3',
} as const;

export const TicketStatus = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
} as const;

export const TicketCategory = {
  BUG: 'bug',
  FEATURE: 'feature',
  SUPPORT: 'support',
  BILLING: 'billing',
  OTHER: 'other',
} as const;

export type TicketPriority =
  (typeof TicketPriority)[keyof typeof TicketPriority];
export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];
export type TicketCategory =
  (typeof TicketCategory)[keyof typeof TicketCategory];

@Entity('support_tickets')
@Index(['workspaceId'])
@Index(['userId'])
@Index(['status'])
@Index(['priority'])
@Index(['category'])
@Index(['createdAt'])
export class SupportTicket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  workspaceId?: string | null;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 20 })
  category: TicketCategory;

  @Column({ type: 'varchar', length: 20, default: 'P2' })
  priority: TicketPriority;

  @Column({ type: 'varchar', length: 255 })
  subject: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 20, default: 'open' })
  status: TicketStatus;

  @Column({ type: 'text', nullable: true })
  resolution?: string | null;

  @Column({ type: 'uuid', nullable: true })
  assignedTo?: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  attachments: string[];

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}

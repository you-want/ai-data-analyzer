import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity';

export type OAuthProvider = 'github' | 'google';

@Entity('oauth_accounts')
@Unique(['provider', 'providerAccountId'])
@Index(['userId', 'provider'])
export class OAuthAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 20 })
  provider: OAuthProvider;

  @Column({ type: 'varchar', length: 120 })
  providerAccountId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email?: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;
}

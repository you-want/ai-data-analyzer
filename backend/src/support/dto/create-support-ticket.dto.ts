import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import {
  TicketCategory,
  TicketPriority,
} from '../entities/support-ticket.entity';
import type {
  TicketCategory as TicketCategoryType,
  TicketPriority as TicketPriorityType,
} from '../entities/support-ticket.entity';

export class CreateSupportTicketDto {
  @IsOptional()
  @IsString()
  workspaceId?: string;

  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsNotEmpty()
  @IsEnum(TicketCategory)
  category: TicketCategoryType;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriorityType = 'P2';

  @IsNotEmpty()
  @IsString()
  subject: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsOptional()
  attachments?: string[];
}

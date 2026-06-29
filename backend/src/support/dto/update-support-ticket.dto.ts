import { IsEnum, IsOptional, IsString } from 'class-validator';
import {
  TicketPriority,
  TicketStatus,
} from '../entities/support-ticket.entity';
import type {
  TicketPriority as TicketPriorityType,
  TicketStatus as TicketStatusType,
} from '../entities/support-ticket.entity';

export class UpdateSupportTicketDto {
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatusType;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriorityType;

  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsOptional()
  @IsString()
  resolution?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

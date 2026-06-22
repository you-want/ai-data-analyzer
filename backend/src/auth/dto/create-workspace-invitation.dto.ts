import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { WorkspaceInvitationRole } from '../auth.types';

export class CreateWorkspaceInvitationDto {
  @IsIn(['admin', 'member', 'viewer'])
  role: WorkspaceInvitationRole;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  expiresInDays?: number;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  message?: string;
}

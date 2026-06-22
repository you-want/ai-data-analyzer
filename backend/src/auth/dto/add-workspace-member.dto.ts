import { IsEmail, IsIn } from 'class-validator';
import type { WorkspaceRole } from '../auth.types';

export class AddWorkspaceMemberDto {
  @IsEmail()
  email: string;

  @IsIn(['admin', 'member', 'viewer'])
  role: Exclude<WorkspaceRole, 'owner'>;
}

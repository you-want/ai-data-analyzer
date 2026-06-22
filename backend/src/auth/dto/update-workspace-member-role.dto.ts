import { IsIn } from 'class-validator';
import type { WorkspaceRole } from '../auth.types';

export class UpdateWorkspaceMemberRoleDto {
  @IsIn(['admin', 'member', 'viewer'])
  role: Exclude<WorkspaceRole, 'owner'>;
}

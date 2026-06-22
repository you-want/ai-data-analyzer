import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth.service';
import type { AuthenticatedUser } from '../auth.types';

interface RequestWithAuth extends Request {
  user?: AuthenticatedUser;
  workspaceContext?: {
    workspaceId: string;
    role: 'owner' | 'admin' | 'member' | 'viewer';
  };
}

@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('请先登录');
    }

    const requestedWorkspaceId = request.header('x-workspace-id');
    const membership = await this.authService.resolveMembership(
      user.id,
      requestedWorkspaceId,
    );

    if (!membership) {
      throw new ForbiddenException('你不属于当前工作空间');
    }

    request.workspaceContext = {
      workspaceId: membership.workspaceId,
      role: membership.role,
    };

    return true;
  }
}

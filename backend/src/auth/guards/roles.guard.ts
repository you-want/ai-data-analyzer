import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { WorkspaceRole } from '../auth.types';
import type { Request } from 'express';

interface RequestWithWorkspace extends Request {
  workspaceContext?: { workspaceId: string; role: WorkspaceRole };
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<WorkspaceRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithWorkspace>();
    const role = request.workspaceContext?.role;

    if (!role || !requiredRoles.includes(role)) {
      throw new ForbiddenException('当前工作空间角色无权执行该操作');
    }

    return true;
  }
}

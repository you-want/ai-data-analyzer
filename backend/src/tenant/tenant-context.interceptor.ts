import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Request } from 'express';
import { TenantContextService } from './tenant-context.service';

interface RequestWithTenant extends Request {
  user?: {
    id: string;
  };
  workspaceContext?: {
    workspaceId: string;
    role: string;
  };
}

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly tenantContextService: TenantContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<RequestWithTenant>();
    return this.tenantContextService.run(
      {
        userId: request.user?.id,
        workspaceId: request.workspaceContext?.workspaceId,
        workspaceRole: request.workspaceContext?.role,
      },
      () => next.handle(),
    );
  }
}

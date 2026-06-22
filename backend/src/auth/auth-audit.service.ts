import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceAuditLog } from './entities/workspace-audit-log.entity';
import { TenantRlsService } from '../tenant/tenant-rls.service';

@Injectable()
export class AuthAuditService {
  constructor(
    @InjectRepository(WorkspaceAuditLog)
    private readonly auditLogsRepository: Repository<WorkspaceAuditLog>,
    private readonly tenantRlsService: TenantRlsService,
  ) {}

  async record(input: {
    workspaceId?: string | null;
    actorUserId?: string | null;
    action: string;
    targetType?: string | null;
    targetId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<WorkspaceAuditLog> {
    return this.tenantRlsService.runWithTenant(
      {
        workspaceId: input.workspaceId ?? undefined,
        userId: input.actorUserId ?? undefined,
      },
      async (manager) =>
        manager.getRepository(WorkspaceAuditLog).save(
          this.auditLogsRepository.create({
            workspaceId: input.workspaceId ?? null,
            actorUserId: input.actorUserId ?? null,
            action: input.action,
            targetType: input.targetType ?? null,
            targetId: input.targetId ?? null,
            metadata: input.metadata ?? {},
          }),
        ),
    );
  }

  async listWorkspaceAuditLogs(
    workspaceId: string,
    limit = 50,
  ): Promise<
    Array<{
      auditLogId: string;
      action: string;
      targetType: string | null;
      targetId: string | null;
      actorUserId: string | null;
      actorName: string | null;
      actorEmail: string | null;
      metadata: Record<string, unknown>;
      createdAt: string;
    }>
  > {
    const logs = await this.tenantRlsService.runWithTenant(
      { workspaceId },
      async (manager) =>
        manager.getRepository(WorkspaceAuditLog).find({
          where: { workspaceId },
          relations: { actorUser: true },
          order: { createdAt: 'DESC' },
          take: Math.min(Math.max(limit, 1), 100),
        }),
    );

    return logs.map((log) => ({
      auditLogId: log.id,
      action: log.action,
      targetType: log.targetType ?? null,
      targetId: log.targetId ?? null,
      actorUserId: log.actorUserId ?? null,
      actorName: log.actorUser?.name ?? null,
      actorEmail: log.actorUser?.email ?? null,
      metadata: log.metadata,
      createdAt: log.createdAt.toISOString(),
    }));
  }
}

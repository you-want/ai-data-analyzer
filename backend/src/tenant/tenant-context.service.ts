import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantContextSnapshot {
  userId?: string;
  workspaceId?: string;
  workspaceRole?: string;
}

@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantContextSnapshot>();

  run<T>(snapshot: TenantContextSnapshot, callback: () => T): T {
    return this.storage.run(snapshot, callback);
  }

  getSnapshot(): TenantContextSnapshot {
    return this.storage.getStore() ?? {};
  }

  getWorkspaceId(): string | undefined {
    return this.getSnapshot().workspaceId;
  }

  getUserId(): string | undefined {
    return this.getSnapshot().userId;
  }

  getWorkspaceRole(): string | undefined {
    return this.getSnapshot().workspaceRole;
  }
}

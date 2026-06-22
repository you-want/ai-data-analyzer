import { Global, Module } from '@nestjs/common';
import { TenantContextService } from './tenant-context.service';
import { TenantRlsService } from './tenant-rls.service';
import { TenantRlsBootstrapService } from './tenant-rls-bootstrap.service';

@Global()
@Module({
  providers: [
    TenantContextService,
    TenantRlsService,
    TenantRlsBootstrapService,
  ],
  exports: [TenantContextService, TenantRlsService],
})
export class TenantModule {}

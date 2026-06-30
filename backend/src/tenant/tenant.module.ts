import { Global, Module } from '@nestjs/common';
import { TenantContextService } from './tenant-context.service';
import { TenantRlsService } from './tenant-rls.service';
import { TenantRlsBootstrapService } from './tenant-rls-bootstrap.service';
import { TenantQueryWrapperService } from './tenant-query-wrapper.service';

@Global()
@Module({
  providers: [
    TenantContextService,
    TenantRlsService,
    TenantRlsBootstrapService,
    TenantQueryWrapperService,
  ],
  exports: [TenantContextService, TenantRlsService, TenantQueryWrapperService],
})
export class TenantModule {}

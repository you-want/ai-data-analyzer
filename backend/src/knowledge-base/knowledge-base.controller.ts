import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { KnowledgeBaseService } from './knowledge-base.service';
import {
  CurrentWorkspace,
  CurrentUser,
} from '../auth/decorators/current-auth.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../auth/guards/workspace.guard';
import type { AuthenticatedUser, WorkspaceContext } from '../auth/auth.types';

class IngestReportDto {
  report: string;
  analysisId?: string;
  datasetId?: string;
}

@Controller('knowledge-base')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class KnowledgeBaseController {
  constructor(private readonly knowledgeBaseService: KnowledgeBaseService) {}

  @Post('ingest/report')
  ingestReport(
    @Body() body: IngestReportDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentWorkspace() workspace: WorkspaceContext,
  ) {
    return this.knowledgeBaseService.ingestReport({
      workspaceId: workspace.workspaceId,
      analysisId: body.analysisId,
      datasetId: body.datasetId,
      report: body.report,
      metadata: {
        ingestedBy: user.id,
      },
    });
  }

  @Get('query')
  async query(
    @CurrentWorkspace() workspace: WorkspaceContext,
    @Query('q') q: string,
    @Query('topK') topK?: string,
  ) {
    const items = await this.knowledgeBaseService.query(
      workspace.workspaceId,
      q,
      topK ? Number(topK) : undefined,
    );

    return {
      items,
      contextPack: this.knowledgeBaseService.buildContextPack(items),
    };
  }
}

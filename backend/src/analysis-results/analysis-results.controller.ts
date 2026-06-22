import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { AnalysisResultsService } from './analysis-results.service';
import { CreateAnalysisResultDto } from './dto/create-analysis-result.dto';
import { UpdateAnalysisResultDto } from './dto/update-analysis-result.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../auth/guards/workspace.guard';
import {
  CurrentUser,
  CurrentWorkspace,
} from '../auth/decorators/current-auth.decorator';
import type { AuthenticatedUser, WorkspaceContext } from '../auth/auth.types';

@Controller('analysis-results')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class AnalysisResultsController {
  constructor(
    private readonly analysisResultsService: AnalysisResultsService,
  ) {}

  @Post()
  create(
    @Body() createAnalysisResultDto: CreateAnalysisResultDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentWorkspace() workspace: WorkspaceContext,
  ) {
    return this.analysisResultsService.create(
      workspace.workspaceId,
      user.id,
      createAnalysisResultDto,
    );
  }

  @Get()
  findAll(@CurrentWorkspace() workspace: WorkspaceContext) {
    return this.analysisResultsService.findAll(workspace.workspaceId);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentWorkspace() workspace: WorkspaceContext,
  ) {
    return this.analysisResultsService.findOne(workspace.workspaceId, id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateAnalysisResultDto: UpdateAnalysisResultDto,
    @CurrentWorkspace() workspace: WorkspaceContext,
  ) {
    return this.analysisResultsService.update(
      workspace.workspaceId,
      id,
      updateAnalysisResultDto,
    );
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentWorkspace() workspace: WorkspaceContext,
  ) {
    return this.analysisResultsService.remove(workspace.workspaceId, id);
  }
}

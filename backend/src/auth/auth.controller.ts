import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Redirect,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  CurrentUser,
  CurrentWorkspace,
} from './decorators/current-auth.decorator';
import type { AuthenticatedUser, WorkspaceContext } from './auth.types';
import { WorkspaceGuard } from './guards/workspace.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { AddWorkspaceMemberDto } from './dto/add-workspace-member.dto';
import { UpdateWorkspaceMemberRoleDto } from './dto/update-workspace-member-role.dto';
import { CreateWorkspaceInvitationDto } from './dto/create-workspace-invitation.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('oauth/providers')
  oauthProviders() {
    return this.authService.getOAuthProviderStatuses();
  }

  @Get('oauth/:provider/start')
  startOAuth(
    @Param('provider') provider: 'github' | 'google',
    @Query('next') next?: string,
  ) {
    return {
      url: this.authService.buildOAuthAuthorizationUrl(provider, next),
    };
  }

  @Get('oauth/:provider/redirect')
  @Redirect(undefined, HttpStatus.TEMPORARY_REDIRECT)
  redirectToOAuthProvider(
    @Param('provider') provider: 'github' | 'google',
    @Query('next') next?: string,
  ) {
    return {
      url: this.authService.buildOAuthAuthorizationUrl(provider, next),
    };
  }

  @Get('oauth/:provider/callback')
  async oauthCallback(
    @Param('provider') provider: 'github' | 'google',
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() response: Response,
  ) {
    const frontendUrl = this.authService.getFrontendOAuthCallbackUrl();

    try {
      const result = await this.authService.exchangeOAuthCode({
        provider,
        code,
        state,
      });
      const redirectUrl = new URL(frontendUrl);
      redirectUrl.searchParams.set('ticket', result.ticket);
      redirectUrl.searchParams.set('next', result.nextPath);
      return response.redirect(redirectUrl.toString());
    } catch (error) {
      const redirectUrl = new URL(frontendUrl);
      redirectUrl.searchParams.set(
        'error',
        error instanceof Error ? error.message : 'OAuth 登录失败',
      );
      return response.redirect(redirectUrl.toString());
    }
  }

  @Get('oauth/session')
  oauthSession(@Query('ticket') ticket: string) {
    return this.authService.consumeOAuthTicket(ticket);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @Get('workspaces')
  @UseGuards(JwtAuthGuard)
  workspaces(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getUserWorkspaces(user.id);
  }

  @Get('workspace/members')
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  workspaceMembers(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentWorkspace() workspace: WorkspaceContext,
  ) {
    return this.authService.getWorkspaceMembers(user.id, workspace.workspaceId);
  }

  @Post('workspace/members')
  @UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
  @Roles('owner', 'admin')
  addWorkspaceMember(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentWorkspace() workspace: WorkspaceContext,
    @Body() dto: AddWorkspaceMemberDto,
  ) {
    return this.authService.addWorkspaceMember(
      user.id,
      workspace.workspaceId,
      dto,
    );
  }

  @Patch('workspace/members/:membershipId')
  @UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
  @Roles('owner', 'admin')
  updateWorkspaceMemberRole(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentWorkspace() workspace: WorkspaceContext,
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateWorkspaceMemberRoleDto,
  ) {
    return this.authService.updateWorkspaceMemberRole(
      user.id,
      workspace.workspaceId,
      membershipId,
      dto.role,
    );
  }

  @Delete('workspace/members/:membershipId')
  @UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
  @Roles('owner', 'admin')
  removeWorkspaceMember(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentWorkspace() workspace: WorkspaceContext,
    @Param('membershipId') membershipId: string,
  ) {
    return this.authService.removeWorkspaceMember(
      user.id,
      workspace.workspaceId,
      membershipId,
    );
  }

  @Get('workspace/invitations')
  @UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
  @Roles('owner', 'admin')
  workspaceInvitations(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentWorkspace() workspace: WorkspaceContext,
  ) {
    return this.authService.getWorkspaceInvitations(
      user.id,
      workspace.workspaceId,
    );
  }

  @Get('workspace/audit-logs')
  @UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
  @Roles('owner', 'admin')
  workspaceAuditLogs(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentWorkspace() workspace: WorkspaceContext,
    @Query('limit') limit?: string,
  ) {
    return this.authService.getWorkspaceAuditLogs(
      user.id,
      workspace.workspaceId,
      limit ? Number(limit) : undefined,
    );
  }

  @Post('workspace/invitations')
  @UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
  @Roles('owner', 'admin')
  createWorkspaceInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentWorkspace() workspace: WorkspaceContext,
    @Body() dto: CreateWorkspaceInvitationDto,
  ) {
    return this.authService.createWorkspaceInvitation(
      user.id,
      workspace.workspaceId,
      dto,
    );
  }

  @Delete('workspace/invitations/:invitationId')
  @UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
  @Roles('owner', 'admin')
  revokeWorkspaceInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentWorkspace() workspace: WorkspaceContext,
    @Param('invitationId') invitationId: string,
  ) {
    return this.authService.revokeWorkspaceInvitation(
      user.id,
      workspace.workspaceId,
      invitationId,
    );
  }

  @Get('invitations/:token')
  invitationPreview(@Param('token') token: string) {
    return this.authService.getWorkspaceInvitationPreview(token);
  }

  @Post('invitations/:token/accept')
  @UseGuards(JwtAuthGuard)
  acceptInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('token') token: string,
  ) {
    return this.authService.acceptWorkspaceInvitation(user.id, token);
  }
}

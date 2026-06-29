import {
  BadRequestException,
  HttpException,
  HttpStatus,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { createHash, createHmac, randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { compare, hash } from 'bcryptjs';
import type { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';
import { User } from './entities/user.entity';
import { Workspace } from './entities/workspace.entity';
import { Membership } from './entities/membership.entity';
import { WorkspaceInvitation } from './entities/workspace-invitation.entity';
import { OAuthAccount } from './entities/oauth-account.entity';
import { AuthAuditService } from './auth-audit.service';
import { TenantRlsService } from '../tenant/tenant-rls.service';
import {
  AuthNotificationService,
  type InviteEmailResult,
} from './auth-notification.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type {
  AcceptedWorkspaceInvitation,
  AuthenticatedUser,
  AuthResponsePayload,
  CreatedWorkspaceInvitation,
  OAuthProvider,
  OAuthProviderStatus,
  WorkspaceMemberSummary,
  WorkspaceInvitationPreview,
  WorkspaceInvitationRole,
  WorkspaceInvitationStatus,
  WorkspaceInvitationSummary,
  WorkspaceAuditLogSummary,
  WorkspaceRole,
} from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Workspace)
    private readonly workspacesRepository: Repository<Workspace>,
    @InjectRepository(WorkspaceInvitation)
    private readonly invitationsRepository: Repository<WorkspaceInvitation>,
    @InjectRepository(OAuthAccount)
    private readonly oauthAccountsRepository: Repository<OAuthAccount>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly authAuditService: AuthAuditService,
    private readonly authNotificationService: AuthNotificationService,
    private readonly tenantRlsService: TenantRlsService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersRepository.findOne({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('该邮箱已经注册过了');
    }

    const passwordHash = await hash(dto.password, 10);
    const user = await this.usersRepository.save(
      this.usersRepository.create({
        email: dto.email.toLowerCase(),
        name: dto.name,
        passwordHash,
      }),
    );

    const workspace = await this.workspacesRepository.save(
      this.workspacesRepository.create({
        name: `${dto.name} 的工作空间`,
        ownerUserId: user.id,
      }),
    );

    await this.tenantRlsService.runWithTenant(
      { workspaceId: workspace.id, userId: user.id },
      async (manager) => {
        const membershipsRepository = manager.getRepository(Membership);
        await membershipsRepository.save(
          membershipsRepository.create({
            userId: user.id,
            workspaceId: workspace.id,
            role: 'owner',
          }),
        );
        return null;
      },
    );

    await this.authAuditService.record({
      workspaceId: workspace.id,
      actorUserId: user.id,
      action: 'auth.register',
      targetType: 'user',
      targetId: user.id,
      metadata: {
        email: user.email,
        workspaceName: workspace.name,
      },
    });

    return this.buildAuthResponse(user, workspace.id);
  }

  async login(dto: LoginDto) {
    const user = await this.usersRepository.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user?.passwordHash) {
      throw new UnauthorizedException('账号或密码不正确');
    }

    const passwordValid = await compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('账号或密码不正确');
    }

    const membership = await this.tenantRlsService.runWithTenant(
      { userId: user.id },
      async (manager) =>
        manager.getRepository(Membership).findOne({
          where: { userId: user.id },
          order: { createdAt: 'ASC' },
        }),
    );

    await this.authAuditService.record({
      workspaceId: membership?.workspaceId ?? null,
      actorUserId: user.id,
      action: 'auth.login',
      targetType: 'user',
      targetId: user.id,
      metadata: {
        email: user.email,
      },
    });

    return this.buildAuthResponse(user, membership?.workspaceId);
  }

  getOAuthProviderStatuses(): OAuthProviderStatus[] {
    return this.supportedOAuthProviders().map((provider) => ({
      provider,
      enabled: this.isOAuthProviderEnabled(provider),
      label: provider === 'github' ? 'GitHub' : 'Google',
    }));
  }

  buildOAuthAuthorizationUrl(
    provider: OAuthProvider,
    nextPath?: string,
  ): string {
    this.assertSupportedOAuthProvider(provider);
    this.assertOAuthProviderEnabled(provider);

    const state = this.createOAuthState({
      provider,
      nextPath: this.normalizeNextPath(nextPath),
    });
    const callbackUrl = this.buildOAuthCallbackUrl(provider);

    if (provider === 'github') {
      return `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(
        this.configService.get<string>('GITHUB_CLIENT_ID', ''),
      )}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=${encodeURIComponent(
        'read:user user:email',
      )}&state=${encodeURIComponent(state)}`;
    }

    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
      this.configService.get<string>('GOOGLE_CLIENT_ID', ''),
    )}&redirect_uri=${encodeURIComponent(callbackUrl)}&response_type=code&scope=${encodeURIComponent(
      'openid email profile',
    )}&state=${encodeURIComponent(state)}&access_type=offline&prompt=consent`;
  }

  async exchangeOAuthCode(input: {
    provider: OAuthProvider;
    code?: string;
    state?: string;
  }): Promise<{ ticket: string; nextPath: string }> {
    this.assertSupportedOAuthProvider(input.provider);
    if (!input.code || !input.state) {
      throw new BadRequestException('OAuth 回调缺少 code 或 state');
    }

    const statePayload = this.verifyOAuthState(input.state, input.provider);
    const profile = await this.fetchOAuthProfile(input.provider, input.code);
    const user = await this.resolveUserFromOAuthProfile(
      input.provider,
      profile,
    );
    const membership = await this.ensureDefaultWorkspaceMembership(user);
    const authPayload = this.buildAuthResponse(user, membership.workspaceId);
    const ticket = await this.issueOAuthTicket(authPayload);

    await this.authAuditService.record({
      workspaceId: membership.workspaceId,
      actorUserId: user.id,
      action: 'auth.oauth_login',
      targetType: 'user',
      targetId: user.id,
      metadata: {
        provider: input.provider,
        email: user.email,
      },
    });

    return {
      ticket,
      nextPath: statePayload.nextPath,
    };
  }

  async consumeOAuthTicket(ticket: string): Promise<AuthResponsePayload> {
    const cacheKey = this.getOAuthTicketCacheKey(ticket);
    const payload = await this.cacheManager.get<AuthResponsePayload>(cacheKey);
    if (!payload) {
      throw new NotFoundException('OAuth 登录票据不存在或已过期');
    }
    await this.cacheManager.del(cacheKey);
    return payload;
  }

  getFrontendOAuthCallbackUrl(): string {
    return this.buildFrontendOAuthCallbackUrl();
  }

  async findAuthenticatedUser(userId: string): Promise<AuthenticatedUser> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }
    return { id: user.id, email: user.email, name: user.name };
  }

  async getUserWorkspaces(userId: string) {
    const memberships = await this.tenantRlsService.runWithTenant(
      { userId },
      async (manager) =>
        manager.getRepository(Membership).find({
          where: { userId },
          relations: { workspace: true },
          order: { createdAt: 'ASC' },
        }),
    );

    return memberships.map((membership) => ({
      workspaceId: membership.workspaceId,
      name: membership.workspace.name,
      role: membership.role,
    }));
  }

  async resolveMembership(userId: string, workspaceId?: string) {
    if (workspaceId) {
      return this.tenantRlsService.runWithTenant(
        { userId, workspaceId },
        async (manager) =>
          manager.getRepository(Membership).findOne({
            where: { userId, workspaceId },
          }),
      );
    }

    return this.tenantRlsService.runWithTenant({ userId }, async (manager) =>
      manager.getRepository(Membership).findOne({
        where: { userId },
        order: { createdAt: 'ASC' },
      }),
    );
  }

  async getWorkspaceMembers(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceMemberSummary[]> {
    await this.requireWorkspaceMembership(userId, workspaceId);

    const memberships = await this.tenantRlsService.runWithTenant(
      { workspaceId, userId },
      async (manager) =>
        manager.getRepository(Membership).find({
          where: { workspaceId },
          relations: { user: true },
          order: { createdAt: 'ASC' },
        }),
    );

    return memberships.map((membership) => ({
      membershipId: membership.id,
      userId: membership.userId,
      email: membership.user.email,
      name: membership.user.name,
      role: membership.role,
      createdAt: membership.createdAt.toISOString(),
    }));
  }

  async addWorkspaceMember(
    actorUserId: string,
    workspaceId: string,
    input: {
      email: string;
      role: Exclude<WorkspaceRole, 'owner'>;
    },
  ): Promise<WorkspaceMemberSummary> {
    const actorMembership = await this.requireWorkspaceMembership(
      actorUserId,
      workspaceId,
    );
    this.assertCanAssignRole(actorMembership.role, input.role);

    const targetUser = await this.usersRepository.findOne({
      where: { email: input.email.toLowerCase() },
    });

    if (!targetUser) {
      throw new NotFoundException(
        '目标用户不存在，请先让对方注册，不然邀请会像发给空气。',
      );
    }

    const existingMembership = await this.tenantRlsService.runWithTenant(
      { workspaceId, userId: actorUserId },
      async (manager) =>
        manager.getRepository(Membership).findOne({
          where: { userId: targetUser.id, workspaceId },
          relations: { user: true },
        }),
    );

    if (existingMembership) {
      throw new ConflictException('该用户已经在当前工作空间里了');
    }

    const membership = await this.tenantRlsService.runWithTenant(
      { workspaceId, userId: actorUserId },
      async (manager) => {
        const membershipsRepository = manager.getRepository(Membership);
        return membershipsRepository.save(
          membershipsRepository.create({
            userId: targetUser.id,
            workspaceId,
            role: input.role,
          }),
        );
      },
    );

    await this.authAuditService.record({
      workspaceId,
      actorUserId,
      action: 'workspace.member.added',
      targetType: 'membership',
      targetId: membership.id,
      metadata: {
        targetUserId: targetUser.id,
        targetEmail: targetUser.email,
        role: membership.role,
      },
    });

    return {
      membershipId: membership.id,
      userId: targetUser.id,
      email: targetUser.email,
      name: targetUser.name,
      role: membership.role,
      createdAt: membership.createdAt.toISOString(),
    };
  }

  async updateWorkspaceMemberRole(
    actorUserId: string,
    workspaceId: string,
    membershipId: string,
    role: Exclude<WorkspaceRole, 'owner'>,
  ): Promise<WorkspaceMemberSummary> {
    const actorMembership = await this.requireWorkspaceMembership(
      actorUserId,
      workspaceId,
    );
    this.assertCanAssignRole(actorMembership.role, role);

    const membership = await this.tenantRlsService.runWithTenant(
      { workspaceId, userId: actorUserId },
      async (manager) =>
        manager.getRepository(Membership).findOne({
          where: { id: membershipId, workspaceId },
          relations: { user: true },
        }),
    );

    if (!membership) {
      throw new NotFoundException('成员不存在');
    }
    if (membership.role === 'owner') {
      throw new BadRequestException('owner 角色不能在这里被修改');
    }
    if (actorMembership.role === 'admin' && membership.role === 'admin') {
      throw new ForbiddenException('admin 不能修改另一个 admin 的角色');
    }

    membership.role = role;
    const saved = await this.tenantRlsService.runWithTenant(
      { workspaceId, userId: actorUserId },
      async (manager) => manager.getRepository(Membership).save(membership),
    );

    await this.authAuditService.record({
      workspaceId,
      actorUserId,
      action: 'workspace.member.role_updated',
      targetType: 'membership',
      targetId: saved.id,
      metadata: {
        targetUserId: saved.userId,
        targetEmail: saved.user.email,
        role: saved.role,
      },
    });

    return {
      membershipId: saved.id,
      userId: saved.userId,
      email: saved.user.email,
      name: saved.user.name,
      role: saved.role,
      createdAt: saved.createdAt.toISOString(),
    };
  }

  async removeWorkspaceMember(
    actorUserId: string,
    workspaceId: string,
    membershipId: string,
  ): Promise<{ removed: true }> {
    const actorMembership = await this.requireWorkspaceMembership(
      actorUserId,
      workspaceId,
    );

    const membership = await this.tenantRlsService.runWithTenant(
      { workspaceId, userId: actorUserId },
      async (manager) =>
        manager.getRepository(Membership).findOne({
          where: { id: membershipId, workspaceId },
        }),
    );

    if (!membership) {
      throw new NotFoundException('成员不存在');
    }
    if (membership.role === 'owner') {
      throw new BadRequestException('owner 不能在这里被移除');
    }
    if (membership.userId === actorUserId) {
      throw new BadRequestException('请不要把自己从当前工作空间踢出去');
    }
    if (actorMembership.role === 'admin' && membership.role === 'admin') {
      throw new ForbiddenException('admin 不能移除另一个 admin');
    }

    await this.tenantRlsService.runWithTenant(
      { workspaceId, userId: actorUserId },
      async (manager) => {
        await manager.getRepository(Membership).delete({ id: membership.id });
        return null;
      },
    );
    await this.authAuditService.record({
      workspaceId,
      actorUserId,
      action: 'workspace.member.removed',
      targetType: 'membership',
      targetId: membership.id,
      metadata: {
        targetUserId: membership.userId,
        role: membership.role,
      },
    });
    return { removed: true };
  }

  async getWorkspaceInvitations(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceInvitationSummary[]> {
    const actorMembership = await this.requireWorkspaceMembership(
      userId,
      workspaceId,
    );
    this.assertCanManageWorkspaceInvitations(actorMembership.role);

    const invitations = await this.invitationsRepository.find({
      where: { workspaceId },
      order: { createdAt: 'DESC' },
      take: 20,
    });

    return invitations.map((invitation) =>
      this.buildWorkspaceInvitationSummary(invitation),
    );
  }

  async getWorkspaceAuditLogs(
    userId: string,
    workspaceId: string,
    limit = 50,
  ): Promise<WorkspaceAuditLogSummary[]> {
    const actorMembership = await this.requireWorkspaceMembership(
      userId,
      workspaceId,
    );
    this.assertCanManageWorkspaceInvitations(actorMembership.role);
    return this.authAuditService.listWorkspaceAuditLogs(workspaceId, limit);
  }

  async createWorkspaceInvitation(
    actorUserId: string,
    workspaceId: string,
    input: {
      role: WorkspaceInvitationRole;
      expiresInDays?: number;
      email?: string;
      message?: string;
    },
  ): Promise<CreatedWorkspaceInvitation> {
    const actorMembership = await this.requireWorkspaceMembership(
      actorUserId,
      workspaceId,
    );
    this.assertCanAssignRole(actorMembership.role, input.role);

    const token = randomBytes(24).toString('hex');
    const invitation = await this.invitationsRepository.save(
      this.invitationsRepository.create({
        workspaceId,
        createdByUserId: actorUserId,
        role: input.role,
        invitedEmail: input.email?.toLowerCase() ?? null,
        tokenHash: this.hashInvitationToken(token),
        expiresAt: this.buildInvitationExpiry(input.expiresInDays),
      }),
    );

    const actorUser = await this.usersRepository.findOne({
      where: { id: actorUserId },
    });
    const workspace = await this.workspacesRepository.findOne({
      where: { id: workspaceId },
    });
    const inviteUrl = this.buildInvitationUrl(token);
    const emailResult = input.email
      ? await this.sendInvitationEmailSafely({
          recipientEmail: input.email.toLowerCase(),
          workspaceName: workspace?.name || '工作空间',
          inviterName: actorUser?.name || '团队管理员',
          role: input.role,
          inviteUrl,
          expiresAt: invitation.expiresAt.toISOString(),
        })
      : null;

    await this.authAuditService.record({
      workspaceId,
      actorUserId,
      action: 'workspace.invitation.created',
      targetType: 'invitation',
      targetId: invitation.id,
      metadata: {
        role: invitation.role,
        invitedEmail: invitation.invitedEmail ?? null,
        expiresAt: invitation.expiresAt.toISOString(),
        emailDeliveryStatus: emailResult
          ? this.mapEmailResultToStatus(emailResult)
          : 'not_requested',
        message: input.message ?? null,
      },
    });

    return {
      ...this.buildWorkspaceInvitationSummary(invitation),
      inviteUrl,
      emailDeliveryStatus: emailResult
        ? this.mapEmailResultToStatus(emailResult)
        : 'not_requested',
      emailDeliveryMessage: emailResult?.message ?? null,
    };
  }

  async revokeWorkspaceInvitation(
    actorUserId: string,
    workspaceId: string,
    invitationId: string,
  ): Promise<{ revoked: true }> {
    const actorMembership = await this.requireWorkspaceMembership(
      actorUserId,
      workspaceId,
    );
    this.assertCanManageWorkspaceInvitations(actorMembership.role);

    const invitation = await this.invitationsRepository.findOne({
      where: { id: invitationId, workspaceId },
    });

    if (!invitation) {
      throw new NotFoundException('邀请不存在');
    }

    const status = this.resolveInvitationStatus(invitation);
    if (status === 'accepted') {
      throw new BadRequestException('这个邀请已经被领取了，没法再撤回');
    }
    if (status === 'revoked') {
      return { revoked: true };
    }

    invitation.revokedAt = new Date();
    await this.invitationsRepository.save(invitation);
    await this.authAuditService.record({
      workspaceId,
      actorUserId,
      action: 'workspace.invitation.revoked',
      targetType: 'invitation',
      targetId: invitation.id,
      metadata: {
        invitedEmail: invitation.invitedEmail ?? null,
      },
    });
    return { revoked: true };
  }

  async getWorkspaceInvitationPreview(
    token: string,
  ): Promise<WorkspaceInvitationPreview> {
    const invitation = await this.invitationsRepository.findOne({
      where: { tokenHash: this.hashInvitationToken(token) },
      relations: { workspace: true, createdByUser: true },
    });

    if (!invitation) {
      throw new NotFoundException('邀请链接不存在，可能已经被清理掉了');
    }

    return {
      workspaceId: invitation.workspaceId,
      workspaceName: invitation.workspace.name,
      inviterName: invitation.createdByUser.name,
      role: invitation.role,
      status: this.resolveInvitationStatus(invitation),
      invitedEmail: invitation.invitedEmail ?? null,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }

  async acceptWorkspaceInvitation(
    userId: string,
    token: string,
  ): Promise<AcceptedWorkspaceInvitation> {
    const invitation = await this.invitationsRepository.findOne({
      where: { tokenHash: this.hashInvitationToken(token) },
      relations: { workspace: true },
    });

    if (!invitation) {
      throw new NotFoundException('邀请链接不存在，可能是复制时手抖了');
    }

    this.assertInvitationAcceptable(invitation);

    const accepted = await this.tenantRlsService.runWithTenant(
      { workspaceId: invitation.workspaceId, userId },
      async (manager) => {
        const invitationsRepository =
          manager.getRepository(WorkspaceInvitation);
        const membershipsRepository = manager.getRepository(Membership);
        const existingMembership = await membershipsRepository.findOne({
          where: { userId, workspaceId: invitation.workspaceId },
        });
        if (existingMembership) {
          throw new ConflictException('你已经在这个工作空间里了，不用重复领奖');
        }
        const user = await manager.getRepository(User).findOne({
          where: { id: userId },
        });
        if (
          invitation.invitedEmail &&
          user?.email.toLowerCase() !== invitation.invitedEmail.toLowerCase()
        ) {
          throw new ForbiddenException(
            '这个邀请绑定了指定邮箱，请使用受邀邮箱登录',
          );
        }

        await membershipsRepository.save(
          membershipsRepository.create({
            userId,
            workspaceId: invitation.workspaceId,
            role: invitation.role,
          }),
        );

        invitation.acceptedByUserId = userId;
        invitation.acceptedAt = new Date();
        await invitationsRepository.save(invitation);

        return {
          workspaceId: invitation.workspaceId,
          workspaceName: invitation.workspace.name,
          role: invitation.role,
        };
      },
    );

    await this.authAuditService.record({
      workspaceId: invitation.workspaceId,
      actorUserId: userId,
      action: 'workspace.invitation.accepted',
      targetType: 'invitation',
      targetId: invitation.id,
      metadata: {
        role: invitation.role,
        invitedEmail: invitation.invitedEmail ?? null,
      },
    });

    return accepted;
  }

  private buildAuthResponse(user: User, workspaceId?: string) {
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      defaultWorkspaceId: workspaceId,
    };
  }

  private supportedOAuthProviders(): OAuthProvider[] {
    return ['github', 'google'];
  }

  private assertSupportedOAuthProvider(
    provider: string,
  ): asserts provider is OAuthProvider {
    if (this.supportedOAuthProviders().includes(provider as OAuthProvider)) {
      return;
    }
    throw new BadRequestException(`不支持的 OAuth Provider: ${provider}`);
  }

  private isOAuthProviderEnabled(provider: OAuthProvider): boolean {
    return Boolean(this.getOAuthProviderConfig(provider)?.clientId);
  }

  private assertOAuthProviderEnabled(provider: OAuthProvider): void {
    const config = this.getOAuthProviderConfig(provider);
    const providerName = provider === 'github' ? 'GitHub' : 'Google';
    const docsUrl =
      provider === 'github'
        ? 'https://github.com/settings/developers'
        : 'https://console.cloud.google.com/apis/credentials';

    if (!config?.clientId || !config.clientSecret) {
      const missingFields: string[] = [];
      if (!config?.clientId)
        missingFields.push(`${providerName.toUpperCase()}_CLIENT_ID`);
      if (!config?.clientSecret)
        missingFields.push(`${providerName.toUpperCase()}_CLIENT_SECRET`);

      throw new BadRequestException(
        `OAuth Provider ${providerName} 尚未配置完整。请设置以下环境变量: ${missingFields.join(
          ', ',
        )}。配置指南: ${docsUrl}`,
      );
    }
  }

  private getOAuthProviderConfig(provider: OAuthProvider) {
    if (provider === 'github') {
      return {
        clientId: this.configService.get<string>('GITHUB_CLIENT_ID'),
        clientSecret: this.configService.get<string>('GITHUB_CLIENT_SECRET'),
      };
    }

    return {
      clientId: this.configService.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
    };
  }

  private buildOAuthCallbackUrl(provider: OAuthProvider): string {
    const backendUrl = this.configService.get<string>(
      'BACKEND_PUBLIC_URL',
      'http://localhost:3001',
    );
    return `${backendUrl.replace(/\/$/, '')}/auth/oauth/${provider}/callback`;
  }

  private buildFrontendOAuthCallbackUrl(): string {
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    return `${frontendUrl.replace(/\/$/, '')}/auth/callback`;
  }

  private createOAuthState(input: {
    provider: OAuthProvider;
    nextPath: string;
  }): string {
    const payload = Buffer.from(JSON.stringify(input)).toString('base64url');
    const signature = createHmac('sha256', this.getOAuthStateSecret())
      .update(payload)
      .digest('base64url');
    return `${payload}.${signature}`;
  }

  private verifyOAuthState(
    state: string,
    provider: OAuthProvider,
  ): { provider: OAuthProvider; nextPath: string } {
    const [payload, signature] = state.split('.');
    if (!payload || !signature) {
      throw new BadRequestException('OAuth state 格式不正确');
    }

    const expectedSignature = createHmac('sha256', this.getOAuthStateSecret())
      .update(payload)
      .digest('base64url');

    if (expectedSignature !== signature) {
      throw new BadRequestException('OAuth state 校验失败');
    }

    const parsed = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as {
      provider: OAuthProvider;
      nextPath?: string;
    };

    if (parsed.provider !== provider) {
      throw new BadRequestException('OAuth provider 与 state 不匹配');
    }

    return {
      provider: parsed.provider,
      nextPath: this.normalizeNextPath(parsed.nextPath),
    };
  }

  private getOAuthStateSecret(): string {
    return this.configService.get<string>(
      'OAUTH_STATE_SECRET',
      this.configService.get<string>('JWT_SECRET', 'dev-secret-change-me'),
    );
  }

  private normalizeNextPath(nextPath?: string): string {
    if (!nextPath || !nextPath.startsWith('/')) {
      return '/dashboard';
    }
    return nextPath;
  }

  private async fetchOAuthProfile(provider: OAuthProvider, code: string) {
    if (provider === 'github') {
      return this.fetchGitHubOAuthProfile(code);
    }
    return this.fetchGoogleOAuthProfile(code);
  }

  private async fetchGitHubOAuthProfile(code: string): Promise<{
    providerAccountId: string;
    email: string;
    name: string;
  }> {
    const config = this.getOAuthProviderConfig('github');
    this.assertOAuthProviderEnabled('github');

    const tokenResponse = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: config?.clientId,
          client_secret: config?.clientSecret,
          code,
          redirect_uri: this.buildOAuthCallbackUrl('github'),
        }),
      },
    );
    const tokenPayload = (await tokenResponse.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };
    if (!tokenResponse.ok || !tokenPayload.access_token) {
      throw new HttpException(
        tokenPayload.error_description || 'GitHub OAuth token 交换失败',
        HttpStatus.BAD_REQUEST,
      );
    }

    const profileResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenPayload.access_token}`,
        Accept: 'application/vnd.github+json',
      },
    });
    const profile = (await profileResponse.json()) as {
      id?: number;
      email?: string | null;
      name?: string | null;
      login?: string | null;
    };
    if (!profileResponse.ok || !profile.id) {
      throw new HttpException(
        'GitHub 用户资料获取失败',
        HttpStatus.BAD_REQUEST,
      );
    }

    let email = profile.email ?? null;
    if (!email) {
      const emailsResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${tokenPayload.access_token}`,
          Accept: 'application/vnd.github+json',
        },
      });
      const emails = (await emailsResponse.json()) as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;
      email =
        emails.find((item) => item.primary && item.verified)?.email ||
        emails.find((item) => item.verified)?.email ||
        null;
    }

    if (!email) {
      throw new BadRequestException(
        'GitHub 账号没有可用邮箱，无法自动创建或关联用户',
      );
    }

    return {
      providerAccountId: String(profile.id),
      email: email.toLowerCase(),
      name: profile.name || profile.login || email.split('@')[0],
    };
  }

  private async fetchGoogleOAuthProfile(code: string): Promise<{
    providerAccountId: string;
    email: string;
    name: string;
  }> {
    const config = this.getOAuthProviderConfig('google');
    this.assertOAuthProviderEnabled('google');

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config?.clientId || '',
        client_secret: config?.clientSecret || '',
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.buildOAuthCallbackUrl('google'),
      }),
    });
    const tokenPayload = (await tokenResponse.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };
    if (!tokenResponse.ok || !tokenPayload.access_token) {
      throw new HttpException(
        tokenPayload.error_description || 'Google OAuth token 交换失败',
        HttpStatus.BAD_REQUEST,
      );
    }

    const profileResponse = await fetch(
      'https://openidconnect.googleapis.com/v1/userinfo',
      {
        headers: {
          Authorization: `Bearer ${tokenPayload.access_token}`,
        },
      },
    );
    const profile = (await profileResponse.json()) as {
      sub?: string;
      email?: string;
      name?: string;
    };
    if (!profileResponse.ok || !profile.sub || !profile.email) {
      throw new HttpException(
        'Google 用户资料获取失败',
        HttpStatus.BAD_REQUEST,
      );
    }

    return {
      providerAccountId: profile.sub,
      email: profile.email.toLowerCase(),
      name: profile.name || profile.email.split('@')[0],
    };
  }

  private async resolveUserFromOAuthProfile(
    provider: OAuthProvider,
    profile: {
      providerAccountId: string;
      email: string;
      name: string;
    },
  ): Promise<User> {
    const existingAccount = await this.oauthAccountsRepository.findOne({
      where: {
        provider,
        providerAccountId: profile.providerAccountId,
      },
      relations: { user: true },
    });
    if (existingAccount?.user) {
      return existingAccount.user;
    }

    let user = await this.usersRepository.findOne({
      where: { email: profile.email.toLowerCase() },
    });
    let createdUser = false;
    if (!user) {
      user = await this.usersRepository.save(
        this.usersRepository.create({
          email: profile.email.toLowerCase(),
          name: profile.name,
          passwordHash: null,
        }),
      );
      createdUser = true;
    }

    await this.oauthAccountsRepository.save(
      this.oauthAccountsRepository.create({
        userId: user.id,
        provider,
        providerAccountId: profile.providerAccountId,
        email: profile.email.toLowerCase(),
      }),
    );

    if (createdUser) {
      await this.authAuditService.record({
        actorUserId: user.id,
        action: 'auth.oauth_user_created',
        targetType: 'user',
        targetId: user.id,
        metadata: {
          provider,
          email: user.email,
        },
      });
    }

    return user;
  }

  private async ensureDefaultWorkspaceMembership(
    user: User,
  ): Promise<Membership> {
    let membership = await this.tenantRlsService.runWithTenant(
      { userId: user.id },
      async (manager) =>
        manager.getRepository(Membership).findOne({
          where: { userId: user.id },
          order: { createdAt: 'ASC' },
        }),
    );
    if (membership) {
      return membership;
    }

    const workspace = await this.workspacesRepository.save(
      this.workspacesRepository.create({
        name: `${user.name} 的工作空间`,
        ownerUserId: user.id,
      }),
    );
    membership = await this.tenantRlsService.runWithTenant(
      {
        workspaceId: workspace.id,
        userId: user.id,
      },
      async (manager) => {
        const membershipsRepository = manager.getRepository(Membership);
        return membershipsRepository.save(
          membershipsRepository.create({
            userId: user.id,
            workspaceId: workspace.id,
            role: 'owner',
          }),
        );
      },
    );
    return membership;
  }

  private async issueOAuthTicket(
    payload: AuthResponsePayload,
  ): Promise<string> {
    const ticket = randomBytes(24).toString('hex');
    await this.cacheManager.set(
      this.getOAuthTicketCacheKey(ticket),
      payload,
      5 * 60 * 1000,
    );
    return ticket;
  }

  private getOAuthTicketCacheKey(ticket: string): string {
    return `oauth-ticket:${ticket}`;
  }

  private async requireWorkspaceMembership(
    userId: string,
    workspaceId: string,
  ): Promise<Membership> {
    const membership = await this.resolveMembership(userId, workspaceId);

    if (!membership) {
      throw new ForbiddenException('你不属于当前工作空间');
    }

    return membership;
  }

  private assertCanAssignRole(
    actorRole: WorkspaceRole,
    targetRole: WorkspaceInvitationRole,
  ): void {
    if (actorRole === 'owner') {
      return;
    }

    if (actorRole !== 'admin') {
      throw new ForbiddenException('当前角色无权管理成员');
    }

    if (targetRole === 'admin') {
      throw new ForbiddenException('admin 不能授予 admin 角色');
    }
  }

  private assertCanManageWorkspaceInvitations(actorRole: WorkspaceRole): void {
    if (actorRole === 'owner' || actorRole === 'admin') {
      return;
    }

    throw new ForbiddenException('当前角色无权管理邀请链接');
  }

  private buildWorkspaceInvitationSummary(
    invitation: WorkspaceInvitation,
  ): WorkspaceInvitationSummary {
    return {
      invitationId: invitation.id,
      role: invitation.role,
      status: this.resolveInvitationStatus(invitation),
      invitedEmail: invitation.invitedEmail ?? null,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
      acceptedAt: invitation.acceptedAt?.toISOString() || null,
    };
  }

  private resolveInvitationStatus(
    invitation: WorkspaceInvitation,
  ): WorkspaceInvitationStatus {
    if (invitation.revokedAt) {
      return 'revoked';
    }
    if (invitation.acceptedAt) {
      return 'accepted';
    }
    if (invitation.expiresAt.getTime() <= Date.now()) {
      return 'expired';
    }
    return 'pending';
  }

  private assertInvitationAcceptable(invitation: WorkspaceInvitation): void {
    const status = this.resolveInvitationStatus(invitation);

    if (status === 'pending') {
      return;
    }
    if (status === 'accepted') {
      throw new ConflictException('这个邀请已经被别人先拿走了');
    }
    if (status === 'revoked') {
      throw new BadRequestException('这个邀请已经被撤回了');
    }

    throw new BadRequestException('这个邀请已经过期了，请让管理员重新发一条');
  }

  private buildInvitationExpiry(expiresInDays = 7): Date {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    return expiresAt;
  }

  private buildInvitationUrl(token: string): string {
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    return `${frontendUrl.replace(/\/$/, '')}/invite/${token}`;
  }

  private hashInvitationToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async sendInvitationEmailSafely(input: {
    recipientEmail: string;
    workspaceName: string;
    inviterName: string;
    role: string;
    inviteUrl: string;
    expiresAt: string;
  }): Promise<InviteEmailResult> {
    return this.authNotificationService.sendWorkspaceInvitationEmail(input);
  }

  private mapEmailResultToStatus(
    result: InviteEmailResult,
  ): CreatedWorkspaceInvitation['emailDeliveryStatus'] {
    if (result.delivered) {
      return 'sent';
    }
    return result.mode === 'stub' ? 'stub' : 'failed';
  }
}

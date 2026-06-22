export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';
export type WorkspaceInvitationRole = Exclude<WorkspaceRole, 'owner'>;
export type OAuthProvider = 'github' | 'google';
export type WorkspaceInvitationStatus =
  | 'pending'
  | 'accepted'
  | 'expired'
  | 'revoked';

export interface JwtPayload {
  sub: string;
  email: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthResponsePayload {
  accessToken: string;
  user: AuthenticatedUser;
  defaultWorkspaceId?: string;
}

export interface WorkspaceContext {
  workspaceId: string;
  role: WorkspaceRole;
}

export interface WorkspaceMemberSummary {
  membershipId: string;
  userId: string;
  email: string;
  name: string;
  role: WorkspaceRole;
  createdAt: string;
}

export interface WorkspaceInvitationSummary {
  invitationId: string;
  role: WorkspaceInvitationRole;
  status: WorkspaceInvitationStatus;
  invitedEmail: string | null;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
}

export interface CreatedWorkspaceInvitation extends WorkspaceInvitationSummary {
  inviteUrl: string;
  emailDeliveryStatus: 'not_requested' | 'sent' | 'stub' | 'failed';
  emailDeliveryMessage: string | null;
}

export interface WorkspaceInvitationPreview {
  workspaceId: string;
  workspaceName: string;
  inviterName: string;
  role: WorkspaceInvitationRole;
  status: WorkspaceInvitationStatus;
  invitedEmail: string | null;
  expiresAt: string;
}

export interface AcceptedWorkspaceInvitation {
  workspaceId: string;
  workspaceName: string;
  role: WorkspaceInvitationRole;
}

export interface WorkspaceAuditLogSummary {
  auditLogId: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  actorUserId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface OAuthProviderStatus {
  provider: OAuthProvider;
  enabled: boolean;
  label: string;
}

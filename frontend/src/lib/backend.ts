export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export interface FrontendAuthUser {
  id: string;
  email: string;
  name: string;
}

export interface WorkspaceSummary {
  workspaceId: string;
  name: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
}

export interface WorkspaceMemberSummary {
  membershipId: string;
  userId: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  createdAt: string;
}

export interface WorkspaceInvitationSummary {
  invitationId: string;
  role: 'admin' | 'member' | 'viewer';
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
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
  role: 'admin' | 'member' | 'viewer';
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  invitedEmail: string | null;
  expiresAt: string;
}

export interface AcceptedWorkspaceInvitation {
  workspaceId: string;
  workspaceName: string;
  role: 'admin' | 'member' | 'viewer';
}

export interface OAuthProviderStatus {
  provider: 'github' | 'google';
  enabled: boolean;
  label: string;
}

export interface AuthSession {
  accessToken: string;
  user: FrontendAuthUser;
  defaultWorkspaceId?: string;
  workspaces: WorkspaceSummary[];
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & {
    accessToken?: string;
    workspaceId?: string;
  },
): Promise<T> {
  const headers = new Headers(init?.headers);

  if (init?.accessToken) {
    headers.set('Authorization', `Bearer ${init.accessToken}`);
  }
  if (init?.workspaceId) {
    headers.set('x-workspace-id', init.workspaceId);
  }
  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const message = await extractErrorMessage(response);
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function buildOAuthRedirectUrl(
  provider: 'github' | 'google',
  nextPath?: string,
): string {
  const url = new URL(`${BACKEND_URL}/auth/oauth/${provider}/redirect`);
  if (nextPath) {
    url.searchParams.set('next', nextPath);
  }
  return url.toString();
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string };
    return payload.message || `请求失败: ${response.status}`;
  } catch {
    return `请求失败: ${response.status}`;
  }
}

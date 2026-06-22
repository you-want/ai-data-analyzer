'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  apiFetch,
  type CreatedWorkspaceInvitation,
  type WorkspaceMemberSummary,
  type WorkspaceInvitationSummary,
} from '@/lib/backend';
import { useAuth } from './providers/AuthProvider';

type EditableRole = 'admin' | 'member' | 'viewer';

export default function WorkspaceMembersPanel() {
  const { isAuthenticated, accessToken, activeWorkspaceId, activeWorkspace } =
    useAuth();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<EditableRole>('member');
  const [inviteRole, setInviteRole] = useState<EditableRole>('member');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteExpiresInDays, setInviteExpiresInDays] = useState('7');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestInviteUrl, setLatestInviteUrl] = useState<string | null>(null);
  const [latestInviteMessage, setLatestInviteMessage] = useState<string | null>(null);
  const [copiedInviteUrl, setCopiedInviteUrl] = useState(false);

  const canManageMembers = useMemo(
    () => activeWorkspace?.role === 'owner' || activeWorkspace?.role === 'admin',
    [activeWorkspace],
  );

  const swrKey =
    isAuthenticated && accessToken && activeWorkspaceId
      ? ['workspace-members', activeWorkspaceId]
      : null;

  const {
    data: members,
    error: loadError,
    isLoading,
    mutate,
  } = useSWR<WorkspaceMemberSummary[]>(
    swrKey,
    () =>
      apiFetch<WorkspaceMemberSummary[]>('/auth/workspace/members', {
        accessToken: accessToken || undefined,
        workspaceId: activeWorkspaceId || undefined,
      }),
  );

  const invitationSWRKey =
    canManageMembers && isAuthenticated && accessToken && activeWorkspaceId
      ? ['workspace-invitations', activeWorkspaceId]
      : null;

  const {
    data: invitations,
    error: invitationLoadError,
    isLoading: invitationsLoading,
    mutate: mutateInvitations,
  } = useSWR<WorkspaceInvitationSummary[]>(
    invitationSWRKey,
    () =>
      apiFetch<WorkspaceInvitationSummary[]>('/auth/workspace/invitations', {
        accessToken: accessToken || undefined,
        workspaceId: activeWorkspaceId || undefined,
      }),
  );

  const handleInvite = async () => {
    if (!email.trim() || !accessToken || !activeWorkspaceId) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/auth/workspace/members', {
        method: 'POST',
        body: JSON.stringify({ email, role }),
        accessToken,
        workspaceId: activeWorkspaceId,
      });
      setEmail('');
      setRole('member');
      await mutate();
    } catch (inviteError) {
      setError(
        inviteError instanceof Error ? inviteError.message : '邀请成员失败',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateInviteLink = async () => {
    if (!accessToken || !activeWorkspaceId) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setCopiedInviteUrl(false);
    setLatestInviteMessage(null);
    try {
      const created = await apiFetch<CreatedWorkspaceInvitation>(
        '/auth/workspace/invitations',
        {
          method: 'POST',
          body: JSON.stringify({
            role: inviteRole,
            expiresInDays: Number(inviteExpiresInDays) || 7,
            email: inviteEmail.trim() || undefined,
          }),
          accessToken,
          workspaceId: activeWorkspaceId,
        },
      );
      setLatestInviteUrl(created.inviteUrl);
      setLatestInviteMessage(created.emailDeliveryMessage);
      setInviteEmail('');
      await mutateInvitations();
    } catch (createInviteError) {
      setError(
        createInviteError instanceof Error
          ? createInviteError.message
          : '生成邀请链接失败',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleChange = async (
    membershipId: string,
    nextRole: EditableRole,
  ) => {
    if (!accessToken || !activeWorkspaceId) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/auth/workspace/members/${membershipId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: nextRole }),
        accessToken,
        workspaceId: activeWorkspaceId,
      });
      await mutate();
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : '更新角色失败',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (membershipId: string) => {
    if (!accessToken || !activeWorkspaceId) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/auth/workspace/members/${membershipId}`, {
        method: 'DELETE',
        accessToken,
        workspaceId: activeWorkspaceId,
      });
      await mutate();
      await mutateInvitations();
    } catch (removeError) {
      setError(
        removeError instanceof Error ? removeError.message : '移除成员失败',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!accessToken || !activeWorkspaceId) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/auth/workspace/invitations/${invitationId}`, {
        method: 'DELETE',
        accessToken,
        workspaceId: activeWorkspaceId,
      });
      await mutateInvitations();
    } catch (revokeError) {
      setError(
        revokeError instanceof Error ? revokeError.message : '撤回邀请失败',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyInviteUrl = async () => {
    if (!latestInviteUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(latestInviteUrl);
      setCopiedInviteUrl(true);
    } catch {
      setError('复制邀请链接失败，请手动复制');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        请先登录，再来管理团队成员。不然这个面板只能独自沉思。
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-zinc-100">
            工作空间成员
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            当前身份：{activeWorkspace?.role || '未知'}，支持查看成员、调整角色、移除成员和生成邀请链接。
          </p>
        </div>
      </div>

      {canManageMembers ? (
        <div className="mt-4 rounded-xl bg-gray-50 p-4 dark:bg-zinc-950">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_120px_120px]">
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="输入已注册用户邮箱"
              className="rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as EditableRole)}
              className="rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="member">member</option>
              <option value="viewer">viewer</option>
              {activeWorkspace?.role === 'owner' ? (
                <option value="admin">admin</option>
              ) : null}
            </select>
            <button
              type="button"
              onClick={handleInvite}
              disabled={submitting || !email.trim()}
              className="rounded-xl bg-linear-to-r from-emerald-500 to-teal-500 px-4 py-3 text-sm font-medium text-white transition hover:from-emerald-400 hover:to-teal-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              添加成员
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_120px_120px_120px_minmax(0,1fr)]">
            <input
              type="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              className="rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              placeholder="可选：顺手发到这个邮箱"
            />
            <select
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value as EditableRole)}
              className="rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="member">member</option>
              <option value="viewer">viewer</option>
              {activeWorkspace?.role === 'owner' ? (
                <option value="admin">admin</option>
              ) : null}
            </select>
            <input
              type="number"
              min={1}
              max={30}
              value={inviteExpiresInDays}
              onChange={(event) => setInviteExpiresInDays(event.target.value)}
              className="rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              placeholder="有效天数"
            />
            <button
              type="button"
              onClick={handleCreateInviteLink}
              disabled={submitting}
              className="rounded-xl bg-linear-to-r from-blue-500 to-cyan-500 px-4 py-3 text-sm font-medium text-white transition hover:from-blue-400 hover:to-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              生成邀请链接
            </button>
            <div className="rounded-xl border border-dashed border-gray-200 px-4 py-3 text-xs text-gray-500 dark:border-zinc-700 dark:text-zinc-400">
              新链接默认 7 天失效。填邮箱时会尝试发邀请邮件，没配邮件通道也不会阻止链接生成。
            </div>
          </div>

          {latestInviteUrl ? (
            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/30 dark:bg-blue-950/30 dark:text-blue-100">
              <div className="font-medium">刚刚生成的邀请链接</div>
              <div className="mt-2 break-all text-xs">{latestInviteUrl}</div>
              {latestInviteMessage ? (
                <div className="mt-2 text-xs">{latestInviteMessage}</div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleCopyInviteUrl}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-blue-500"
                >
                  {copiedInviteUrl ? '已复制' : '复制链接'}
                </button>
                <a
                  href={latestInviteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-blue-300 px-3 py-2 text-xs font-medium text-blue-800 transition hover:bg-blue-100 dark:border-blue-800 dark:text-blue-200 dark:hover:bg-blue-900/20"
                >
                  打开邀请页
                </a>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
          当前角色只能查看成员列表，暂时没有人事任免权。恭喜你，少了很多锅。
        </div>
      )}

      {error || loadError || invitationLoadError ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
          {error ||
            (loadError instanceof Error
              ? loadError.message
              : invitationLoadError instanceof Error
                ? invitationLoadError.message
                : '读取团队信息失败')}
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {isLoading ? (
          <div className="text-sm text-gray-500 dark:text-zinc-400">正在读取成员列表...</div>
        ) : members && members.length > 0 ? (
          members.map((member) => (
            <div
              key={member.membershipId}
              className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                    {member.name}
                  </div>
                  <div className="mt-1 text-xs text-gray-500 dark:text-zinc-400">
                    {member.email}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {canManageMembers && member.role !== 'owner' ? (
                    <select
                      value={member.role}
                      disabled={submitting}
                      onChange={(event) =>
                        handleRoleChange(
                          member.membershipId,
                          event.target.value as EditableRole,
                        )
                      }
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    >
                      {activeWorkspace?.role === 'owner' ? (
                        <option value="admin">admin</option>
                      ) : null}
                      <option value="member">member</option>
                      <option value="viewer">viewer</option>
                    </select>
                  ) : (
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                      {member.role}
                    </span>
                  )}

                  {canManageMembers && member.role !== 'owner' ? (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleRemove(member.membershipId)}
                      className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900/40 dark:text-rose-200 dark:hover:bg-rose-950/30"
                    >
                      移除
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-sm text-gray-500 dark:text-zinc-400">当前工作空间还没有成员。</div>
        )}
      </div>

      {canManageMembers ? (
        <div className="mt-6">
          <div className="text-sm font-medium text-gray-900 dark:text-zinc-100">
            最近生成的邀请
          </div>
          <div className="mt-3 space-y-3">
            {invitationsLoading ? (
              <div className="text-sm text-gray-500 dark:text-zinc-400">
                正在读取邀请列表...
              </div>
            ) : invitations && invitations.length > 0 ? (
              invitations.map((invitation) => (
                <div
                  key={invitation.invitationId}
                  className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1 text-sm text-gray-600 dark:text-zinc-300">
                      <div>
                        角色：<span className="font-medium">{invitation.role}</span>
                      </div>
                      {invitation.invitedEmail ? (
                        <div>目标邮箱：{invitation.invitedEmail}</div>
                      ) : null}
                      <div>状态：{invitation.status}</div>
                      <div>
                        过期时间：
                        {new Date(invitation.expiresAt).toLocaleString('zh-CN')}
                      </div>
                    </div>

                    {invitation.status === 'pending' ? (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() =>
                          handleRevokeInvitation(invitation.invitationId)
                        }
                        className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900/40 dark:text-rose-200 dark:hover:bg-rose-950/30"
                      >
                        撤回邀请
                      </button>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500 dark:text-zinc-400">
                还没有生成过邀请链接。
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  apiFetch,
  type AcceptedWorkspaceInvitation,
  type WorkspaceInvitationPreview,
} from '@/lib/backend';
import OAuthButtons from '@/components/OAuthButtons';
import { useAuth } from '@/components/providers/AuthProvider';

type Mode = 'login' | 'register';

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const rawToken = params?.token;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken || '';
  const {
    ready,
    isAuthenticated,
    user,
    accessToken,
    login,
    register,
    refreshWorkspaces,
  } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [acceptSubmitting, setAcceptSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<AcceptedWorkspaceInvitation | null>(null);

  const {
    data: preview,
    error: previewError,
    isLoading,
  } = useSWR<WorkspaceInvitationPreview>(
    token ? ['invitation-preview', token] : null,
    () => apiFetch<WorkspaceInvitationPreview>(`/auth/invitations/${token}`),
  );

  const canAccept = useMemo(
    () => preview?.status === 'pending',
    [preview?.status],
  );

  const handleAuthSubmit: React.FormEventHandler<HTMLFormElement> = async (
    event,
  ) => {
    event.preventDefault();
    setAuthSubmitting(true);
    setAuthError(null);

    try {
      if (mode === 'login') {
        await login({ email, password });
      } else {
        await register({ name, email, password });
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : '登录或注册失败');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleAccept = async () => {
    if (!accessToken || !token) {
      return;
    }

    setAcceptSubmitting(true);
    setAcceptError(null);
    try {
      const result = await apiFetch<AcceptedWorkspaceInvitation>(
        `/auth/invitations/${token}/accept`,
        {
          method: 'POST',
          accessToken,
        },
      );
      await refreshWorkspaces(result.workspaceId);
      setAccepted(result);
    } catch (error) {
      setAcceptError(error instanceof Error ? error.message : '接受邀请失败');
    } finally {
      setAcceptSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#0f172a,#020617_60%)] px-6 py-16 text-white">
      <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,420px)]">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur">
          <p className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-cyan-200">
            Workspace Invite
          </p>

          {isLoading ? (
            <div className="mt-6 text-sm text-white/70">正在读取邀请信息...</div>
          ) : preview ? (
            <>
              <h1 className="mt-6 text-4xl font-semibold">
                加入 {preview.workspaceName}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200/80">
                {preview.inviterName} 给你发来一张团队通行证，目标角色是{' '}
                <span className="font-semibold text-white">{preview.role}</span>。
                这下不是旁观 SaaS 演进了，是直接上工位。
              </p>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-white/50">
                    邀请状态
                  </div>
                  <div className="mt-2 text-lg font-medium">{preview.status}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-white/50">
                    目标角色
                  </div>
                  <div className="mt-2 text-lg font-medium">{preview.role}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-white/50">
                    过期时间
                  </div>
                  <div className="mt-2 text-lg font-medium">
                    {new Date(preview.expiresAt).toLocaleString('zh-CN')}
                  </div>
                </div>
              </div>

              {accepted ? (
                <div className="mt-8 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-5 text-emerald-50">
                  <div className="text-lg font-semibold">加入成功</div>
                  <div className="mt-2 text-sm text-emerald-50/80">
                    你已经进入 {accepted.workspaceName}，角色是 {accepted.role}。
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => router.push('/dashboard')}
                      className="rounded-full bg-white px-5 py-3 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
                    >
                      去控制台
                    </button>
                    <Link
                      href="/"
                      className="rounded-full border border-white/20 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                    >
                      回首页
                    </Link>
                  </div>
                </div>
              ) : isAuthenticated ? (
                <div className="mt-8 rounded-2xl border border-white/10 bg-slate-950/40 p-5">
                  <div className="text-sm text-white/70">
                    当前登录账号：{user?.email || '未知'}
                  </div>
                  <button
                    type="button"
                    onClick={handleAccept}
                    disabled={!canAccept || acceptSubmitting}
                    className="mt-4 rounded-full bg-linear-to-r from-emerald-400 to-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:from-emerald-300 hover:to-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {acceptSubmitting ? '接受中...' : '接受邀请并加入工作空间'}
                  </button>
                  {acceptError ? (
                    <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                      {acceptError}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-8 rounded-2xl border border-white/10 bg-slate-950/40 p-5 text-sm text-white/70">
                  先登录或注册，再把这张邀请券兑换成真实权限。
                </div>
              )}
            </>
          ) : (
            <div className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {previewError instanceof Error
                ? previewError.message
                : '邀请信息读取失败'}
            </div>
          )}
        </section>

        <aside className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur">
          <div className="flex items-center gap-3 text-sm">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`rounded-full px-4 py-2 transition ${
                mode === 'login'
                  ? 'bg-white text-slate-900'
                  : 'bg-white/10 text-white hover:bg-white/15'
              }`}
            >
              登录
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`rounded-full px-4 py-2 transition ${
                mode === 'register'
                  ? 'bg-white text-slate-900'
                  : 'bg-white/10 text-white hover:bg-white/15'
              }`}
            >
              注册
            </button>
          </div>

          <h2 className="mt-6 text-2xl font-semibold text-white">
            {isAuthenticated ? '账号已就位' : mode === 'login' ? '先登录再入场' : '注册后立刻加入'}
          </h2>
          <p className="mt-2 text-sm text-white/70">
            {isAuthenticated
              ? '你已经有会话了，左侧按钮现在可以直接把邀请兑换成成员身份。'
              : '邀请页支持边登录边入队，不用在多个页面之间来回蹦迪。'}
          </p>

          {isAuthenticated ? (
            <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-50/90">
              当前账号：{user?.name} / {user?.email}
            </div>
          ) : (
            <form onSubmit={handleAuthSubmit} className="mt-6 space-y-4">
              {mode === 'register' ? (
                <label className="block">
                  <span className="mb-2 block text-sm text-white/80">昵称</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white outline-none transition focus:border-cyan-400/50"
                    placeholder="例如：Rain"
                    required
                  />
                </label>
              ) : null}

              <label className="block">
                <span className="mb-2 block text-sm text-white/80">邮箱</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white outline-none transition focus:border-cyan-400/50"
                  placeholder="you@example.com"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-white/80">密码</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white outline-none transition focus:border-cyan-400/50"
                  placeholder="至少 6 位"
                  required
                />
              </label>

              {authError ? (
                <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {authError}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={authSubmitting || !ready || !canAccept}
                className="w-full rounded-2xl bg-linear-to-r from-cyan-400 to-blue-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:from-cyan-300 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {authSubmitting
                  ? '提交中...'
                  : mode === 'login'
                    ? '登录当前账号'
                    : '注册并继续'}
              </button>

              <OAuthButtons nextPath={`/invite/${token}`} className="pt-2" />
            </form>
          )}

          <div className="mt-6 text-xs text-white/50">
            如果邀请已经过期或被撤回，右侧会直接告诉你，不会让你白跑一趟。
          </div>
        </aside>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useAuth } from './providers/AuthProvider';
import OAuthButtons from './OAuthButtons';

type Mode = 'login' | 'register';

export default function AuthWorkbench() {
  const { ready, isAuthenticated, user, activeWorkspaceId, login, register, logout } =
    useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(
    () => (mode === 'login' ? '登录你的工作空间' : '注册并创建个人工作空间'),
    [mode],
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (mode === 'login') {
        await login({ email, password });
      } else {
        await register({ name, email, password });
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : '操作失败，请稍后重试',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-sm text-white/70">
        正在读取本地会话，AI 还在揉眼睛...
      </div>
    );
  }

  if (isAuthenticated && user) {
    return (
      <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-8 text-white">
        <p className="text-sm uppercase tracking-[0.2em] text-emerald-200/80">
          Session Ready
        </p>
        <h2 className="mt-3 text-3xl font-semibold">欢迎回来，{user.name}</h2>
        <p className="mt-3 text-sm text-emerald-50/80">
          当前工作空间已激活，接下来你可以直接进控制台、跑多智能体分析、查知识库和看套餐额度。
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-full border border-emerald-300/30 px-3 py-1 text-emerald-50/80">
            {user.email}
          </span>
          <span className="rounded-full border border-emerald-300/30 px-3 py-1 text-emerald-50/80">
            workspace: {activeWorkspaceId || '未选择'}
          </span>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="rounded-full bg-white px-5 py-3 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
          >
            进入控制台
          </Link>
          <button
            type="button"
            onClick={logout}
            className="rounded-full border border-white/20 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
          >
            退出登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur">
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

      <h2 className="mt-6 text-3xl font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm text-white/70">
        先把身份、工作空间和权限这三件套配齐，后面的多智能体、RAG、计费面板才不会像无证驾驶。
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {mode === 'register' && (
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
        )}

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

        {error && (
          <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-2xl bg-linear-to-r from-cyan-400 to-blue-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:from-cyan-300 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? '提交中...' : mode === 'login' ? '立即登录' : '注册并创建工作空间'}
        </button>
      </form>

      <OAuthButtons nextPath="/dashboard" className="mt-6" />
    </div>
  );
}

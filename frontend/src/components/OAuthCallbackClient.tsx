'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch, type FrontendAuthUser } from '@/lib/backend';
import { useAuth } from './providers/AuthProvider';

export default function OAuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { completeAuthSession } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const ticket = searchParams.get('ticket');
  const nextPath = searchParams.get('next') || '/dashboard';
  const oauthError = searchParams.get('error');
  const initialError = oauthError || (!ticket ? 'OAuth 登录票据缺失' : null);

  useEffect(() => {
    if (!ticket || initialError) {
      return;
    }
    const oauthTicket = ticket;

    let cancelled = false;

    async function bootstrap() {
      try {
        const payload = await apiFetch<{
          accessToken: string;
          user: FrontendAuthUser;
          defaultWorkspaceId?: string;
        }>(`/auth/oauth/session?ticket=${encodeURIComponent(oauthTicket)}`);
        if (cancelled) {
          return;
        }
        await completeAuthSession(payload);
        router.replace(nextPath);
      } catch (sessionError) {
        if (!cancelled) {
          setError(
            sessionError instanceof Error
              ? sessionError.message
              : 'OAuth 会话初始化失败',
          );
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [completeAuthSession, initialError, nextPath, router, ticket]);

  const message = error || initialError;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#0f172a,#020617_60%)] px-6 py-16 text-white">
      <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur">
        <div className="text-sm uppercase tracking-[0.2em] text-cyan-200">
          OAuth Callback
        </div>
        <h1 className="mt-4 text-3xl font-semibold">正在完成登录</h1>
        <p className="mt-3 text-sm text-white/70">
          后端已经把授权码换完了，我现在把会话塞回浏览器。
        </p>
        {message ? (
          <div className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {message}
          </div>
        ) : (
          <div className="mt-6 text-sm text-white/70">请稍等，马上跳转...</div>
        )}
      </div>
    </div>
  );
}

import { Suspense } from 'react';
import OAuthCallbackClient from '../../../components/OAuthCallbackClient';

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#0f172a,#020617_60%)] px-6 py-16 text-white">
      <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur">
        <div className="text-sm uppercase tracking-[0.2em] text-cyan-200">
          OAuth Callback
        </div>
        <h1 className="mt-4 text-3xl font-semibold">正在完成登录</h1>
        <p className="mt-6 text-sm text-white/70">请稍等，马上跳转...</p>
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <OAuthCallbackClient />
    </Suspense>
  );
}

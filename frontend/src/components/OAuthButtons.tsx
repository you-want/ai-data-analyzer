'use client';

import useSWR from 'swr';
import {
  apiFetch,
  buildOAuthRedirectUrl,
  type OAuthProviderStatus,
} from '@/lib/backend';

export default function OAuthButtons({
  nextPath,
  className = '',
}: {
  nextPath?: string;
  className?: string;
}) {
  const { data: providers } = useSWR<OAuthProviderStatus[]>(
    ['oauth-providers'],
    () => apiFetch<OAuthProviderStatus[]>('/auth/oauth/providers'),
  );

  const enabledProviders = providers?.filter((provider) => provider.enabled) || [];
  if (providers && enabledProviders.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <div className="text-xs uppercase tracking-[0.16em] text-white/50">
        或者用第三方账号
      </div>
      <div className="mt-3 grid gap-3">
        {(providers || [
          { provider: 'github', enabled: true, label: 'GitHub' },
          { provider: 'google', enabled: true, label: 'Google' },
        ]).map((provider) => (
          <a
            key={provider.provider}
            href={buildOAuthRedirectUrl(provider.provider, nextPath)}
            aria-disabled={!provider.enabled}
            className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
              provider.enabled
                ? 'border-white/15 bg-white/5 text-white hover:bg-white/10'
                : 'cursor-not-allowed border-white/10 bg-white/5 text-white/40 pointer-events-none'
            }`}
          >
            使用 {provider.label} 继续
          </a>
        ))}
      </div>
    </div>
  );
}

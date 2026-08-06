import React, { useEffect, useMemo, useState } from 'react';

import { useAppStore } from '@/store/useAppStore';
import { isPublicProductionHost } from '@/utils/publicProduction';

type HealthMeta = {
  gitSha?: string;
  gitBranch?: string;
  environment?: string;
  version?: string;
};

function normalizeEnvLabel(input: string): string {
  const v = input.trim().toLowerCase();
  if (!v) return 'unknown';
  if (v === 'prod') return 'production';
  return v;
}

function inferEnvFromHost(hostname: string): string | null {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1') return 'local';
  if (host === 'consultify.ai' || host === 'www.consultify.ai') return 'production';
  if (host === 'demo.consultify.ai') return 'demo';
  if (
    host === 'stage.consultinity.ai' ||
    host === 'staging.consultify.ai' ||
    host === 'stage.consultify.ai'
  ) {
    return 'staging';
  }
  if (host.endsWith('.railway.app')) return 'railway';
  return null;
}

function shortSha(sha?: string): string | null {
  if (!sha) return null;
  const s = sha.trim();
  if (!s) return null;
  return s.length > 12 ? s.slice(0, 12) : s;
}

export const EnvironmentBadge: React.FC = () => {
  const currentUser = useAppStore((s) => s.currentUser);

  const [health, setHealth] = useState<HealthMeta | null>(null);

  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';

  const inferredEnv = useMemo(() => inferEnvFromHost(hostname), [hostname]);
  const role = (currentUser?.role || '').toUpperCase();
  const isPrivileged = role === 'SUPERADMIN' || role === 'ADMIN';

  // Customer-facing public production should not show extra chrome by default.
  const shouldShow = useMemo(() => {
    if (!hostname) return false;
    if (isPrivileged) return true;
    return !isPublicProductionHost(hostname);
  }, [hostname, isPrivileged]);

  const envLabel = useMemo(() => {
    const fromVite =
      (import.meta as { env?: Record<string, string> }).env?.VITE_APP_ENV ||
      (import.meta as { env?: Record<string, string> }).env?.MODE ||
      '';
    return normalizeEnvLabel(inferredEnv || fromVite || 'unknown');
  }, [inferredEnv]);

  useEffect(() => {
    if (!shouldShow) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    fetch('/api/health', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as HealthMeta;
      })
      .then((data) => {
        if (data) setHealth(data);
      })
      .catch(() => {
        // ignore (offline / auth proxies / transient)
      })
      .finally(() => {
        clearTimeout(timeout);
      });

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [shouldShow]);

  if (!shouldShow) return null;

  const sha = shortSha(health?.gitSha) || shortSha((window as any)?.__APP_BUILD_SHA__) || null;
  const branch = health?.gitBranch?.trim() || null;
  const version = health?.version?.trim() || null;

  const label = envLabel.toUpperCase();
  const chip = `${label}${sha ? ` @${sha}` : ''}`;
  const tooltip = [
    `env=${envLabel}`,
    sha ? `sha=${sha}` : null,
    branch ? `branch=${branch}` : null,
    version ? `version=${version}` : null,
    hostname ? `host=${hostname}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <div
      className="pointer-events-none fixed bottom-3 left-3 z-toast rounded-full border border-white/10 bg-navy-950/80 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-slate-200 backdrop-blur"
      title={tooltip}
      role="status"
      aria-label={`Środowisko ${label}${sha ? `, wersja ${sha}` : ''}`}
      data-testid="environment-badge"
    >
      <span className="opacity-90">{chip}</span>
    </div>
  );
};

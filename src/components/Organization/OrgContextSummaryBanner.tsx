/**
 * OrgContextSummaryBanner — M16 P0-2
 *
 * Replaces the decorative OrganizationV8CanonPanel with a live, compact strip
 * that surfaces the real Teresa organization-context state:
 *   - claim count + last-rebuilt timestamp from GET /api/organization-context
 *   - an admin-only "Rebuild" action (POST /api/organization-context/rebuild)
 *   - an explicit "Teresa is using this context" affordance linking to the
 *     knowledge-graph section
 *
 * States: skeleton on first load; graceful empty state when no claims exist yet;
 * silent fallback (renders nothing) on fetch error so navigating between org
 * sections never spams the user. Subscribes to the /org-context Socket.IO
 * namespace so a rebuild in one tab refreshes the banner everywhere (P1-3).
 */

import { ArrowRight, RefreshCw, Sparkles } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';

import { Button } from '@/components/ui/primitives';
import { ROUTES } from '@/routes/routeConfig';
import { Api } from '@/services/api';

interface OrgContextResponse {
  snapshotUpdatedAt?: string | null;
  counts?: {
    items?: number;
    claims?: number;
    conflicts?: number;
  };
}

interface OrgContextRebuiltEvent {
  organizationId: string;
  rebuiltAt: string | null;
  counts?: { items: number; claims: number; conflicts: number };
}

interface OrgContextSummaryBannerProps {
  organizationId?: string;
  isAdmin?: boolean;
  className?: string;
}

function formatRelative(iso: string | null | undefined, isPl: boolean): string {
  if (!iso) return isPl ? 'nigdy' : 'never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return isPl ? 'nigdy' : 'never';
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return isPl ? 'przed chwilą' : 'just now';
  if (mins < 60) return isPl ? `${mins} min temu` : `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return isPl ? `${hours} godz. temu` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return isPl ? `${days} dni temu` : `${days}d ago`;
}

export const OrgContextSummaryBanner: React.FC<OrgContextSummaryBannerProps> = ({
  organizationId,
  isAdmin = false,
  className = '',
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [context, setContext] = useState<OrgContextResponse | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    try {
      const data = (await Api.organizationContextGet()) as OrgContextResponse;
      setContext(data || null);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void load();
  }, [organizationId, load]);

  // P1-3: live refresh when any client rebuilds this org's context.
  useEffect(() => {
    if (!organizationId) return;
    let disposed = false;
    // Chat P0-1 — JWT in handshake; the namespace now rejects anonymous
    // connections. Without `auth.token` we won't even connect.
    const token = typeof window !== 'undefined' ? window.localStorage.getItem('token') || '' : '';
    const configuredTarget = String(import.meta.env.VITE_API_TARGET || '').replace(/\/+$/, '');
    const socket = configuredTarget
      ? io(`${configuredTarget}/org-context`, {
          transports: ['websocket'],
          auth: { token },
        })
      : io('/org-context', {
          transports: ['websocket'],
          auth: { token },
        });
    socketRef.current = socket;

    socket.on('connect', () => {
      if (disposed) return;
      socket.emit('join:org', organizationId);
    });
    socket.on('org:context:rebuilt', (evt: OrgContextRebuiltEvent) => {
      if (disposed) return;
      if (evt?.organizationId && evt.organizationId !== organizationId) return;
      setContext((prev) => ({
        snapshotUpdatedAt: evt.rebuiltAt ?? prev?.snapshotUpdatedAt ?? null,
        counts: evt.counts ?? prev?.counts,
      }));
      setFailed(false);
    });

    return () => {
      disposed = true;
      socket.emit('leave:org', organizationId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [organizationId]);

  const handleRebuild = useCallback(async () => {
    setRebuilding(true);
    try {
      const result = (await Api.organizationContextRebuild()) as {
        rebuiltAt?: string | null;
        counts?: OrgContextResponse['counts'];
      };
      setContext((prev) => ({
        snapshotUpdatedAt: result?.rebuiltAt ?? prev?.snapshotUpdatedAt ?? null,
        counts: result?.counts ?? prev?.counts,
      }));
      setFailed(false);
    } catch {
      // Re-fetch to recover the last good state; do not surface a destructive error here.
      await load();
    } finally {
      setRebuilding(false);
    }
  }, [load]);

  if (!organizationId) return null;

  // Silent fallback — never block the section view on a context fetch error.
  if (failed && !context) return null;

  if (loading) {
    return (
      <div
        className={`flex items-center gap-3 rounded-2xl border border-slate-200/60 bg-white dark:border-navy-700/60 dark:bg-navy-900/40 px-4 py-3 ${className}`.trim()}
        aria-busy="true"
      >
        <div className="h-5 w-5 animate-pulse rounded-full bg-slate-100 dark:bg-navy-800" />
        <div className="h-4 w-48 animate-pulse rounded bg-slate-100 dark:bg-navy-800" />
      </div>
    );
  }

  const claims = context?.counts?.claims ?? 0;
  const hasClaims = claims > 0;
  const updatedLabel = formatRelative(context?.snapshotUpdatedAt, !!isPl);

  return (
    <section
      className={`flex flex-col gap-3 rounded-2xl border border-slate-200/60 bg-white dark:border-navy-700/60 dark:bg-navy-900/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${className}`.trim()}
      aria-label={t('organization.context.banner.aria', 'Teresa organization context')}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            hasClaims
              ? 'bg-crimson-50 text-crimson-600 dark:bg-crimson-950/40 dark:text-crimson-400'
              : 'bg-slate-100 text-slate-600 dark:bg-navy-800 dark:text-slate-500'
          }`}
        >
          <Sparkles size={18} />
        </span>
        <div className="min-w-0">
          {hasClaims ? (
            <>
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                {t('organization.context.banner.claims', {
                  count: claims,
                  ago: updatedLabel,
                  defaultValue: 'Teresa context: {{count}} claims · updated {{ago}}',
                })}
              </p>
              <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                {t(
                  'organization.context.banner.teresaUsing',
                  'Teresa is using this context to answer your questions'
                )}
              </p>
            </>
          ) : (
            <button
              type="button"
              onClick={() => navigate(ROUTES.ORGANIZATION.PROFILE)}
              className="group inline-flex items-center gap-1.5 text-left"
            >
              <span className="text-sm font-medium text-slate-700 group-hover:text-crimson-600 dark:text-slate-200 dark:group-hover:text-crimson-400">
                {t(
                  'organization.context.banner.empty',
                  "Add org profile details to improve Teresa's answers"
                )}
              </span>
              <ArrowRight
                size={14}
                className="text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-crimson-600 dark:group-hover:text-crimson-400"
              />
            </button>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
        <button
          type="button"
          onClick={() => navigate(`${ROUTES.ORGANIZATION.ROOT}/knowledge-graph`)}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-navy-800 dark:hover:text-slate-200"
        >
          {t('organization.context.banner.viewGraph', 'View knowledge graph')}
          <ArrowRight size={12} />
        </button>
        {isAdmin && (
          <Button
            variant="brand"
            size="sm"
            loading={rebuilding}
            icon={<RefreshCw />}
            onClick={handleRebuild}
          >
            {t('organization.context.banner.rebuild', 'Rebuild')}
          </Button>
        )}
      </div>
    </section>
  );
};

export default OrgContextSummaryBanner;

/**
 * UNIFICATION E1 + E2 — Initiative chain observability (visible in the UI).
 *
 * The 2026-06-26 audit showed that the lineage (`/initiatives/:id/lineage`) and
 * funnel (`/initiatives/funnel/stats`) endpoints existed, but NO FE component
 * consumed them — observability was invisible to the user. This panel closes that
 * gap: it shows the portfolio conversion funnel (E2) and the lineage chain of the
 * selected initiative (E1): source → initiative → execution → results.
 *
 * Read-only. i18n PL/EN via t(). Statuses via EntityStatusChip (canon c.*).
 */
import { ArrowRight, GitBranch, Loader2, TrendingUp } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EntityStatusChip } from '@/components/ui/primitives/chips/EntityStatusChip';
import {
  InitiativeApi,
  type Initiative,
  type InitiativeFunnelStats,
  type InitiativeLineageChain,
} from '@/services/api/initiatives.api';

function ConversionStep({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center px-3">
      <span className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{value}</span>
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
    </div>
  );
}

/** Horizontal share bar (no hex/rose — primary token). */
function ShareBar({ label, count, total }: { label: React.ReactNode; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="w-32 shrink-0 text-xs text-slate-600 dark:text-slate-300">{label}</div>
      <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="absolute inset-y-0 left-0 rounded-full bg-c-info" style={{ width: `${pct}%` }} />
      </div>
      <div className="w-14 shrink-0 text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">
        {count} · {pct}%
      </div>
    </div>
  );
}

export interface InitiativeObservabilityPanelProps {
  /** Optional: initiative id to pre-show the lineage chain. */
  initialInitiativeId?: string | null;
}

export function InitiativeObservabilityPanel({
  initialInitiativeId = null,
}: InitiativeObservabilityPanelProps) {
  const { t } = useTranslation();

  const [funnel, setFunnel] = useState<InitiativeFunnelStats | null>(null);
  const [funnelLoading, setFunnelLoading] = useState(true);

  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialInitiativeId);
  const [lineage, setLineage] = useState<InitiativeLineageChain | null>(null);
  const [lineageLoading, setLineageLoading] = useState(false);

  // E2 — funnel + lista do pickera lineage.
  useEffect(() => {
    let alive = true;
    (async () => {
      setFunnelLoading(true);
      const [stats, list] = await Promise.all([
        InitiativeApi.getFunnelStats(),
        InitiativeApi.getInitiatives().catch(() => [] as Initiative[]),
      ]);
      if (!alive) return;
      setFunnel(stats);
      setInitiatives(list);
      if (!selectedId && list.length > 0) setSelectedId(list[0].id);
      setFunnelLoading(false);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // E1 — lineage wybranej inicjatywy.
  useEffect(() => {
    if (!selectedId) {
      setLineage(null);
      return;
    }
    let alive = true;
    setLineageLoading(true);
    InitiativeApi.getLineage(selectedId).then((chain) => {
      if (!alive) return;
      setLineage(chain);
      setLineageLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [selectedId]);

  const statusTotal = useMemo(
    () => (funnel ? Object.values(funnel.byStatus).reduce((a, b) => a + b, 0) : 0),
    [funnel]
  );
  const sourceTotal = useMemo(
    () => (funnel ? Object.values(funnel.bySource).reduce((a, b) => a + b, 0) : 0),
    [funnel]
  );

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4">
      {/* ── E2: Funnel konwersji ─────────────────────────────────────────── */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <header className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-c-info" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t('initiatives.observability.funnelTitle', 'Lejek konwersji portfela')}
          </h3>
        </header>

        {funnelLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('common.loading', 'Loading…')}
          </div>
        ) : funnel ? (
          <>
            <div className="mb-4 flex items-center justify-center gap-1 rounded-lg bg-slate-50 py-3 dark:bg-slate-800/50">
              <ConversionStep
                label={t('initiatives.observability.created', 'Created')}
                value={funnel.conversion.created}
              />
              <ArrowRight className="h-4 w-4 text-slate-300" />
              <ConversionStep
                label={t('initiatives.observability.inExecution', 'In execution')}
                value={funnel.conversion.inExecution}
              />
              <ArrowRight className="h-4 w-4 text-slate-300" />
              <ConversionStep
                label={t('initiatives.observability.tracking', 'Results')}
                value={funnel.conversion.tracking}
              />
              <div className="ml-4 flex flex-col items-center border-l border-slate-200 pl-4 dark:border-slate-700">
                <span className="text-2xl font-semibold text-c-info dark:text-c-info">
                  {funnel.conversion.conversionPct}%
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {t('initiatives.observability.conversion', 'Conversion')}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                  {t('initiatives.observability.byStatus', 'By status')}
                </h4>
                {Object.entries(funnel.byStatus)
                  .sort((a, b) => b[1] - a[1])
                  .map(([status, count]) => (
                    <ShareBar
                      key={status}
                      label={<EntityStatusChip status={status} />}
                      count={count}
                      total={statusTotal}
                    />
                  ))}
              </div>
              <div>
                <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                  {t('initiatives.observability.bySource', 'By source')}
                </h4>
                {Object.entries(funnel.bySource)
                  .sort((a, b) => b[1] - a[1])
                  .map(([source, count]) => (
                    <ShareBar key={source} label={source} count={count} total={sourceTotal} />
                  ))}
              </div>
            </div>
          </>
        ) : (
          <p className="py-4 text-sm text-slate-500">
            {t('initiatives.observability.empty', 'No observability data.')}
          </p>
        )}
      </section>

      {/* ── E1: Lineage chain ────────────────────────────────────────────── */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <header className="mb-3 flex flex-wrap items-center gap-2">
          <GitBranch className="h-4 w-4 text-c-info" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t('initiatives.observability.lineageTitle', 'Initiative lineage chain')}
          </h3>
          {initiatives.length > 0 && (
            <select
              value={selectedId ?? ''}
              onChange={(e) => setSelectedId(e.target.value || null)}
              className="ml-auto rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              aria-label={t('initiatives.observability.pickInitiative', 'Select initiative')}
            >
              {initiatives.map((i) => (
                <option key={i.id} value={i.id}>
                  {String((i as { title?: string; name?: string }).title || (i as { name?: string }).name || i.id).slice(0, 60)}
                </option>
              ))}
            </select>
          )}
        </header>

        {lineageLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('common.loading', 'Loading…')}
          </div>
        ) : lineage ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {/* Source */}
            <div className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
              <div className="text-xs text-slate-400">{t('initiatives.observability.source', 'Source')}</div>
              <div className="font-medium text-slate-700 dark:text-slate-200">
                {lineage.source
                  ? lineage.source.type
                  : t('initiatives.observability.sourceManual', 'manual')}
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-300" />
            {/* Initiative */}
            <div className="rounded-lg border border-c-info bg-c-info/10 px-3 py-2 dark:border-c-info dark:bg-c-info/20">
              <div className="text-xs text-slate-400">{t('initiatives.observability.initiative', 'Initiative')}</div>
              <div className="max-w-[16rem] truncate font-medium text-slate-800 dark:text-slate-100">
                {lineage.initiative.title}
              </div>
              <div className="mt-1">
                <EntityStatusChip status={lineage.initiative.status} />
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-300" />
            {/* Execution */}
            <div className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
              <div className="text-xs text-slate-400">{t('initiatives.observability.execution', 'Execution')}</div>
              <div className="font-medium text-slate-700 dark:text-slate-200">
                {lineage.downstream.executionStatus
                  ? lineage.downstream.executionStatus
                  : '—'}
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-300" />
            {/* Results */}
            <div className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
              <div className="text-xs text-slate-400">{t('initiatives.observability.results', 'Results')}</div>
              <div className="font-medium text-slate-700 dark:text-slate-200">
                {lineage.downstream.benefits && lineage.downstream.benefits.length > 0
                  ? t('initiatives.observability.kpiCount', '{{count}} KPI', {
                      count: lineage.downstream.benefits.length,
                    })
                  : '—'}
              </div>
            </div>
          </div>
        ) : (
          <p className="py-4 text-sm text-slate-500">
            {t('initiatives.observability.noLineage', 'No lineage chain for the selected initiative.')}
          </p>
        )}
      </section>
    </div>
  );
}

export default InitiativeObservabilityPanel;

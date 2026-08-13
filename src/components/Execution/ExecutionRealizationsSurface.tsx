import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  listExecutionCases,
  readExecutionCase,
  readRegisteredInitiative,
} from '@/services/initiatives-execution/runtimeApi';
import { buildInitiativeDeepLink } from '@/utils/initiativeDeepLink';

import { countExecutionPresets, type ExecutionMenu3Contract } from './canonicalMenu3';

type Knowledge = Record<string, any>;

interface ExecutionRow {
  id: string;
  title: string;
  description: string;
  initiativeId: string;
  lifecycle: string;
  phase: string;
  owner: string;
  handoffRef: string;
  baselineRef: string;
  openGaps: number;
  nextMilestone: string;
  nextAction: string;
  updatedAt: string;
  version: number;
  detail: Knowledge;
}

const roleLabel = (value: unknown): string => {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  return raw.replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const phaseLabel = (state: unknown, deliveryState: unknown): string => {
  if (String(state).toUpperCase() === 'CLOSED') return 'Zamknięcie';
  if (String(deliveryState).toUpperCase() === 'DELIVERED') return 'Przekazanie rezultatów';
  return 'Realizacja';
};

const lifecycleLabel = (value: unknown): string => {
  const normalized = String(value || '').toUpperCase();
  if (normalized === 'CLOSED') return 'Zamknięta';
  if (normalized === 'ACTIVE') return 'Aktywna';
  if (normalized === 'PAUSED') return 'Wstrzymana';
  return roleLabel(value);
};

const buildRow = (
  summary: Knowledge,
  detail: Knowledge,
  initiativeReadback?: Knowledge
): ExecutionRow => {
  const baseline = (detail.acceptedBaseline || {}) as Knowledge;
  const scope =
    baseline.scope && typeof baseline.scope === 'object'
      ? (baseline.scope as Knowledge)
      : ({} as Knowledge);
  const initiative = (initiativeReadback?.initiative || {}) as Knowledge;
  const lifecycle = lifecycleLabel(summary.state || detail.state);
  const isClosed = String(summary.state || detail.state).toUpperCase() === 'CLOSED';
  const handoffVersion = Number(detail.handoffPackageVersion || 0);
  const sourceInitiativeVersion = Number(baseline.sourceVersions?.initiative || 0);
  const gaps = Array.isArray(detail.gaps) ? detail.gaps : [];
  const milestones = (baseline.baseline?.milestones || {}) as Knowledge;
  const nextMilestone = Object.values(milestones).find(Boolean);

  return {
    id: String(summary.executionCaseId),
    title: String(initiative.title || scope.outcome || 'Realizacja bez nazwy biznesowej'),
    description: String(initiative.problem || scope.problem || 'Brak opisu problemu biznesowego.'),
    initiativeId: String(summary.initiativeId || detail.initiativeId || ''),
    lifecycle,
    phase: phaseLabel(summary.state || detail.state, detail.deliveryState),
    owner: roleLabel(
      summary.executionManagerName ||
        detail.executionManagerName ||
        summary.executionManagerId ||
        detail.executionManagerId
    ),
    handoffRef:
      handoffVersion > 0 ? `${String(summary.handoffPackageId)}@v${handoffVersion}` : 'UNKNOWN',
    baselineRef:
      sourceInitiativeVersion > 0 ? `Initiative baseline@v${sourceInitiativeVersion}` : 'UNKNOWN',
    openGaps: gaps.filter((gap) => String((gap as Knowledge)?.status || 'OPEN') !== 'CLOSED')
      .length,
    nextMilestone: nextMilestone ? String(nextMilestone) : 'UNKNOWN',
    nextAction: isClosed ? 'Przegląd efektów' : 'Otwórz realizację',
    updatedAt: String(summary.updatedAt || detail.updatedAt || ''),
    version: Number(summary.version || 0),
    detail,
  };
};

const presets = [
  'active',
  'at-risk',
  'critical',
  'blocked',
  'missing-baseline',
  'missing-forecast',
  'closing',
  'delivered',
  'unknown',
] as const;

export const ExecutionRealizationsSurface = ({
  scope,
  activePreset,
  onCountsChange,
}: { scope: 'active' | 'all' } & ExecutionMenu3Contract) => {
  const [state, setState] = useState<'LOADING' | 'READY' | 'ERROR'>('LOADING');
  const [rows, setRows] = useState<ExecutionRow[]>([]);

  const load = useCallback(async () => {
    setState('LOADING');
    try {
      const response = (await listExecutionCases()) as { cases?: Knowledge[] };
      const hydrated = await Promise.all(
        (response.cases ?? []).map(async (summary) => {
          const executionCaseId = String(summary.executionCaseId);
          const [full, initiative] = await Promise.all([
            readExecutionCase(executionCaseId) as Promise<{ detail?: Knowledge }>,
            readRegisteredInitiative(String(summary.initiativeId)),
          ]);
          return buildRow(summary, full.detail ?? {}, initiative as Knowledge);
        })
      );
      const scoped =
        scope === 'active'
          ? hydrated.filter((execution) => execution.lifecycle !== 'Zamknięta')
          : hydrated;
      setRows(scoped);
      setState('READY');
    } catch {
      setState('ERROR');
    }
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  const matches = useCallback((row: ExecutionRow, preset: string) => {
    const health = String(row.detail.health ?? row.detail.severity ?? '').toUpperCase();
    if (preset === 'active') return row.lifecycle === 'Aktywna';
    if (preset === 'at-risk') return health === 'AT_RISK';
    if (preset === 'critical') return health === 'CRITICAL';
    if (preset === 'blocked') return row.openGaps > 0;
    if (preset === 'missing-baseline') return row.baselineRef === 'UNKNOWN';
    if (preset === 'missing-forecast') return row.nextMilestone === 'UNKNOWN';
    if (preset === 'closing') return /clos|zamk/i.test(row.phase);
    if (preset === 'delivered') return /deliver|przekaz/i.test(row.phase);
    if (preset === 'unknown')
      return row.owner === '—' || row.baselineRef === 'UNKNOWN' || row.nextMilestone === 'UNKNOWN';
    return false;
  }, []);

  const visibleRows = useMemo(
    () => rows.filter((row) => matches(row, activePreset ?? 'active')),
    [activePreset, matches, rows]
  );
  useEffect(
    () => onCountsChange?.(countExecutionPresets(rows, presets, matches)),
    [matches, onCountsChange, rows]
  );

  return (
    <section aria-label="Realizowane inicjatywy" className="min-h-0 flex-1 px-4 pb-6">
      {state === 'ERROR' ? (
        <div
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-c-text"
        >
          Nie udało się załadować realizacji.{' '}
          <button onClick={() => void load()}>Spróbuj ponownie</button>
        </div>
      ) : null}
      {state === 'LOADING' ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Ładowanie inicjatyw">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-64 animate-pulse rounded-2xl border border-c-border bg-c-surface"
            />
          ))}
        </div>
      ) : null}
      {state === 'READY' && visibleRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-c-border bg-c-surface/60 p-10 text-center">
          <h3 className="text-base font-semibold text-c-text">Brak inicjatyw w realizacji</h3>
          <p className="mt-2 text-sm text-c-text-muted">
            Karta pojawi się tutaj, gdy inicjatywa przejdzie do realizacji.
          </p>
        </div>
      ) : null}
      {state === 'READY' && visibleRows.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleRows.map((initiative) => (
            <a
              key={initiative.id}
              href={buildInitiativeDeepLink(initiative.initiativeId, { mode: 'doc' })}
              className="group flex min-h-64 flex-col rounded-2xl border border-c-border bg-c-surface p-5 transition hover:-translate-y-0.5 hover:border-primary-500/50 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                  W realizacji
                </span>
                <span
                  className={
                    initiative.openGaps > 0
                      ? 'rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300'
                      : 'rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300'
                  }
                >
                  {initiative.openGaps > 0
                    ? `${initiative.openGaps} otwarta luka`
                    : 'Bez otwartych luk'}
                </span>
              </div>
              <h3 className="mt-5 text-lg font-semibold leading-6 text-c-text group-hover:text-primary-300">
                {initiative.title}
              </h3>
              <p className="mt-2 line-clamp-3 text-sm leading-5 text-c-text-muted">
                {initiative.description}
              </p>
              <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-c-border pt-4 text-sm">
                <div>
                  <dt className="text-xs text-c-text-muted">Odpowiedzialny</dt>
                  <dd className="mt-1 font-medium text-c-text">{initiative.owner}</dd>
                </div>
                <div>
                  <dt className="text-xs text-c-text-muted">Najbliższy kamień</dt>
                  <dd className="mt-1 font-medium text-c-text">{initiative.nextMilestone}</dd>
                </div>
              </dl>
              <div className="mt-auto flex items-center justify-between pt-5 text-sm font-medium text-primary-300">
                <span>{initiative.nextAction}</span>
                <span aria-hidden="true">→</span>
              </div>
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
};

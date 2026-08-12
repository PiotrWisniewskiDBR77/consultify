import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { CanonicalInitiativeRegister } from '@/components/Initiatives/CanonicalInitiativeRegister';
import { toCanonicalInitiativeRegisterItem } from '@/components/Initiatives/initiativeRegisterProjection';
import type { TableRow } from '@/components/standard';
import {
  listExecutionCases,
  readExecutionCase,
  readRegisteredInitiative,
} from '@/services/initiatives-execution/runtimeApi';
import { useAppStore } from '@/store/useAppStore';
import type { PortfolioInitiative } from '@/types';

import { AcceptanceRequesterPanel } from './AcceptanceRequesterPanel';
import { countExecutionPresets, type ExecutionMenu3Contract } from './canonicalMenu3';

type Knowledge = Record<string, any>;

interface ExecutionRow extends TableRow {
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

type ExecutionInitiativeRow = PortfolioInitiative & { executionCaseId: string };

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

const buildRow = (summary: Knowledge, detail: Knowledge): ExecutionRow => {
  const baseline = (detail.acceptedBaseline || {}) as Knowledge;
  const scope = (baseline.scope || {}) as Knowledge;
  const lifecycle = lifecycleLabel(summary.state || detail.state);
  const isClosed = String(summary.state || detail.state).toUpperCase() === 'CLOSED';
  const handoffVersion = Number(detail.handoffPackageVersion || 0);
  const sourceInitiativeVersion = Number(baseline.sourceVersions?.initiative || 0);
  const gaps = Array.isArray(detail.gaps) ? detail.gaps : [];
  const milestones = (baseline.baseline?.milestones || {}) as Knowledge;
  const nextMilestone = Object.values(milestones).find(Boolean);

  return {
    id: String(summary.executionCaseId),
    title: String(scope.outcome || 'Realizacja bez nazwy biznesowej'),
    description: String(scope.problem || 'Brak opisu problemu biznesowego.'),
    initiativeId: String(summary.initiativeId || detail.initiativeId || ''),
    lifecycle,
    phase: phaseLabel(summary.state || detail.state, detail.deliveryState),
    owner: roleLabel(summary.executionManagerId || detail.executionManagerId),
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
  const currentUserId = useAppStore((store) => store.currentUser?.id ?? null);
  const currentUserDisplayName = useAppStore((store) => {
    const user = store.currentUser as any;
    return (
      user?.displayName ||
      user?.name ||
      [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
      null
    );
  });
  const [state, setState] = useState<'LOADING' | 'READY' | 'ERROR'>('LOADING');
  const [rows, setRows] = useState<ExecutionRow[]>([]);
  const [initiativeRows, setInitiativeRows] = useState<ExecutionInitiativeRow[]>([]);
  const [selectedInitiativeId, setSelectedInitiativeId] = useState<string | null>(null);
  const [selectedExecutionCaseId, setSelectedExecutionCaseId] = useState<string | null>(null);
  const [showWorkbench, setShowWorkbench] = useState(false);

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
          return {
            execution: buildRow(summary, full.detail ?? {}),
            initiative: {
              ...toCanonicalInitiativeRegisterItem(initiative, {
                id: currentUserId,
                displayName: currentUserDisplayName,
              }),
              executionCaseId,
            } as ExecutionInitiativeRow,
          };
        })
      );
      const scoped =
        scope === 'active'
          ? hydrated.filter(({ execution }) => execution.lifecycle !== 'Zamknięta')
          : hydrated;
      setRows(scoped.map(({ execution }) => execution));
      setInitiativeRows(scoped.map(({ initiative }) => initiative));
      setState('READY');
    } catch {
      setState('ERROR');
    }
  }, [currentUserDisplayName, currentUserId, scope]);

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
  const visibleInitiativeRows = useMemo(() => {
    const ids = new Set(visibleRows.map((row) => row.initiativeId));
    return initiativeRows.filter((row) => ids.has(row.id));
  }, [initiativeRows, visibleRows]);
  const selected = useMemo(
    () => rows.find((row) => row.id === selectedExecutionCaseId) ?? null,
    [rows, selectedExecutionCaseId]
  );
  const executionByInitiativeId = useMemo(
    () => new Map(rows.map((row) => [row.initiativeId, row])),
    [rows]
  );

  useEffect(
    () => onCountsChange?.(countExecutionPresets(rows, presets, matches)),
    [matches, onCountsChange, rows]
  );

  return (
    <section aria-label="Realizacje" className="min-h-0 flex-1">
      <CanonicalInitiativeRegister
        rows={visibleInitiativeRows}
        selectedId={selectedInitiativeId}
        onSelect={(row) => {
          setSelectedInitiativeId(row?.id ?? null);
          setSelectedExecutionCaseId(
            row ? (executionByInitiativeId.get(row.id)?.id ?? null) : null
          );
          setShowWorkbench(false);
        }}
        onOpen={(row) => {
          const execution = executionByInitiativeId.get(row.id);
          setSelectedInitiativeId(row.id);
          setSelectedExecutionCaseId(execution?.id ?? null);
          setShowWorkbench(Boolean(execution));
        }}
        relationForRow={(row) => {
          const execution = executionByInitiativeId.get(row.id);
          return execution
            ? [
                {
                  label: `Execution Case ${execution.id}@v${execution.version}`,
                  onClick: () => {
                    setSelectedExecutionCaseId(execution.id);
                    setShowWorkbench(true);
                  },
                },
                { label: `Handoff ${execution.handoffRef}` },
              ]
            : [{ label: 'Execution Case UNKNOWN' }];
        }}
        persistKey="execution.canonical.executions.v1"
        loading={state === 'LOADING'}
        error={state === 'ERROR' ? 'Nie udało się załadować realizacji.' : null}
        onRetry={() => void load()}
        emptyTitle="Brak inicjatyw w realizacji"
        emptyDescription="Inicjatywa pojawi się tutaj po zaakceptowaniu jej pakietu przekazania."
        previewOpen={!showWorkbench && Boolean(selectedInitiativeId)}
      />

      {showWorkbench && selected ? (
        <div className="border-t border-c-border p-4" aria-label="Karta realizacji">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-c-text">{selected.title}</h3>
              <p className="text-xs text-c-text-muted">
                Execution Case {selected.id} · v{selected.version} · {selected.phase}
              </p>
            </div>
            <button
              type="button"
              className="h-9 rounded-full border border-c-border px-4 text-sm font-medium"
              onClick={() => setShowWorkbench(false)}
            >
              Zamknij kartę
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <SummaryCard label="Execution Case" value={`${selected.id}@v${selected.version}`} />
            <SummaryCard label="Zakres" value={selected.description} />
            <SummaryCard label="Pakiet przekazania" value={selected.handoffRef} />
            <SummaryCard label="Zaakceptowana baza" value={selected.baselineRef} />
          </div>
          <AcceptanceRequesterPanel
            executionCaseId={selected.id}
            executionCaseVersion={selected.version}
            initiativeId={selected.initiativeId}
          />
        </div>
      ) : null}
    </section>
  );
};

const SummaryCard = ({ label, value }: { label: string; value: string }) => (
  <section className="rounded-xl border border-c-border bg-c-surface p-3">
    <div className="text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
      {label}
    </div>
    <div className="mt-1 text-sm text-c-text">{value || '—'}</div>
  </section>
);

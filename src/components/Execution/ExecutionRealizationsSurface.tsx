import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import {
  StandardPreview,
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard';
import {
  listExecutionCases,
  readExecutionCase,
  readRegisteredInitiative,
} from '@/services/initiatives-execution/runtimeApi';

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
  const [state, setState] = useState<'LOADING' | 'READY' | 'ERROR'>('LOADING');
  const [rows, setRows] = useState<ExecutionRow[]>([]);
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
  const selected = useMemo(
    () => rows.find((row) => row.id === selectedExecutionCaseId) ?? null,
    [rows, selectedExecutionCaseId]
  );

  const columns: TableColumn[] = [
    { id: 'title', label: 'Realizacja', sortable: true, width: '260px' },
    { id: 'lifecycle', label: 'Stan', sortable: true, filterable: true, width: '140px' },
    { id: 'phase', label: 'Faza', sortable: true, width: '170px' },
    { id: 'owner', label: 'Manager realizacji', sortable: true, width: '190px' },
    { id: 'handoffRef', label: 'Pakiet przekazania', width: '220px' },
    { id: 'baselineRef', label: 'Zaakceptowana baza', width: '190px' },
    { id: 'openGaps', label: 'Otwarte luki', sortable: true, align: 'right', width: '120px' },
    { id: 'nextMilestone', label: 'Następny kamień milowy', width: '220px' },
    { id: 'nextAction', label: 'Następne działanie', width: '180px' },
    { id: 'updatedAt', label: 'Aktualizacja', sortable: true, width: '160px' },
  ];

  useEffect(
    () => onCountsChange?.(countExecutionPresets(rows, presets, matches)),
    [matches, onCountsChange, rows]
  );

  return (
    <section aria-label="Realizacje" className="min-h-0 flex-1">
      {state === 'ERROR' ? (
        <div role="alert">
          Nie udało się załadować realizacji.{' '}
          <button onClick={() => void load()}>Spróbuj ponownie</button>
        </div>
      ) : null}
      <TableWithPreviewLayout<ExecutionRow>
        selectedId={selectedExecutionCaseId}
        selectedItem={selected}
        onSelect={(id) => {
          setSelectedExecutionCaseId(id);
          setShowWorkbench(false);
        }}
        onOpenFull={(id) => {
          setSelectedExecutionCaseId(id);
          setShowWorkbench(true);
        }}
        itemIds={visibleRows.map((row) => row.id)}
        getItemById={(id) => rows.find((row) => row.id === id) ?? null}
        previewOpen={!showWorkbench && Boolean(selectedExecutionCaseId)}
        renderPreview={(row) => (
          <StandardPreview
            embedded
            title={row.title}
            onClose={() => setSelectedExecutionCaseId(null)}
            onOpenFull={() => setShowWorkbench(true)}
            openLabel="Otwórz"
            meta={{
              pills: [
                { label: row.lifecycle, tone: row.lifecycle === 'Aktywna' ? 'success' : 'neutral' },
                { label: row.phase, tone: 'info' },
              ],
              trailing: <span className="text-xs">v{row.version}</span>,
              recommendation: row.nextAction,
            }}
            details={{
              label: 'Szczegóły realizacji',
              text: row.description,
              properties: [
                { id: 'manager', label: 'Manager', value: row.owner },
                { id: 'handoff', label: 'Pakiet przekazania', value: row.handoffRef },
                { id: 'baseline', label: 'Zaakceptowana baza', value: row.baselineRef },
                { id: 'gaps', label: 'Otwarte luki', value: String(row.openGaps) },
                { id: 'milestone', label: 'Następny kamień milowy', value: row.nextMilestone },
              ],
            }}
            relations={[
              { label: `Execution Case ${row.id}@v${row.version}` },
              { label: `Inicjatywa · …${row.initiativeId.slice(-8)}` },
              { label: `Pakiet przekazania · ${row.handoffRef}` },
            ]}
          />
        )}
      >
        <StandardTable
          columns={columns}
          data={visibleRows}
          loading={state === 'LOADING'}
          selectedRowId={selectedExecutionCaseId}
          onRowClick={(row) => {
            setSelectedExecutionCaseId(String(row.id));
            setShowWorkbench(false);
          }}
          onRowDoubleClick={(row) => {
            setSelectedExecutionCaseId(String(row.id));
            setShowWorkbench(true);
          }}
          rowMenu={(row) => ({
            primary: [
              {
                id: 'open',
                label: 'Otwórz realizację',
                onClick: () => {
                  setSelectedExecutionCaseId(String(row.id));
                  setShowWorkbench(true);
                },
              },
            ],
            universalHandlers: {
              preview: () => {
                setSelectedExecutionCaseId(String(row.id));
                setShowWorkbench(false);
              },
              archiveNote: 'Zamknięcie realizacji wymaga decyzji.',
            },
          })}
          persistKey="execution.canonical.execution-cases.v2"
          empty={{
            title: 'Brak zaakceptowanych realizacji',
            description: 'Realizacja pojawi się po zaakceptowaniu pakietu przekazania.',
          }}
        />
      </TableWithPreviewLayout>

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

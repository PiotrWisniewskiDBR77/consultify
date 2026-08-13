/**
 * AssessmentOutputsTab — P0D kernel Outputs surface.
 *
 * ★ REWRITE (2026-08-13): this tab used to read `GET /api/artifacts`
 * (`originRuntime === 'assessment_report'`) — an unrelated, older registry
 * that a restarted user's real frozen Outputs, Reports, Presentations and
 * Initiative Proposal Drafts never land in. It now reads the method-core
 * kernel exclusively (`@/method-core/api/methodCoreApi`:
 * `listOutputs`/`getOutput`), the same immutable-snapshot store the
 * assessment session actually freezes into (`server/src/method-core/
 * outputs/MethodOutputService.ts`). This is the fix for the CLAUDE.md P0D
 * problem statement: "po restarcie użytkownik nie odnajduje swoich
 * zamrożonych Outputów" — because the tab was looking at the wrong table.
 *
 * ★ Snapshot discipline (hard rule #1): opening a row ALWAYS fetches
 * `getOutput(id)` — the server's persisted, immutable snapshot — and that
 * fetched detail (not the list row, and never anything derived from a live
 * session) drives the preview's properties/status. There is no
 * reconstruction from "current session state" anywhere in this file, and no
 * `RECOVERY_DRAFT`/localStorage read at all (that concept lives entirely in
 * the excluded `src/components/assessment/drd/` tree — grepped, confirmed
 * absent here).
 *
 * Internal structure: a lightweight neutral segmented switch (Outputs /
 * Reports / Initiatives — NOT a second StandardModuleBar; this is one Hub
 * tab's own content, AssessmentHub's top-level tabs are untouched) plus,
 * from an Output row, a "View lineage" action that swaps the aside for
 * `ArtifactLineagePanel` (session → revisions → Output → Report/
 * Presentation → Initiative Proposal). This design keeps ALL of P0D's UI
 * inside this package's own files — AssessmentHub.tsx needed ZERO changes:
 * it already renders `<AssessmentOutputsTab onCountChange={setOutputsCount} />`
 * at the 'outputs' tab, and that prop contract is unchanged here.
 *
 * List UI = StandardTable/StandardPreview only (TRIADA_KANON.md) — no
 * bespoke table. The segmented switch is a plain neutral pill row (c-* tokens,
 * focus ring c-focus, active state neutral — never crimson/`primary-*`),
 * mirroring the existing `TableTabStrip` pattern used elsewhere in this repo
 * for in-surface tab strips.
 */
import { FileText, GitBranch, Lightbulb, Package } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  getOutput,
  isAuthError,
  listOutputs,
  type MethodOutputListItem,
  type MethodOutputSummary,
} from '@/method-core/api/methodCoreApi';
import { formatListDate } from '@/utils/listDateFormat';

import { EmptyState } from '../shared/states';
import { type MetaPill, StandardPreview } from '../standard/StandardPreview';
import {
  type StandardRowMenu,
  StandardTable,
  type TableColumn,
  type TableRow,
} from '../standard/StandardTable';
import { StatusChip } from '../ui/primitives/chips';
import { ArtifactLineagePanel } from './artifacts/ArtifactLineagePanel';
import { AssessmentInitiativesTab } from './artifacts/AssessmentInitiativesTab';
import { AssessmentReportsTab } from './artifacts/AssessmentReportsTab';

type OutputRow = MethodOutputListItem & { [key: string]: unknown };

type InnerView = 'outputs' | 'reports' | 'initiatives';

function statusTone(isSuperseded: boolean | null): 'success' | 'neutral' {
  return isSuperseded === false ? 'success' : 'neutral';
}

function statusLabel(isPolish: boolean, isSuperseded: boolean | null): string {
  if (isSuperseded === false) return isPolish ? 'Aktualny' : 'Current';
  if (isSuperseded === true) return isPolish ? 'Zastąpiony' : 'Superseded';
  return isPolish ? 'Status nieznany' : 'Status unknown';
}

interface AssessmentOutputsTabProps {
  onCountChange?: (count: number | null) => void;
}

export const AssessmentOutputsTab: React.FC<AssessmentOutputsTabProps> = ({ onCountChange }) => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const onCountChangeRef = useRef(onCountChange);

  useEffect(() => {
    onCountChangeRef.current = onCountChange;
  }, [onCountChange]);

  const [view, setView] = useState<InnerView>('outputs');
  const [outputIdFilter, setOutputIdFilter] = useState<string | null>(null);

  const [items, setItems] = useState<OutputRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const [selectedOutputId, setSelectedOutputId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<{
    output: MethodOutputSummary;
    superseded: boolean;
    supersededByOutputId: string | null;
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [lineageSessionId, setLineageSessionId] = useState<string | null>(null);

  // Deliberately no dependency on `t` (react-i18next's `t` isn't guaranteed
  // referentially stable, and isn't in this suite's mock) — closes only over
  // stable setState functions and the latest parent callback via ref.
  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setHasLoadError(false);
    setForbidden(false);
    listOutputs()
      .then((res) => {
        if (cancelled) return;
        setItems(res.outputs as OutputRow[]);
        onCountChangeRef.current?.(res.outputs.length);
      })
      .catch((err) => {
        if (cancelled) return;
        setItems([]);
        onCountChangeRef.current?.(null);
        if (isAuthError(err)) {
          setForbidden(true);
        } else {
          setHasLoadError(true);
        }
        // eslint-disable-next-line no-console -- fixed diagnostic only, no raw message in UI.
        console.error('[AssessmentOutputsTab] failed to load outputs', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (view !== 'outputs') return;
    const cancel = load();
    return cancel;
  }, [load, view]);

  // Opening a row ALWAYS re-fetches the immutable server snapshot — see the
  // module doc comment's "snapshot discipline" note. The list row (`items`)
  // is only ever used for the table itself and as a loading-time fallback
  // for the preview header, never substituted for this fetch.
  useEffect(() => {
    if (!selectedOutputId) {
      setSelectedDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    getOutput(selectedOutputId)
      .then((res) => {
        if (!cancelled) setSelectedDetail(res);
      })
      .catch(() => {
        if (!cancelled) setSelectedDetail(null);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedOutputId]);

  // Derives current/superseded from the fetched page itself when the list
  // endpoint doesn't carry `isSuperseded` per row: an Output is superseded
  // iff some OTHER Output in the SAME fetched list points back at it via
  // `revisionOfOutputId` — the identical rule `MethodOutputService.
  // isSuperseded` applies server-side, just computed over persisted rows
  // already on hand instead of a second read. KNOWN LIMITATION (disclosed,
  // same class as the old file's ARTIFACTS_FETCH_LIMIT note): only correct
  // within the fetched page — a revision chain deep enough to be paginated
  // apart from its predecessor could show a stale "Current" until opened
  // (opening always re-resolves via `getOutput`, which IS authoritative).
  const supersededIds = useMemo(() => {
    const s = new Set<string>();
    for (const item of items) {
      if (item.revisionOfOutputId) s.add(item.revisionOfOutputId);
    }
    return s;
  }, [items]);

  const isRowSuperseded = useCallback(
    (row: OutputRow): boolean | null => {
      if (row.isSuperseded !== null) return row.isSuperseded;
      return supersededIds.has(row.id);
    },
    [supersededIds]
  );

  const selectedRow = useMemo(
    () => items.find((item) => item.id === selectedOutputId) ?? null,
    [items, selectedOutputId]
  );

  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'scope',
        label: t('assessment.outputs.table.scope', 'Scope'),
        sortable: true,
        render: (row) => (row.scope as string | null) || t('assessment.outputs.table.untitled', 'Untitled output'),
      },
      {
        id: 'module',
        label: t('assessment.outputs.table.module', 'Module'),
        width: '110px',
        sortable: true,
        render: (row) => (row.module as string | null) || '—',
      },
      {
        id: 'outputVersion',
        label: t('assessment.outputs.table.version', 'Version'),
        width: '160px',
        sortable: true,
        render: (row) => {
          const version = row.outputVersion as number | null;
          const superseded = isRowSuperseded(row as OutputRow);
          return (
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[11px]">{version != null ? `v${version}` : '—'}</span>
              <StatusChip label={statusLabel(isPolish, superseded)} tone={statusTone(superseded)} size="sm" />
            </div>
          );
        },
      },
      {
        id: 'frozenAt',
        label: t('assessment.outputs.table.frozenAt', 'Frozen at'),
        width: '150px',
        sortable: true,
        render: (row) => (row.frozenAt ? formatListDate(row.frozenAt as string) : '—'),
      },
    ],
    [t, isPolish, isRowSuperseded]
  );

  const metaPills: MetaPill[] = useMemo(() => {
    if (!selectedRow) return [];
    const superseded = selectedDetail ? selectedDetail.superseded : isRowSuperseded(selectedRow);
    const pills: MetaPill[] = [
      { label: statusLabel(isPolish, superseded), tone: statusTone(superseded) },
    ];
    if (selectedRow.module) pills.push({ label: selectedRow.module, tone: 'neutral' });
    if (selectedRow.demoBypassActive) {
      pills.push({ label: isPolish ? 'Tryb demo' : 'Demo bypass', tone: 'warning' });
    }
    return pills;
  }, [selectedRow, selectedDetail, isRowSuperseded, isPolish]);

  const previewDetailsText = isPolish
    ? 'To jest zamrożony, niezmienny snapshot zatwierdzony podczas sesji assessmentu. Pobrany bezpośrednio z serwera.'
    : 'This is the frozen, immutable snapshot approved during the assessment session. Fetched directly from the server.';

  const rowMenu = useCallback(
    (row: TableRow): StandardRowMenu => {
      const sessionId = typeof row.sessionId === 'string' ? row.sessionId : null;
      return {
        primary: sessionId
          ? [
              {
                id: 'view-lineage',
                label: t('assessment.outputs.rowMenu.viewLineage', 'View lineage'),
                icon: GitBranch,
                onClick: () => setLineageSessionId(sessionId),
              },
            ]
          : undefined,
        universalHandlers: {
          preview: () => setSelectedOutputId(String(row.id)),
        },
      };
    },
    [t]
  );

  const showLineage = lineageSessionId !== null;

  const segments: { id: InnerView; label: string }[] = [
    { id: 'outputs', label: t('assessment.outputs.segment.outputs', 'Outputs') },
    { id: 'reports', label: t('assessment.outputs.segment.reports', 'Reports') },
    { id: 'initiatives', label: t('assessment.outputs.segment.initiatives', 'Initiatives') },
  ];

  if (forbidden && view === 'outputs') {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <SegmentedNav segments={segments} active={view} onChange={setView} />
        <div className="flex-1 overflow-auto p-4">
          <EmptyState
            variant="forbidden"
            title={t('assessment.outputs.forbidden.title', 'No access to Outputs')}
            description={t(
              'assessment.outputs.forbidden.description',
              'Your account does not have permission to view this organization’s Outputs.'
            )}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <SegmentedNav segments={segments} active={view} onChange={setView} />

      {view === 'reports' ? (
        <AssessmentReportsTab
          outputId={outputIdFilter ?? undefined}
          onClearFilter={outputIdFilter ? () => setOutputIdFilter(null) : undefined}
          onOpenLineage={(sessionId) => setLineageSessionId(sessionId)}
        />
      ) : view === 'initiatives' ? (
        <AssessmentInitiativesTab
          outputId={outputIdFilter ?? undefined}
          onClearFilter={outputIdFilter ? () => setOutputIdFilter(null) : undefined}
          onOpenLineage={(sessionId) => setLineageSessionId(sessionId)}
        />
      ) : (
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 min-w-0 overflow-auto pl-4 pr-1.5 pt-3 pb-4">
            <StandardTable
              columns={columns}
              data={items}
              loading={loading}
              error={
                hasLoadError
                  ? isPolish
                    ? 'Nie udało się wczytać Outputów. Spróbuj ponownie.'
                    : 'Failed to load Outputs. Please try again.'
                  : null
              }
              onRetry={load}
              persistKey="assessment.outputs"
              defaultSort={{ columnId: 'frozenAt', direction: 'desc' }}
              selectedRowId={selectedOutputId}
              onRowClick={(row) => setSelectedOutputId(String(row.id))}
              rowMenu={rowMenu}
              rowDescription={() => null}
              empty={{
                icon: Package,
                title: t('assessment.outputs.emptyState.title', 'No outputs yet'),
                description: t(
                  'assessment.outputs.emptyState.description',
                  'Outputs frozen from a completed assessment session will appear here.'
                ),
              }}
            />
          </div>

          {showLineage && lineageSessionId ? (
            <aside className="w-[400px] shrink-0 p-3 overflow-hidden">
              <ArtifactLineagePanel
                sessionId={lineageSessionId}
                onClose={() => setLineageSessionId(null)}
                onOpenOutput={(outputId) => {
                  setLineageSessionId(null);
                  setSelectedOutputId(outputId);
                }}
                onOpenReport={() => {
                  setLineageSessionId(null);
                  setView('reports');
                }}
                onOpenInitiativeDraft={() => {
                  setLineageSessionId(null);
                  setView('initiatives');
                }}
              />
            </aside>
          ) : selectedRow ? (
            <aside className="w-[400px] shrink-0 bg-slate-50 dark:bg-navy-950 p-3 overflow-hidden">
              <StandardPreview
                title={selectedRow.scope || t('assessment.outputs.table.untitled', 'Untitled output')}
                onClose={() => setSelectedOutputId(null)}
                loading={detailLoading}
                meta={{
                  pills: metaPills,
                  trailing: selectedRow.frozenAt ? (
                    <span className="text-[11px] font-semibold text-c-text-secondary">
                      {formatListDate(selectedRow.frozenAt as string)}
                    </span>
                  ) : undefined,
                }}
                details={{
                  text: previewDetailsText,
                  showWordCount: false,
                  properties: [
                    {
                      id: 'sessionId',
                      label: isPolish ? 'Sesja' : 'Session',
                      value: selectedRow.sessionId ?? '—',
                      mono: true,
                    },
                    {
                      id: 'methodPack',
                      label: isPolish ? 'Pakiet metody' : 'Method pack',
                      value:
                        selectedRow.methodPackId && selectedRow.methodPackVersion
                          ? `${selectedRow.methodPackId}@${selectedRow.methodPackVersion}`
                          : '—',
                      mono: true,
                    },
                    {
                      id: 'findings',
                      label: isPolish ? 'Ustalenia' : 'Findings',
                      value: selectedDetail ? selectedDetail.output.findings.length : (selectedRow.findingsCount ?? '—'),
                    },
                    {
                      id: 'limitations',
                      label: isPolish ? 'Ograniczenia' : 'Limitations',
                      value: selectedDetail
                        ? selectedDetail.output.limitations.length
                        : (selectedRow.limitationsCount ?? '—'),
                    },
                    {
                      id: 'contentHash',
                      label: isPolish ? 'Skrót treści' : 'Content hash',
                      value: selectedRow.contentHash ? `${String(selectedRow.contentHash).slice(0, 12)}…` : '—',
                      mono: true,
                    },
                    {
                      id: 'supersededBy',
                      label: isPolish ? 'Zastąpiony przez' : 'Superseded by',
                      value: (selectedDetail?.supersededByOutputId ?? selectedRow.supersededByOutputId) || '—',
                      mono: true,
                    },
                  ],
                  propertyLabel: isPolish ? 'Właściwość' : 'Property',
                  valueLabel: isPolish ? 'Wartość' : 'Value',
                  onCopy: () => {
                    void navigator.clipboard?.writeText(previewDetailsText);
                  },
                }}
                relations={[
                  {
                    id: 'reports',
                    label: isPolish ? 'Raporty' : 'Reports',
                    icon: FileText,
                    onClick: () => {
                      setOutputIdFilter(selectedRow.id);
                      setView('reports');
                    },
                  },
                  {
                    id: 'initiatives',
                    label: isPolish ? 'Inicjatywy' : 'Initiatives',
                    icon: Lightbulb,
                    onClick: () => {
                      setOutputIdFilter(selectedRow.id);
                      setView('initiatives');
                    },
                  },
                ]}
                actions={{
                  informational: selectedRow.sessionId
                    ? [
                        {
                          id: 'view-lineage',
                          variant: 'neutral',
                          label: t('assessment.outputs.actions.viewLineage', 'View lineage'),
                          icon: GitBranch,
                          onClick: () => setLineageSessionId(selectedRow.sessionId as string),
                        },
                      ]
                    : undefined,
                }}
              />
            </aside>
          ) : null}
        </div>
      )}
    </div>
  );
};

/** Neutral, non-crimson in-surface segmented switch — same c-* token
 * discipline as `TableTabStrip` (src/components/MyWork/table/TableTabStrip.tsx),
 * NOT a second `StandardModuleBar` (this is one Hub tab's own content). */
const SegmentedNav: React.FC<{
  segments: { id: InnerView; label: string }[];
  active: InnerView;
  onChange: (id: InnerView) => void;
}> = ({ segments, active, onChange }) => (
  <div className="flex items-center gap-1 px-4 pt-3 pb-1 shrink-0" role="tablist">
    {segments.map((segment) => {
      const isActive = segment.id === active;
      return (
        <button
          key={segment.id}
          type="button"
          role="tab"
          aria-selected={isActive}
          onClick={() => onChange(segment.id)}
          className={`rounded-token-md px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
            isActive
              ? 'bg-c-surface-raised text-c-text border border-c-border'
              : 'text-c-text-muted hover:text-c-text-secondary hover:bg-c-surface-raised border border-transparent'
          }`}
        >
          {segment.label}
        </button>
      );
    })}
  </div>
);

export default AssessmentOutputsTab;

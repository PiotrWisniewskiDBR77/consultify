import { Loader2, RefreshCw, ThumbsDown, ThumbsUp } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type MetaPill, StandardPreview } from '../standard/StandardPreview';
import {
  type StandardRowMenu,
  StandardTable,
  type TableColumn,
  type TableRow,
} from '../standard/StandardTable';
import { type AcceptCandidatePayload, useCandidates } from './CandidatesPanel';

/**
 * T28 R11 — canonical Candidates table + preview, built on the same
 * `useCandidates('pending')` hook `CandidatesPanel.tsx` already uses (real
 * GET/POST /initiatives/candidates* endpoints — no invented promote/reject/
 * export). Scan stays a toolbar action above the table, not a row/table
 * feature (surfaceRegister.ts T28: relocateFromList
 * ['candidates-scan-tool']). Kebab/PPM expose only Open preview plus the
 * two real per-row transitions, Accept and Dismiss — no bulk (selection:
 * 'none', no true multi-candidate endpoint exists).
 *
 * `CandidatesPanel.tsx` itself is left untouched; this is a new, additive
 * surface, not a rewrite of it.
 */

const WORD_LIMIT = 140;

function truncateWords(text: string, limit: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= limit) return text.trim();
  return `${words.slice(0, limit).join(' ')}…`;
}

export interface CandidatesTableProps {
  onAccept?: (payload: AcceptCandidatePayload) => void;
  initialSelectedId?: string | null;
  onSelectionChange?: (candidateId: string | null) => void;
  demoMode?: boolean;
}

const demoCandidates = [
  {
    id: 'demo-candidate-predictive-maintenance', organizationId: 'demo', sourceType: 'Assessment insight', sourceId: 'drd-1',
    title: 'Predictive Maintenance Pilot', rationale: 'DRD evidence shows repeated unplanned downtime and enough machine telemetry for a bounded pilot.',
    fitScore: 0.92, status: 'pending' as const, createdAt: '2026-08-22T10:00:00.000Z',
  },
  {
    id: 'demo-candidate-supplier-risk', organizationId: 'demo', sourceType: 'Interview finding', sourceId: 'interview-7',
    title: 'Supplier Risk Early-Warning Board', rationale: 'Procurement teams currently discover material shortages after production plans have already been committed.',
    fitScore: 0.84, status: 'pending' as const, createdAt: '2026-08-21T13:30:00.000Z',
  },
  {
    id: 'demo-candidate-energy', organizationId: 'demo', sourceType: 'Audit recommendation', sourceId: 'audit-3',
    title: 'Energy Consumption Control Loop', rationale: 'Meter data exists, but no owner receives actionable deviation alerts or verifies corrective actions.',
    fitScore: 0.76, status: 'pending' as const, createdAt: '2026-08-20T08:15:00.000Z',
  },
];

export const CandidatesTable: React.FC<CandidatesTableProps> = ({
  onAccept,
  initialSelectedId = null,
  onSelectionChange,
  demoMode = false,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const { candidates, loading, error, busyId, scanning, refresh, scan, accept, dismiss } =
    useCandidates('pending');
  const visibleCandidates = demoMode ? demoCandidates : candidates;

  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);

  React.useEffect(() => {
    setSelectedId(initialSelectedId);
  }, [initialSelectedId]);

  const selectCandidate = useCallback(
    (candidateId: string | null) => {
      setSelectedId(candidateId);
      onSelectionChange?.(candidateId);
    },
    [onSelectionChange]
  );

  const selected = useMemo(
    () => visibleCandidates.find((c) => c.id === selectedId) ?? null,
    [visibleCandidates, selectedId]
  );

  // Selected row can disappear from `candidates` the instant accept/dismiss
  // resolves (the hook filters it out of state) — close the preview rather
  // than show a stale/ghost record.
  React.useEffect(() => {
    if (!loading && selectedId && !visibleCandidates.some((c) => c.id === selectedId)) {
      selectCandidate(null);
    }
  }, [visibleCandidates, loading, selectCandidate, selectedId]);

  const handleAccept = useCallback(
    async (id: string) => {
      const payload = await accept(id);
      if (payload && onAccept) onAccept(payload);
    },
    [accept, onAccept]
  );

  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'title',
        label: t('initiatives.candidatesTable.title', 'Title'),
        sortable: true,
      },
      {
        id: 'sourceType',
        label: t('initiatives.candidatesTable.source', 'Source'),
        width: '140px',
        sortable: true,
      },
      {
        id: 'fitScore',
        label: t('initiatives.candidatesTable.fitScore', 'Fit score'),
        width: '100px',
        align: 'right',
        sortable: true,
        render: (row) =>
          `${Math.round(Math.max(0, Math.min(1, Number(row.fitScore) || 0)) * 100)}%`,
      },
      {
        id: 'status',
        label: t('initiatives.candidatesTable.status', 'Status'),
        width: '110px',
        sortable: true,
      },
      {
        id: 'createdAt',
        label: t('initiatives.candidatesTable.created', 'Created'),
        width: '120px',
        sortable: true,
        render: (row) => (row.createdAt ? String(row.createdAt).slice(0, 10) : '—'),
      },
    ],
    [t]
  );

  const metaPills: MetaPill[] = useMemo(() => {
    if (!selected) return [];
    const pct = Math.round(Math.max(0, Math.min(1, selected.fitScore)) * 100);
    return [
      { label: selected.sourceType, tone: 'neutral' },
      { label: `${pct}%`, tone: 'info' },
    ];
  }, [selected]);

  const previewDetailsText = useMemo(() => {
    if (!selected) return '';
    const pct = Math.round(Math.max(0, Math.min(1, selected.fitScore)) * 100);
    const base = isPolish
      ? `Kandydat: ${selected.title}. Źródło: ${selected.sourceType}. Dopasowanie: ${pct}%. Uzasadnienie: ${selected.rationale}`
      : `Candidate: ${selected.title}. Source: ${selected.sourceType}. Fit: ${pct}%. Rationale: ${selected.rationale}`;
    return truncateWords(base, WORD_LIMIT);
  }, [selected, isPolish]);

  const rowMenu = useCallback(
    (row: TableRow): StandardRowMenu => {
      const busy = busyId === row.id;
      return {
        statusTransitions: [
          {
            id: 'accept',
            label: t('initiatives.candidatesTable.accept', 'Accept'),
            icon: ThumbsUp,
            onClick: () => void handleAccept(String(row.id)),
            disabled: busy || demoMode,
            note: demoMode ? 'Sample data · read only' : busy ? (isPolish ? 'Przetwarzanie…' : 'Processing…') : undefined,
          },
          {
            id: 'dismiss',
            label: t('initiatives.candidatesTable.dismiss', 'Dismiss'),
            icon: ThumbsDown,
            onClick: () => void dismiss(String(row.id)),
            disabled: busy || demoMode,
            note: demoMode ? 'Sample data · read only' : busy ? (isPolish ? 'Przetwarzanie…' : 'Processing…') : undefined,
          },
        ],
        universalHandlers: {
          preview: () => selectCandidate(String(row.id)),
        },
      };
    },
    [busyId, demoMode, handleAccept, dismiss, t, isPolish, selectCandidate]
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-3">
        <button
          type="button"
          onClick={() => void scan()}
          disabled={scanning}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          {scanning ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {t('initiatives.candidatesTable.scan', 'Scan discovery')}
        </button>
      </div>
      <div className="flex-1 min-w-0 flex overflow-hidden">
        <div className="flex-1 min-w-0 overflow-auto pl-4 pr-1.5 pt-3 pb-4">
          <StandardTable
            surfaceId="T28"
            columns={columns}
            data={visibleCandidates as unknown as TableRow[]}
            loading={demoMode ? false : loading}
            error={
              !demoMode && error
                ? isPolish
                  ? 'Nie udało się wczytać kandydatów. Spróbuj ponownie.'
                  : 'Failed to load candidates. Please try again.'
                : null
            }
            onRetry={refresh}
            persistKey="initiatives.candidates"
            defaultSort={{ columnId: 'createdAt', direction: 'desc' }}
            selectedRowId={selectedId}
            onRowClick={(row) => selectCandidate(String(row.id))}
            rowMenu={rowMenu}
            rowDescription={() => null}
            empty={{
              title: t('initiatives.candidatesTable.emptyTitle', 'No candidates yet'),
              description: t(
                'initiatives.candidatesTable.emptyDescription',
                'Run a scan to let AI suggest initiatives from discovery.'
              ),
            }}
          />
        </div>

        {selected ? (
          <aside className="w-[400px] shrink-0 bg-slate-50 dark:bg-navy-950 p-3 overflow-hidden">
            <StandardPreview
              title={selected.title}
              onClose={() => selectCandidate(null)}
              meta={{ pills: metaPills }}
              details={{
                text: previewDetailsText,
                onCopy: () => {
                  void navigator.clipboard?.writeText(previewDetailsText);
                },
              }}
              relations={[]}
              actions={{
                resolutions: [
                  {
                    id: 'accept',
                    variant: 'positive',
                    label: t('initiatives.candidatesTable.accept', 'Accept'),
                    icon: ThumbsUp,
                    onClick: () => void handleAccept(selected.id),
                    disabled: busyId === selected.id,
                  },
                  {
                    id: 'dismiss',
                    variant: 'neutral',
                    label: t('initiatives.candidatesTable.dismiss', 'Dismiss'),
                    icon: ThumbsDown,
                    onClick: () => void dismiss(selected.id),
                    disabled: busyId === selected.id,
                  },
                ],
              }}
            />
          </aside>
        ) : null}
      </div>
    </div>
  );
};

export default CandidatesTable;

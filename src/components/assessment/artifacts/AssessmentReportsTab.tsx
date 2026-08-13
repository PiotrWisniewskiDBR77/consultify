/**
 * AssessmentReportsTab — P0D kernel Reports surface.
 *
 * Reads `GET /api/method/reports` (method-core kernel: `method_report_snapshots`,
 * `kind === 'report'`) — NEVER the legacy ReportBuilder/`assessment_reports`
 * table AssessmentHub's own `reports` tab reads today. This component is
 * intentionally standalone (not wired into AssessmentHub's top-level 'reports'
 * tab id — see the P0D handoff report for why) so it can be reused wherever a
 * kernel-backed Reports list is needed, scoped to one Output (`outputId`) or
 * org-wide (`outputId` omitted).
 *
 * ★ Snapshot discipline: selecting a row fetches `getReportSnapshot(id)` —
 * the persisted, structured `content` — rather than deriving anything from a
 * live session. There is no local/offline draft source here at all.
 *
 * List UI = StandardTable/StandardPreview only (TRIADA_KANON.md). No bespoke
 * table.
 */
import { FileText } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  getReportSnapshot,
  isAuthError,
  listReports,
  type MethodArtefactSnapshotDetail,
  type MethodArtefactSnapshotSummary,
} from '@/method-core/api/methodCoreApi';
import { formatListDate } from '@/utils/listDateFormat';

import { EmptyState } from '../../shared/states';
import { type MetaPill, StandardPreview } from '../../standard/StandardPreview';
import {
  type StandardRowMenu,
  StandardTable,
  type TableColumn,
  type TableRow,
} from '../../standard/StandardTable';
import { StatusChip } from '../../ui/primitives/chips';

type ReportRow = MethodArtefactSnapshotSummary & { [key: string]: unknown };

export interface AssessmentReportsTabProps {
  /** Scope to Reports belonging to one Output — e.g. navigated here from the
   * Outputs tab. Omit for the org-wide Reports library. */
  outputId?: string;
  /** Rendered as a "Clear filter" affordance when `outputId` is set. */
  onClearFilter?: () => void;
  /** Opens the full lineage (session → revisions → output → report/
   * presentation → initiative) for the selected row's session. */
  onOpenLineage?: (sessionId: string) => void;
  /** Pre-select a row on mount — e.g. navigated here directly from
   * ArtifactLineagePanel's "Reports" group. Only consulted once, at mount. */
  initialSelectedId?: string;
}

function statusTone(status: string | null): 'success' | 'neutral' {
  return status === 'current' ? 'success' : 'neutral';
}

function statusLabel(isPolish: boolean, status: string | null): string {
  if (status === 'current') return isPolish ? 'Aktualny' : 'Current';
  if (status === 'superseded') return isPolish ? 'Zastąpiony' : 'Superseded';
  if (status === 'source_updated') return isPolish ? 'Źródło zaktualizowane' : 'Source updated';
  return isPolish ? 'Status nieznany' : 'Status unknown';
}

export const AssessmentReportsTab: React.FC<AssessmentReportsTabProps> = ({
  outputId,
  onClearFilter,
  onOpenLineage,
  initialSelectedId,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');

  const [items, setItems] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null);
  const [detail, setDetail] = useState<MethodArtefactSnapshotDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setHasLoadError(false);
    setForbidden(false);
    listReports(outputId ? { outputId } : {})
      .then((rows) => {
        if (cancelled) return;
        setItems(rows as ReportRow[]);
      })
      .catch((err) => {
        if (cancelled) return;
        setItems([]);
        if (isAuthError(err)) {
          setForbidden(true);
        } else {
          setHasLoadError(true);
        }
        // eslint-disable-next-line no-console -- fixed diagnostic only, no raw message in UI.
        console.error('[AssessmentReportsTab] failed to load reports', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [outputId]);

  useEffect(() => {
    const cancel = load();
    return cancel;
  }, [load]);

  // Selecting a row fetches the persisted snapshot content from the server —
  // never derived from anything held client-side.
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    getReportSnapshot(selectedId)
      .then((res) => {
        if (!cancelled) setDetail(res);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const selectedSummary = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  );

  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'title',
        label: t('assessment.reports.table.title', 'Title'),
        sortable: true,
        render: (row) => (row.title as string | null) || t('assessment.reports.table.untitled', 'Untitled report'),
      },
      {
        id: 'status',
        label: t('assessment.reports.table.status', 'Status'),
        width: '150px',
        sortable: true,
        render: (row) => (
          <StatusChip
            label={statusLabel(isPolish, row.status as string | null)}
            tone={statusTone(row.status as string | null)}
          />
        ),
      },
      {
        id: 'createdAt',
        label: t('assessment.reports.table.created', 'Created'),
        width: '150px',
        sortable: true,
        render: (row) => (row.createdAt ? formatListDate(row.createdAt as string) : '—'),
      },
    ],
    [t, isPolish]
  );

  const metaPills: MetaPill[] = useMemo(() => {
    if (!selectedSummary) return [];
    const pills: MetaPill[] = [
      { label: statusLabel(isPolish, selectedSummary.status), tone: statusTone(selectedSummary.status) },
    ];
    if (selectedSummary.demoBypassActive) {
      pills.push({ label: isPolish ? 'Tryb demo' : 'Demo bypass', tone: 'warning' });
    }
    return pills;
  }, [selectedSummary, isPolish]);

  const previewDetailsText = useMemo(() => {
    if (!selectedSummary) return '';
    if (detailLoading) return '';
    if (!detail) {
      return isPolish
        ? 'Nie udało się wczytać treści raportu z serwera.'
        : 'Could not load the report content from the server.';
    }
    let contentText = '';
    try {
      contentText = JSON.stringify(detail.content, null, 2);
    } catch {
      contentText = '';
    }
    if (!contentText) return '';
    const capped = contentText.length > 2000 ? `${contentText.slice(0, 2000)}…` : contentText;
    return capped;
  }, [selectedSummary, detail, detailLoading, isPolish]);

  const rowMenu = useCallback(
    (row: TableRow): StandardRowMenu => ({
      universalHandlers: {
        preview: () => setSelectedId(String(row.id)),
      },
    }),
    []
  );

  if (forbidden) {
    return (
      <div className="h-full overflow-auto p-4">
        <EmptyState
          variant="forbidden"
          title={t('assessment.reports.forbidden.title', 'No access to Reports')}
          description={t(
            'assessment.reports.forbidden.description',
            'Your account does not have permission to view this organization’s Report snapshots.'
          )}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {outputId ? (
        <div className="flex items-center gap-2 px-4 pt-3 text-[11px] text-c-text-muted">
          <span>
            {isPolish ? 'Filtr: raporty dla wybranego Outputu' : 'Filter: reports for the selected Output'}
          </span>
          {onClearFilter ? (
            <button
              type="button"
              onClick={onClearFilter}
              className="rounded-token-md border border-c-border px-2 py-0.5 text-[11px] font-medium text-c-text hover:bg-c-surface-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              {isPolish ? 'Wyczyść filtr' : 'Clear filter'}
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 min-w-0 overflow-auto pl-4 pr-1.5 pt-3 pb-4">
          <StandardTable
            columns={columns}
            data={items}
            loading={loading}
            error={
              hasLoadError
                ? isPolish
                  ? 'Nie udało się wczytać raportów. Spróbuj ponownie.'
                  : 'Failed to load reports. Please try again.'
                : null
            }
            onRetry={load}
            persistKey="assessment.artifacts.reports"
            defaultSort={{ columnId: 'createdAt', direction: 'desc' }}
            selectedRowId={selectedId}
            onRowClick={(row) => setSelectedId(String(row.id))}
            rowMenu={rowMenu}
            rowDescription={() => null}
            empty={{
              icon: FileText,
              title: t('assessment.reports.emptyState.title', 'No reports yet'),
              description: outputId
                ? t(
                    'assessment.reports.emptyState.descriptionScoped',
                    'This Output has no Report snapshot yet.'
                  )
                : t(
                    'assessment.reports.emptyState.description',
                    'Report snapshots created from a frozen Output will appear here.'
                  ),
            }}
          />
        </div>

        {selectedSummary ? (
          <aside className="w-[400px] shrink-0 bg-slate-50 dark:bg-navy-950 p-3 overflow-hidden">
            <StandardPreview
              title={selectedSummary.title || t('assessment.reports.table.untitled', 'Untitled report')}
              onClose={() => setSelectedId(null)}
              loading={detailLoading}
              meta={{
                pills: metaPills,
                trailing: selectedSummary.createdAt ? (
                  <span className="text-[11px] font-semibold text-c-text-secondary">
                    {formatListDate(selectedSummary.createdAt)}
                  </span>
                ) : undefined,
              }}
              details={{
                text: previewDetailsText,
                label: isPolish ? 'Treść (surowa)' : 'Content (raw)',
                showWordCount: false,
                properties: [
                  {
                    id: 'outputId',
                    label: isPolish ? 'Output' : 'Output',
                    value: selectedSummary.outputId ?? '—',
                    mono: true,
                  },
                  {
                    id: 'sessionId',
                    label: isPolish ? 'Sesja' : 'Session',
                    value: selectedSummary.sessionId ?? '—',
                    mono: true,
                  },
                  {
                    id: 'contentHash',
                    label: isPolish ? 'Skrót treści' : 'Content hash',
                    value: selectedSummary.contentHash
                      ? `${selectedSummary.contentHash.slice(0, 12)}…`
                      : '—',
                    mono: true,
                  },
                  {
                    id: 'supersededBy',
                    label: isPolish ? 'Zastąpiony przez' : 'Superseded by',
                    value: selectedSummary.supersededByOutputId ?? '—',
                    mono: true,
                  },
                ],
                propertyLabel: isPolish ? 'Właściwość' : 'Property',
                valueLabel: isPolish ? 'Wartość' : 'Value',
                onCopy: () => {
                  void navigator.clipboard?.writeText(previewDetailsText);
                },
              }}
              relations={
                selectedSummary.sessionId && onOpenLineage
                  ? [
                      {
                        id: 'lineage',
                        label: isPolish ? 'Historia pochodzenia' : 'Lineage',
                        onClick: () => onOpenLineage(selectedSummary.sessionId as string),
                      },
                    ]
                  : []
              }
            />
          </aside>
        ) : null}
      </div>
    </div>
  );
};

export default AssessmentReportsTab;

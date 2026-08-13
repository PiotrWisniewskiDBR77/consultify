/**
 * AssessmentInitiativesTab — P0D kernel Initiative Proposal Drafts surface.
 *
 * Reads `GET /api/method/initiative-drafts` (method-core kernel:
 * `method_initiative_drafts`) — NEVER the Initiatives module's Registered
 * Initiatives table AssessmentHub's own 'initiatives' tab reads today.
 *
 * ★ A row here is a DRAFT proposal grouped from Output findings, NOT a
 * Registered Initiative. Turning one into a Registered Initiative is a
 * separate human action in the Initiatives module — this component has no
 * "Register" button because that write is outside method-core's reach by
 * construction (`MethodInitiativeDraftService` has no such method).
 *
 * Standalone/reusable (not wired into AssessmentHub's top-level 'initiatives'
 * tab id — see the P0D handoff report). Scope to one Output via `outputId`,
 * or org-wide when omitted.
 *
 * List UI = StandardTable/StandardPreview only (TRIADA_KANON.md).
 */
import { Lightbulb } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  isAuthError,
  listInitiativeDrafts,
  type MethodInitiativeDraftSummary,
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

type DraftRow = MethodInitiativeDraftSummary & { [key: string]: unknown };

export interface AssessmentInitiativesTabProps {
  /** Scope to drafts belonging to one Output. Omit for the org-wide list. */
  outputId?: string;
  onClearFilter?: () => void;
  onOpenLineage?: (sessionId: string) => void;
  /** Pre-select a row on mount — e.g. navigated here directly from
   * ArtifactLineagePanel's "Initiative Proposals" group. Consulted once. */
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

function confidenceTone(confidence: string | null): 'success' | 'warning' | 'neutral' {
  if (confidence === 'high') return 'success';
  if (confidence === 'low') return 'warning';
  return 'neutral';
}

export const AssessmentInitiativesTab: React.FC<AssessmentInitiativesTabProps> = ({
  outputId,
  onClearFilter,
  onOpenLineage,
  initialSelectedId,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');

  const [items, setItems] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setHasLoadError(false);
    setForbidden(false);
    listInitiativeDrafts(outputId ? { outputId } : {})
      .then((rows) => {
        if (cancelled) return;
        setItems(rows as DraftRow[]);
      })
      .catch((err) => {
        if (cancelled) return;
        setItems([]);
        if (isAuthError(err)) {
          setForbidden(true);
        } else {
          setHasLoadError(true);
        }
        // eslint-disable-next-line no-console -- fixed diagnostic only.
        console.error('[AssessmentInitiativesTab] failed to load initiative drafts', err);
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

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  );

  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'title',
        label: t('assessment.initiativeDrafts.table.title', 'Title'),
        sortable: true,
        render: (row) =>
          (row.title as string | null) ||
          t('assessment.initiativeDrafts.table.untitled', 'Untitled draft'),
      },
      {
        id: 'confidence',
        label: t('assessment.initiativeDrafts.table.confidence', 'Confidence'),
        width: '120px',
        sortable: true,
        render: (row) => {
          const confidence = row.confidence as string | null;
          if (!confidence) return '—';
          return <StatusChip label={confidence} tone={confidenceTone(confidence)} hideDot />;
        },
      },
      {
        id: 'status',
        label: t('assessment.initiativeDrafts.table.status', 'Status'),
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
        id: 'findingIds',
        label: t('assessment.initiativeDrafts.table.findings', 'Findings'),
        width: '100px',
        render: (row) => {
          const ids = row.findingIds as string[] | undefined;
          return ids ? String(ids.length) : '0';
        },
      },
      {
        id: 'createdAt',
        label: t('assessment.initiativeDrafts.table.created', 'Created'),
        width: '150px',
        sortable: true,
        render: (row) => (row.createdAt ? formatListDate(row.createdAt as string) : '—'),
      },
    ],
    [t, isPolish]
  );

  const metaPills: MetaPill[] = useMemo(() => {
    if (!selected) return [];
    const pills: MetaPill[] = [
      { label: statusLabel(isPolish, selected.status), tone: statusTone(selected.status) },
    ];
    if (selected.confidence) {
      pills.push({ label: selected.confidence, tone: confidenceTone(selected.confidence) });
    }
    return pills;
  }, [selected, isPolish]);

  const previewDetailsText = useMemo(() => {
    if (!selected) return '';
    const parts: string[] = [];
    if (selected.summary) parts.push(selected.summary);
    if (selected.rationale) parts.push(`${isPolish ? 'Uzasadnienie' : 'Rationale'}: ${selected.rationale}`);
    if (selected.expectedOutcome) {
      parts.push(`${isPolish ? 'Oczekiwany efekt' : 'Expected outcome'}: ${selected.expectedOutcome}`);
    }
    return parts.join(' ');
  }, [selected, isPolish]);

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
          title={t('assessment.initiativeDrafts.forbidden.title', 'No access to Initiative Drafts')}
          description={t(
            'assessment.initiativeDrafts.forbidden.description',
            'Your account does not have permission to view this organization’s Initiative Proposal Drafts.'
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
            {isPolish
              ? 'Filtr: propozycje inicjatyw dla wybranego Outputu'
              : 'Filter: initiative drafts for the selected Output'}
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
                  ? 'Nie udało się wczytać propozycji inicjatyw. Spróbuj ponownie.'
                  : 'Failed to load initiative drafts. Please try again.'
                : null
            }
            onRetry={load}
            persistKey="assessment.artifacts.initiativeDrafts"
            defaultSort={{ columnId: 'createdAt', direction: 'desc' }}
            selectedRowId={selectedId}
            onRowClick={(row) => setSelectedId(String(row.id))}
            rowMenu={rowMenu}
            rowDescription={() => null}
            empty={{
              icon: Lightbulb,
              title: t('assessment.initiativeDrafts.emptyState.title', 'No initiative drafts yet'),
              description: outputId
                ? t(
                    'assessment.initiativeDrafts.emptyState.descriptionScoped',
                    'This Output has no Initiative Proposal Draft yet.'
                  )
                : t(
                    'assessment.initiativeDrafts.emptyState.description',
                    'Initiative Proposal Drafts grouped from findings will appear here.'
                  ),
            }}
          />
        </div>

        {selected ? (
          <aside className="w-[400px] shrink-0 bg-slate-50 dark:bg-navy-950 p-3 overflow-hidden">
            <StandardPreview
              title={selected.title || t('assessment.initiativeDrafts.table.untitled', 'Untitled draft')}
              onClose={() => setSelectedId(null)}
              meta={{
                pills: metaPills,
                trailing: selected.createdAt ? (
                  <span className="text-[11px] font-semibold text-c-text-secondary">
                    {formatListDate(selected.createdAt)}
                  </span>
                ) : undefined,
              }}
              details={{
                text: previewDetailsText,
                properties: [
                  {
                    id: 'outputId',
                    label: isPolish ? 'Output' : 'Output',
                    value: selected.outputId ?? '—',
                    mono: true,
                  },
                  {
                    id: 'sessionId',
                    label: isPolish ? 'Sesja' : 'Session',
                    value: selected.sessionId ?? '—',
                    mono: true,
                  },
                  {
                    id: 'findingIds',
                    label: isPolish ? 'Powiązane ustalenia' : 'Linked findings',
                    value: String(selected.findingIds.length),
                  },
                  {
                    id: 'supersededBy',
                    label: isPolish ? 'Zastąpiony przez' : 'Superseded by',
                    value: selected.supersededByOutputId ?? '—',
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
                selected.sessionId && onOpenLineage
                  ? [
                      {
                        id: 'lineage',
                        label: isPolish ? 'Historia pochodzenia' : 'Lineage',
                        onClick: () => onOpenLineage(selected.sessionId as string),
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

export default AssessmentInitiativesTab;

/**
 * OutputsAggregateTabContent — All | Mine | Needs review
 * Single registry-backed list (GET /api/artifacts with view=mine|review).
 */

import {
  Archive,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Loader2,
  Presentation,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { buildMyWorkSheetTableOpenPath } from '@/utils/artifactLinks';
import {
  downloadSheetArtifactXlsx,
  resolveTablePlatformWorkspaceIdForTable,
} from '@/utils/sheetArtifactOpen';

import { API_URL, getHeaders } from '../../services/api';
import {
  FilterableTable,
  type FilterChip,
  type GridItem,
  GridView,
  type TableColumn,
  type ViewMode,
} from '../shared/ModuleHub';
import type { RowAction } from '../shared/RowActionsMenu';
import { TableWithPreviewLayout } from '../shared/TableWithPreviewLayout';
import type { UnifiedOutputRow } from './types';
import type { useRapActions } from './useRapData';

function rowKey(row: UnifiedOutputRow): string {
  return `${row.kind}:${row.originRecordId}`;
}

function formatLabel(value: string | null | undefined): string {
  const normalized = String(value || '').trim();
  if (!normalized) return '—';
  return normalized
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatSourceSummary(
  row: Pick<UnifiedOutputRow, 'sourceType' | 'sourceInitiativeId'>,
  t: (key: string, fallback?: string) => string
): string {
  const parts: string[] = [];
  if (row.sourceType) {
    parts.push(formatLabel(row.sourceType));
  }
  if (row.sourceInitiativeId) {
    parts.push(t('rap.outputs.source.initiativeLinked', 'Initiative linked'));
  }
  return parts.length ? parts.join(' · ') : '—';
}

function formatReviewSummary(
  row: Pick<UnifiedOutputRow, 'governance'>,
  t: (key: string, fallback?: string) => string
): string {
  const state = formatLabel(row.governance?.publishState);
  if (state === '—') return '—';
  const gateCount = row.governance?.reviewGateCount;
  if (typeof gateCount === 'number' && gateCount > 0) {
    return `${state} (${gateCount})`;
  }
  return state;
}

type AggregateRow = UnifiedOutputRow & { id: string; title: string };

interface OutputsAggregateTabContentProps {
  viewMode: ViewMode;
  searchQuery: string;
  activeFilters: FilterChip[];
  onFilterChange: (filters: FilterChip[]) => void;
  rows: UnifiedOutputRow[];
  loading: boolean;
  error?: string | null;
  onRefresh: () => void;
  actions: ReturnType<typeof useRapActions>;
}

export const OutputsAggregateTabContent: React.FC<OutputsAggregateTabContentProps> = ({
  viewMode,
  searchQuery,
  activeFilters,
  onFilterChange,
  rows,
  loading,
  error,
  onRefresh,
  actions,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const navigate = useNavigate();
  const { isEnabled } = useFeatureFlags();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedGovernance, setSelectedGovernance] = useState<
    UnifiedOutputRow['governance'] | null
  >(null);
  const translate = useCallback(
    (key: string, fallback?: string) => t(key, { defaultValue: fallback ?? key }),
    [t]
  );

  const openGovernedSheetRow = useCallback(
    async (originRecordId: string) => {
      const tableId = String(originRecordId);
      if (isEnabled('tablePlatformMetadataFirst')) {
        const ws = await resolveTablePlatformWorkspaceIdForTable(tableId);
        if (ws) {
          navigate(buildMyWorkSheetTableOpenPath(ws, tableId));
          return;
        }
      }
      const ok = await downloadSheetArtifactXlsx(tableId);
      if (ok) {
        toast.success(isPolish ? 'Pobrano arkusz (.xlsx)' : 'Downloaded spreadsheet (.xlsx)');
      } else {
        toast.error(isPolish ? 'Nie udało się pobrać arkusza' : 'Could not download spreadsheet');
      }
    },
    [isEnabled, isPolish, navigate]
  );

  const tableRows: AggregateRow[] = useMemo(
    () => rows.map((r) => ({ ...r, id: rowKey(r), title: r.title })),
    [rows]
  );

  const filteredData = useMemo(() => {
    let data = tableRows;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.owner.toLowerCase().includes(q) ||
          item.statusKey.toLowerCase().includes(q)
      );
    }
    for (const f of activeFilters) {
      if (f.column === 'outputKind') data = data.filter((item) => item.kind === f.value);
      if (f.column === 'status') data = data.filter((item) => item.statusKey === f.value);
    }
    return data;
  }, [tableRows, searchQuery, activeFilters]);

  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'title',
        label: t('rap.columns.title', 'Tytuł'),
        width: '280px',
        render: (row: AggregateRow) => (
          <div className="flex items-center gap-2 min-w-0">
            {row.kind === 'document' ? (
              <FileText size={16} className="shrink-0 text-blue-400" />
            ) : row.kind === 'presentation' ? (
              <Presentation size={16} className="shrink-0 text-purple-400" />
            ) : (
              <FileSpreadsheet size={16} className="shrink-0 text-emerald-400" />
            )}
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
              {row.title}
            </span>
          </div>
        ),
      },
      {
        id: 'outputKind',
        label: t('rap.outputs.columns.kind', 'Typ'),
        width: '120px',
        filterable: true,
        filterOptions: [
          {
            value: 'document',
            label: t('rap.outputs.kind.document', 'Document'),
            color: 'bg-blue-400',
          },
          {
            value: 'presentation',
            label: t('rap.outputs.kind.presentation', 'Presentation'),
            color: 'bg-purple-400',
          },
          {
            value: 'sheet',
            label: t('rap.outputs.kind.sheet', 'Sheet'),
            color: 'bg-emerald-400',
          },
        ],
        render: (row: AggregateRow) => (
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300 capitalize">
            {row.kind === 'document'
              ? t('rap.outputs.kind.document', 'Document')
              : row.kind === 'presentation'
                ? t('rap.outputs.kind.presentation', 'Presentation')
                : t('rap.outputs.kind.sheet', 'Sheet')}
          </span>
        ),
      },
      {
        id: 'status',
        label: t('rap.columns.status', 'Status'),
        width: '120px',
        filterable: true,
        filterOptions: [
          { value: 'draft', label: isPolish ? 'Szkic' : 'Draft', color: 'bg-slate-400' },
          {
            value: 'generated',
            label: isPolish ? 'Wygenerowana' : 'Generated',
            color: 'bg-blue-400',
          },
          { value: 'editing', label: isPolish ? 'Edycja' : 'Editing', color: 'bg-amber-400' },
          { value: 'ready', label: isPolish ? 'Gotowy' : 'Ready', color: 'bg-emerald-400' },
          {
            value: 'exported',
            label: isPolish ? 'Wyeksportowany' : 'Exported',
            color: 'bg-blue-400',
          },
          { value: 'shared', label: isPolish ? 'Udostępniony' : 'Shared', color: 'bg-purple-400' },
          {
            value: 'archived',
            label: isPolish ? 'Zarchiwizowany' : 'Archived',
            color: 'bg-slate-500',
          },
        ],
        render: (row: AggregateRow) => (
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300 capitalize">
            {formatLabel(row.statusKey)}
          </span>
        ),
      },
      {
        id: 'owner',
        label: t('rap.columns.owner', 'Właściciel'),
        width: '160px',
      },
      {
        id: 'visibility',
        label: t('rap.outputs.columns.visibility', 'Visibility'),
        width: '120px',
        render: (row: AggregateRow) => (
          <span className="text-xs text-slate-600 dark:text-slate-300">
            {formatLabel(row.governance?.visibilityScope)}
          </span>
        ),
      },
      {
        id: 'source',
        label: t('rap.outputs.columns.source', 'Source'),
        width: '150px',
        render: (row: AggregateRow) => (
          <span className="text-xs text-slate-600 dark:text-slate-300">
            {formatSourceSummary(row, translate)}
          </span>
        ),
      },
      {
        id: 'review',
        label: t('rap.outputs.columns.review', 'Review'),
        width: '130px',
        render: (row: AggregateRow) => (
          <span className="text-xs text-slate-600 dark:text-slate-300">
            {formatReviewSummary(row, translate)}
          </span>
        ),
      },
      {
        id: 'exports',
        label: t('rap.outputs.columns.exports', 'Exports'),
        width: '120px',
        render: (row: AggregateRow) => (
          <span className="text-xs text-slate-600 dark:text-slate-300">
            {row.exportFormats.length ? row.exportFormats.join(', ').toUpperCase() : '—'}
          </span>
        ),
      },
      {
        id: 'updatedAt',
        label: t('rap.columns.date', 'Data'),
        width: '130px',
        sortable: true,
        render: (row: AggregateRow) => {
          const d = new Date(row.updatedAt);
          return (
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {d.toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          );
        },
      },
    ],
    [t, isPolish]
  );

  const openRow = (row: UnifiedOutputRow) => {
    if (row.kind === 'document') navigate(`/reports/builder/${row.originRecordId}`);
    else if (row.kind === 'presentation') navigate(`/presentations/builder/${row.originRecordId}`);
    else if (row.kind === 'sheet') void openGovernedSheetRow(row.originRecordId);
  };

  const getRowActions = (row: AggregateRow): RowAction[] => {
    const base: RowAction[] = [
      {
        id: 'open',
        label: t('rap.actions.open', 'Otwórz'),
        icon: ExternalLink,
        variant: 'primary',
        onClick: () => openRow(row),
      },
    ];
    if (row.kind === 'document') {
      base.push({
        id: 'export',
        label: t('rap.actions.exportPdf', 'Eksportuj PDF'),
        icon: Download,
        onClick: () => actions.exportReportPdf(row),
      });
      base.push({
        id: 'archive',
        label: t('rap.actions.delete', 'Usuń'),
        icon: Archive,
        divider: true,
        variant: 'danger',
        onClick: async () => {
          const ok = await actions.archiveReport(row);
          if (ok) onRefresh();
        },
      });
    } else if (row.kind === 'presentation') {
      base.push({
        id: 'export',
        label: t('rap.actions.exportPptx', 'Eksportuj PPTX'),
        icon: Download,
        onClick: () => actions.exportDeckPptx(row),
      });
      base.push({
        id: 'archive',
        label: t('rap.actions.delete', 'Usuń'),
        icon: Archive,
        divider: true,
        variant: 'danger',
        onClick: async () => {
          const ok = await actions.archiveDeck(row);
          if (ok) onRefresh();
        },
      });
    }
    return base;
  };

  const selectedItem = selectedId ? filteredData.find((i) => i.id === selectedId) || null : null;
  const previewItem = selectedItem
    ? {
        ...selectedItem,
        governance: selectedGovernance || selectedItem.governance,
      }
    : null;
  const itemIds = filteredData.map((i) => i.id);

  useEffect(() => {
    let isMounted = true;
    setSelectedGovernance(selectedItem?.governance || null);

    async function fetchTrustState() {
      if (!selectedItem?.artifactId) {
        setSelectedGovernance(selectedItem?.governance || null);
        return;
      }

      try {
        const res = await fetch(`${API_URL}/artifacts/${selectedItem.artifactId}/trust-state`, {
          headers: getHeaders(),
        });
        if (!res.ok) {
          if (isMounted) setSelectedGovernance(selectedItem.governance || null);
          return;
        }
        const data = await res.json();
        const payload = data?.data || data;
        if (!isMounted) return;
        setSelectedGovernance({
          ...(selectedItem.governance || {}),
          visibilityScope: payload.visibilityScope,
          publishState: payload.publishState,
          validationState: payload.validationState || null,
          validationChecks: Array.isArray(payload.validationChecks) ? payload.validationChecks : [],
          publishReviewers: Array.isArray(payload.reviewers) ? payload.reviewers : [],
          reviewGateCount:
            typeof payload.reviewGateCount === 'number' ? payload.reviewGateCount : 0,
          projectId: payload.projectId || null,
          executionRunId: payload.executionRunId || null,
          executionState: payload.executionState || null,
          contextSnapshotId: payload.contextSnapshotId || null,
          canonicalHome: payload.canonicalHome || null,
          lastTransitionAt: payload.lastTransitionAt || null,
          sourceRefs: Array.isArray(payload.sourceRefs) ? payload.sourceRefs : [],
          originSummary:
            payload.originSummary && typeof payload.originSummary === 'object'
              ? payload.originSummary
              : null,
          openPath: payload.openPath || null,
          exportPath: payload.exportPath || null,
          authority: payload.authority || null,
          manageAccessPath: payload.manageAccessPath || null,
          canManageAccess: Boolean(payload.canManageAccess),
          exportHistory: Array.isArray(payload.exportHistory) ? payload.exportHistory : [],
          reviewAuthority: payload.reviewAuthority || 'artifact_review',
          executionAuthority: payload.executionAuthority || 'execution_spine',
          accessGrants: Array.isArray(payload.accessGrants) ? payload.accessGrants : [],
          originLinks: Array.isArray(payload.originLinks) ? payload.originLinks : [],
        });
      } catch {
        if (isMounted) setSelectedGovernance(selectedItem?.governance || null);
      }
    }

    void fetchTrustState();
    return () => {
      isMounted = false;
    };
  }, [selectedItem?.artifactId, selectedItem?.governance]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (error && rows.length === 0 && !searchQuery && activeFilters.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="w-full max-w-3xl rounded-2xl border border-amber-200/70 dark:border-amber-400/20 bg-amber-50/80 dark:bg-amber-500/10 p-6">
          <div className="text-lg font-semibold text-slate-900 dark:text-white">
            {t('rap.errors.outputsRegistryTitle', 'Outputs library source needs attention')}
          </div>
          <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">{error}</div>
        </div>
      </div>
    );
  }

  if (viewMode === 'grid') {
    const gridItems: GridItem[] = filteredData.map((item) => ({
      id: item.id,
      name: item.title,
      type: item.kind,
      typeColor:
        item.kind === 'presentation'
          ? 'strategic'
          : item.kind === 'document'
            ? 'operational'
            : 'digital',
      status: item.statusKey.toUpperCase(),
      progress: 0,
      updatedAt: item.updatedAt,
      owner: item.owner,
    }));

    return (
      <GridView
        items={gridItems}
        selectedItemId={selectedId}
        onItemClick={(item) => setSelectedId(item.id)}
        emptyMessage={t('rap.empty.outputs', 'Brak outputów')}
        newItemLabel={t('rap.actions.newFromTemplate', 'Nowy z szablonu')}
      />
    );
  }

  return (
    <div className="h-full overflow-hidden">
      <TableWithPreviewLayout<AggregateRow>
        selectedId={selectedId}
        selectedItem={previewItem}
        onSelect={setSelectedId}
        itemIds={itemIds}
        getItemById={(id) => filteredData.find((x) => x.id === id) ?? null}
        renderPreview={(item) => (
          <div className="p-4 space-y-3 text-sm text-slate-700 dark:text-slate-200">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {item.kind === 'document'
                ? t('rap.outputs.kind.document', 'Document')
                : item.kind === 'presentation'
                  ? t('rap.outputs.kind.presentation', 'Presentation')
                  : t('rap.outputs.kind.sheet', 'Sheet')}
            </div>
            <div className="text-lg font-semibold text-slate-900 dark:text-white">{item.title}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t('rap.outputs.preview.status', 'Status')}:{' '}
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {formatLabel(item.statusKey)}
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t('rap.columns.owner', 'Owner')}:{' '}
              <span className="font-medium text-slate-700 dark:text-slate-200">{item.owner}</span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t('rap.outputs.preview.visibility', 'Visibility')}:{' '}
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {formatLabel(item.governance?.visibilityScope)}
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t('rap.outputs.preview.validation', 'Validation')}:{' '}
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {formatLabel(item.governance?.validationState)}
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t('rap.outputs.preview.execution', 'Execution')}:{' '}
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {formatLabel(item.governance?.executionState)}
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t('rap.outputs.preview.review', 'Review')}:{' '}
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {formatLabel(item.governance?.publishState)}
              </span>
              {typeof item.governance?.reviewGateCount === 'number' ? (
                <span className="ml-1">
                  ({item.governance.reviewGateCount}
                  {t('rap.outputs.preview.reviewersShort', ' gates')})
                </span>
              ) : null}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t('rap.outputs.preview.source', 'Source')}:{' '}
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {formatSourceSummary(item, translate)}
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t('rap.outputs.preview.lineage', 'Lineage')}:{' '}
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {[
                  typeof item.governance?.originLinks?.length === 'number'
                    ? `${item.governance.originLinks.length} ${t('rap.outputs.preview.originsShort', 'origins')}`
                    : null,
                  typeof item.governance?.sourceRefs?.length === 'number'
                    ? `${item.governance.sourceRefs.length} ${t('rap.outputs.preview.sourcesShort', 'sources')}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t('rap.outputs.preview.artifactId', 'Artifact ID')}:{' '}
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {item.artifactId || '—'}
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t('rap.outputs.preview.executionRunId', 'Execution run')}:{' '}
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {item.governance?.executionRunId || '—'}
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t('rap.outputs.preview.exports', 'Exports')}:{' '}
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {item.exportFormats.length ? item.exportFormats.join(', ').toUpperCase() : '—'}
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t('rap.outputs.preview.exportTrace', 'Export trace')}:{' '}
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {item.governance?.exportHistory?.length
                  ? `${item.governance.exportHistory.length} · ${formatLabel(item.governance.exportHistory[0]?.status)}`
                  : '—'}
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t('rap.outputs.preview.accessControl', 'Access control')}:{' '}
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {typeof item.governance?.canManageAccess === 'boolean'
                  ? item.governance.canManageAccess
                    ? t('rap.outputs.preview.canManageAccess', 'Can manage')
                    : t('rap.outputs.preview.readOnly', 'Read only')
                  : '—'}
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t('rap.outputs.preview.trustBoundary', 'Trust boundary')}:{' '}
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {`${t('rap.outputs.preview.executionAuthority', 'Execution')}: ${formatLabel(item.governance?.executionAuthority)} · ${t('rap.outputs.preview.reviewAuthority', 'Review')}: ${formatLabel(item.governance?.reviewAuthority)}`}
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t('rap.outputs.preview.validationChecks', 'Validation checks')}:{' '}
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {Array.isArray(item.governance?.validationChecks) &&
                item.governance.validationChecks.length > 0
                  ? item.governance.validationChecks
                      .filter((check) => check.status !== 'passed')
                      .map((check) => `${check.id}:${check.status}`)
                      .join(' · ') || t('rap.outputs.preview.validationChecksAllGood', 'all passed')
                  : '—'}
              </span>
            </div>
            {item.kind === 'sheet' ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {t(
                  'rap.outputs.preview.sheetHint',
                  'Governed sheet artifacts use the same registry; authoring and export paths are rolling out in Wave 2.'
                )}
              </p>
            ) : null}
          </div>
        )}
        renderPreviewFooter={(item) => (
          <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-200/70 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={() => openRow(item)}
              className="h-9 px-4 rounded-full text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors"
            >
              {item.kind === 'sheet'
                ? isEnabled('tablePlatformMetadataFirst')
                  ? t('rap.actions.openInWorkspace', 'Open in workspace')
                  : t('rap.actions.exportXlsx', 'Download XLSX')
                : t('rap.actions.open', 'Otwórz')}
            </button>
            {item.artifactId ? (
              <button
                type="button"
                disabled={
                  item.governance?.validationState === 'pending' ||
                  item.governance?.validationState === 'attention_required' ||
                  (!!item.governance?.publishState &&
                    item.governance.publishState !== 'private_draft')
                }
                onClick={async () => {
                  const aid = item.artifactId;
                  if (!aid) return;
                  const ok = await actions.startArtifactReview(aid);
                  if (ok) onRefresh();
                }}
                className="h-9 px-4 rounded-full text-sm font-medium border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('rap.actions.startReview', 'Start review')}
              </button>
            ) : null}
          </div>
        )}
      >
        <FilterableTable
          columns={columns}
          data={filteredData}
          selectedRowId={selectedId}
          onRowClick={(row) => setSelectedId((row as AggregateRow).id)}
          onRowDoubleClick={(row) => openRow(row as AggregateRow)}
          getRowActions={(row) => getRowActions(row as AggregateRow)}
          activeFilters={activeFilters}
          onFilterChange={onFilterChange}
          emptyMessage={t('rap.empty.outputs', 'Brak outputów')}
          canvasClassName="pl-4 pr-1.5 pt-3 pb-4"
        />
      </TableWithPreviewLayout>
    </div>
  );
};

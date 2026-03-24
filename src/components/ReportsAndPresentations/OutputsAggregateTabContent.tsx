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
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { buildMyWorkSheetTableOpenPath } from '@/utils/artifactLinks';
import {
  downloadSheetArtifactXlsx,
  resolveTablePlatformWorkspaceIdForTable,
} from '@/utils/sheetArtifactOpen';

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
        toast.success(
          isPolish ? 'Pobrano arkusz (.xlsx)' : 'Downloaded spreadsheet (.xlsx)'
        );
      } else {
        toast.error(
          isPolish ? 'Nie udało się pobrać arkusza' : 'Could not download spreadsheet'
        );
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
        onClick: () => actions.exportReportPdf(row.originRecordId),
      });
      base.push({
        id: 'archive',
        label: t('rap.actions.delete', 'Usuń'),
        icon: Archive,
        divider: true,
        variant: 'danger',
        onClick: async () => {
          const ok = await actions.archiveReport(row.originRecordId);
          if (ok) onRefresh();
        },
      });
    } else if (row.kind === 'presentation') {
      base.push({
        id: 'export',
        label: t('rap.actions.exportPptx', 'Eksportuj PPTX'),
        icon: Download,
        onClick: () => actions.exportDeckPptx(row.originRecordId),
      });
      base.push({
        id: 'archive',
        label: t('rap.actions.delete', 'Usuń'),
        icon: Archive,
        divider: true,
        variant: 'danger',
        onClick: async () => {
          const ok = await actions.archiveDeck(row.originRecordId);
          if (ok) onRefresh();
        },
      });
    }
    return base;
  };

  const selectedItem = selectedId ? filteredData.find((i) => i.id === selectedId) || null : null;
  const itemIds = filteredData.map((i) => i.id);

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
        selectedItem={selectedItem}
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
              {t('rap.outputs.preview.exports', 'Exports')}:{' '}
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {item.exportFormats.length ? item.exportFormats.join(', ').toUpperCase() : '—'}
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
                onClick={async () => {
                  const aid = item.artifactId;
                  if (!aid) return;
                  const ok = await actions.startArtifactReview(aid);
                  if (ok) onRefresh();
                }}
                className="h-9 px-4 rounded-full text-sm font-medium border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
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

/**
 * ReportsTabContent — "Raporty" tab
 * Golden standard: FilterableTable (7 columns) + GridView cards + Preview pane
 * Connected to /api/report-builder backend
 */

import { Archive, Download, ExternalLink, FileText, Loader2, Share2 } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

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
import { ReportPreviewBody, ReportPreviewFooter } from './previews/ReportPreview';
import { REPORT_STATUS_META, REPORT_TYPE_META, type ReportItem } from './types';
import type { useRapActions } from './useRapData';

interface ReportsTabContentProps {
  viewMode: ViewMode;
  searchQuery: string;
  activeFilters: FilterChip[];
  onFilterChange: (filters: FilterChip[]) => void;
  reports: ReportItem[];
  loading: boolean;
  error?: string | null;
  onRefresh: () => void;
  actions: ReturnType<typeof useRapActions>;
}

export const ReportsTabContent: React.FC<ReportsTabContentProps> = ({
  viewMode,
  searchQuery,
  activeFilters,
  onFilterChange,
  reports,
  loading,
  error,
  onRefresh,
  actions,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedGovernance, setSelectedGovernance] = useState<ReportItem['governance'] | null>(null);
  const [reviewBusyArtifactId, setReviewBusyArtifactId] = useState<string | null>(null);

  const filteredData = useMemo(() => {
    let data = reports;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter((item) => item.title.toLowerCase().includes(q));
    }
    for (const f of activeFilters) {
      if (f.column === 'reportType') data = data.filter((item) => item.reportType === f.value);
      if (f.column === 'status') data = data.filter((item) => item.status === f.value);
    }
    return data;
  }, [reports, searchQuery, activeFilters]);

  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'title',
        label: t('rap.columns.title', 'Tytuł'),
        width: '280px',
        render: (row: ReportItem) => {
          const meta = REPORT_TYPE_META[row.reportType] || REPORT_TYPE_META.custom;
          return (
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${meta.color} bg-current/10`}
              >
                {row.reportType}
              </span>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                {row.title}
              </span>
            </div>
          );
        },
      },
      {
        id: 'reportType',
        label: t('rap.columns.reportType', 'Typ'),
        width: '130px',
        filterable: true,
        filterOptions: [
          { value: 'R1', label: 'R1 — Weekly', color: 'bg-blue-400' },
          { value: 'R2', label: 'R2 — Steering', color: 'bg-purple-400' },
          { value: 'R3', label: 'R3 — Benefits', color: 'bg-emerald-400' },
          { value: 'R4', label: 'R4 — Portfolio', color: 'bg-amber-400' },
          { value: 'custom', label: 'Custom', color: 'bg-slate-400' },
        ],
        render: (row: ReportItem) => {
          const meta = REPORT_TYPE_META[row.reportType] || REPORT_TYPE_META.custom;
          return (
            <span className={`text-xs font-medium ${meta.color}`}>
              {isPolish ? meta.labelPl : meta.label}
            </span>
          );
        },
      },
      {
        id: 'status',
        label: t('rap.columns.status', 'Status'),
        width: '120px',
        filterable: true,
        filterOptions: [
          { value: 'draft', label: isPolish ? 'Szkic' : 'Draft', color: 'bg-slate-400' },
          { value: 'ready', label: isPolish ? 'Gotowy' : 'Ready', color: 'bg-emerald-400' },
          {
            value: 'exported',
            label: isPolish ? 'Wyeksportowany' : 'Exported',
            color: 'bg-blue-400',
          },
          {
            value: 'archived',
            label: isPolish ? 'Zarchiwizowany' : 'Archived',
            color: 'bg-slate-500',
          },
        ],
        render: (row: ReportItem) => {
          const meta = REPORT_STATUS_META[row.status] || REPORT_STATUS_META.draft;
          return (
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-500/10">
              <span className={`w-2 h-2 rounded-full ${meta.dotColor}`} />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                {isPolish ? meta.labelPl : meta.label}
              </span>
            </div>
          );
        },
      },
      {
        id: 'owner',
        label: t('rap.columns.owner', 'Właściciel'),
        width: '160px',
      },
      {
        id: 'period',
        label: t('rap.columns.period', 'Okres'),
        width: '160px',
        render: (row: ReportItem) => {
          if (!row.periodFrom) return <span className="text-sm text-slate-400">—</span>;
          const from = new Date(row.periodFrom).toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
            day: 'numeric',
            month: 'short',
          });
          const to = row.periodTo
            ? new Date(row.periodTo).toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
            : '...';
          return (
            <span className="text-sm text-slate-600 dark:text-slate-300">
              {from} — {to}
            </span>
          );
        },
      },
      {
        id: 'createdAt',
        label: t('rap.columns.date', 'Data'),
        width: '130px',
        sortable: true,
        render: (row: ReportItem) => {
          const d = new Date(row.createdAt);
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
      {
        id: 'exportFormats',
        label: t('rap.columns.exports', 'Eksporty'),
        width: '140px',
        render: (row: ReportItem) => {
          if (!row.exportFormats?.length) return <span className="text-sm text-slate-400">—</span>;
          return (
            <div className="flex items-center gap-1">
              {row.exportFormats.map((fmt) => (
                <span
                  key={fmt}
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300"
                >
                  {fmt}
                </span>
              ))}
            </div>
          );
        },
      },
    ],
    [t, isPolish]
  );

  const getRowActions = (row: ReportItem): RowAction[] => [
    {
      id: 'open',
      label: t('rap.actions.open', 'Otwórz'),
      icon: ExternalLink,
      variant: 'primary',
      onClick: () => navigate(`/reports/builder/${row.id}`),
    },
    {
      id: 'export',
      label: t('rap.actions.exportPdf', 'Eksportuj PDF'),
      icon: Download,
      onClick: () => actions.exportReportPdf(row),
    },
    {
      id: 'share',
      label: t('rap.actions.share', 'Udostępnij'),
      icon: Share2,
      onClick: () => navigate(`/reports/builder/${row.id}?action=share`),
    },
    {
      id: 'archive',
      label: t('rap.actions.delete', 'Usuń'),
      icon: Archive,
      divider: true,
      variant: 'danger',
      onClick: async () => {
        const ok = await actions.archiveReport(row);
        if (ok) onRefresh();
      },
    },
  ];

  const selectedItem = selectedId ? filteredData.find((i) => i.id === selectedId) || null : null;
  const previewItem = selectedItem
    ? {
        ...selectedItem,
        title: selectedItem.title,
        governance: selectedGovernance || selectedItem.governance,
      }
    : null;
  const itemIds = filteredData.map((i) => i.id);
  const reviewDisabled =
    !previewItem?.artifactId ||
    reviewBusyArtifactId === previewItem?.artifactId ||
    (!!previewItem?.governance?.publishState &&
      previewItem.governance.publishState !== 'private_draft');

  useEffect(() => {
    let isMounted = true;
    setSelectedGovernance(selectedItem?.governance || null);

    async function fetchGovernance() {
      if (!selectedItem?.artifactId) {
        setSelectedGovernance(selectedItem?.governance || null);
        return;
      }

      try {
        const res = await fetch(`${API_URL}/artifacts/${selectedItem.artifactId}/access`, {
          headers: getHeaders(),
        });
        if (!res.ok) {
          if (isMounted) setSelectedGovernance(selectedItem.governance || null);
          return;
        }
        const data = await res.json();
        if (!isMounted) return;
        setSelectedGovernance({
          ...(selectedItem.governance || {}),
          visibilityScope: data.visibilityScope,
          publishState: data.publishState,
          publishReviewers: Array.isArray(data.reviewers) ? data.reviewers : [],
          projectId: data.projectId || null,
          accessGrants: Array.isArray(data.accessGrants) ? data.accessGrants : [],
          originLinks: Array.isArray(data.originLinks) ? data.originLinks : [],
        });
      } catch {
        if (isMounted) setSelectedGovernance(selectedItem.governance || null);
      }
    }

    void fetchGovernance();
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

  if (error && reports.length === 0 && !searchQuery && activeFilters.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="w-full max-w-3xl rounded-2xl border border-amber-200/70 dark:border-amber-400/20 bg-amber-50/80 dark:bg-amber-500/10 p-6">
          <div className="text-lg font-semibold text-slate-900 dark:text-white">
            {t('rap.errors.realReportsTitle', 'Real reports source needs attention')}
          </div>
          <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">{error}</div>
          <div className="mt-4 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t(
              'rap.errors.realSourceHint',
              'No synthetic demo fallback was injected. Verify active DB, organization scope, and data-context before retrying.'
            )}
          </div>
        </div>
      </div>
    );
  }

  if (reports.length === 0 && !searchQuery && activeFilters.length === 0) {
    const canon = [
      ['R1', isPolish ? 'Weekly Execution' : 'Weekly Execution'],
      ['R2', isPolish ? 'Steering Committee' : 'Steering Committee'],
      ['R3', isPolish ? 'Benefits Tracking' : 'Benefits Tracking'],
      ['R4', isPolish ? 'Portfolio Overview' : 'Portfolio Overview'],
    ];

    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="w-full max-w-4xl rounded-2xl border border-slate-200/70 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.04] p-6">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-300">
              <FileText size={20} />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-semibold text-slate-900 dark:text-white">
                {t('rap.empty.reportsTitle', 'Canonical management reports')}
              </div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {t(
                  'rap.empty.reportsBody',
                  'This library is organized around the V3 report canon. Start from one of the four sponsor-ready report types below.'
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
            {canon.map(([code, label]) => (
              <div
                key={code}
                className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-slate-50/80 dark:bg-white/[0.03] p-4"
              >
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {code}
                </div>
                <div className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                  {label}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t(
              'rap.empty.reportsHint',
              'Use the topbar quick chips or create a new report to enter R1, R2, R3, or R4 flow.'
            )}
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === 'grid') {
    const gridItems: GridItem[] = filteredData.map((item) => ({
      id: item.id,
      name: item.title,
      type: item.reportType,
      typeColor: item.reportType === 'custom' ? 'operational' : 'strategic',
      status: item.status.toUpperCase(),
      progress: 0,
      updatedAt: item.updatedAt,
      owner: item.owner,
    }));

    return (
      <GridView
        items={gridItems}
        selectedItemId={selectedId}
        onItemClick={(item) => setSelectedId(item.id)}
        emptyMessage={t('rap.empty.reports', 'Brak raportów')}
        newItemLabel={t('rap.actions.newReport', 'Nowy raport')}
      />
    );
  }

  return (
    <div className="h-full overflow-hidden">
      <TableWithPreviewLayout<ReportItem & { title: string }>
        selectedId={selectedId}
        selectedItem={previewItem}
        onSelect={setSelectedId}
        itemIds={itemIds}
        getItemById={(id) => filteredData.find((x) => x.id === id) ?? null}
        renderPreview={(item) => (
          <ReportPreviewBody
            report={item}
          />
        )}
        renderPreviewFooter={(item) => (
          <ReportPreviewFooter
            report={item}
            onStartReview={
              item.artifactId
                ? async () => {
                    const aid = item.artifactId as string;
                    setReviewBusyArtifactId(aid);
                    const ok = await actions.startArtifactReview(aid);
                    setReviewBusyArtifactId(null);
                    if (ok) onRefresh();
                  }
                : undefined
            }
            reviewActionDisabled={item.id === previewItem?.id ? reviewDisabled : !item.artifactId}
            onOpen={() => navigate(`/reports/builder/${item.id}`)}
            onExport={() => actions.exportReportPdf(item)}
          />
        )}
      >
        <FilterableTable
          columns={columns}
          data={filteredData}
          selectedRowId={selectedId}
          onRowClick={(row) => setSelectedId(row.id)}
          onRowDoubleClick={(row) => navigate(`/reports/builder/${row.id}`)}
          getRowActions={(row) => getRowActions(row as unknown as ReportItem)}
          activeFilters={activeFilters}
          onFilterChange={onFilterChange}
          emptyMessage={t('rap.empty.reports', 'Brak raportów')}
          canvasClassName="pl-4 pr-1.5 pt-3 pb-4"
        />
      </TableWithPreviewLayout>
    </div>
  );
};

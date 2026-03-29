/**
 * PresentationsTabContent — "Prezentacje" tab
 * Golden standard: FilterableTable (6 columns) + GridView cards + Preview pane
 * Connected to /api/presentations/decks backend
 */

import { Archive, Download, Edit, ExternalLink, Loader2, Share2 } from 'lucide-react';
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
import { PresentationPreviewBody, PresentationPreviewFooter } from './previews/PresentationPreview';
import { PRESENTATION_STATUS_META, type PresentationItem, SOURCE_TYPE_META } from './types';
import type { useRapActions } from './useRapData';

interface PresentationsTabContentProps {
  viewMode: ViewMode;
  searchQuery: string;
  activeFilters: FilterChip[];
  onFilterChange: (filters: FilterChip[]) => void;
  presentations: PresentationItem[];
  loading: boolean;
  error?: string | null;
  onRefresh: () => void;
  actions: ReturnType<typeof useRapActions>;
}

export const PresentationsTabContent: React.FC<PresentationsTabContentProps> = ({
  viewMode,
  searchQuery,
  activeFilters,
  onFilterChange,
  presentations,
  loading,
  error,
  onRefresh,
  actions,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedGovernance, setSelectedGovernance] = useState<
    PresentationItem['governance'] | null
  >(null);
  const [reviewBusyArtifactId, setReviewBusyArtifactId] = useState<string | null>(null);

  const filteredData = useMemo(() => {
    let data = presentations;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter((item) => item.title.toLowerCase().includes(q));
    }
    for (const f of activeFilters) {
      if (f.column === 'sourceType') data = data.filter((item) => item.sourceType === f.value);
      if (f.column === 'status') data = data.filter((item) => item.status === f.value);
      if (f.column === 'presentationMode')
        data = data.filter((item) => (item.presentationMode || 'briefing') === f.value);
    }
    return data;
  }, [presentations, searchQuery, activeFilters]);

  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'title',
        label: t('rap.columns.title', 'Tytuł'),
        width: '300px',
        render: (row: PresentationItem) => (
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-6 rounded bg-gradient-to-br from-slate-200 to-slate-300 dark:from-navy-700 dark:to-navy-600 shrink-0 flex items-center justify-center">
              <span className="text-[8px] font-bold text-slate-500 dark:text-slate-400">PPT</span>
            </div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
              {row.title}
            </span>
          </div>
        ),
      },
      {
        id: 'sourceType',
        label: t('rap.columns.source', 'Źródło'),
        width: '130px',
        filterable: true,
        filterOptions: [
          { value: 'tool', label: isPolish ? 'Narzędzie' : 'Tool', color: 'bg-emerald-400' },
          { value: 'assessment', label: isPolish ? 'Ocena' : 'Assessment', color: 'bg-purple-400' },
          { value: 'finance', label: isPolish ? 'Finanse' : 'Finance', color: 'bg-blue-400' },
          { value: 'upload', label: isPolish ? 'Przesłane' : 'Upload', color: 'bg-amber-400' },
        ],
        render: (row: PresentationItem) => {
          const meta = SOURCE_TYPE_META[row.sourceType] || SOURCE_TYPE_META.tool;
          return (
            <span className={`text-xs font-medium ${meta.color}`}>
              {isPolish ? meta.labelPl : meta.label}
            </span>
          );
        },
      },
      {
        id: 'owner',
        label: t('rap.columns.owner', 'Właściciel'),
        width: '160px',
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
          { value: 'ready', label: isPolish ? 'Gotowa' : 'Ready', color: 'bg-emerald-400' },
          { value: 'shared', label: isPolish ? 'Udostępniona' : 'Shared', color: 'bg-purple-400' },
          {
            value: 'archived',
            label: isPolish ? 'Zarchiwizowana' : 'Archived',
            color: 'bg-slate-500',
          },
        ],
        render: (row: PresentationItem) => {
          const meta = PRESENTATION_STATUS_META[row.status] || PRESENTATION_STATUS_META.draft;
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
        id: 'presentationMode',
        label: t('rap.columns.mode', 'Tryb'),
        width: '120px',
        filterable: true,
        filterOptions: [
          { value: 'show', label: 'Show', color: 'bg-blue-400' },
          { value: 'document', label: 'Document', color: 'bg-emerald-400' },
          { value: 'briefing', label: 'Briefing', color: 'bg-amber-400' },
          { value: 'workshop', label: 'Workshop', color: 'bg-purple-400' },
        ],
        render: (row: PresentationItem) => (
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300 capitalize">
            {row.presentationMode || 'briefing'}
          </span>
        ),
      },
      {
        id: 'createdAt',
        label: t('rap.columns.date', 'Data'),
        width: '130px',
        sortable: true,
        render: (row: PresentationItem) => {
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
        id: 'slideCount',
        label: t('rap.columns.slides', 'Slajdy'),
        width: '90px',
        render: (row: PresentationItem) => (
          <span className="text-sm text-slate-600 dark:text-slate-300">{row.slideCount}</span>
        ),
      },
    ],
    [t, isPolish]
  );

  const getRowActions = (row: PresentationItem): RowAction[] => [
    {
      id: 'open',
      label: t('rap.actions.open', 'Otwórz'),
      icon: ExternalLink,
      variant: 'primary',
      onClick: () => navigate(`/presentations/builder/${row.id}`),
    },
    {
      id: 'export',
      label: t('rap.actions.exportPptx', 'Eksportuj PPTX'),
      icon: Download,
      onClick: () => actions.exportDeckPptx(row),
    },
    {
      id: 'share',
      label: t('rap.actions.share', 'Udostępnij'),
      icon: Share2,
      onClick: () => navigate(`/presentations/builder/${row.id}?action=share`),
    },
    {
      id: 'rename',
      label: t('rap.actions.rename', 'Zmień nazwę'),
      icon: Edit,
      onClick: () => navigate(`/presentations/builder/${row.id}?action=rename`),
    },
    {
      id: 'archive',
      label: t('rap.actions.delete', 'Usuń'),
      icon: Archive,
      divider: true,
      variant: 'danger',
      onClick: async () => {
        const ok = await actions.archiveDeck(row);
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
    (!!previewItem?.governance?.validationState &&
      previewItem.governance.validationState !== 'validated') ||
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

  if (error && presentations.length === 0 && !searchQuery && activeFilters.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="w-full max-w-3xl rounded-2xl border border-amber-200/70 dark:border-amber-400/20 bg-amber-50/80 dark:bg-amber-500/10 p-6">
          <div className="text-lg font-semibold text-slate-900 dark:text-white">
            {t('rap.errors.realPresentationsTitle', 'Real presentations source needs attention')}
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

  if (viewMode === 'grid') {
    const gridItems: GridItem[] = filteredData.map((item) => ({
      id: item.id,
      name: item.title,
      type: item.sourceType,
      typeColor:
        item.sourceType === 'tool'
          ? 'strategic'
          : item.sourceType === 'assessment'
            ? 'digital'
            : 'operational',
      status: item.status.toUpperCase(),
      progress: 0,
      updatedAt: item.updatedAt,
      description: `${item.slideCount} ${isPolish ? 'slajdów' : 'slides'}`,
      owner: item.owner,
    }));

    return (
      <GridView
        items={gridItems}
        selectedItemId={selectedId}
        onItemClick={(item) => setSelectedId(item.id)}
        emptyMessage={t('rap.empty.presentations', 'Brak prezentacji')}
        newItemLabel={t('rap.actions.newPresentation', 'Nowa prezentacja')}
      />
    );
  }

  return (
    <div className="h-full overflow-hidden">
      <TableWithPreviewLayout<PresentationItem & { title: string }>
        selectedId={selectedId}
        selectedItem={previewItem}
        onSelect={setSelectedId}
        itemIds={itemIds}
        getItemById={(id) => filteredData.find((x) => x.id === id) ?? null}
        renderPreview={(item) => <PresentationPreviewBody presentation={item} />}
        renderPreviewFooter={(item) => (
          <PresentationPreviewFooter
            presentation={item}
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
            onOpen={() => navigate(`/presentations/builder/${item.id}`)}
            onExport={() => {
              actions.exportDeckPptx(item);
            }}
          />
        )}
      >
        <FilterableTable
          columns={columns}
          data={filteredData}
          selectedRowId={selectedId}
          onRowClick={(row) => setSelectedId(row.id)}
          onRowDoubleClick={(row) => navigate(`/presentations/builder/${row.id}`)}
          getRowActions={(row) => getRowActions(row as unknown as PresentationItem)}
          activeFilters={activeFilters}
          onFilterChange={onFilterChange}
          emptyMessage={t('rap.empty.presentations', 'Brak prezentacji')}
          canvasClassName="pl-4 pr-1.5 pt-3 pb-4"
        />
      </TableWithPreviewLayout>
    </div>
  );
};

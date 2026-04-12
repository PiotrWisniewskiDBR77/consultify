/**
 * OutputsAggregateTabContent — All | Mine | Needs review
 * Single registry-backed list (GET /api/artifacts with view=mine|review).
 */

import {
  Archive,
  BookTemplate,
  CheckCircle2,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Loader2,
  MessageCircle,
  Presentation,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useFeatureFlagsContext } from '@/contexts/FeatureFlagsContext';
import { useOpenChatWithContext } from '@/hooks/useOpenChatWithContext';
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
import { resolveArtifactOpenPath } from './artifactNavigation';
import { TrustStatePreviewSection } from './TrustStatePreviewSection';
import type { ArtifactGovernanceSummary, UnifiedOutputRow } from './types';
import type { useRapActions } from './useRapData';
import { useTrustState } from './useTrustState';

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

function collectSearchTokens(
  row: UnifiedOutputRow,
  t: (key: string, fallback?: string) => string
): string[] {
  return [
    row.title,
    row.owner,
    row.statusKey,
    row.kind,
    row.sourceType,
    row.sourceInitiativeId,
    row.governance?.visibilityScope,
    row.governance?.publishState,
    row.governance?.canonicalHome,
    row.governance?.authority,
    formatSourceSummary(row, t),
    formatReviewSummary(row, t),
    row.exportFormats.join(' '),
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
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
  initialArtifactId?: string | null;
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
  initialArtifactId,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const navigate = useNavigate();
  const { isEnabled } = useFeatureFlagsContext();
  const openChatWithContext = useOpenChatWithContext();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const deepLinkConsumed = useRef(false);
  // selectedGovernance is provided by useTrustState hook below
  const [lineageOpen, setLineageOpen] = useState(false);
  const [lineageLoading, setLineageLoading] = useState(false);
  const [lineageError, setLineageError] = useState<string | null>(null);
  const [lineageRunId, setLineageRunId] = useState<string | null>(null);
  const [lineageRun, setLineageRun] = useState<any | null>(null);
  const [lineageToolUsage, setLineageToolUsage] = useState<any | null>(null);
  const [lineageOutputs, setLineageOutputs] = useState<any[] | null>(null);
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

  const resetLineage = useCallback(() => {
    setLineageLoading(false);
    setLineageError(null);
    setLineageRunId(null);
    setLineageRun(null);
    setLineageToolUsage(null);
    setLineageOutputs(null);
  }, []);

  const openLineage = useCallback(
    async (params: { executionRunId: string; lineagePaths?: ArtifactGovernanceSummary['lineagePaths'] }) => {
      const runId = String(params.executionRunId || '').trim();
      if (!runId) return;

      const lineagePaths = params.lineagePaths || null;
      const runPath = String(lineagePaths?.runPath || `/v8/execution/runs/${runId}`);
      const toolUsagePath = String(
        lineagePaths?.toolUsagePath || `/v8/execution/runs/${runId}/tool-usage`
      );
      const outputsPath = String(lineagePaths?.outputsPath || `/v8/execution/runs/${runId}/outputs`);

      setLineageOpen(true);
      setLineageLoading(true);
      setLineageError(null);
      setLineageRunId(runId);
      setLineageRun(null);
      setLineageToolUsage(null);
      setLineageOutputs(null);

      try {
        const [runRes, toolRes, outputsRes] = await Promise.all([
          fetch(`${API_URL}${runPath}`, { headers: getHeaders() }),
          fetch(`${API_URL}${toolUsagePath}`, { headers: getHeaders() }),
          fetch(`${API_URL}${outputsPath}?limit=50`, { headers: getHeaders() }),
        ]);

        const runJson = runRes.ok ? await runRes.json() : null;
        const toolJson = toolRes.ok ? await toolRes.json() : null;
        const outputsJson = outputsRes.ok ? await outputsRes.json() : null;

        setLineageRun(runJson?.data || null);
        setLineageToolUsage(toolJson?.data || null);
        setLineageOutputs(Array.isArray(outputsJson?.data) ? outputsJson.data : []);

        if (!runRes.ok || !toolRes.ok || !outputsRes.ok) {
          setLineageError(
            t('rap.outputs.preview.lineageLoadFailed', 'Could not load full lineage for this run')
          );
        }
      } catch {
        setLineageError(t('rap.outputs.preview.lineageLoadFailed', 'Could not load full lineage for this run'));
      } finally {
        setLineageLoading(false);
      }
    },
    [t]
  );

  const tableRows: AggregateRow[] = useMemo(
    () => rows.map((r) => ({ ...r, id: rowKey(r), title: r.title })),
    [rows]
  );

  const filteredData = useMemo(() => {
    let data = tableRows;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter((item) => collectSearchTokens(item, translate).some((token) => token.includes(q)));
    }
    for (const f of activeFilters) {
      if (f.column === 'outputKind') data = data.filter((item) => item.kind === f.value);
      if (f.column === 'status') data = data.filter((item) => item.statusKey === f.value);
      if (f.column === 'visibilityScope') {
        data = data.filter((item) => (item.governance?.visibilityScope || '') === f.value);
      }
      if (f.column === 'publishState') {
        data = data.filter((item) => (item.governance?.publishState || '') === f.value);
      }
    }
    return data;
  }, [tableRows, searchQuery, activeFilters, translate]);

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
    const openPath = resolveArtifactOpenPath({
      kind: row.kind,
      originRecordId: row.originRecordId,
      governance: row.governance,
    });
    if (openPath) {
      navigate(openPath);
      return;
    }
    if (row.kind === 'sheet') void openGovernedSheetRow(row.originRecordId);
  };

  const getRowActions = (row: AggregateRow): RowAction[] => {
    const isTemplateArtifact = Boolean((row.governance?.originSummary as any)?.template);
    const base: RowAction[] = [
      {
        id: 'open',
        label: t('rap.actions.open', 'Otwórz'),
        icon: ExternalLink,
        variant: 'primary',
        onClick: () => openRow(row),
      },
      {
        id: 'discuss',
        label: t('rap.actions.discuss', 'Discuss'),
        icon: MessageCircle,
        onClick: () => {
          void openChatWithContext({
            entityType: row.kind === 'document' ? 'report' : row.kind,
            entityId: row.originRecordId,
            entityName: row.title,
            pmoContext: row.kind === 'document' ? { reportId: row.originRecordId } : undefined,
          });
        },
      },
    ];

    if (!isTemplateArtifact && row.artifactId && (row.kind === 'document' || row.kind === 'presentation')) {
      base.push({
        id: 'save_as_template',
        label: t('rap.actions.saveAsTemplate', 'Save as template'),
        icon: BookTemplate,
        onClick: async () => {
          const aid = row.artifactId;
          if (!aid) return;

          const defaultName = `${row.title} Template`;
          const name = window.prompt(
            isPolish ? 'Nazwa nowego wzorca:' : 'New template name:',
            defaultName
          );
          if (!name?.trim()) return;
          const description = window.prompt(
            isPolish ? 'Opis (opcjonalnie):' : 'Description (optional):',
            ''
          );
          const scopeIsOrg = window.confirm(
            isPolish
              ? 'Czy to ma być wzorzec organizacji (wymaga review)?'
              : 'Should this be an organization template (requires review)?'
          );

          try {
            const res = await fetch(`${API_URL}/artifacts/${aid}/save-as-template`, {
              method: 'POST',
              headers: { ...getHeaders(), 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: name.trim(),
                description: String(description || '').trim(),
                scope: scopeIsOrg ? 'org' : 'user',
              }),
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(String(err?.error || 'Failed to save template'));
            }
            toast.success(isPolish ? 'Zapisano jako wzorzec' : 'Saved as template');
            navigate('/presentations?tab=templates');
          } catch (e: any) {
            toast.error(e?.message ? String(e.message) : isPolish ? 'Błąd zapisu wzorca' : 'Failed');
          }
        },
      });
    }

    if (
      isTemplateArtifact &&
      row.artifactId &&
      row.governance?.visibilityScope === 'review_shared' &&
      (row.governance?.publishState === 'reviewable_share' || row.governance?.publishState === 'in_review')
    ) {
      base.push({
        id: 'approve_template',
        label: t('rap.actions.approveTemplate', 'Approve & publish'),
        icon: CheckCircle2,
        variant: 'primary',
        onClick: async () => {
          try {
            const res = await fetch(`${API_URL}/artifacts/${row.artifactId}/publish`, {
              method: 'POST',
              headers: { ...getHeaders(), 'Content-Type': 'application/json' },
              body: JSON.stringify({ reviewType: 'peer_review' }),
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(String(err?.error || 'Publish failed'));
            }
            toast.success(isPolish ? 'Opublikowano' : 'Published');
            onRefresh();
          } catch (e: any) {
            toast.error(e?.message ? String(e.message) : isPolish ? 'Błąd publikacji' : 'Publish failed');
          }
        },
      });
    }

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

  useEffect(() => {
    if (!initialArtifactId || deepLinkConsumed.current || filteredData.length === 0) return;
    const match = filteredData.find((r) => r.artifactId === initialArtifactId);
    if (match) {
      setSelectedId(match.id);
      deepLinkConsumed.current = true;
    }
  }, [initialArtifactId, filteredData]);

  const selectedItem = selectedId ? filteredData.find((i) => i.id === selectedId) || null : null;
  const selectedGovernance = useTrustState(selectedItem?.artifactId, selectedItem?.governance);
  const previewItem = selectedItem
    ? {
        ...selectedItem,
        governance: selectedGovernance || selectedItem.governance,
      }
    : null;
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
      <Dialog
        open={lineageOpen}
        onOpenChange={(open) => {
          setLineageOpen(open);
          if (!open) resetLineage();
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('rap.outputs.preview.lineageTitle', 'Run lineage')}</DialogTitle>
            <DialogDescription>
              {t('rap.outputs.preview.lineageRunId', 'Execution run')}: {lineageRunId || '—'}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 space-y-3 text-sm text-slate-700 dark:text-slate-200">
            {lineageLoading ? (
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <Loader2 size={16} className="animate-spin" />
                {t('rap.outputs.preview.lineageLoading', 'Loading lineage…')}
              </div>
            ) : null}
            {lineageError ? (
              <div className="rounded-lg border border-amber-200/70 bg-amber-50/70 p-3 text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-100">
                {lineageError}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200/70 bg-white/60 p-3 dark:border-slate-700/70 dark:bg-slate-900/30">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {t('rap.outputs.preview.lineageRun', 'Run')}
                </div>
                <div className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                  {formatLabel(lineageRun?.state || lineageRun?.runState || lineageRun?.status)}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {t('rap.outputs.preview.lineageCreatedAt', 'Created')}:{' '}
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {String(lineageRun?.createdAt || lineageRun?.created_at || '—')}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200/70 bg-white/60 p-3 dark:border-slate-700/70 dark:bg-slate-900/30">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {t('rap.outputs.preview.lineageToolCalls', 'Tool calls')}
                </div>
                <div className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                  {Array.isArray(lineageToolUsage?.invocations)
                    ? lineageToolUsage.invocations.length
                    : 0}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {t('rap.outputs.preview.lineageTraces', 'Traces')}:{' '}
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {Array.isArray(lineageToolUsage?.traces) ? lineageToolUsage.traces.length : 0}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200/70 bg-white/60 p-3 dark:border-slate-700/70 dark:bg-slate-900/30">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {t('rap.outputs.preview.lineageOutputs', 'Outputs')}
                </div>
                <div className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                  {Array.isArray(lineageOutputs) ? lineageOutputs.length : 0}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {t('rap.outputs.preview.lineageVisibility', 'Visibility enforced')}
                </div>
              </div>
            </div>

            {Array.isArray(lineageToolUsage?.invocations) && lineageToolUsage.invocations.length ? (
              <div className="rounded-lg border border-slate-200/70 p-3 dark:border-slate-700/70">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {t('rap.outputs.preview.lineageToolCallsList', 'Tool calls')}
                </div>
                <div className="mt-2 space-y-2">
                  {lineageToolUsage.invocations.slice(0, 8).map((inv: any, idx: number) => (
                    <div
                      key={String(inv.invocationId || inv.id || idx)}
                      className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:bg-slate-900/40 dark:text-slate-200"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {String(inv.toolName || inv.tool || inv.name || 'tool')}
                        </div>
                        <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                          {String(inv.createdAt || inv.created_at || inv.timestamp || '')}
                        </div>
                      </div>
                      <div className="ml-3 shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
                        {formatLabel(inv.status || inv.resultStatus || inv.state)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {Array.isArray(lineageOutputs) && lineageOutputs.length ? (
              <div className="rounded-lg border border-slate-200/70 p-3 dark:border-slate-700/70">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {t('rap.outputs.preview.lineageOutputsList', 'Output pointers')}
                </div>
                <div className="mt-2 space-y-2">
                  {lineageOutputs.slice(0, 12).map((out: any, idx: number) => {
                    const originRecordId = String(out.originRecordId || '').trim();
                    const outputType = String(out.outputType || '').trim();
                    const kind =
                      outputType === 'presentation'
                        ? 'presentation'
                        : outputType === 'sheet'
                          ? 'sheet'
                          : 'document';
                    const openPath =
                      kind === 'sheet' || !originRecordId
                        ? null
                        : resolveArtifactOpenPath({ kind, originRecordId, governance: null });

                    return (
                      <div
                        key={String(out.artifactId || out.originRecordId || idx)}
                        className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:bg-slate-900/40 dark:text-slate-200"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium">
                            {String(out.resolvedTitle || out.titleSnapshot || out.originTitle || 'Output')}
                          </div>
                          <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                            {String(out.artifactFamily || out.outputType || out.originRuntime || '—')} ·{' '}
                            {String(out.visibilityScope || '—')}
                          </div>
                        </div>
                        <div className="ml-3 shrink-0">
                          {kind === 'sheet' && originRecordId ? (
                            <button
                              type="button"
                              onClick={() => void openGovernedSheetRow(originRecordId)}
                              className="rounded-md border border-slate-200/70 bg-white/60 px-2 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-white dark:border-slate-700/70 dark:bg-slate-900/40 dark:text-slate-200 dark:hover:bg-slate-900"
                            >
                              {t('rap.outputs.preview.download', 'Download')}
                            </button>
                          ) : openPath ? (
                            <button
                              type="button"
                              onClick={() => navigate(openPath)}
                              className="rounded-md border border-slate-200/70 bg-white/60 px-2 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-white dark:border-slate-700/70 dark:bg-slate-900/40 dark:text-slate-200 dark:hover:bg-slate-900"
                            >
                              {t('rap.outputs.preview.open', 'Open')}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <TableWithPreviewLayout<AggregateRow>
        selectedId={selectedId}
        selectedItem={previewItem}
        onSelect={setSelectedId}
        onOpenFull={(id) => {
          const row = filteredData.find((x) => x.id === id);
          if (row) openRow(row);
        }}
        itemIds={itemIds}
        getItemById={(id) => filteredData.find((x) => x.id === id) ?? null}
        renderPreview={(item) => (
          <div className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {item.kind === 'document'
                ? t('rap.outputs.kind.document', 'Document')
                : item.kind === 'presentation'
                  ? t('rap.outputs.kind.presentation', 'Presentation')
                  : t('rap.outputs.kind.sheet', 'Sheet')}
            </div>
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
            <TrustStatePreviewSection
              governance={item.governance}
              artifactId={item.artifactId}
              exportFormats={item.exportFormats}
              onTrace={openLineage}
            />
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
          <div className="flex items-center gap-2">
            {item.kind === 'sheet' ? (
              <button
                type="button"
                onClick={() => openRow(item)}
                className="h-9 px-4 rounded-full text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors"
              >
                {isEnabled('tablePlatformMetadataFirst')
                  ? t('rap.actions.openInWorkspace', 'Open in workspace')
                  : t('rap.actions.exportXlsx', 'Download XLSX')}
              </button>
            ) : null}
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

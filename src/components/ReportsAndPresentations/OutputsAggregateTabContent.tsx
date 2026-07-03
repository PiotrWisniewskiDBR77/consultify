/**
 * OutputsAggregateTabContent — All | Mine | Needs review
 * Single registry-backed list (GET /api/artifacts with view=mine|review).
 */

import {
  Archive,
  BookTemplate,
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Loader2,
  MessageCircle,
  Presentation,
  Sparkles,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LoadingState as SharedLoadingState } from '@/components/shared/states';
import { Button, ErrorState } from '@/components/ui/primitives';
import { EntityStatusChip } from '@/components/ui/primitives/chips';
import { useFeatureFlagsContext } from '@/contexts/FeatureFlagsContext';
import { useOpenChatWithContext } from '@/hooks/useOpenChatWithContext';
import { buildMyWorkSheetTableOpenPath } from '@/utils/artifactLinks';
import {
  downloadSheetArtifactXlsx,
  resolveTablePlatformWorkspaceIdForTable,
} from '@/utils/sheetArtifactOpen';

import { useConfirmDialog } from '@/components/MyWork/shared/ConfirmDialog';

import { API_URL, getHeaders } from '../../services/api';
import {
  type BulkAction,
  BulkActionBar,
  FilterableTable,
  type FilterChip,
  type GridItem,
  GridView,
  type TableColumn,
  useTableSelection,
  type ViewMode,
} from '../shared/ModuleHub';
import type { RowAction } from '../shared/RowActionsMenu';
import { TableWithPreviewLayout } from '../shared/TableWithPreviewLayout';
import { resolveArtifactOpenPath } from './artifactNavigation';
import { duplicateArtifactToCanvasDraft } from './duplicateArtifactToDraft';
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
  /** L-08: registry routes 404 because ENABLE_V8_GLOBAL is OFF → module disabled. */
  moduleDisabled?: boolean;
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
  moduleDisabled = false,
  onRefresh,
  actions,
  initialArtifactId,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const navigate = useNavigate();
  const location = useLocation();
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
        toast.success(t('reports.downloadedSpreadsheetXlsx'));
      } else {
        toast.error(t('reports.couldNotDownloadSpreadsheet'));
      }
    },
    [isEnabled, isPolish, navigate]
  );

  // Teresa touchpoint: open chat pre-seeded with an output-generation goal so a
  // brand-new (empty) Outputs Library has a one-click path to its first artifact.
  const openTeresaForOutput = useCallback(() => {
    openChatWithContext({
      entityType: 'outputs_module',
      entityId: 'outputs_onboarding',
      entityName: t('rap.hub.entityName', 'Reports & Presentations'),
      contextData: {
        intent: 'generate_output',
        goal: t('rap.onboarding.body', 'Generate a report or deck with Teresa'),
        // A11/D3: pre-fill the composer with a real opener so the empty-state
        // CTA is not just "open chat" but "open chat ready to generate."
        teresaPrompt: t('reports.helpMeGenerateTheFirstReport'),
      },
    });
  }, [isPolish, openChatWithContext, t]);

  const resetLineage = useCallback(() => {
    setLineageLoading(false);
    setLineageError(null);
    setLineageRunId(null);
    setLineageRun(null);
    setLineageToolUsage(null);
    setLineageOutputs(null);
  }, []);

  const openLineage = useCallback(
    async (params: {
      executionRunId: string;
      lineagePaths?: ArtifactGovernanceSummary['lineagePaths'];
    }) => {
      const runId = String(params.executionRunId || '').trim();
      if (!runId) return;

      const lineagePaths = params.lineagePaths || null;
      const runPath = String(lineagePaths?.runPath || `/v8/execution/runs/${runId}`);
      const toolUsagePath = String(
        lineagePaths?.toolUsagePath || `/v8/execution/runs/${runId}/tool-usage`
      );
      const outputsPath = String(
        lineagePaths?.outputsPath || `/v8/execution/runs/${runId}/outputs`
      );

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
        setLineageError(
          t('rap.outputs.preview.lineageLoadFailed', 'Could not load full lineage for this run')
        );
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
      data = data.filter((item) =>
        collectSearchTokens(item, translate).some((token) => token.includes(q))
      );
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

  // Localized status label kept stable with the filter dropdown options; the
  // EntityStatusChip owns the colored dot (tone), this only supplies the text.
  const statusLabel = useCallback(
    (statusKey: string | null | undefined): string => {
      const key = String(statusKey || '').trim().toLowerCase();
      const labels: Record<string, [string, string]> = {
        draft: ['Szkic', 'Draft'],
        generated: ['Wygenerowana', 'Generated'],
        editing: ['Edycja', 'Editing'],
        ready: ['Gotowy', 'Ready'],
        exported: ['Wyeksportowany', 'Exported'],
        shared: ['Udostępniony', 'Shared'],
        archived: ['Zarchiwizowany', 'Archived'],
      };
      const pair = labels[key];
      if (pair) return isPolish ? pair[0] : pair[1];
      return formatLabel(statusKey);
    },
    [isPolish]
  );

  const columns: TableColumn[] = useMemo(
    () => [
      // canon §3.5 — leading selection column drives select-all + per-row checkboxes.
      { id: 'select', label: '', type: 'select', width: '44px' },
      {
        id: 'title',
        label: t('rap.columns.title', 'Tytuł'),
        width: '280px',
        render: (row: AggregateRow) => (
          <div className="flex items-center gap-2 min-w-0">
            {/* L-07 (§27): neutral type icons — color is a signal owned by the
                status chip, not ad-hoc icon tints (TABLE_AND_PREVIEW_CANON §4.1). */}
            {row.kind === 'document' ? (
              <FileText size={16} className="shrink-0 text-c-text-muted" />
            ) : row.kind === 'presentation' ? (
              <Presentation size={16} className="shrink-0 text-c-text-muted" />
            ) : (
              <FileSpreadsheet size={16} className="shrink-0 text-c-text-muted" />
            )}
            <span className="text-sm font-medium text-c-text truncate">
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
            color: 'bg-blue-400',
          },
          {
            value: 'sheet',
            label: t('rap.outputs.kind.sheet', 'Sheet'),
            color: 'bg-emerald-400',
          },
        ],
        render: (row: AggregateRow) => (
          <span className="text-xs font-medium text-c-text-secondary capitalize">
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
          { value: 'draft', label: t('reports.draft'), color: 'bg-slate-400' },
          {
            value: 'generated',
            label: t('reports.generated'),
            color: 'bg-blue-400',
          },
          { value: 'editing', label: t('reports.editing'), color: 'bg-amber-400' },
          { value: 'ready', label: t('reports.ready'), color: 'bg-emerald-400' },
          {
            value: 'exported',
            label: t('reports.exported'),
            color: 'bg-blue-400',
          },
          { value: 'shared', label: t('reports.shared'), color: 'bg-blue-400' },
          {
            value: 'archived',
            label: t('reports.archived'),
            color: 'bg-slate-500',
          },
        ],
        // L-07 (§27): canonical EntityStatusChip (semantic dot tone) instead of a
        // raw text/colored-class status. Localized label kept; tone is derived
        // from the raw statusKey by the chip's statusChipTone() mapping.
        render: (row: AggregateRow) => (
          <EntityStatusChip status={row.statusKey} label={statusLabel(row.statusKey)} />
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
          <span className="text-xs text-c-text-secondary">
            {formatLabel(row.governance?.visibilityScope)}
          </span>
        ),
      },
      {
        id: 'source',
        label: t('rap.outputs.columns.source', 'Source'),
        width: '150px',
        render: (row: AggregateRow) => (
          <span className="text-xs text-c-text-secondary">
            {formatSourceSummary(row, translate)}
          </span>
        ),
      },
      {
        id: 'review',
        label: t('rap.outputs.columns.review', 'Review'),
        width: '130px',
        render: (row: AggregateRow) => (
          <span className="text-xs text-c-text-secondary">
            {formatReviewSummary(row, translate)}
          </span>
        ),
      },
      {
        id: 'exports',
        label: t('rap.outputs.columns.exports', 'Exports'),
        width: '120px',
        render: (row: AggregateRow) => (
          <span className="text-xs text-c-text-secondary">
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
            <span className="text-sm text-c-text-muted">
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
    [t, isPolish, statusLabel]
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
      // canon §9.2 FIXED BOTTOM MANIFEST position 1
      {
        id: 'open_preview',
        label: t('rap.actions.openPreview', 'Otwórz podgląd'),
        icon: ChevronRight,
        onClick: () => setSelectedId(row.id),
      },
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

    // D2 "Duplikuj / Użyj jako szablonu" — Claude-Artifacts "Remix" analog.
    // Copies a document/sheet artifact into a NEW Work Canvas draft + opens the
    // chat canvas; the original is untouched. Decks are not markdown canvas
    // drafts → gated to document/sheet (see duplicateArtifactToDraft.ts).
    if (row.kind === 'document' || row.kind === 'sheet') {
      base.push({
        id: 'duplicate_as_template',
        label: t('rap.actions.duplicateAsTemplate', 'Duplikuj / Użyj jako szablonu'),
        icon: Copy,
        onClick: async () => {
          const toastId = toast.loading(
            t('reports.creatingACopy')
          );
          try {
            const { chatUrl } = await duplicateArtifactToCanvasDraft(
              {
                kind: row.kind as 'document' | 'sheet',
                originRecordId: row.originRecordId,
                artifactId: row.artifactId,
                title: row.title,
              },
              { isPolish }
            );
            toast.success(
              t('reports.createdAnEditableCopy'),
              { id: toastId }
            );
            navigate(chatUrl);
          } catch (e: any) {
            toast.error(
              e?.message
                ? String(e.message)
                : t('reports.couldNotCreateACopy'),
              { id: toastId }
            );
          }
        },
      });
    }

    if (
      !isTemplateArtifact &&
      row.artifactId &&
      (row.kind === 'document' || row.kind === 'presentation')
    ) {
      base.push({
        id: 'save_as_template',
        label: t('rap.actions.saveAsTemplate', 'Save as template'),
        icon: BookTemplate,
        onClick: async () => {
          const aid = row.artifactId;
          if (!aid) return;

          const defaultName = `${row.title} Template`;
          const name = window.prompt(
            t('reports.newTemplateName'),
            defaultName
          );
          if (!name?.trim()) return;
          const description = window.prompt(
            t('reports.descriptionOptional'),
            ''
          );
          const scopeIsOrg = window.confirm(
            t('reports.shouldThisBeAnOrganizationTemplate')
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
            const payload = (await res.json().catch(() => ({}))) as {
              data?: { artifactId?: string };
            };
            const templateArtifactId =
              typeof payload?.data?.artifactId === 'string' ? payload.data.artifactId : null;
            toast.success(t('reports.savedAsTemplate'));
            const params = new URLSearchParams(location.search || '');
            params.set('tab', 'templates');
            if (templateArtifactId) {
              params.set('artifactId', templateArtifactId);
            }
            navigate(`/presentations?${params.toString()}`);
          } catch (e: any) {
            toast.error(
              e?.message ? String(e.message) : t('reports.failed')
            );
          }
        },
      });
    }

    if (
      isTemplateArtifact &&
      row.artifactId &&
      row.governance?.visibilityScope === 'review_shared' &&
      (row.governance?.publishState === 'reviewable_share' ||
        row.governance?.publishState === 'in_review')
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
            toast.success(t('reports.published'));
            onRefresh();
          } catch (e: any) {
            toast.error(
              e?.message ? String(e.message) : t('reports.publishFailed')
            );
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
        // canon §14: Archive = soft-delete (reversible) — label "Archiwizuj", NOT "Usuń"
        id: 'archive',
        label: t('rap.actions.archive', 'Archiwizuj'),
        icon: Archive,
        divider: true,
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
        // canon §14: Archive = soft-delete (reversible) — label "Archiwizuj", NOT "Usuń"
        id: 'archive',
        label: t('rap.actions.archive', 'Archiwizuj'),
        icon: Archive,
        divider: true,
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

  // canon §3.5 — row selection + bulk archive (loops the existing per-row
  // archiveReport/archiveDeck; no new backend endpoint).
  const selection = useTableSelection(itemIds);
  const { dialog: bulkConfirmDialog, confirm: confirmBulk } = useConfirmDialog();

  const bulkActions = useMemo<BulkAction[]>(() => {
    const rowById = new Map(filteredData.map((r) => [String(r.id), r]));
    return [
      {
        id: 'archive',
        // canon §14: bulk Archive = reversible soft-delete over selected outputs.
        label: t('rap.actions.archive', 'Archiwizuj'),
        icon: Archive,
        variant: 'danger',
        onRun: async (sel) => {
          const ok = await confirmBulk({
            title: t('rap.bulk.confirmArchiveTitle', 'Zarchiwizować zaznaczone outputy?'),
            description: t(
              'rap.bulk.confirmArchiveDesc',
              'Zarchiwizujesz {{count}} pozycji. Operacja jest odwracalna.',
              { count: sel.count }
            ),
            confirmLabel: t('rap.actions.archive', 'Archiwizuj'),
            cancelLabel: t('common.cancel', 'Anuluj'),
            variant: 'warning',
          });
          if (!ok) return;
          await sel.runBulk(
            async (id) => {
              const row = rowById.get(id);
              if (!row) throw new Error('missing row');
              const done =
                row.kind === 'presentation'
                  ? await actions.archiveDeck(row)
                  : await actions.archiveReport(row);
              if (!done) throw new Error('archive failed');
            },
            { silent: true }
          );
          onRefresh();
        },
      },
    ];
  }, [filteredData, actions, confirmBulk, onRefresh, t]);

  if (loading) {
    return (
      <div className="p-4">
        <SharedLoadingState template="card" count={6} />
      </div>
    );
  }

  // L-08: ENABLE_V8_GLOBAL OFF → registry 404. Dedicated "module disabled"
  // banner instead of the generic "failed to load" error, so operators can tell
  // a turned-off flag apart from an actual backend failure.
  if (moduleDisabled) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="w-full max-w-xl rounded-2xl border border-c-border-subtle bg-c-surface p-8 text-center">
          <h2 className="text-lg font-semibold text-c-text">
            {t('rap.moduleDisabled.title', 'Outputs library is turned off')}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-c-text-secondary">
            {t(
              'rap.moduleDisabled.body',
              'This workspace does not have the outputs library enabled. Contact your administrator to turn it on.'
            )}
          </p>
        </div>
      </div>
    );
  }

  if (error && rows.length === 0 && !searchQuery && activeFilters.length === 0) {
    return (
      <ErrorState
        title={t('rap.errors.outputsRegistryTitle', 'Outputs library source needs attention')}
        message={error}
        retry={onRefresh}
      />
    );
  }

  // Teresa onboarding empty state — only the truly empty library (no rows, no
  // error, no active search/filter) gets the "Generate with Teresa" touchpoint.
  if (!loading && !error && rows.length === 0 && !searchQuery && activeFilters.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="w-full max-w-xl rounded-2xl border border-c-border-subtle bg-c-surface p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-crimson-50 text-crimson-600 dark:bg-crimson-950/40 dark:text-crimson-400">
            <Sparkles size={26} />
          </div>
          <h2 className="text-lg font-semibold text-c-text">
            {t('rap.onboarding.title', 'Your outputs land here')}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-c-text-secondary">
            {t(
              'rap.onboarding.body',
              'Ask Teresa to generate a report or deck — it will appear here for review and export.'
            )}
          </p>
          <div className="mt-5 flex items-center justify-center">
            <Button variant="brand" onClick={openTeresaForOutput} icon={<Sparkles size={16} />}>
              {t('rap.onboarding.cta', 'Generate with Teresa')}
            </Button>
          </div>
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

          <div className="mt-3 space-y-3 text-sm text-c-text-secondary">
            {lineageLoading ? (
              <div className="flex items-center gap-2 text-c-text-muted">
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
              <div className="rounded-lg border border-c-border-subtle bg-c-surface p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">
                  {t('rap.outputs.preview.lineageRun', 'Run')}
                </div>
                <div className="mt-1 text-sm font-medium text-c-text">
                  {formatLabel(lineageRun?.state || lineageRun?.runState || lineageRun?.status)}
                </div>
                <div className="mt-1 text-xs text-c-text-muted">
                  {t('rap.outputs.preview.lineageCreatedAt', 'Created')}:{' '}
                  <span className="font-medium text-c-text-secondary">
                    {String(lineageRun?.createdAt || lineageRun?.created_at || '—')}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-c-border-subtle bg-c-surface p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">
                  {t('rap.outputs.preview.lineageToolCalls', 'Tool calls')}
                </div>
                <div className="mt-1 text-sm font-medium text-c-text">
                  {Array.isArray(lineageToolUsage?.invocations)
                    ? lineageToolUsage.invocations.length
                    : 0}
                </div>
                <div className="mt-1 text-xs text-c-text-muted">
                  {t('rap.outputs.preview.lineageTraces', 'Traces')}:{' '}
                  <span className="font-medium text-c-text-secondary">
                    {Array.isArray(lineageToolUsage?.traces) ? lineageToolUsage.traces.length : 0}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-c-border-subtle bg-c-surface p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">
                  {t('rap.outputs.preview.lineageOutputs', 'Outputs')}
                </div>
                <div className="mt-1 text-sm font-medium text-c-text">
                  {Array.isArray(lineageOutputs) ? lineageOutputs.length : 0}
                </div>
                <div className="mt-1 text-xs text-c-text-muted">
                  {t('rap.outputs.preview.lineageVisibility', 'Visibility enforced')}
                </div>
              </div>
            </div>

            {Array.isArray(lineageToolUsage?.invocations) && lineageToolUsage.invocations.length ? (
              <div className="rounded-lg border border-c-border-subtle p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">
                  {t('rap.outputs.preview.lineageToolCallsList', 'Tool calls')}
                </div>
                <div className="mt-2 space-y-2">
                  {lineageToolUsage.invocations.slice(0, 8).map((inv: any, idx: number) => (
                    <div
                      key={String(inv.invocationId || inv.id || idx)}
                      className="flex items-center justify-between rounded-md bg-c-surface-raised px-3 py-2 text-xs text-c-text-secondary"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {String(inv.toolName || inv.tool || inv.name || 'tool')}
                        </div>
                        <div className="truncate text-[11px] text-c-text-muted">
                          {String(inv.createdAt || inv.created_at || inv.timestamp || '')}
                        </div>
                      </div>
                      <div className="ml-3 shrink-0 text-[11px] text-c-text-muted">
                        {formatLabel(inv.status || inv.resultStatus || inv.state)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {Array.isArray(lineageOutputs) && lineageOutputs.length ? (
              <div className="rounded-lg border border-c-border-subtle p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">
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
                    // HOTFIX task#63 (UI-M5): forward any origin hints on the lineage
                    // pointer so a promoted-assessment output is not routed to an empty
                    // report builder here either.
                    const lineageGovernance: ArtifactGovernanceSummary | null =
                      out.openPath || out.authority || out.originSummary || out.originRuntime
                        ? {
                            openPath: out.openPath || null,
                            authority:
                              out.authority ||
                              (String(out.originRuntime || '') === 'assessment_report'
                                ? 'assessment_workbench'
                                : null),
                            originSummary:
                              out.originSummary && typeof out.originSummary === 'object'
                                ? out.originSummary
                                : null,
                          }
                        : null;
                    const openPath =
                      kind === 'sheet' || !originRecordId
                        ? null
                        : resolveArtifactOpenPath({
                            kind,
                            originRecordId,
                            governance: lineageGovernance,
                          });

                    return (
                      <div
                        key={String(out.artifactId || out.originRecordId || idx)}
                        className="flex items-center justify-between rounded-md bg-c-surface-raised px-3 py-2 text-xs text-c-text-secondary"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium">
                            {String(
                              out.resolvedTitle || out.titleSnapshot || out.originTitle || 'Output'
                            )}
                          </div>
                          <div className="truncate text-[11px] text-c-text-muted">
                            {String(
                              out.artifactFamily || out.outputType || out.originRuntime || '—'
                            )}{' '}
                            · {String(out.visibilityScope || '—')}
                          </div>
                        </div>
                        <div className="ml-3 shrink-0">
                          {kind === 'sheet' && originRecordId ? (
                            <button
                              type="button"
                              onClick={() => void openGovernedSheetRow(originRecordId)}
                              className="rounded-md border border-c-border bg-c-surface px-2 py-0.5 text-[10px] font-medium text-c-text-secondary hover:bg-c-surface-raised"
                            >
                              {t('rap.outputs.preview.download', 'Download')}
                            </button>
                          ) : openPath ? (
                            <button
                              type="button"
                              onClick={() => navigate(openPath)}
                              className="rounded-md border border-c-border bg-c-surface px-2 py-0.5 text-[10px] font-medium text-c-text-secondary hover:bg-c-surface-raised"
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
          <div className="space-y-3 text-sm text-c-text-secondary">
            <div className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">
              {item.kind === 'document'
                ? t('rap.outputs.kind.document', 'Document')
                : item.kind === 'presentation'
                  ? t('rap.outputs.kind.presentation', 'Presentation')
                  : t('rap.outputs.kind.sheet', 'Sheet')}
            </div>
            <div className="text-xs text-c-text-muted">
              {t('rap.outputs.preview.status', 'Status')}:{' '}
              <span className="font-medium text-c-text-secondary">
                {formatLabel(item.statusKey)}
              </span>
            </div>
            <div className="text-xs text-c-text-muted">
              {t('rap.columns.owner', 'Owner')}:{' '}
              <span className="font-medium text-c-text-secondary">{item.owner}</span>
            </div>
            <TrustStatePreviewSection
              governance={item.governance}
              artifactId={item.artifactId}
              exportFormats={item.exportFormats}
              onTrace={openLineage}
            />
            {item.kind === 'sheet' ? (
              <p className="text-xs text-c-text-muted leading-relaxed">
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
                className="h-9 px-4 rounded-full text-sm font-medium bg-c-text text-c-surface hover:opacity-90 transition-opacity"
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
                className="h-9 px-4 rounded-full text-sm font-medium border border-c-border text-c-text-secondary hover:bg-c-surface-raised transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('rap.actions.startReview', 'Start review')}
              </button>
            ) : null}
          </div>
        )}
      >
        <div className="flex h-full min-h-0 flex-col">
          <BulkActionBar selection={selection} actions={bulkActions} />
          {bulkConfirmDialog}
          <div className="min-h-0 flex-1">
            <FilterableTable
              columns={columns}
              data={filteredData}
              selectedRowId={selectedId}
              selection={selection.selectionProp}
              onRowClick={(row) => setSelectedId((row as AggregateRow).id)}
              onRowDoubleClick={(row) => openRow(row as AggregateRow)}
              getRowActions={(row) => getRowActions(row as AggregateRow)}
              activeFilters={activeFilters}
              onFilterChange={onFilterChange}
              emptyMessage={t('rap.empty.outputs', 'Brak outputów')}
              canvasClassName="pl-4 pr-1.5 pt-3 pb-4"
              // L-06 (§27): persist column widths/visibility/order across reload —
              // canonical FilterableTable localStorage path, one key for this table.
              persistKey="rap.outputs.aggregate"
            />
          </div>
        </div>
      </TableWithPreviewLayout>
    </div>
  );
};

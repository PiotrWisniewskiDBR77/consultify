/**
 * OutputsAggregateTabContent — All | Mine | Needs review
 * Single registry-backed list (GET /api/artifacts with view=mine|review).
 */

import {
  BookTemplate,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Eye,
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

import { LoadingState as SharedLoadingState } from '@/components/shared/states';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button, ErrorState } from '@/components/ui/primitives';
import { EntityStatusChip, statusChipTone } from '@/components/ui/primitives/chips';
import { useFeatureFlagsContext } from '@/contexts/FeatureFlagsContext';
import { useOpenChatWithContext } from '@/hooks/useOpenChatWithContext';
import { buildMyWorkSheetTableOpenPath } from '@/utils/artifactLinks';
import {
  downloadSheetArtifactXlsx,
  resolveTablePlatformWorkspaceIdForTable,
} from '@/utils/sheetArtifactOpen';

import { API_URL, getHeaders } from '../../services/api';
import { type FilterChip, type GridItem, GridView, type ViewMode } from '../shared/ModuleHub';
import {
  StandardPreview,
  type StandardPreviewActions,
  standardPreviewShortcuts,
  type StandardRowMenu,
  StandardTable,
  type TableColumn as StandardTableColumn,
} from '../standard';
import { resolveArtifactOpenPath } from './artifactNavigation';
import { duplicateArtifactToCanvasDraft } from './duplicateArtifactToDraft';
import { SaveAsTemplateModal, type SaveAsTemplateSource } from './SaveAsTemplateModal';
import { TrustStatePreviewSection } from './TrustStatePreviewSection';
import { SHEET_ORIGIN_META } from './types';
import type { ArtifactGovernanceSummary, SheetOrigin, UnifiedOutputRow } from './types';
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

/**
 * TYP column label for `kind === 'sheet'` rows (inwentarz Excel 27.07): a flat
 * Table Studio export ("tabela o niczym" bez treści) and a real generated
 * workbook both used to render as a bare "Sheet", making 61/75 export rows
 * indistinguishable from the 6 real workbooks. Text-only differentiation —
 * same neutral class as the other kinds, no new colors. See `SheetOrigin` /
 * `resolveSheetOrigin` (useRapData.ts) for how the origin is derived.
 */
function sheetKindLabel(
  sheetOrigin: SheetOrigin | undefined,
  t: (key: string, fallback?: string) => string,
  isPolish: boolean
): string {
  const meta = SHEET_ORIGIN_META[sheetOrigin || 'workbook'];
  const key =
    sheetOrigin === 'table_export' ? 'rap.outputs.kind.sheetExport' : 'rap.outputs.kind.sheetModel';
  return t(key, isPolish ? meta.labelPl : meta.label);
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
  // Triada canon A4/pkt.13: checkbox po lewej każdego wiersza — obowiązkowy
  // niezależnie od bulk-toolbara. Ten Hub NIE jest jeszcze przeniesiony na
  // StandardModuleBar (Menu 3 bulk mode) — osobny, większy program migracji
  // ModuleHub→StandardModuleBar, poza zakresem tego zadania. Checkbox tu
  // działa jako lokalny toggle (zaznaczenie widoczne, przetrwa re-render);
  // bulk-akcje podepniemy razem z tamtą migracją.
  const [selectedOutputIds, setSelectedOutputIds] = useState<Set<string>>(new Set());
  const deepLinkConsumed = useRef(false);
  // selectedGovernance is provided by useTrustState hook below
  const [lineageOpen, setLineageOpen] = useState(false);
  const [lineageLoading, setLineageLoading] = useState(false);
  const [lineageError, setLineageError] = useState<string | null>(null);
  const [lineageRunId, setLineageRunId] = useState<string | null>(null);
  const [lineageRun, setLineageRun] = useState<any | null>(null);
  const [lineageToolUsage, setLineageToolUsage] = useState<any | null>(null);
  const [lineageOutputs, setLineageOutputs] = useState<any[] | null>(null);
  // #83b: real "save as template" modal state (replaces window.prompt/confirm).
  const [saveAsTemplateSource, setSaveAsTemplateSource] = useState<SaveAsTemplateSource | null>(
    null
  );
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
        // Naprawa 2026-07-28 ("jeden Excel na każdej ścieżce", path #4 —
        // Materiały → Arkusze → otwarcie z listy): brak mapowania na tabelę
        // platformową zwykle znaczy, że to PRAWDZIWY skoroszyt Excela
        // (generated_workbooks, nie tp_tables — patrz komentarz w
        // ExceleView.tsx). Klik "Otwórz" po cichu ŚCIĄGAŁ plik zamiast
        // otworzyć edytowalną siatkę — teraz otwiera ten sam, jednolity
        // widok arkusza co reszta modułu (`ExceleView`'s reopen: GET
        // /workbook/:id → EditableSpreadsheetGrid), które samo ma dalszy,
        // jawny fallback (Table Studio / "nie znaleziono") gdy naprawdę nic
        // się nie rozwiąże.
        navigate(`/excele?artifactId=${encodeURIComponent(tableId)}`);
        return;
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
      const key = String(statusKey || '')
        .trim()
        .toLowerCase();
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

  const columns: StandardTableColumn[] = useMemo(
    () => [
      {
        id: 'title',
        label: t('rap.columns.title', 'Tytuł'),
        width: '280px',
        render: (rawRow: Record<string, unknown>) => {
          const row = rawRow as unknown as AggregateRow;
          return (
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
              <span className="text-sm font-medium text-c-text truncate">{row.title}</span>
            </div>
          );
        },
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
          },
          {
            value: 'presentation',
            label: t('rap.outputs.kind.presentation', 'Presentation'),
          },
          {
            value: 'sheet',
            label: t('rap.outputs.kind.sheet', 'Sheet'),
          },
        ],
        render: (rawRow: Record<string, unknown>) => {
          const row = rawRow as unknown as AggregateRow;
          return (
            <span className="text-xs font-medium text-c-text-secondary capitalize">
              {row.kind === 'document'
                ? t('rap.outputs.kind.document', 'Document')
                : row.kind === 'presentation'
                  ? t('rap.outputs.kind.presentation', 'Presentation')
                  : sheetKindLabel(row.sheetOrigin, translate, isPolish)}
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
          { value: 'draft', label: t('reports.draft') },
          { value: 'generated', label: t('reports.generated') },
          { value: 'editing', label: t('reports.editing') },
          { value: 'ready', label: t('reports.ready') },
          { value: 'exported', label: t('reports.exported') },
          { value: 'shared', label: t('reports.shared') },
          { value: 'archived', label: t('reports.archived') },
        ],
        // L-07 (§27): canonical EntityStatusChip (semantic dot tone) instead of a
        // raw text/colored-class status. Localized label kept; tone is derived
        // from the raw statusKey by the chip's statusChipTone() mapping.
        render: (rawRow: Record<string, unknown>) => {
          const row = rawRow as unknown as AggregateRow;
          return <EntityStatusChip status={row.statusKey} label={statusLabel(row.statusKey)} />;
        },
      },
      {
        id: 'owner',
        label: t('rap.columns.owner', 'Właściciel'),
        width: '160px',
        render: (rawRow: Record<string, unknown>) => {
          const row = rawRow as unknown as AggregateRow;
          return (
            <span className="text-sm text-c-text-secondary truncate block">{row.owner || '—'}</span>
          );
        },
      },
      {
        id: 'visibility',
        label: t('rap.outputs.columns.visibility', 'Visibility'),
        width: '120px',
        render: (rawRow: Record<string, unknown>) => {
          const row = rawRow as unknown as AggregateRow;
          return (
            <span className="text-xs text-c-text-secondary">
              {formatLabel(row.governance?.visibilityScope)}
            </span>
          );
        },
      },
      {
        id: 'source',
        label: t('rap.outputs.columns.source', 'Source'),
        width: '150px',
        render: (rawRow: Record<string, unknown>) => {
          const row = rawRow as unknown as AggregateRow;
          return (
            <span className="text-xs text-c-text-secondary">
              {formatSourceSummary(row, translate)}
            </span>
          );
        },
      },
      {
        id: 'review',
        label: t('rap.outputs.columns.review', 'Review'),
        width: '130px',
        render: (rawRow: Record<string, unknown>) => {
          const row = rawRow as unknown as AggregateRow;
          return (
            <span className="text-xs text-c-text-secondary">
              {formatReviewSummary(row, translate)}
            </span>
          );
        },
      },
      {
        id: 'exports',
        label: t('rap.outputs.columns.exports', 'Exports'),
        width: '120px',
        render: (rawRow: Record<string, unknown>) => {
          const row = rawRow as unknown as AggregateRow;
          return (
            <span className="text-xs text-c-text-secondary">
              {row.exportFormats.length ? row.exportFormats.join(', ').toUpperCase() : '—'}
            </span>
          );
        },
      },
      {
        id: 'updatedAt',
        label: t('rap.columns.date', 'Data'),
        width: '130px',
        sortable: true,
        sortAccessor: (rawRow: Record<string, unknown>) => {
          const row = rawRow as unknown as AggregateRow;
          const d = new Date(row.updatedAt);
          return Number.isNaN(d.getTime()) ? 0 : d.getTime();
        },
        render: (rawRow: Record<string, unknown>) => {
          const row = rawRow as unknown as AggregateRow;
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
    [t, isPolish, statusLabel, translate]
  );

  const openRow = (row: UnifiedOutputRow) => {
    // Naprawa 2026-07-28 ("jeden Excel na każdej ścieżce", path #4): dla
    // kind==='sheet' `resolveArtifactOpenPath` ZAWSZE zwraca prawdę — serwer
    // nigdy nie ustawia `governance.openPath` dla runtime 'sheet' (patrz
    // brak gałęzi 'sheet' w buildActionTargetPayload, server/src/routes/artifacts.routes.ts),
    // więc spadało to zawsze na statyczne `getArtifactPath('sheet', id)` =
    // `/tabele?artifactId=` — nawet dla PRAWDZIWYCH skoroszytów Excela z
    // `generated_workbooks`, które tam nie istnieją (Table Studio pokazywał
    // "Nie udało się załadować podglądu tabeli"). `openGovernedSheetRow`
    // (używana już przez pigułkę "Otwórz w przestrzeni roboczej"/"Pobierz
    // XLSX" niżej) robi to poprawnie i ASYNCHRONICZNIE: najpierw sprawdza,
    // czy to realna tabela platformowa (→ My Work), inaczej otwiera ten sam,
    // jednolity widok arkusza (`/excele?artifactId=`) co reszta modułu.
    if (row.kind === 'sheet') {
      void openGovernedSheetRow(row.originRecordId);
      return;
    }
    const openPath = resolveArtifactOpenPath({
      kind: row.kind,
      originRecordId: row.originRecordId,
      governance: row.governance,
    });
    if (openPath) {
      navigate(openPath);
    }
  };

  // Triada standard (TRIADA_KANON.md A6 / ANEKS #4): moduł deklaruje TYLKO
  // bloki 1-3 (primary/statusTransitions/timeActions); StandardTable dokłada
  // SAMA blok 4 (Open preview · Edit · Archive) i blok 5 (Delete/Reject).
  // Outputs nie mają "Edit" w kebabie sensu stricto (edycja = otwarcie
  // dokumentu/decka w jego edytorze) ani terminów (blok 3 = n/d).
  const buildRowMenu = useCallback(
    (row: AggregateRow): StandardRowMenu => {
      const isTemplateArtifact = Boolean((row.governance?.originSummary as any)?.template);

      const primary: StandardRowMenu['primary'] = [
        {
          id: 'open',
          label: t('rap.actions.open', 'Otwórz'),
          icon: ExternalLink,
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
      // Copies a document/sheet artifact into a NEW Work Canvas draft + opens
      // the chat canvas; the original is untouched. Decks are not markdown
      // canvas drafts → gated to document/sheet (see duplicateArtifactToDraft.ts).
      if (row.kind === 'document' || row.kind === 'sheet') {
        primary.push({
          id: 'duplicate_as_template',
          label: t('rap.actions.duplicateAsTemplate', 'Duplikuj / Użyj jako szablonu'),
          icon: Copy,
          onClick: async () => {
            const toastId = toast.loading(t('reports.creatingACopy'));
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
              toast.success(t('reports.createdAnEditableCopy'), { id: toastId });
              navigate(chatUrl);
            } catch (e: any) {
              toast.error(e?.message ? String(e.message) : t('reports.couldNotCreateACopy'), {
                id: toastId,
              });
            }
          },
        });
      }

      if (
        !isTemplateArtifact &&
        row.artifactId &&
        (row.kind === 'document' || row.kind === 'presentation')
      ) {
        primary.push({
          id: 'save_as_template',
          label: t('rap.actions.saveAsTemplate', 'Save as template'),
          icon: BookTemplate,
          onClick: () => {
            const aid = row.artifactId;
            if (!aid) return;
            // #83b: real modal (name + type + visibility) replaces the old
            // window.prompt()/window.confirm() sequence — see SaveAsTemplateModal.
            setSaveAsTemplateSource({
              artifactId: aid,
              title: row.title,
              kind: row.kind as 'document' | 'presentation',
            });
          },
        });
      }

      if (row.kind === 'document') {
        primary.push({
          id: 'export',
          label: t('rap.actions.exportPdf', 'Eksportuj PDF'),
          icon: Download,
          onClick: () => actions.exportReportPdf(row),
        });
      } else if (row.kind === 'presentation') {
        primary.push({
          id: 'export',
          label: t('rap.actions.exportPptx', 'Eksportuj PPTX'),
          icon: Download,
          onClick: () => actions.exportDeckPptx(row),
        });
      }

      // Blok 2 — przejście stanu: review → published (tylko szablony w review).
      const statusTransitions: StandardRowMenu['statusTransitions'] =
        isTemplateArtifact &&
        row.artifactId &&
        row.governance?.visibilityScope === 'review_shared' &&
        (row.governance?.publishState === 'reviewable_share' ||
          row.governance?.publishState === 'in_review')
          ? [
              {
                id: 'approve_template',
                label: t('rap.actions.approveTemplate', 'Approve & publish'),
                icon: CheckCircle2,
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
                    toast.error(e?.message ? String(e.message) : t('reports.publishFailed'));
                  }
                },
              },
            ]
          : undefined;

      // Blok 4 (uniwersalny) — Archive jest REALNYM soft-delete API (canon §14:
      // label "Archiwizuj", NIE "Usuń"). Sheets nie mają jeszcze archive API
      // (Wave 2) → disabled z notą, StandardTable dokłada ją sama.
      const archiveHandler =
        row.kind === 'document'
          ? async () => {
              const ok = await actions.archiveReport(row);
              if (ok) onRefresh();
            }
          : row.kind === 'presentation'
            ? async () => {
                const ok = await actions.archiveDeck(row);
                if (ok) onRefresh();
              }
            : undefined;

      return {
        primary,
        statusTransitions,
        // Blok 3 (czas) — n/d: outputy nie mają terminów/SLA.
        universalHandlers: {
          preview: () => setSelectedId(row.id),
          archive: archiveHandler,
          archiveNote: archiveHandler
            ? undefined
            : t('rap.outputs.archive.sheetsComingSoon', 'Coming soon (backend)'),
          // Brak dedykowanego ekranu edycji poza otwarciem dokumentu/decka —
          // "Edit" disabled z notą (StandardTable dokłada ją sama, edycja
          // realna dzieje się przez "Otwórz").
        },
        // Brak API twardego usuwania outputów (tylko archive) — destructive
        // celowo disabled z notą.
        destructive: {
          note: t('rap.outputs.delete.comingSoon', 'Coming soon (backend)'),
        },
      };
    },
    [t, isPolish, navigate, location.search, openChatWithContext, actions, onRefresh]
  );

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

  const previewActions: StandardPreviewActions | undefined = useMemo(() => {
    if (!previewItem) return undefined;
    // TYPE 11 fix (2026-07-26): this used to also carry an informational[0]
    // "Otwórz" entry calling openRow(previewItem) — a literal duplicate of the
    // header onOpenFull (below, same handler). Removed; header stays the
    // single "open" action for this panel.
    const informational: NonNullable<StandardPreviewActions['informational']> = [];
    if (previewItem.kind === 'sheet') {
      // N1 fix (2026-07-26): this used to call openRow(previewItem) too, which
      // for kind==='sheet' always resolves a truthy path via
      // resolveArtifactOpenPath() and navigates away — it never downloaded
      // anything, so "Download XLSX" silently opened the row instead (rejestr
      // N1: "Download XLSX nic nie pobiera"). openGovernedSheetRow is the real
      // handler already used elsewhere in this file for sheet rows (see the
      // lineage "Download" button below, ~L1048): it navigates to the
      // workspace when tablePlatformMetadataFirst is on, otherwise calls
      // downloadSheetArtifactXlsx() to actually fetch+download the .xlsx blob.
      informational.push({
        id: 'open_sheet',
        variant: 'neutral',
        label: isEnabled('tablePlatformMetadataFirst')
          ? t('rap.actions.openInWorkspace', 'Open in workspace')
          : t('rap.actions.exportXlsx', 'Download XLSX'),
        icon: Download,
        shortcut: 'D',
        onClick: () => void openGovernedSheetRow(previewItem.originRecordId),
      });
    }
    if (previewItem.artifactId) {
      const reviewBlocked =
        previewItem.governance?.validationState === 'pending' ||
        previewItem.governance?.validationState === 'attention_required' ||
        (!!previewItem.governance?.publishState &&
          previewItem.governance.publishState !== 'private_draft');
      informational.push({
        id: 'start_review',
        variant: 'neutral',
        label: t('rap.actions.startReview', 'Start review'),
        icon: Eye,
        shortcut: 'R',
        disabled: reviewBlocked,
        onClick: async () => {
          const aid = previewItem.artifactId;
          if (!aid) return;
          const ok = await actions.startArtifactReview(aid);
          if (ok) onRefresh();
        },
      });
    }
    return { informational };
  }, [previewItem, t, isEnabled, actions, onRefresh, openGovernedSheetRow]);

  // Esc closes preview; single-key shortcuts (O/D/R) active while preview
  // open (kanon B.24/B.31 — wzór 1:1 z Assessment/Results adopterami).
  useEffect(() => {
    if (!selectedId) return;
    const shortcuts = standardPreviewShortcuts(previewActions);
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }
      if (e.key === 'Escape') {
        setSelectedId(null);
        return;
      }
      const handler = shortcuts[e.key.toUpperCase()];
      if (handler) {
        e.preventDefault();
        handler();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, previewActions]);

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
        <div className="w-full max-w-xl rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-8 text-center">
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
        <div className="w-full max-w-xl rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-8 text-center">
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
              <div className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3">
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

              <div className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3">
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

              <div className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3">
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
                              className="rounded-md border border-c-border bg-c-surface px-2 py-0.5 text-[10px] font-medium text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                            >
                              {t('rap.outputs.preview.download', 'Download')}
                            </button>
                          ) : openPath ? (
                            <button
                              type="button"
                              onClick={() => navigate(openPath)}
                              className="rounded-md border border-c-border bg-c-surface px-2 py-0.5 text-[10px] font-medium text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
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

      <SaveAsTemplateModal
        isOpen={!!saveAsTemplateSource}
        source={saveAsTemplateSource}
        onClose={() => setSaveAsTemplateSource(null)}
        onSaved={(templateArtifactId) => {
          const params = new URLSearchParams(location.search || '');
          params.set('tab', 'templates');
          if (templateArtifactId) {
            params.set('artifactId', templateArtifactId);
          }
          navigate(`/presentations?${params.toString()}`);
        }}
      />

      {/* Triada standard (docs/ui-standards/TRIADA_KANON.md A4-A7): Outputs
          aggregate list (All/Mine/Review share this component) →
          StandardTable + StandardPreview, hand-rolled flex/aside layout 1:1
          with the Assessment 'list' / Interview inbox / Results KPI catalog
          adopters (NOT TableWithPreviewLayout, which those adopters also
          bypass). */}
      <div className="h-full flex overflow-hidden">
        <div className="flex-1 min-w-0 overflow-auto pl-4 pr-1.5 pt-3 pb-4">
          <StandardTable
            columns={columns}
            data={filteredData as unknown as Array<Record<string, unknown> & { id: string }>}
            selectedRowId={selectedId}
            onRowClick={(row) => setSelectedId(String((row as any).id))}
            onRowDoubleClick={(row) => openRow(row as unknown as AggregateRow)}
            rowDescription={() => null}
            defaultSort={{ columnId: 'updatedAt', direction: 'desc' }}
            // L-06 (§27): persist column widths/visibility/order across reload —
            // canonical StandardTable/FilterableTable localStorage path, one
            // key for this table (kept identical to the pre-triada key).
            persistKey="rap.outputs.aggregate"
            activeFilters={activeFilters}
            onFilterChange={onFilterChange}
            empty={{
              icon: FileText,
              title: t('rap.empty.outputs', 'Brak outputów'),
            }}
            rowMenu={(row) => buildRowMenu(row as unknown as AggregateRow)}
            selection={{ selectedIds: selectedOutputIds, onChange: setSelectedOutputIds }}
          />
        </div>

        {previewItem ? (
          <aside className="w-[400px] shrink-0 bg-slate-50 dark:bg-navy-950 p-3 overflow-hidden">
            <StandardPreview
              title={previewItem.title}
              onClose={() => setSelectedId(null)}
              onOpenFull={() => openRow(previewItem)}
              meta={{
                pills: [
                  {
                    label:
                      previewItem.kind === 'document'
                        ? t('rap.outputs.kind.document', 'Document')
                        : previewItem.kind === 'presentation'
                          ? t('rap.outputs.kind.presentation', 'Presentation')
                          : t('rap.outputs.kind.sheet', 'Sheet'),
                    tone: 'neutral',
                  },
                  {
                    label: statusLabel(previewItem.statusKey),
                    tone: statusChipTone(previewItem.statusKey),
                  },
                ],
                trailing: (
                  <span className="text-[11px] font-semibold text-c-text-secondary">
                    {new Date(previewItem.updatedAt).toLocaleDateString(
                      isPolish ? 'pl-PL' : 'en-US',
                      { day: 'numeric', month: 'short', year: 'numeric' }
                    )}
                  </span>
                ),
              }}
              details={{
                text: [
                  `${t('rap.columns.owner', 'Owner')}: ${previewItem.owner || '—'}`,
                  `${t('rap.outputs.columns.visibility', 'Visibility')}: ${formatLabel(previewItem.governance?.visibilityScope)}`,
                  `${t('rap.outputs.columns.source', 'Source')}: ${formatSourceSummary(previewItem, translate)}`,
                  `${t('rap.outputs.columns.review', 'Review')}: ${formatReviewSummary(previewItem, translate)}`,
                  `${t('rap.outputs.columns.exports', 'Exports')}: ${previewItem.exportFormats.length ? previewItem.exportFormats.join(', ').toUpperCase() : '—'}`,
                ].join('\n'),
                onCopy: () => {
                  void navigator.clipboard?.writeText(
                    `${previewItem.title} — ${statusLabel(previewItem.statusKey)}`
                  );
                },
              }}
              ai={{
                hints: [
                  t('rap.outputs.ai.summarize', 'Summarize'),
                  t('rap.outputs.ai.suggestNext', 'Suggest next steps'),
                ],
                disabled: true,
                disabledTooltip: t('common.comingSoon', 'Coming soon'),
              }}
              relations={
                previewItem.sourceInitiativeId
                  ? [
                      {
                        label: t('rap.outputs.source.initiativeLinked', 'Initiative linked'),
                      },
                    ]
                  : []
              }
              actions={previewActions}
            >
              <TrustStatePreviewSection
                governance={previewItem.governance}
                artifactId={previewItem.artifactId}
                exportFormats={previewItem.exportFormats}
                onTrace={openLineage}
              />
              {previewItem.kind === 'sheet' ? (
                <p className="mt-3 text-xs text-c-text-muted leading-relaxed">
                  {t(
                    'rap.outputs.preview.sheetHint',
                    'Governed sheet artifacts use the same registry; authoring and export paths are rolling out in Wave 2.'
                  )}
                </p>
              ) : null}
            </StandardPreview>
          </aside>
        ) : null}
      </div>
    </div>
  );
};

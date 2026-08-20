/**
 * FinanceHub (Economics route)
 *
 * KANON v3 (Golden Standard Table+Cards+Preview):
 * - 5 main functional tabs (order): Statements / Analysis / Models / Prediction / Enterprise valuation
 * - Table + Preview layout: FilterableTable + TableWithPreviewLayout (gap-1.5, preview width clamp, no divider)
 * - Grid/Cards alternative: GridView SSOT with finance type accents
 * - Table canvas padding: pl-4 pr-1.5 pt-3 pb-4
 * - Preview footer zones: AI hints → divider → relations (2 rows) → divider → actions
 * - Topbar right cluster: AI → Primary CTA → View → Filters (flush right)
 * - Command Row: status counters as pills h-9 (one line, swap in place)
 * - Per-tab row actions (kebab ⋮ triage)
 * - Per-tab contextual AI hints in preview
 * - i18n PL/EN via useTranslation
 *
 * SSOT references:
 * - docs/product/FINANCIAL_ANALYSIS_V3.md (5 tabs / domain)
 * - docs/product/UI_UX_GOLDEN_STANDARD_V3_AGENT_PROCEDURE.md
 * - docs/ui-standards/03-modules/golden-standard-table-cards-preview-v3.md
 */

import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Calculator,
  ChevronDown,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  GitBranch,
  Link2,
  MessageCircle,
  Plus,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import React, { lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { EmptyState, LoadingState } from '@/components/shared/states';
import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import {
  StandardPreview,
  type StandardPreviewActions,
  standardPreviewShortcuts,
  type StandardRowMenu,
  StandardTable,
} from '@/components/standard';
import { MetaChip, statusChipTone } from '@/components/ui/primitives/chips';
import { usePolicySnapshot } from '@/contexts/AccessPolicyContext';
// AP_MOUNT §B — the four "finished, tested, unreachable" Finance v3 (AP-09/10/11)
// detail workspaces (Prediction/Baseline/Analysis/Valuation, Pakiety G/F/E/H) each
// read their OWN flag internally (AP_MOUNT §A) and render `null` at OFF, so importing
// + conditionally rendering them here is safe by construction — no behaviour change
// unless the flag is flipped. Named `FinanceV3*` locally: this file already declares
// unrelated `ValuationWorkspace`/`FinancialAnalysisWorkspace` consts (the OLD
// Benefits/M16 "Economics" workspaces, a separate system — see the ID-space caveat on
// each v3 mount branch below).
import { useFinanceAnalysisWorkspaceFlag } from '@/hooks/useFinanceAnalysisWorkspaceFlag';
import { useFinanceBaselineWorkspaceFlag } from '@/hooks/useFinanceBaselineWorkspaceFlag';
import { useFinancePredictionWorkspaceFlag } from '@/hooks/useFinancePredictionWorkspaceFlag';
import { useFinanceStatementPackWorkspaceV2Flag } from '@/hooks/useFinanceStatementPackWorkspaceV2Flag';
import { useFinanceValuationWorkspaceFlag } from '@/hooks/useFinanceValuationWorkspaceFlag';
import { useOpenChatWithContext } from '@/hooks/useOpenChatWithContext';
import { useV8FeatureFlag } from '@/hooks/useV8FeatureFlag';
import { ROUTES } from '@/routes/routeConfig';
import { Api, API_URL, getHeaders } from '@/services/api';
import type { BusinessVersionStatus } from '@/services/api/financeV2.types';
import {
  shouldFallbackToLegacyFinance,
  V8FinanceApi,
  type V8FinanceDashboard,
} from '@/services/api/v8/finance';
import { useAppStore } from '@/store/useAppStore';
import { formatListDate } from '@/utils/listDateFormat';

// ID_BRIDGE (Gate E) — legacy `/api/v8/finance/*` id -> canonical
// `{artifactId, businessVersionId}` resolution gate, used by all four v3
// mount branches below (openV3Baseline/Prediction/Analysis/Valuation).
import { FinanceLegacyBridgeGate } from '../Finance/shared/FinanceLegacyBridgeGate';
import { Menu3DropdownChip } from '../shared/Menu3DropdownChip';
import {
  FilterChip,
  type GridItem,
  GridView,
  ModuleTab,
  OpenDocument,
  TableColumn,
  ViewMode,
} from '../shared/ModuleHub';
import { getMenu3AiButtonClass } from '../shared/ModuleHub/menu3ActionButtonStyles';
import { useModuleOpenDocuments } from '../shared/ModuleHub/useModuleOpenDocuments';
import {
  MENU_3_ACTION_DANGER,
  MENU_3_ALL_DOT_CLASS,
  MENU_3_BADGE_ACTIVE,
  MENU_3_BADGE_INACTIVE,
  MENU_3_CHIP_ACTIVE,
  MENU_3_CHIP_INACTIVE,
  MENU_3_INNER_CLASS,
  MENU_3_LEFT_CLASS,
  MENU_3_RIGHT_CLASS,
  Menu3Chip,
} from '../shared/ModuleMenu3';
import { EmptyStateInline } from '../shared/NModeBlocks/EmptyStateInline';
import { StandardModuleBar } from '../standard/StandardModuleBar';
import { FinanceDegradedBanner } from './FinanceDegradedBanner';
import { getFinanceErrorMessage } from './financeErrorMap';
import { FinanceLanePanel } from './FinanceLanePanel';
import { FinanceLaneStrip } from './FinanceLaneStrip';
import { buildFinanceTeresaPrompt } from './financeModelLabels';
import { useFinancePreview } from './FinancePreviewPanel';
import {
  type FinanceAnalysisRow,
  type FinanceKind,
  type FinanceModelRow,
  type FinanceRow,
  type FinanceStatementRow,
  type FinanceStatus,
  type FinanceValuationRow,
  getTypeCode,
  KIND_ICONS,
  type PredictionType,
  statusToItemStatus,
  statusToProgress,
} from './financeTypes';
import { useFinanceData } from './hooks/useFinanceData';
import { useFinanceLane } from './hooks/useFinanceLane';
import { useFinanceRowActions } from './hooks/useFinanceRowActions';
import { useFinanceSelection } from './hooks/useFinanceSelection';

// ---------------------------------------------------------------------------
// H5.1 perf (code-splitting): heavy, on-demand surfaces are lazy-loaded so the
// FinanceHub critical-path chunk no longer bundles the full editor suite +
// ~20 M16 value-tracking panels + create modals + import/export dialogs. Each
// of these only ever renders behind a state/flag/tab gate, so splitting them
// out shrinks first-paint without changing any behaviour, flags, or contracts.
// The runtime gates (isFinanceFlagEnabled / activeTab / show* state) are
// unchanged — only the module import boundary + a Suspense skeleton were added.
// ---------------------------------------------------------------------------
const BudgetWorkspace = lazy(() =>
  import('../Benefits/BudgetWorkspace').then((m) => ({ default: m.BudgetWorkspace }))
);
const FinancialAnalysisWorkspace = lazy(() =>
  import('../Benefits/FinancialAnalysisWorkspace').then((m) => ({
    default: m.FinancialAnalysisWorkspace,
  }))
);
const ValuationWorkspace = lazy(() =>
  import('../Benefits/ValuationWorkspace').then((m) => ({ default: m.ValuationWorkspace }))
);
const ExportToOutputDialog = lazy(() =>
  import('../Finance/ExportToOutputDialog').then((m) => ({ default: m.ExportToOutputDialog }))
);
const FinancialModelWorkspace = lazy(() =>
  import('../Finance/FinancialModelWorkspace').then((m) => ({ default: m.FinancialModelWorkspace }))
);
const FinancialStatementImportWizard = lazy(() =>
  import('../Finance/FinancialStatementImportWizard').then((m) => ({
    default: m.FinancialStatementImportWizard,
  }))
);
const FinancialStatementPackWorkspace = lazy(() =>
  import('../Finance/FinancialStatementPackWorkspace').then((m) => ({
    default: m.FinancialStatementPackWorkspace,
  }))
);
// AP_MOUNT §B — Finance v3 (finance-v2 canonical) detail workspaces, aliased
// `FinanceV3*` to avoid colliding with the OLD `ValuationWorkspace`/
// `FinancialAnalysisWorkspace` consts above (Benefits/M16, different system).
const FinanceV3PredictionWorkspace = lazy(() =>
  import('../Finance/Prediction/PredictionWorkspace').then((m) => ({
    default: m.PredictionWorkspace,
  }))
);
const FinanceV3BaselineWorkspace = lazy(() =>
  import('../Finance/BaselineWorkspace').then((m) => ({ default: m.BaselineWorkspace }))
);
const FinanceV3AnalysisWorkspace = lazy(() =>
  import('../Finance/Analysis/AnalysisWorkspace').then((m) => ({ default: m.AnalysisWorkspace }))
);
const FinanceV3ValuationWorkspace = lazy(() =>
  import('../Finance/Valuation/ValuationWorkspace').then((m) => ({ default: m.ValuationWorkspace }))
);
const FinanceV3StatementPackWorkspace = lazy(() =>
  import('../Finance/statementPackWorkspaceV2/StatementPackWorkspaceV2').then((m) => ({
    default: m.StatementPackWorkspaceV2,
  }))
);
const FinanceWorkspaceUtilities = lazy(() =>
  import('../Finance/shared/FinanceWorkspaceUtilities').then((m) => ({
    default: m.FinanceWorkspaceUtilities,
  }))
);

function CanonicalFinanceWorkspaceMount({
  artifactId,
  businessVersionId,
  artifactType,
  children,
}: {
  artifactId: string;
  businessVersionId: string;
  artifactType: import('@/services/api/financeV2.types').FinanceArtifactType;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      <FinanceWorkspaceUtilities
        artifactId={artifactId}
        businessVersionId={businessVersionId}
        artifactType={artifactType}
      />
    </div>
  );
}
const CreateAnalysisModal = lazy(() =>
  import('./modals/CreateAnalysisModal').then((m) => ({ default: m.CreateAnalysisModal }))
);
const CreateBudgetModal = lazy(() =>
  import('./modals/CreateBudgetModal').then((m) => ({ default: m.CreateBudgetModal }))
);
const CreateModelModal = lazy(() =>
  import('./modals/CreateModelModal').then((m) => ({ default: m.CreateModelModal }))
);
const CreateValuationModal = lazy(() =>
  import('./modals/CreateValuationModal').then((m) => ({ default: m.CreateValuationModal }))
);
const LinkInitiativeModal = lazy(() =>
  import('./modals/LinkInitiativeModal').then((m) => ({ default: m.LinkInitiativeModal }))
);

/**
 * Guard against raw JS Date `.toString()` leaking into a statement title
 * (owner 2026-07-04 saw "Thu Dec 31 2026 00:00:00 GMT+0000 (Coordinated Universal
 * Time)" as a card name). If the value looks like a JS/ISO date-string, render a
 * compact locale date instead; otherwise pass the label through unchanged.
 */
const JS_DATE_TOSTRING_RE = /^[A-Z][a-z]{2}\s+[A-Z][a-z]{2}\s+\d{1,2}\s+\d{4}\b/; // "Thu Dec 31 2026 ..."
/**
 * FIN-005: the owner-side fix now serializes Finance period columns before they
 * leave the API (`server/src/services/financePeriodFormat.ts`), so this guard is
 * defence in depth. It also covers the ISO *timestamp* shape
 * ("2026-12-31T00:00:00.000Z") — a `Date` crossing JSON turns into that, and
 * rendering it raw is the same class of leak as the `Date.toString()` form.
 */
const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/; // "2026-12-31T00:00:00.000Z"
function sanitizeStatementTitle(raw?: unknown): string {
  const value = raw instanceof Date ? raw.toISOString() : String(raw ?? '').trim();
  if (!value) return '';
  const looksLikeDate = JS_DATE_TOSTRING_RE.test(value) || ISO_TIMESTAMP_RE.test(value);
  if (looksLikeDate) {
    const parsed = new Date(value);
    // `toLocaleDateString(undefined, …)` brało format z PRZEGLĄDARKI, nie
    // z języka konta — ta sama data wychodziła inaczej niż w sąsiedniej
    // kolumnie. Wspólny formatter (`utils/listDateFormat`) daje jeden zapis.
    if (!Number.isNaN(parsed.getTime())) return formatListDate(parsed);
  }
  return value;
}

// Build distinct StandardTable filter options (§2 canon) from the currently
// loaded rows for a categorical field. Options are data-driven so the dropdown
// never shows values that match zero rows. `labelFor` optionally maps a raw
// value to a human label (e.g. 'budget' → 'Budget').
function buildFilterOptions(
  rows: Array<Record<string, unknown>>,
  accessor: (row: any) => unknown,
  labelFor?: (value: string) => string
): { value: string; label: string }[] {
  const seen = new Set<string>();
  const out: { value: string; label: string }[] = [];
  for (const row of rows) {
    const raw = accessor(row);
    if (raw === undefined || raw === null) continue;
    const value = String(raw).trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push({ value, label: labelFor ? labelFor(value) : value });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

// AP_MOUNT §B — legacy `FinanceStatus` ('DRAFT'|'REVIEW'|'APPROVED', the OLD
// `/api/v8/finance/*` vocabulary) has no exact match in finance-v2's
// `BusinessVersionStatus` (8 values). Best-effort mapping, documented rather
// than silently coerced — 'REVIEW' -> 'IN_REVIEW' is a judgment call (the old
// system doesn't distinguish "submitted, not yet started" from "actively
// being reviewed").
function mapLegacyFinanceStatusToV3(status: FinanceStatus): BusinessVersionStatus {
  switch (status) {
    case 'DRAFT':
      return 'DRAFT';
    case 'REVIEW':
      return 'IN_REVIEW';
    case 'APPROVED':
      return 'APPROVED';
    default:
      return 'DRAFT';
  }
}

// AP_MOUNT §B — pure branch-selection logic for the Finance detail view,
// extracted so it is unit-testable WITHOUT mounting the full `FinanceHub`
// (a page-level component with a large provider/hook dependency graph).
// This function is the actual source of truth the JSX below destructures —
// not a parallel re-implementation that could drift.
export interface FinanceDetailBranchFlags {
  baseline: boolean;
  prediction: boolean;
  analysis: boolean;
  valuation: boolean;
}

export interface FinanceDetailBranches {
  isBudgetPrediction: boolean;
  openStatement: boolean;
  isModelWorkspace: boolean;
  openAnalysis: boolean;
  openValuation: boolean;
  /** `true` only when the row is kind `'models'` AND the Baseline flag is ON. */
  openV3Baseline: boolean;
  /** `true` only when the row is kind `'prediction'` + predictionType `'model'` AND the Prediction flag is ON. */
  openV3Prediction: boolean;
  /** `true` only when `openAnalysis` AND the Analysis flag is ON. */
  openV3Analysis: boolean;
  /** `true` only when `openValuation` AND the Valuation flag is ON. */
  openV3Valuation: boolean;
  /** `true` if ANY of the four v3 branches above is active — used to suppress the generic header (v3 workspaces carry their own via `FinanceWorkspaceBar`). */
  openFinanceV3: boolean;
  needsFullHeight: boolean;
}

export type FinanceDeepLink = {
  tab: ModuleTab;
  entityId: string;
};

/** Canonical Finance detail URLs, including all five flag-gated workspaces. */
export function parseFinanceDeepLink(pathname: string): FinanceDeepLink | null {
  const match = pathname.match(
    /^\/finance\/(statements|models|analyses|predictions|valuations)\/([^/]+)$/
  );
  if (!match) return null;

  const tabBySegment: Record<string, ModuleTab> = {
    statements: 'statements',
    models: 'models',
    analyses: 'analysis',
    predictions: 'prediction',
    valuations: 'valuation',
  };
  return { tab: tabBySegment[match[1]], entityId: decodeURIComponent(match[2]) };
}

export function resolveFinanceDetailBranches(
  kind: FinanceKind,
  predictionType: PredictionType | undefined,
  flags: FinanceDetailBranchFlags
): FinanceDetailBranches {
  const isBudgetPrediction = kind === 'prediction' && predictionType === 'budget';
  const openStatement = kind === 'statements';
  const isModelWorkspace =
    kind === 'models' || (kind === 'prediction' && predictionType === 'model');
  const openAnalysis = kind === 'analysis' || kind === 'investment';
  const openValuation = kind === 'valuation';
  const openV3Baseline = kind === 'models' && flags.baseline;
  const openV3Prediction = kind === 'prediction' && predictionType === 'model' && flags.prediction;
  const openV3Analysis = openAnalysis && flags.analysis;
  const openV3Valuation = openValuation && flags.valuation;
  const openFinanceV3 = openV3Baseline || openV3Prediction || openV3Analysis || openV3Valuation;
  const needsFullHeight =
    openStatement || isModelWorkspace || openAnalysis || isBudgetPrediction || openValuation;
  return {
    isBudgetPrediction,
    openStatement,
    isModelWorkspace,
    openAnalysis,
    openValuation,
    openV3Baseline,
    openV3Prediction,
    openV3Analysis,
    openV3Valuation,
    openFinanceV3,
    needsFullHeight,
  };
}

// Empty-state icon per tab for the shared Models/Analysis/Prediction/Valuation/
// Investment StandardTable block (canon A4, StandardTableEmpty.icon wants a
// LucideIcon component, not the pre-rendered ReactNode in KIND_ICONS).
const EMPTY_STATE_ICON_BY_TAB: Partial<Record<ModuleTab, typeof Calculator>> = {
  models: Calculator,
  analysis: BarChart3,
  investment: Target,
  prediction: TrendingUp,
  valuation: Target,
};

export const FinanceHub: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // ---- View state ----
  const [activeTab, setActiveTab] = useState<ModuleTab>(
    (searchParams.get('tab') as ModuleTab) || 'statements'
  );
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  // Triada standard (canon A3/A6): checkbox selection on the 'statements' tab
  // switches Menu 3 into bulk mode (1:1 markup with AssessmentHub 'list').
  const [selectedStatementIds, setSelectedStatementIds] = useState<Set<string>>(new Set());
  // Same pattern for the shared Models/Analysis/Prediction/Valuation/Investment
  // block (docs/ui-standards/TRIADA_KANON.md A3/A6) — one selection set shared
  // by the 5 tabs, cleared whenever the active tab changes.
  const [selectedFinanceRowIds, setSelectedFinanceRowIds] = useState<Set<string>>(new Set());

  const { openDocuments, setOpenDocuments, activeDocumentId, setActiveDocumentId } =
    useModuleOpenDocuments('finance');
  const [activeDocument, setActiveDocument] = useState<FinanceRow | null>(null);
  const relatedArtifactIdempotencyKeys = useRef(new Map<string, string>());

  // AP_MOUNT §B — read each Finance v3 mount flag ONCE at the top of the
  // component (Rules of Hooks: unconditional call). All four default OFF
  // (CLAUDE.md #7/#9) — `.enabled` is `false` unless a local override was set,
  // so `detailContent` below falls through to the EXACT pre-existing legacy
  // branch whenever a flag is OFF (see the negative-control proof in
  // AP_MOUNT_report.md §B).
  const financeV3PredictionFlag = useFinancePredictionWorkspaceFlag();
  const financeV3BaselineFlag = useFinanceBaselineWorkspaceFlag();
  const financeV3AnalysisFlag = useFinanceAnalysisWorkspaceFlag();
  const financeV3ValuationFlag = useFinanceValuationWorkspaceFlag();
  const financeV3StatementPackFlag = useFinanceStatementPackWorkspaceV2Flag();

  const handleCreateRelatedArtifact = useCallback(
    async (
      artifactType: import('@/services/api/financeV2.types').FinanceArtifactType,
      sourceBusinessVersionId: string
    ) => {
      if (artifactType !== 'HISTORICAL_ANALYSIS') {
        toast('Ten typ artefaktu nie ma jeszcze bezpiecznego kreatora z pakietu sprawozdań.');
        return;
      }
      if (!financeV3AnalysisFlag.enabled) {
        toast.error('Kanoniczny obszar Analizy nie jest włączony dla tej organizacji.');
        return;
      }
      try {
        const idempotencyKey =
          relatedArtifactIdempotencyKeys.current.get(sourceBusinessVersionId) ??
          globalThis.crypto.randomUUID();
        relatedArtifactIdempotencyKeys.current.set(sourceBusinessVersionId, idempotencyKey);
        const response = (await Api.post(
          `/v8/finance-v2/versions/${encodeURIComponent(sourceBusinessVersionId)}/derived-analysis`,
          { idempotencyKey }
        )) as any;
        const created = response?.data ?? response;
        if (!created?.artifactId || !created?.businessVersionId) {
          throw new Error('Serwer nie zwrócił stabilnej tożsamości utworzonej analizy.');
        }
        const next = new URLSearchParams(searchParams);
        next.set('tab', 'analysis');
        next.set('canonicalArtifactType', 'HISTORICAL_ANALYSIS');
        next.set('canonicalArtifactId', String(created.artifactId));
        next.set('canonicalBusinessVersionId', String(created.businessVersionId));
        setSearchParams(next);
        relatedArtifactIdempotencyKeys.current.delete(sourceBusinessVersionId);
        setActiveDocumentId(null);
        setActiveDocument(null);
      } catch (error) {
        toast.error(getFinanceErrorMessage(error));
      }
    },
    [financeV3AnalysisFlag.enabled, searchParams, setActiveDocumentId, setSearchParams]
  );

  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportTarget, setExportTarget] = useState<{
    id: string;
    title: string;
    sourceType: 'financial_analysis' | 'financial_model' | 'valuation';
  } | null>(null);

  // ---- Modal visibility ----
  const [showCreateModelModal, setShowCreateModelModal] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [showLinkInitiativeModal, setShowLinkInitiativeModal] = useState(false);
  const [showAnalysisCreateModal, setShowAnalysisCreateModal] = useState(false);
  const [showPredictionCreateModal, setShowPredictionCreateModal] = useState(false);
  const [showValuationCreateModal, setShowValuationCreateModal] = useState(false);
  const [showAnalyzeMenu, setShowAnalyzeMenu] = useState(false);
  const [v8Dashboard, setV8Dashboard] = useState<V8FinanceDashboard | null>(null);
  const [lanePanelOpen, setLanePanelOpen] = useState(false);
  const [useLegacyFinanceMode, setUseLegacyFinanceMode] = useState(false);
  const [createModelSourceStatementPackId, setCreateModelSourceStatementPackId] = useState<
    string | null
  >(null);
  const [analysisSourceStatementPackId, setAnalysisSourceStatementPackId] = useState<string | null>(
    null
  );
  const [analysisInitialTitle, setAnalysisInitialTitle] = useState('');
  const [budgetInitialTitle, setBudgetInitialTitle] = useState('');
  const [valuationInitialSource, setValuationInitialSource] = useState<{
    type?: 'financial_model' | 'financial_analysis' | 'budget' | 'manual';
    id?: string;
  }>({});
  const [valuationInitialTitle, setValuationInitialTitle] = useState('');
  const analyzeMenuRef = useRef<HTMLDivElement | null>(null);
  const openChatWithContext = useOpenChatWithContext();
  const currentOrganization = useAppStore((s) => s.currentOrganization);
  const { isEnabled: isV8FinanceEnabled } = useV8FeatureFlag('finance');
  const { isFeatureBlocked } = usePolicySnapshot();
  const isFinanceBlocked = isFeatureBlocked('finance');
  const isFinanceRuntimeV8 = isV8FinanceEnabled && !useLegacyFinanceMode;
  const lane = useFinanceLane({
    enabled: isFinanceRuntimeV8,
    onUnavailable: () => {
      setUseLegacyFinanceMode(true);
      setV8Dashboard(null);
      setLanePanelOpen(false);
    },
  });
  const validFinanceTabs = useMemo(
    () => ['statements', 'analysis', 'models', 'prediction', 'valuation'] as ModuleTab[],
    []
  );

  // Clear bulk-selection when leaving the Statements tab (Triada standard scope).
  useEffect(() => {
    if (activeTab !== 'statements' && selectedStatementIds.size > 0) {
      setSelectedStatementIds(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Clear bulk-selection when switching between the 5 shared tabs (or leaving
  // to Statements) — mirrors the Statements-tab clearing effect above.
  useEffect(() => {
    if (selectedFinanceRowIds.size > 0) {
      setSelectedFinanceRowIds(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ---- Extracted hooks ----
  const {
    statements,
    models,
    analyses,
    valuations,
    budgets,
    loadingTab,
    loadError,
    loadStatements,
    loadModels,
    loadAnalyses,
    loadValuations,
    loadBudgets,
    rowsForActiveTab,
    filteredRows,
    statusCounts,
  } = useFinanceData(activeTab, searchQuery, activeFilters);

  // #82 — tab-specific column filters (currency/method/analysisType/subtype…) do
  // not exist on every tab. When the tab changes, drop any non-status filter so a
  // stale filter can never silently hide all rows on a tab that lacks that column.
  useEffect(() => {
    setActiveFilters((prev) =>
      prev.some((f) => f.column !== 'status') ? prev.filter((f) => f.column === 'status') : prev
    );
  }, [activeTab]);

  const {
    selectedId,
    selectedItem,
    statementPreviewDetail,
    statementPreviewRatios,
    modelPreviewDetail,
    predictionValidations,
    analysisPreviewRatios,
    budgetPreviewScenarios,
    valuationPreviewResults,
    valuationPreviewDetail,
    getBudgetRawId,
    loadModelPreview,
    loadPredictionPreview,
    loadBudgetPreviewScenarios,
    loadAnalysisPreviewRatios,
    loadValuationPreviewResults,
    onSelectRow,
    deselectRow,
  } = useFinanceSelection(activeTab);

  const handleOpenEntityChat = useCallback(
    (row: FinanceRow) => {
      const entityTypeMap: Record<string, string> = {
        statements: 'financial_statement',
        models: 'financial_model',
        analysis: 'financial_analysis',
        prediction: 'financial_model',
        valuation: 'valuation',
        investment: 'financial_analysis',
      };
      const teresaPrompt = buildFinanceTeresaPrompt(row.kind, t);
      openChatWithContext({
        entityType: entityTypeMap[row.kind] || 'financial_model',
        entityId: row.id,
        entityName: row.title,
        contextData: {
          kind: row.kind,
          status: row.status,
          tab: activeTab,
          organizationName: currentOrganization?.name,
          teresaPrompt,
        },
      });
    },
    [openChatWithContext, activeTab, currentOrganization?.name, t]
  );

  const loadV8Dashboard = useCallback(async () => {
    if (!isFinanceRuntimeV8) {
      setV8Dashboard(null);
      return;
    }
    try {
      const response = await V8FinanceApi.getDashboard();
      setV8Dashboard(response.dashboard);
    } catch (error) {
      if (shouldFallbackToLegacyFinance(error)) {
        setUseLegacyFinanceMode(true);
        setV8Dashboard(null);
        return;
      }
      throw error;
    }
  }, [isFinanceRuntimeV8]);

  useEffect(() => {
    setUseLegacyFinanceMode(false);
    setV8Dashboard(null);
    setLanePanelOpen(false);
  }, [currentOrganization?.id]);

  useEffect(() => {
    let cancelled = false;
    if (!isFinanceRuntimeV8) {
      setV8Dashboard(null);
      return () => {
        cancelled = true;
      };
    }
    void loadV8Dashboard().catch(() => {
      if (!cancelled) setV8Dashboard(null);
    });
    return () => {
      cancelled = true;
    };
  }, [isFinanceRuntimeV8, loadV8Dashboard]);

  useEffect(() => {
    if (location.pathname !== ROUTES.ECONOMICS) return;
    navigate(
      {
        pathname: ROUTES.FINANCE,
        search: location.search,
      },
      { replace: true }
    );
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    const deepLink = parseFinanceDeepLink(location.pathname);
    if (!deepLink) return;
    const { tab, entityId } = deepLink;
    // Wait for useFinanceData to expose rows for the target tab. Previously the
    // effect looked in the old tab's rows once and never retried, so cold links
    // silently stayed on the list.
    if (tab !== activeTab) {
      setActiveTab(tab);
      return;
    }
    const row = rowsForActiveTab.find((candidate) => candidate.id === entityId);
    if (!row) return;
    const currentPredictionType = (activeDocument as FinanceModelRow | null)?.predictionType;
    const targetPredictionType = (row as FinanceModelRow).predictionType;
    if (
      entityId !== activeDocumentId ||
      activeDocument?.kind !== row.kind ||
      currentPredictionType !== targetPredictionType
    ) {
      setActiveDocumentId(entityId);
      setActiveDocument(row);
      onSelectRow(row);
    }
  }, [
    activeDocument,
    activeDocumentId,
    activeTab,
    location.pathname,
    onSelectRow,
    rowsForActiveTab,
    setActiveDocumentId,
  ]);

  useEffect(() => {
    if (!activeDocument) return;
    if (
      activeDocument.kind === 'models' ||
      (activeDocument.kind === 'prediction' &&
        (activeDocument as FinanceModelRow).predictionType === 'model')
    ) {
      void loadModelPreview(activeDocument as FinanceModelRow);
    }
  }, [activeDocument, loadModelPreview]);

  const statementRows = useMemo(
    () =>
      (statements || []).map((statement: any): FinanceStatementRow => {
        const childStatements = Array.isArray(statement.statements)
          ? statement.statements.map((row: any) => ({
              id: String(row.id),
              statementType: String(row.statement_type || ''),
              rawStatus: String(row.status || 'draft'),
              readinessStatus: String(row.readiness_status || 'pending'),
              readinessScore: Number(row.readiness_score ?? 0),
              validationStatus: String(row.validation_status || 'pending'),
              mappedLineCount: Number(row.mapped_line_count ?? 0),
              totalLineCount: Number(row.total_line_count ?? 0),
              unmappedLineCount: Number(row.unmapped_line_count ?? 0),
              sourceFileName: String(row.source_file_name || ''),
              updatedAt: String(row.updated_at || row.created_at || ''),
            }))
          : [];
        const presentTypes = new Set<string>();
        if (Number(statement.pl_count ?? 0) > 0) presentTypes.add('P&L');
        if (Number(statement.bs_count ?? 0) > 0) presentTypes.add('BS');
        if (Number(statement.cf_count ?? 0) > 0) presentTypes.add('CF');
        for (const row of childStatements) {
          if (row.statementType) presentTypes.add(row.statementType);
        }
        const mappedLineCount = childStatements.reduce(
          (sum: number, row: any) => sum + Number(row.mappedLineCount || 0),
          0
        );
        const unmappedLineCount = childStatements.reduce(
          (sum: number, row: any) => sum + Number(row.unmappedLineCount || 0),
          0
        );
        const totalLineCount = mappedLineCount + unmappedLineCount;
        const effectiveReadiness = String(
          statement.pack_readiness_status || statement.readiness_status || 'pending'
        ).toLowerCase();
        const missingStatementTypes =
          typeof statement.missing_statement_types === 'string' &&
          statement.missing_statement_types.trim().startsWith('[')
            ? JSON.parse(statement.missing_statement_types)
            : Array.isArray(statement.missing_statement_types)
              ? statement.missing_statement_types
              : [];
        return {
          id: String(statement.id),
          title:
            sanitizeStatementTitle(statement.entity_name) ||
            sanitizeStatementTitle(statement.period_label) ||
            `${t('finance.pack.titleFallback', 'Statement Pack')} ${sanitizeStatementTitle(statement.period_end)}`.trim(),
          kind: 'statements',
          status:
            effectiveReadiness === 'ready'
              ? 'APPROVED'
              : effectiveReadiness === 'recoverable'
                ? 'REVIEW'
                : 'DRAFT',
          statementType: 'PACK',
          statementPackId: String(statement.id),
          entityName: String(statement.entity_name || ''),
          // Ten sam powod co przy `periodLabel` — oba trafiaja do kolumny
          // PERIOD jako zapasowy zapis `start → koniec`.
          periodStart: sanitizeStatementTitle(statement.period_start),
          periodEnd: sanitizeStatementTitle(statement.period_end),
          /**
           * P-24 (Piotr, Finance → Statements, 2026-07-27): „Zmień ten czas
           * w period i już będzie dużo lepiej".
           *
           * `title` przechodził przez `sanitizeStatementTitle`, a `periodLabel`
           * NIE — więc kolumna PERIOD dalej pokazywała surowe
           * `Thu Dec 31 2026 00:00:00 GMT+0000 (Coordinated Universal Time)`.
           * Ta sama wartość szła też do karty otwartego dokumentu w Menu 3
           * i do tytułu podglądu.
           */
          periodLabel: sanitizeStatementTitle(statement.period_label),
          currency: String(statement.currency || 'PLN'),
          scaling: String(statement.scaling || 'units'),
          sourceFileName: childStatements
            .map((row: any) => row.sourceFileName)
            .filter(Boolean)
            .join(', '),
          validationStatus: String(statement.pack_status || 'pending'),
          mappedLineCount,
          totalLineCount,
          unmappedLineCount,
          sourceStatementCount: Number(
            statement.source_statement_count ??
              childStatements.length ??
              Number(statement.pl_count ?? 0) +
                Number(statement.bs_count ?? 0) +
                Number(statement.cf_count ?? 0)
          ),
          statementIds: childStatements.map((row: any) => row.id),
          missingStatementTypes: missingStatementTypes.map((value: unknown) => String(value)),
          completenessLabel: ['P&L', 'BS', 'CF']
            .map((type) => (presentTypes.has(type) ? type : `—${type}`))
            .join(' / '),
          childStatements,
          nonFinancialLineCount: Number(statement.non_financial_line_count ?? 0),
          overallConfidence: Number(statement.overall_confidence ?? 0),
          rawStatus: String(statement.pack_status || statement.status || 'draft'),
          readinessStatus: effectiveReadiness,
          readinessScore: Number(statement.pack_readiness_score ?? statement.readiness_score ?? 0),
          readinessSummary: String(
            statement.pack_quality_summary || statement.quality_summary || ''
          ),
          readinessReasonCodes:
            typeof statement.pack_quality_reason_codes === 'string' &&
            statement.pack_quality_reason_codes.trim().startsWith('[')
              ? JSON.parse(statement.pack_quality_reason_codes)
              : Array.isArray(statement.pack_quality_reason_codes)
                ? statement.pack_quality_reason_codes
                : [],
          documentClass: String(statement.document_class || ''),
          extractionStrategy: String(statement.extraction_strategy || ''),
          templateFamily: statement.template_family ? String(statement.template_family) : null,
          valuesVersion: Number(statement.values_version ?? 0),
          isWorkable: effectiveReadiness === 'ready',
          updatedAt: String(
            statement.updated_at || statement.created_at || new Date().toISOString()
          ),
        };
      }),
    [statements, t]
  );
  const readyStatementRows = useMemo(
    () => statementRows.filter((statement) => statement.isWorkable),
    [statementRows]
  );
  const analyzeContextRow = useMemo(
    () => activeDocument ?? selectedItem ?? null,
    [activeDocument, selectedItem]
  );

  // ---- Document management ----
  const handleOpenFull = useCallback((row: FinanceRow) => {
    const doc: OpenDocument = {
      id: row.id,
      type: 'report',
      subType: 'finance',
      name: row.title,
      status: statusToItemStatus(row.status),
    };
    setOpenDocuments((prev) => (prev.some((d) => d.id === doc.id) ? prev : [...prev, doc]));
    setActiveDocumentId(row.id);
    setActiveDocument(row);
  }, []);

  const handleCloseDocument = useCallback(
    (id: string) => {
      setOpenDocuments((prev) => prev.filter((d) => d.id !== id));
      if (activeDocumentId === id) {
        setActiveDocumentId(null);
        setActiveDocument(null);
      }
    },
    [activeDocumentId]
  );

  const handleShowList = useCallback(() => {
    setActiveDocumentId(null);
    setActiveDocument(null);
    const kind: FinanceKind =
      activeTab === 'statements'
        ? 'statements'
        : activeTab === 'models'
          ? 'models'
          : activeTab === 'analysis'
            ? 'analysis'
            : activeTab === 'investment'
              ? 'investment'
              : activeTab === 'prediction'
                ? 'prediction'
                : 'valuation';
    if (kind === 'statements') loadStatements().catch(() => {});
    if (kind === 'analysis' || kind === 'investment') loadAnalyses().catch(() => {});
    if (kind === 'models') loadModels().catch(() => {});
    if (kind === 'prediction') {
      loadModels().catch(() => {});
      loadBudgets().catch(() => {});
    }
    if (kind === 'valuation') loadValuations().catch(() => {});
  }, [activeTab, loadStatements, loadAnalyses, loadModels, loadBudgets, loadValuations]);

  const handleRemoveFilter = useCallback(
    (id: string) => setActiveFilters((prev) => prev.filter((f) => f.id !== id)),
    []
  );
  const handleClearFilters = useCallback(() => setActiveFilters([]), []);
  const focusStatementQueue = useCallback(
    (status: 'APPROVED' | 'REVIEW' | 'DRAFT') => {
      const label =
        status === 'APPROVED'
          ? t('finance.counters.readyStatements', 'Ready Statements')
          : status === 'REVIEW'
            ? t('finance.counters.recoveryQueue', 'Recovery Queue')
            : t('finance.counters.rejectedImports', 'Rejected Imports');
      setActiveFilters((prev) => [
        ...prev.filter((filter) => filter.column !== 'status'),
        {
          id: `status-${status}`,
          column: 'status',
          value: status,
          label,
        },
      ]);
    },
    [t]
  );
  const buildAnalyzeTitle = useCallback((base: string, suffix: string) => {
    const trimmedBase = String(base || '')
      .trim()
      .replace(/\s+/g, ' ');
    return trimmedBase ? `${trimmedBase} ${suffix}` : suffix;
  }, []);
  const openAnalysisFlow = useCallback(
    (options?: {
      title?: string;
      statementPackId?: string | null;
      analysisType?: 'comprehensive' | 'investment_case';
    }) => {
      setShowAnalyzeMenu(false);
      setAnalysisInitialTitle(options?.title || '');
      setAnalysisSourceStatementPackId(options?.statementPackId || null);
      const targetTab = options?.analysisType === 'investment_case' ? 'investment' : 'analysis';
      setActiveTab(targetTab);
      setShowAnalysisCreateModal(true);
    },
    []
  );
  const openModelFlow = useCallback((statementPackId?: string | null) => {
    setShowAnalyzeMenu(false);
    setCreateModelSourceStatementPackId(statementPackId || null);
    setActiveTab('models');
    setShowCreateModelModal(true);
  }, []);
  const openBudgetFlow = useCallback((title?: string) => {
    setShowAnalyzeMenu(false);
    setBudgetInitialTitle(title || '');
    setActiveTab('prediction');
    setShowPredictionCreateModal(true);
  }, []);
  const openValuationFlow = useCallback(
    (options?: {
      title?: string;
      sourceType?: 'financial_model' | 'financial_analysis' | 'budget' | 'manual';
      sourceId?: string;
    }) => {
      setShowAnalyzeMenu(false);
      setValuationInitialTitle(options?.title || '');
      setValuationInitialSource(
        options?.sourceType ? { type: options.sourceType, id: options.sourceId } : {}
      );
      setActiveTab('valuation');
      setShowValuationCreateModal(true);
    },
    []
  );

  const handleModelChanged = useCallback(async () => {
    await loadModels();
  }, [loadModels]);
  const handleStatementChanged = useCallback(async () => {
    await loadStatements();
  }, [loadStatements]);
  const handleAnalysisChanged = useCallback(async () => {
    await loadAnalyses();
  }, [loadAnalyses]);
  const handleBudgetChanged = useCallback(async () => {
    await loadBudgets();
  }, [loadBudgets]);
  const handleValuationChanged = useCallback(async () => {
    await loadValuations();
  }, [loadValuations]);

  const refreshFinanceTruth = useCallback(
    async (kinds: FinanceKind[]) => {
      await Promise.allSettled([
        loadV8Dashboard().catch(() => {
          setV8Dashboard(null);
        }),
        ...kinds.map((kind) => {
          if (kind === 'statements') return loadStatements();
          if (kind === 'analysis' || kind === 'investment') return loadAnalyses();
          if (kind === 'models') return loadModels();
          if (kind === 'prediction') return Promise.all([loadModels(), loadBudgets()]);
          return loadValuations();
        }),
      ]);
    },
    [loadAnalyses, loadBudgets, loadModels, loadStatements, loadV8Dashboard, loadValuations]
  );

  const handleExport = useCallback((row: FinanceRow) => {
    const sourceType =
      row.kind === 'analysis' || row.kind === 'investment'
        ? 'financial_analysis'
        : row.kind === 'valuation'
          ? 'valuation'
          : 'financial_model';
    setExportTarget({ id: row.id, title: row.title, sourceType });
    setExportDialogOpen(true);
  }, []);

  const handleCreateModelFromStatement = useCallback((row: FinanceStatementRow) => {
    setCreateModelSourceStatementPackId(row.id);
    setShowCreateModelModal(true);
  }, []);

  const handleCreateAnalysisFromStatements = useCallback(
    (row: FinanceStatementRow) => {
      setAnalysisSourceStatementPackId(row.id);
      setAnalysisInitialTitle(
        buildAnalyzeTitle(
          row.entityName || row.periodLabel || row.title,
          t('finance.preview.suffixAnalysis', 'analysis')
        )
      );
      setShowAnalysisCreateModal(true);
    },
    [buildAnalyzeTitle, t]
  );

  /**
   * FIN-005: names already taken in this tenant, so "Duplikuj" cannot mint a
   * second record with an identical title. Reads the RAW loaded collections
   * (not `filteredRows`) — a search box or an active filter must not hide a
   * name and let a collision through.
   */
  const getExistingTitles = useCallback(
    (kind: FinanceRow['kind']): string[] => {
      const namesOf = (rows: any[], ...fields: string[]) =>
        (rows || [])
          .map((row) => {
            for (const field of fields) {
              const value = row?.[field];
              if (typeof value === 'string' && value.trim()) return value;
            }
            return '';
          })
          .filter(Boolean);

      switch (kind) {
        case 'models':
          return namesOf(models, 'name', 'title');
        case 'analysis':
        case 'investment':
          return namesOf(analyses, 'title', 'name');
        case 'valuation':
          return namesOf(valuations, 'title', 'name');
        case 'prediction':
          // The prediction tab mixes models and budgets in one list.
          return [...namesOf(models, 'name', 'title'), ...namesOf(budgets, 'title', 'name')];
        case 'statements':
        default:
          return namesOf(statements, 'entity_name', 'period_label');
      }
    },
    [models, analyses, valuations, budgets, statements]
  );

  // ---- Row actions ----
  const { getRowActions, handleDelete: handleFinanceDelete } = useFinanceRowActions({
    handleOpenFull,
    handleOpenPreview: (row) => onSelectRow(row),
    handleExport,
    handleOpenEntityChat,
    handleCreateModelFromStatement,
    handleCreateAnalysisFromStatements,
    loadStatements,
    loadModels,
    loadAnalyses,
    loadBudgets,
    loadValuations,
    loadPredictionPreview,
    loadBudgetPreviewScenarios,
    loadValuationPreviewResults,
    getBudgetRawId,
    getExistingTitles,
  });

  // ---- Preview ----
  const { renderPreviewBody, renderPreviewFooter } = useFinancePreview({
    statementPreviewDetail,
    statementPreviewRatios,
    modelPreviewDetail,
    predictionValidations,
    analysisPreviewRatios,
    budgetPreviewScenarios,
    valuationPreviewResults,
    valuationPreviewDetail,
    handleOpenFull,
    handleCreateModelFromStatement,
    handleCreateAnalysisFromStatements,
    loadStatements,
    loadModels,
    loadAnalyses,
    loadAnalysisPreviewRatios,
    loadBudgets,
    loadBudgetPreviewScenarios,
    loadPredictionPreview,
    loadValuations,
    loadValuationPreviewResults,
    getBudgetRawId,
    versionSnapshots: lane.versionSnapshots,
  });

  // ---- URL param handling for cross-module deep links ----
  useEffect(() => {
    const tab = searchParams.get('tab');
    const createFrom = searchParams.get('createFrom') as
      | 'financial_model'
      | 'financial_analysis'
      | 'budget'
      | null;
    const sourceId = searchParams.get('sourceId');
    const initiativeName = searchParams.get('initiativeName');

    if (tab && validFinanceTabs.includes(tab as ModuleTab)) {
      setActiveTab(tab as ModuleTab);
    }

    if (initiativeName && !searchQuery.trim()) {
      setSearchQuery(initiativeName);
    }

    if (createFrom && tab === 'valuation') {
      setValuationInitialSource({ type: createFrom, id: sourceId || undefined });
      setShowValuationCreateModal(true);
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('createFrom');
      nextParams.delete('sourceId');
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchParams, searchQuery, setSearchParams, validFinanceTabs]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);
    if (nextParams.get('tab') === activeTab) return;
    nextParams.set('tab', activeTab);
    setSearchParams(nextParams, { replace: true });
  }, [activeTab, searchParams, setSearchParams]);

  useEffect(() => {
    if (!showAnalyzeMenu) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (analyzeMenuRef.current?.contains(event.target as Node)) return;
      setShowAnalyzeMenu(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [showAnalyzeMenu]);

  // ---- Tabs ----
  const tabs = useMemo(
    () => [
      {
        id: 'statements' as ModuleTab,
        label: t('finance.tabs.statements', 'Statements'),
        icon: <FileText size={16} />,
        count: statements.length,
      },
      {
        id: 'analysis' as ModuleTab,
        label: t('finance.tabs.analysis', 'Analysis'),
        icon: <BarChart3 size={16} />,
        count: analyses.length,
      },
      {
        id: 'models' as ModuleTab,
        label: t('finance.tabs.models', 'Models'),
        icon: <Calculator size={16} />,
        count: models.length,
      },
      {
        id: 'prediction' as ModuleTab,
        label: t('finance.tabs.prediction', 'Prediction'),
        icon: <TrendingUp size={16} />,
        count: models.length + budgets.length,
      },
      {
        id: 'valuation' as ModuleTab,
        label: t('finance.tabs.valuation', 'Enterprise valuation'),
        icon: <Target size={16} />,
        count: valuations.length,
      },
    ],
    [t, statements.length, models.length, analyses, valuations.length, budgets.length]
  );

  // ---- Per-tab columns ----
  const statusFilterOptions = useMemo(
    () => [
      { value: 'DRAFT', label: t('common.status.draft', 'Draft'), color: 'bg-slate-400' },
      { value: 'REVIEW', label: t('common.status.review', 'In Review'), color: 'bg-amber-400' },
      {
        value: 'APPROVED',
        label: t('common.status.approved', 'Approved'),
        color: 'bg-emerald-400',
      },
    ],
    [t]
  );

  // Data-driven filter options (#82 — Finance lists must offer more than one
  // filterable column). Derived from the *unfiltered* rows of the active tab so
  // the dropdowns list exactly the values present, no dead options.
  const currencyFilterOptions = useMemo(
    () => buildFilterOptions(rowsForActiveTab as any[], (r) => r.currency),
    [rowsForActiveTab]
  );
  const analysisTypeFilterOptions = useMemo(
    () =>
      buildFilterOptions(
        rowsForActiveTab as any[],
        (r) => r.analysisType,
        (v) => v.charAt(0).toUpperCase() + v.slice(1)
      ),
    [rowsForActiveTab]
  );
  const methodFilterOptions = useMemo(
    () => buildFilterOptions(rowsForActiveTab as any[], (r) => r.method),
    [rowsForActiveTab]
  );
  const sourceTypeFilterOptions = useMemo(
    () =>
      buildFilterOptions(
        rowsForActiveTab as any[],
        (r) => r.sourceType,
        (v) => v.charAt(0).toUpperCase() + v.slice(1)
      ),
    [rowsForActiveTab]
  );
  const predictionSubtypeFilterOptions = useMemo(
    () =>
      buildFilterOptions(
        rowsForActiveTab as any[],
        (r) => r.predictionType,
        (v) =>
          v === 'budget'
            ? t('finance.prediction.budget', 'Budget')
            : t('finance.prediction.model', 'Model')
      ),
    [rowsForActiveTab, t]
  );

  const baseTypeCol: TableColumn = useMemo(
    () => ({
      id: 'type',
      label: t('common.type', 'Type'),
      width: '80px',
      render: (row: FinanceRow) => (
        <div className="flex items-center gap-2">
          {KIND_ICONS[row.kind]}
          <span className="font-mono text-xs font-bold text-c-text-muted">
            {getTypeCode(row.kind)}
          </span>
        </div>
      ),
    }),
    [t]
  );

  const baseTitleCol: TableColumn = useMemo(
    () => ({
      id: 'title',
      label: t('common.name', 'Name'),
      render: (row: FinanceRow) => (
        <span className="block text-sm text-c-text font-medium truncate">{row.title}</span>
      ),
    }),
    [t]
  );

  const baseStatusCol: TableColumn = useMemo(
    () => ({
      id: 'status',
      label: t('common.status', 'Status'),
      width: '140px',
      filterable: true,
      filterOptions: statusFilterOptions,
    }),
    [t, statusFilterOptions]
  );

  const baseUpdatedCol: TableColumn = useMemo(
    () => ({
      id: 'updatedAt',
      label: t('common.updated', 'Updated'),
      width: '120px',
      sortable: true,
    }),
    [t]
  );

  const columnsForActiveTab: TableColumn[] = useMemo(() => {
    if (activeTab === 'statements') {
      return [
        baseTypeCol,
        baseTitleCol,
        {
          id: 'completeness',
          label: t('finance.columns.statementType', 'Completeness'),
          width: '170px',
          render: (row: FinanceRow) =>
            row.kind === 'statements' ? (
              <span className="text-sm text-c-text-secondary">{row.completenessLabel || '—'}</span>
            ) : (
              <span className="text-sm text-c-text-muted">—</span>
            ),
        },
        {
          id: 'period',
          label: t('finance.columns.period', 'Period'),
          width: '170px',
          render: (row: FinanceRow) =>
            row.kind === 'statements' ? (
              <span className="text-sm text-c-text-secondary">
                {row.periodLabel || `${row.periodStart} → ${row.periodEnd}`}
              </span>
            ) : (
              <span className="text-sm text-c-text-muted">—</span>
            ),
        },
        {
          id: 'currency',
          label: t('common.currency', 'Currency'),
          width: '90px',
          filterable: true,
          filterOptions: currencyFilterOptions,
          render: (row: FinanceRow) =>
            row.kind === 'statements' ? (
              <span className="text-sm text-c-text-secondary">{row.currency}</span>
            ) : (
              <span className="text-sm text-c-text-muted">—</span>
            ),
        },
        {
          id: 'sourceStatementCount',
          label: t('finance.columns.mappedLines', 'Docs'),
          width: '90px',
          render: (row: FinanceRow) =>
            row.kind === 'statements' ? (
              <span className="text-sm text-c-text-secondary">
                {row.sourceStatementCount ?? row.statementIds?.length ?? 0}
              </span>
            ) : (
              <span className="text-sm text-c-text-muted">—</span>
            ),
        },
        baseStatusCol,
        baseUpdatedCol,
      ];
    }
    if (activeTab === 'models') {
      return [
        baseTypeCol,
        baseTitleCol,
        {
          id: 'sourceDocument',
          label: t('finance.columns.document', 'Document'),
          width: '220px',
          render: (row: FinanceRow) =>
            row.kind === 'models' ? (
              <span className="text-sm text-c-text-secondary truncate">
                {row.sourceDocumentTitle || '—'}
              </span>
            ) : (
              <span className="text-sm text-c-text-muted">—</span>
            ),
        },
        {
          id: 'forecastWindow',
          label: t('finance.columns.forecastWindow', 'Forecast'),
          width: '120px',
          render: (row: FinanceRow) =>
            row.kind === 'models' ? (
              <span className="text-sm text-c-text-secondary">{row.forecastWindowLabel}</span>
            ) : (
              <span className="text-sm text-c-text-muted">—</span>
            ),
        },
        {
          id: 'variants',
          label: t('finance.columns.variants', 'Variants'),
          width: '190px',
          render: (row: FinanceRow) =>
            row.kind === 'models' ? (
              <span className="text-sm text-c-text-secondary">{row.variantLabel}</span>
            ) : (
              <span className="text-sm text-c-text-muted">—</span>
            ),
        },
        {
          id: 'analyticsDepth',
          label: t('finance.columns.analyticsDepth', 'Levels'),
          width: '90px',
          render: (row: FinanceRow) =>
            row.kind === 'models' ? (
              <span className="text-sm text-c-text-secondary">{row.analyticalDepthLabel}</span>
            ) : (
              <span className="text-sm text-c-text-muted">—</span>
            ),
        },
        baseStatusCol,
        baseUpdatedCol,
      ];
    }
    if (activeTab === 'analysis' || activeTab === 'investment') {
      return [
        baseTypeCol,
        baseTitleCol,
        {
          id: 'analysisType',
          label: t('finance.columns.analysisType', 'Type'),
          width: '140px',
          filterable: true,
          filterOptions: analysisTypeFilterOptions,
          render: (row: FinanceRow) =>
            row.kind === 'analysis' || row.kind === 'investment' ? (
              <span className="text-sm text-c-text-secondary capitalize">{row.analysisType}</span>
            ) : (
              <span className="text-sm text-c-text-muted">—</span>
            ),
        },
        {
          id: 'periodCount',
          label: t('finance.columns.periods', 'Periods'),
          width: '100px',
          render: (row: FinanceRow) =>
            row.kind === 'analysis' || row.kind === 'investment' ? (
              <span className="text-sm text-c-text-secondary">{row.periodCount}</span>
            ) : (
              <span className="text-sm text-c-text-muted">—</span>
            ),
        },
        {
          id: 'currency',
          label: t('common.currency', 'Currency'),
          width: '90px',
          filterable: true,
          filterOptions: currencyFilterOptions,
          render: (row: FinanceRow) =>
            row.kind === 'analysis' || row.kind === 'investment' ? (
              <span className="text-sm text-c-text-secondary">{row.currency}</span>
            ) : (
              <span className="text-sm text-c-text-muted">—</span>
            ),
        },
        baseStatusCol,
        baseUpdatedCol,
      ];
    }
    if (activeTab === 'prediction') {
      return [
        baseTypeCol,
        {
          // id = 'predictionType' so the built-in FilterableTable match
          // (`row[column.id]`) reads the raw 'model' | 'budget' field directly.
          id: 'predictionType',
          label: t('finance.columns.subtype', 'Subtype'),
          width: '130px',
          filterable: true,
          filterOptions: predictionSubtypeFilterOptions,
          render: (row: FinanceRow) => {
            if (row.kind !== 'prediction')
              return <span className="text-sm text-c-text-muted">—</span>;
            const pRow = row as FinanceModelRow;
            const isBudget = pRow.predictionType === 'budget';
            return (
              <MetaChip
                label={
                  isBudget
                    ? t('finance.prediction.budget', 'Budget')
                    : t('finance.prediction.model', 'Model')
                }
              />
            );
          },
        },
        baseTitleCol,
        {
          id: 'scenario',
          label: t('finance.columns.scenario', 'Scenario'),
          width: '120px',
          render: (row: FinanceRow) =>
            row.kind === 'prediction' ? (
              <span className="text-sm text-c-text-secondary">
                {(row as FinanceModelRow).scenario}
              </span>
            ) : (
              <span className="text-sm text-c-text-muted">—</span>
            ),
        },
        {
          id: 'horizon',
          label: t('finance.columns.horizon', 'Horizon'),
          width: '120px',
          render: (row: FinanceRow) => {
            if (row.kind !== 'prediction')
              return <span className="text-sm text-c-text-muted">—</span>;
            const pRow = row as FinanceModelRow;
            if (pRow.predictionType === 'budget')
              return (
                <span className="text-sm text-c-text-secondary">
                  {pRow.periodStart && pRow.periodEnd
                    ? `${pRow.periodStart} → ${pRow.periodEnd}`
                    : '—'}
                </span>
              );
            return (
              <span className="text-sm text-c-text-secondary">
                {pRow.horizonMonths} {t('finance.units.mo', 'mo')}
              </span>
            );
          },
        },
        baseStatusCol,
        baseUpdatedCol,
      ];
    }
    return [
      baseTypeCol,
      baseTitleCol,
      {
        id: 'sourceType',
        label: t('finance.columns.source', 'Source'),
        width: '120px',
        filterable: true,
        filterOptions: sourceTypeFilterOptions,
        render: (row: FinanceRow) =>
          row.kind === 'valuation' ? (
            <span className="text-sm text-c-text-secondary capitalize">{row.sourceType}</span>
          ) : (
            <span className="text-sm text-c-text-muted">—</span>
          ),
      },
      {
        id: 'method',
        label: t('finance.columns.method', 'Method'),
        width: '100px',
        filterable: true,
        filterOptions: methodFilterOptions,
        render: (row: FinanceRow) =>
          row.kind === 'valuation' ? (
            <span className="text-sm text-c-text-secondary">{row.method}</span>
          ) : (
            <span className="text-sm text-c-text-muted">—</span>
          ),
      },
      {
        id: 'horizonYears',
        label: t('finance.columns.horizonYears', 'Horizon'),
        width: '100px',
        render: (row: FinanceRow) =>
          row.kind === 'valuation' ? (
            <span className="text-sm text-c-text-secondary">
              {row.horizonYears} {t('finance.units.yr', 'yr')}
            </span>
          ) : (
            <span className="text-sm text-c-text-muted">—</span>
          ),
      },
      baseStatusCol,
      baseUpdatedCol,
    ];
  }, [
    activeTab,
    baseTypeCol,
    baseTitleCol,
    baseStatusCol,
    baseUpdatedCol,
    currencyFilterOptions,
    analysisTypeFilterOptions,
    methodFilterOptions,
    sourceTypeFilterOptions,
    predictionSubtypeFilterOptions,
    t,
  ]);

  // ---- Grid items ----
  const gridItems: GridItem[] = useMemo(
    () =>
      filteredRows.map((row) => ({
        id: row.id,
        name: row.title,
        type: getTypeCode(row.kind),
        typeColor: row.kind,
        status: row.status,
        progress: statusToProgress(row.status),
        updatedAt: row.updatedAt,
        brief:
          row.kind === 'statements'
            ? `${(row as FinanceStatementRow).completenessLabel || 'PACK'} • ${(row as FinanceStatementRow).currency} • ${((row as FinanceStatementRow).periodLabel || (row as FinanceStatementRow).periodEnd) ?? ''}`
            : row.kind === 'models'
              ? `${(row as FinanceModelRow).sourceDocumentTitle || t('finance.preview.modelForecastFallback', 'Forecast model')} • ${(row as FinanceModelRow).forecastWindowLabel || ''} • ${(row as FinanceModelRow).variantLabel || ''}`
              : row.kind === 'prediction'
                ? (row as FinanceModelRow).predictionType === 'budget'
                  ? `${t('finance.prediction.budget', 'Budget')} • ${(row as FinanceModelRow).periodStart || ''} → ${(row as FinanceModelRow).periodEnd || ''}`
                  : `${(row as FinanceModelRow).scenario} • ${(row as FinanceModelRow).currency} • ${(row as FinanceModelRow).horizonMonths} ${t('finance.preview.monthsAbbrev', 'mo')}`
                : row.kind === 'analysis' || row.kind === 'investment'
                  ? `${(row as FinanceAnalysisRow).analysisType} • ${(row as FinanceAnalysisRow).currency} • ${(row as FinanceAnalysisRow).periodCount} ${t('finance.preview.periodsAbbrev', 'per.')}`
                  : `${(row as FinanceValuationRow).method} • ${(row as FinanceValuationRow).currency} • ${(row as FinanceValuationRow).horizonYears} ${t('finance.preview.yearsAbbrev', 'yr')}`,
      })),
    [filteredRows, t]
  );

  // ---- Primary CTA ----
  const primaryCta = useMemo(() => {
    const labels: Record<FinanceKind | 'investment', string> = {
      statements: t('finance.cta.importStatement', 'Import statement'),
      models: t('finance.cta.newModel', '+ New model'),
      analysis: t('finance.cta.newAnalysis', '+ New analysis'),
      prediction: t('finance.cta.newScenario', '+ New scenario'),
      valuation: t('finance.cta.newValuation', '+ New valuation'),
      investment: t('finance.cta.newInvestment', '+ New investment case'),
    };
    const currentKind = (activeTab === 'investment' ? 'investment' : activeTab) as
      | FinanceKind
      | 'investment';
    return (
      <button
        onClick={() => {
          if (currentKind === 'statements') setShowImportWizard(true);
          else if (currentKind === 'models') setShowCreateModelModal(true);
          else if (currentKind === 'analysis' || currentKind === 'investment')
            setShowAnalysisCreateModal(true);
          else if (currentKind === 'prediction') setShowPredictionCreateModal(true);
          else if (currentKind === 'valuation') {
            setValuationInitialSource({});
            setShowValuationCreateModal(true);
          }
        }}
        className="inline-flex items-center h-9 px-4 rounded-full text-sm font-medium bg-c-text text-c-bg hover:opacity-90 transition-colors duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-2 focus-visible:ring-offset-c-bg"
      >
        <span>{labels[currentKind] || labels.models}</span>
      </button>
    );
  }, [activeTab, t]);

  const analyzeActions = useMemo(() => {
    const contextRow = analyzeContextRow;
    const readyStatementContext =
      contextRow?.kind === 'statements' && (contextRow as FinanceStatementRow).isWorkable
        ? (contextRow as FinanceStatementRow)
        : readyStatementRows.length === 1
          ? readyStatementRows[0]
          : null;
    const modelContext: FinanceModelRow | null =
      contextRow &&
      (contextRow.kind === 'models' ||
        (contextRow.kind === 'prediction' &&
          (contextRow as FinanceModelRow).predictionType === 'model'))
        ? (contextRow as FinanceModelRow)
        : null;
    const budgetContext: FinanceModelRow | null =
      contextRow?.kind === 'prediction' &&
      (contextRow as FinanceModelRow).predictionType === 'budget'
        ? (contextRow as FinanceModelRow)
        : null;
    const analysisContext =
      contextRow && (contextRow.kind === 'analysis' || contextRow.kind === 'investment')
        ? (contextRow as FinanceAnalysisRow)
        : null;

    if (activeTab === 'statements') {
      return [
        {
          id: 'model',
          label: t('finance.analyze.modeling', 'Modelowanie'),
          description: t(
            'finance.analyze.modelingHint',
            'Utwórz model finansowy z gotowego statementu.'
          ),
          disabled: readyStatementRows.length === 0,
          onSelect: () => openModelFlow(readyStatementContext?.id || null),
        },
        {
          id: 'budget',
          label: t('finance.analyze.budgeting', 'Budżetowanie'),
          description: t(
            'finance.analyze.budgetingHint',
            'Przejdź do budżetu i utwórz nową pozycję planowania.'
          ),
          disabled: false,
          onSelect: () =>
            openBudgetFlow(
              readyStatementContext
                ? buildAnalyzeTitle(
                    readyStatementContext.periodLabel || readyStatementContext.title,
                    t('finance.preview.suffixBudget', 'budget')
                  )
                : ''
            ),
        },
        {
          id: 'analysis',
          label: t('finance.analyze.financialAnalysis', 'Analiza finansowa'),
          description: t(
            'finance.analyze.financialAnalysisHint',
            'Utwórz analizę finansową na bazie gotowych statementów.'
          ),
          disabled: readyStatementRows.length === 0,
          onSelect: () =>
            openAnalysisFlow({
              title: readyStatementContext
                ? buildAnalyzeTitle(
                    readyStatementContext.periodLabel || readyStatementContext.title,
                    t('finance.preview.suffixFinancialAnalysis', 'financial analysis')
                  )
                : '',
              statementPackId: readyStatementContext ? readyStatementContext.id : null,
            }),
        },
        {
          id: 'valuation',
          label: t('finance.analyze.valuation', 'Wycena przedsiębiorstwa'),
          description: t(
            'finance.analyze.valuationFromStatementsHint',
            'Wycena jest dostępna po utworzeniu modelu, budżetu lub analizy finansowej.'
          ),
          disabled: true,
          onSelect: () => undefined,
        },
      ];
    }

    if (activeTab === 'models' || modelContext) {
      return [
        {
          id: 'analysis',
          label: t('finance.analyze.financialAnalysis', 'Analiza finansowa'),
          description: t(
            'finance.analyze.analysisFromModelHint',
            'Przejdź do Analizy i utwórz draft w kontekście bieżącego modelu.'
          ),
          disabled: !modelContext,
          onSelect: () =>
            openAnalysisFlow({
              title: modelContext
                ? buildAnalyzeTitle(
                    modelContext.title,
                    t('finance.preview.suffixFinancialAnalysis', 'financial analysis')
                  )
                : '',
            }),
        },
        {
          id: 'valuation',
          label: t('finance.analyze.valuation', 'Wycena przedsiębiorstwa'),
          description: t(
            'finance.analyze.valuationFromModelHint',
            'Przejdź do Wyceny i utwórz pozycję na bazie bieżącego modelu.'
          ),
          disabled: !modelContext,
          onSelect: () =>
            openValuationFlow({
              title: modelContext
                ? buildAnalyzeTitle(
                    modelContext.title,
                    t('finance.preview.suffixValuation', 'valuation')
                  )
                : '',
              sourceType: 'financial_model',
              sourceId: modelContext?.id,
            }),
        },
      ];
    }

    if (activeTab === 'prediction') {
      return [
        {
          id: 'analysis',
          label: t('finance.analyze.financialAnalysis', 'Analiza finansowa'),
          description: t(
            'finance.analyze.analysisFromPredictionHint',
            'Przejdź do Analizy i utwórz draft w kontekście bieżącego budżetu lub scenariusza.'
          ),
          disabled: !budgetContext && !modelContext,
          onSelect: () =>
            openAnalysisFlow({
              title: budgetContext
                ? buildAnalyzeTitle(
                    budgetContext.title,
                    t('finance.preview.suffixFinancialAnalysis', 'financial analysis')
                  )
                : '',
            }),
        },
        {
          id: 'valuation',
          label: t('finance.analyze.valuation', 'Wycena przedsiębiorstwa'),
          description: t(
            'finance.analyze.valuationFromPredictionHint',
            'Przejdź do Wyceny i utwórz pozycję na bazie bieżącego modelu lub budżetu.'
          ),
          disabled: !budgetContext && !modelContext,
          onSelect: () =>
            openValuationFlow(
              budgetContext
                ? {
                    title: buildAnalyzeTitle(
                      budgetContext.title,
                      t('finance.preview.suffixValuation', 'valuation')
                    ),
                    sourceType: 'budget',
                    sourceId: getBudgetRawId(budgetContext.id),
                  }
                : {
                    title: '',
                    sourceType: 'financial_model',
                    sourceId: undefined,
                  }
            ),
        },
      ];
    }

    if (activeTab === 'analysis' || activeTab === 'investment') {
      return [
        {
          id: 'valuation',
          label: t('finance.analyze.valuation', 'Wycena przedsiębiorstwa'),
          description: t(
            'finance.analyze.valuationFromAnalysisHint',
            'Przejdź do Wyceny i utwórz pozycję na bazie bieżącej analizy.'
          ),
          disabled: !analysisContext,
          onSelect: () =>
            openValuationFlow({
              title: analysisContext
                ? buildAnalyzeTitle(
                    analysisContext.title,
                    t('finance.preview.suffixValuation', 'valuation')
                  )
                : '',
              sourceType: 'financial_analysis',
              sourceId: analysisContext?.id,
            }),
        },
      ];
    }

    return [];
  }, [
    activeTab,
    analyzeContextRow,
    readyStatementRows,
    openModelFlow,
    openBudgetFlow,
    openAnalysisFlow,
    openValuationFlow,
    buildAnalyzeTitle,
    getBudgetRawId,
    t,
  ]);

  const laneActions = useMemo(() => {
    if (lane.activeLaneRun) {
      return [
        {
          id: 'lane_status',
          label: t('finance.analyze.laneStatus', 'View Lane Status'),
          description: t(
            'finance.analyze.laneStatusHint',
            'View active finance lane progress and issues.'
          ),
          disabled: false,
          onSelect: () => setLanePanelOpen(true),
        },
      ];
    }
    return [
      {
        id: 'lane_start',
        label: t('finance.analyze.laneStart', 'Start Finance Lane'),
        description: t(
          'finance.analyze.laneStartHint',
          'Begin a governed import→analysis→mutation→readback workflow.'
        ),
        disabled: false,
        onSelect: async () => {
          try {
            await lane.startRun();
            toast.success(t('finance.lane.started', 'Finance lane started'));
            setLanePanelOpen(true);
          } catch (err: any) {
            toast.error(getFinanceErrorMessage(err));
          }
        },
      },
    ];
  }, [lane, t]);

  const analyzeActionIcons: Record<string, React.ReactNode> = useMemo(
    () => ({
      lane_start: <GitBranch size={14} className="text-blue-500" />,
      lane_status: <GitBranch size={14} className="text-blue-500" />,
      model: <Calculator size={14} className="text-blue-500" />,
      budget: <TrendingUp size={14} className="text-blue-500" />,
      analysis: <BarChart3 size={14} className="text-emerald-500" />,
      valuation: <Target size={14} className="text-amber-500" />,
    }),
    []
  );

  const allAnalyzeActions = useMemo(
    () => [...laneActions, ...analyzeActions],
    [laneActions, analyzeActions]
  );

  const rightControls = useMemo(() => {
    if (allAnalyzeActions.length === 0) return null;

    return (
      <div ref={analyzeMenuRef} className="relative">
        <button
          onClick={() => setShowAnalyzeMenu((prev) => !prev)}
          aria-expanded={showAnalyzeMenu}
          aria-haspopup="menu"
          className={getMenu3AiButtonClass(showAnalyzeMenu)}
        >
          <Sparkles size={13} />
          <span>{t('finance.analyze.cta', 'Analyze')}</span>
          <ChevronDown
            size={13}
            className={`transition-transform duration-200 ${showAnalyzeMenu ? 'rotate-180' : ''}`}
          />
        </button>
        {showAnalyzeMenu && (
          <div
            className="absolute right-0 mt-2 w-80 rounded-2xl border border-c-border-subtle bg-c-surface-raised backdrop-blur-lg shadow-xl p-1.5 z-20"
            role="menu"
          >
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-c-text-muted">
              {t('finance.analyze.menuTitle', 'Choose next step')}
            </div>
            <div className="space-y-0.5">
              {allAnalyzeActions.map((action) => (
                <button
                  key={action.id}
                  role="menuitem"
                  onClick={action.onSelect}
                  disabled={action.disabled}
                  title={
                    action.disabled
                      ? t(
                          'finance.preview.requiresReadyStatementOrModel',
                          'Requires a ready statement or model'
                        )
                      : undefined
                  }
                  className="group flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-c-surface disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-2 focus-visible:ring-offset-c-bg"
                >
                  <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-c-surface-raised transition-colors group-hover:bg-c-border-subtle">
                    {analyzeActionIcons[action.id] || (
                      <BarChart3 size={14} className="text-c-text-muted" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-c-text">{action.label}</div>
                    <div className="mt-0.5 text-[11px] leading-relaxed text-c-text-muted">
                      {action.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }, [allAnalyzeActions, showAnalyzeMenu, analyzeActionIcons, t]);

  // commandRowRightContent — canonical right slot for Menu 3 actions.
  // Rendered inside commandRowContent (justify-between) because ModuleNavBar does not
  // currently render commandRowRightContent in the command-row path.
  const commandRowRightContent = useMemo(
    () => (
      <div className="flex shrink-0 items-center gap-2">
        {rightControls}
        <button
          type="button"
          onClick={() =>
            openChatWithContext({
              entityType: 'finance_module',
              entityId: 'finance',
              entityName: t('finance.aiChat', 'Finance'),
              contextData: {
                activeTab,
                organizationName: currentOrganization?.name,
                laneStatus: lane.activeLaneRun?.currentStep ?? 'idle',
                teresaPrompt:
                  activeTab === 'models' || activeTab === 'prediction'
                    ? buildFinanceTeresaPrompt(activeTab, t)
                    : undefined,
              },
            })
          }
          className={getMenu3AiButtonClass(false)}
          title={t('finance.openAiChat', 'Open AI Chat for Finance')}
        >
          <MessageCircle size={12} />
          <span>AI</span>
        </button>
      </div>
    ),
    [
      activeTab,
      currentOrganization?.name,
      lane.activeLaneRun?.currentStep,
      openChatWithContext,
      rightControls,
      t,
    ]
  );

  // ---- Command Row ----
  const commandRowContent = useMemo(() => {
    const total = rowsForActiveTab.length;
    const dotColors: Record<string, string> = {
      all: 'bg-slate-400',
      DRAFT: 'bg-slate-400',
      REVIEW: 'bg-amber-400',
      APPROVED: 'bg-emerald-400',
    };
    const chips: Array<{
      id: 'all' | 'DRAFT' | 'REVIEW' | 'APPROVED';
      label: string;
      count: number;
      active: boolean;
    }> = [
      {
        id: 'all',
        label: t('finance.counters.all', 'Wszystkie'),
        count: total,
        active: !activeFilters.some((f) => f.column === 'status'),
      },
      {
        id: 'DRAFT',
        label:
          activeTab === 'statements'
            ? t('finance.counters.rejectedImports', 'Rejected Imports')
            : t('finance.counters.draft', 'Draft'),
        count: statusCounts.DRAFT,
        active: activeFilters.some((f) => f.column === 'status' && f.value === 'DRAFT'),
      },
      {
        id: 'REVIEW',
        label:
          activeTab === 'statements'
            ? t('finance.counters.recoveryQueue', 'Recovery Queue')
            : t('finance.counters.review', 'Review'),
        count: statusCounts.REVIEW,
        active: activeFilters.some((f) => f.column === 'status' && f.value === 'REVIEW'),
      },
      {
        id: 'APPROVED',
        label:
          activeTab === 'statements'
            ? t('finance.counters.readyStatements', 'Ready Statements')
            : t('finance.counters.approved', 'Approved'),
        count: statusCounts.APPROVED,
        active: activeFilters.some((f) => f.column === 'status' && f.value === 'APPROVED'),
      },
    ];
    // V8 pipeline health (ingestion/escalations/linkages/gate pass/stale/unlinked) is
    // system-internal telemetry, not a user filter — it does not belong as loose Menu 3
    // chips (was previously 4 always-rendered "—" placeholder chips even with V8 off,
    // plus up to 2 more when on: 6 technical chips cluttering every tab). TRIADA_KANON
    // §A3/§15.3: collapse rarely-changing / non-filter items into a Menu3DropdownChip.
    // Gated on isFinanceRuntimeV8 && v8Dashboard so it only appears when the data exists.
    const v8HealthItems = v8Dashboard
      ? [
          {
            id: 'ingestion',
            label: t('finance.v8.ingestion', 'Processed imports'),
            icon: <FileText size={14} />,
            trailing: String(v8Dashboard.ingestionPipeline?.totalCount ?? '—'),
            disabled: true,
            onSelect: () => {},
          },
          {
            id: 'escalations',
            label: t('finance.v8.escalations', 'Escalations'),
            icon: <AlertTriangle size={14} />,
            trailing: String(v8Dashboard.unresolvedEscalationsCount ?? '—'),
            disabled: true,
            onSelect: () => {},
          },
          {
            id: 'linkages',
            label: t('finance.v8.linkages', 'Linkages'),
            icon: <GitBranch size={14} />,
            trailing: String(v8Dashboard.linkageHealth?.totalLinkages ?? '—'),
            disabled: true,
            onSelect: () => {},
          },
          {
            id: 'gates',
            label: t('finance.v8.gates', 'Gate pass rate'),
            icon: <Target size={14} />,
            trailing:
              v8Dashboard.promotionGatePassRate == null
                ? '—'
                : `${Math.round(v8Dashboard.promotionGatePassRate * 100)}%`,
            disabled: true,
            onSelect: () => {},
          },
          {
            id: 'stale',
            label: t('finance.v8.staleRefreshes', 'Stale data'),
            icon: <Clock size={14} />,
            trailing: String(v8Dashboard.staleSourceRefreshesCount ?? 0),
            disabled: true,
            dividerBefore: true,
            onSelect: () => {},
          },
          {
            id: 'unlinked',
            label: t('finance.v8.unlinked', 'Unlinked initiatives'),
            icon: <Link2 size={14} />,
            trailing: String(v8Dashboard.linkageHealth?.unlinkedInitiativesCount ?? 0),
            danger: (v8Dashboard.linkageHealth?.unlinkedInitiativesCount ?? 0) > 0,
            onSelect: () => setShowLinkInitiativeModal(true),
          },
        ]
      : [];
    const v8EscalationsCount = v8Dashboard?.unresolvedEscalationsCount ?? 0;
    const v8UnlinkedCount = v8Dashboard?.linkageHealth?.unlinkedInitiativesCount ?? 0;
    // Canonical Menu 3 layout: justify-between — presets left, actions right.
    // commandRowRightContent is embedded here because ModuleNavBar's command-row
    // path currently does not render the commandRowRightContent prop.
    return (
      <div className="flex items-center justify-between gap-2 w-full min-w-0">
        {/* Left slot — preset filter chips */}
        <div className={MENU_3_LEFT_CLASS}>
          {chips.map((chip) => (
            <button
              key={chip.id}
              onClick={() => {
                if (chip.id === 'all') {
                  setActiveFilters((prev) => prev.filter((f) => f.column !== 'status'));
                  return;
                }
                const statusValue = chip.id;
                if (chip.active) {
                  setActiveFilters((prev) =>
                    prev.filter((f) => !(f.column === 'status' && f.value === statusValue))
                  );
                  return;
                }
                setActiveFilters((prev) => [
                  ...prev.filter((f) => f.column !== 'status'),
                  {
                    id: `status-${statusValue}`,
                    column: 'status',
                    value: statusValue,
                    label: chip.label,
                  },
                ]);
              }}
              className={chip.active ? MENU_3_CHIP_ACTIVE : MENU_3_CHIP_INACTIVE}
            >
              <span
                className={
                  chip.id === 'all'
                    ? MENU_3_ALL_DOT_CLASS
                    : `h-1.5 w-1.5 rounded-full flex-shrink-0 ${dotColors[chip.id] || dotColors.all}`
                }
              />
              <span>{chip.label}</span>
              <span className={chip.active ? MENU_3_BADGE_ACTIVE : MENU_3_BADGE_INACTIVE}>
                {chip.count}
              </span>
            </button>
          ))}
          {isFinanceRuntimeV8 && v8Dashboard && (
            <>
              <div className="mx-1 h-5 w-px shrink-0 bg-c-border-subtle" />
              <Menu3DropdownChip
                data-testid="finance-v8-health-chip"
                icon={<Activity size={14} className="text-c-text-muted" />}
                label={t('finance.v8.healthChip', 'Data health')}
                badgeCount={v8EscalationsCount > 0 ? v8EscalationsCount : undefined}
                active={v8EscalationsCount > 0 || v8UnlinkedCount > 0}
                ariaLabel={t('finance.v8.healthChipAria', 'Data health — import pipeline details')}
                align="left"
                items={v8HealthItems}
              />
            </>
          )}
          {isFinanceRuntimeV8 && (
            <FinanceLaneStrip
              activeLaneRun={lane.activeLaneRun}
              degradedAlerts={lane.degradedAlerts}
              onOpenPanel={() => setLanePanelOpen(true)}
            />
          )}
        </div>
        {/* Right slot — contextual AI/action buttons (§3.4 MUST) */}
        {commandRowRightContent}
      </div>
    );
  }, [
    rowsForActiveTab.length,
    statusCounts,
    activeFilters,
    activeTab,
    t,
    v8Dashboard,
    lane.activeLaneRun,
    lane.degradedAlerts,
    isFinanceRuntimeV8,
    commandRowRightContent,
  ]);

  const emptyMessage = useMemo(() => {
    const activeStatusFilter = activeFilters.find((filter) => filter.column === 'status')?.value;
    const messages: Record<FinanceKind | 'investment', string> = {
      statements:
        activeStatusFilter === 'APPROVED'
          ? t(
              'finance.empty.readyStatements',
              'No ready statements in the working set. Imports that are not ready stay in Recovery Queue or Rejected Imports.'
            )
          : activeStatusFilter === 'REVIEW'
            ? t(
                'finance.empty.recoveryQueue',
                'Recovery Queue is empty. Imports that still need remap, re-validation, or scale fixes will appear here.'
              )
            : activeStatusFilter === 'DRAFT'
              ? t(
                  'finance.empty.rejectedImports',
                  'Rejected Imports is empty. Documents that fail the minimum recognition contract will appear here.'
                )
              : t(
                  'finance.empty.statements',
                  'No statements in the current view. Ready items go to the working set, recoverable items go to Recovery Queue, and rejected ones stay outside downstream flows.'
                ),
      models: t('finance.empty.models', 'No models yet. Add your first financial model.'),
      analysis: t('finance.empty.analysis', 'No analyses yet. Create your first analysis.'),
      prediction: t('finance.empty.prediction', 'No prediction data. Create a model first.'),
      valuation: t('finance.empty.valuation', 'No valuations yet. Create your first valuation.'),
      investment: t(
        'finance.empty.investment',
        'No investment case studies yet. Create your first investment analysis.'
      ),
    };
    const currentKind = (activeTab === 'investment' ? 'investment' : activeTab) as
      | FinanceKind
      | 'investment';
    return messages[currentKind] || messages.models;
  }, [activeFilters, activeTab, t]);

  // ---- Statements tab (Triada standard, docs/ui-standards/TRIADA_KANON.md A4-A7) ----
  // Statements has its own StandardTable + StandardPreview block (below). The
  // Models/Analysis/Prediction/Valuation/Investment tabs share a second
  // StandardTable + StandardPreview block further down (tableWithPreview),
  // parametrized by columnsForActiveTab/filteredRows per docs/ui-standards/TRIADA_KANON.md.
  const statementRowsData = useMemo(
    () => filteredRows.filter((row): row is FinanceStatementRow => row.kind === 'statements'),
    [filteredRows]
  );
  const selectedStatementRow: FinanceStatementRow | null =
    selectedId && selectedItem?.kind === 'statements'
      ? (selectedItem as FinanceStatementRow)
      : null;

  const statementPreviewActions: StandardPreviewActions | undefined = useMemo(() => {
    if (!selectedStatementRow) return undefined;
    const isConfirmed = String(selectedStatementRow.rawStatus || '').toLowerCase() === 'confirmed';
    return {
      resolutions: [
        ...(selectedStatementRow.isWorkable && !isConfirmed
          ? [
              {
                id: 'confirm',
                variant: 'positive' as const,
                label: t('finance.row.confirmStatement', 'Potwierdź'),
                onClick: async () => {
                  try {
                    await Api.post(
                      `/api/finance-statements/${selectedStatementRow.id}/confirm`,
                      {}
                    );
                    await loadStatements();
                    toast.success(t('finance.toast.statementConfirmed', 'Statement potwierdzony'));
                  } catch (e: any) {
                    toast.error(
                      e?.response?.data?.error ||
                        t('finance.toast.approveFailed', 'Nie udało się zatwierdzić')
                    );
                  }
                },
              },
            ]
          : []),
        {
          id: 'delete',
          variant: 'destructive',
          label: t('common.delete', 'Delete'),
          onClick: () => void handleFinanceDelete(selectedStatementRow),
        },
      ],
      informational: [
        {
          id: 'open',
          variant: 'neutral',
          label: t('common.open', 'Open'),
          icon: ExternalLink,
          shortcut: 'O',
          onClick: () => handleOpenFull(selectedStatementRow),
        },
        ...(selectedStatementRow.isWorkable
          ? [
              {
                id: 'createModel',
                variant: 'neutral' as const,
                label: t('finance.row.createModelFromStatement', 'Utwórz model'),
                icon: TrendingUp,
                onClick: () => handleCreateModelFromStatement(selectedStatementRow),
              },
              {
                id: 'createAnalysis',
                variant: 'neutral' as const,
                label: t('finance.row.createAnalysisFromStatement', 'Utwórz analizę'),
                onClick: () => handleCreateAnalysisFromStatements(selectedStatementRow),
              },
            ]
          : []),
      ],
    };
  }, [
    selectedStatementRow,
    t,
    loadStatements,
    handleFinanceDelete,
    handleOpenFull,
    handleCreateModelFromStatement,
    handleCreateAnalysisFromStatements,
  ]);

  // Esc closes preview; single-key shortcuts (O) active while preview open (kanon B.24/B.31).
  useEffect(() => {
    if (activeTab !== 'statements' || !selectedStatementRow) return;
    const shortcuts = standardPreviewShortcuts(statementPreviewActions);
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable)
        return;
      if (e.key === 'Escape') {
        deselectRow();
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
  }, [activeTab, selectedStatementRow, statementPreviewActions, deselectRow]);

  const handleBulkDeleteStatements = useCallback(async () => {
    if (selectedStatementIds.size === 0) return;
    const confirmMsg = t(
      'finance.preview.confirmBulkDeleteStatements',
      'Are you sure you want to delete {{value}} statement(s)? This cannot be undone.',
      { value: selectedStatementIds.size }
    );
    if (!window.confirm(confirmMsg)) return;
    const ids = Array.from(selectedStatementIds);
    for (const id of ids) {
      const row = statementRowsData.find((r) => r.id === id);
      if (row) await handleFinanceDelete(row);
    }
    setSelectedStatementIds(new Set());
  }, [selectedStatementIds, statementRowsData, handleFinanceDelete, t]);

  const statementsBulkCommandRowContent =
    activeTab === 'statements' && selectedStatementIds.size > 0 ? (
      <div className={MENU_3_INNER_CLASS}>
        <div className={MENU_3_LEFT_CLASS}>
          <span className="inline-flex h-7 items-center rounded-full px-2.5 text-[11px] font-semibold text-c-text whitespace-nowrap">
            {`${selectedStatementIds.size} selected`}
          </span>
          <Menu3Chip
            onClick={() => setSelectedStatementIds(new Set(statementRowsData.map((r) => r.id)))}
          >
            {t('common.selectAll', 'Select all')}
          </Menu3Chip>
          <Menu3Chip onClick={() => setSelectedStatementIds(new Set())}>
            {t('common.clear', 'Clear')}
          </Menu3Chip>
        </div>
        <div className={MENU_3_RIGHT_CLASS}>
          <button
            type="button"
            onClick={() => void handleBulkDeleteStatements()}
            className={MENU_3_ACTION_DANGER}
          >
            <Trash2 size={12} />
            {t('common.delete', 'Delete')}
          </button>
        </div>
      </div>
    ) : null;

  const statementsTableWithPreview = useMemo(
    () => (
      // TABLE_AND_PREVIEW_CANON §7.2 (MUST): the preview pane width comes
      // WYLACZNIE from the shared component — "Zakaz sztywnej szerokosci na
      // kontenerze preview: w-[420px], w-[360px], w-[460px] itp.". This block
      // hand-rolled `flex` + `<aside className="w-[400px] shrink-0 bg-slate-50
      // dark:bg-navy-950">`: it pinned the width from the screen, painted
      // non-token colours and had no mobile behaviour. TableWithPreviewLayout
      // owns clamp(340px, 28%, 480px) + gap-1.5 without border-l and the
      // mobile overlay (TableWithPreviewLayout.tsx:374, :521).
      <TableWithPreviewLayout<FinanceStatementRow & { title: string }>
        selectedId={selectedId}
        selectedItem={
          selectedStatementRow
            ? (selectedStatementRow as unknown as FinanceStatementRow & { title: string })
            : null
        }
        itemIds={statementRowsData.map((row) => String(row.id))}
        getItemById={(id) =>
          (statementRowsData.find((row) => String(row.id) === id) as unknown as
            | (FinanceStatementRow & { title: string })
            | undefined) ?? null
        }
        onSelect={(id) => {
          if (!id) {
            deselectRow();
            return;
          }
          const row = statementRowsData.find((candidate) => String(candidate.id) === id);
          if (row) onSelectRow(row as unknown as FinanceStatementRow);
        }}
        onOpenFull={(id) => {
          const row = statementRowsData.find((candidate) => String(candidate.id) === id);
          if (row) handleOpenFull(row as unknown as FinanceStatementRow);
        }}
        renderPreview={() =>
          selectedStatementRow ? (
            <StandardPreview
              // The parent PreviewPaneShell (TableWithPreviewLayout) owns the
              // header, the close control and the Escape listener. `embedded`
              // renders the canonical preview BODY only — one shell, one title,
              // one close, one Escape handler.
              embedded
              title={selectedStatementRow.title}
              meta={{
                pills: [
                  {
                    label: String(selectedStatementRow.status || 'DRAFT'),
                    tone: statusChipTone(selectedStatementRow.status),
                  },
                  {
                    label: selectedStatementRow.completenessLabel || '—',
                    tone: 'neutral',
                  },
                ],
                trailing: (
                  <span className="text-[11px] font-semibold text-c-text-secondary">
                    {selectedStatementRow.periodLabel ||
                      `${selectedStatementRow.periodStart} → ${selectedStatementRow.periodEnd}`}
                  </span>
                ),
              }}
              details={{
                // TRIADA_KANON §C3 (N-52): wlasciwosci encji (klucz-wartosc) ida
                // do `properties`, renderowanych przez ArtifactPropertiesTable —
                // NIE sklejane w akapit `text`. Przeglad 128 zrzutow wskazal
                // dokladnie ten anty-wzorzec (podglad bedacy zrzutem pol).
                properties: [
                  {
                    id: 'currency',
                    label: t('common.currency', 'Currency'),
                    value: selectedStatementRow.currency,
                    mono: true,
                  },
                  {
                    id: 'docs',
                    label: t('finance.columns.mappedLines', 'Docs'),
                    value: String(
                      selectedStatementRow.sourceStatementCount ??
                        selectedStatementRow.statementIds?.length ??
                        0
                    ),
                    mono: true,
                  },
                  {
                    id: 'mappedLines',
                    label: t('finance.statements.mappedLines', 'Mapped lines'),
                    value: `${selectedStatementRow.mappedLineCount ?? 0} / ${selectedStatementRow.totalLineCount ?? 0}`,
                    mono: true,
                  },
                  ...(selectedStatementRow.readinessSummary
                    ? [
                        {
                          id: 'packHealth',
                          label: t('finance.statements.previewTitle', 'Pack health'),
                          value: selectedStatementRow.readinessSummary,
                        },
                      ]
                    : []),
                ],
                onCopy: () => {
                  void navigator.clipboard?.writeText(
                    `${selectedStatementRow.title} — ${selectedStatementRow.status} (${selectedStatementRow.completenessLabel || ''})`
                  );
                },
              }}
              ai={{
                hints: [
                  t('finance.preview.aiSummarize', 'Summarize statement'),
                  t('finance.preview.aiRisks', 'Flag data risks'),
                ],
                disabled: true,
                disabledTooltip: t('common.comingSoon', 'Coming soon'),
              }}
              relations={
                (selectedStatementRow.childStatements || []).map((child) => ({
                  label: `${child.statementType || 'STM'} · ${child.rawStatus || '—'}`,
                  onClick: () => handleOpenFull(selectedStatementRow),
                })) || []
              }
              actions={statementPreviewActions}
            />
          ) : null
        }
      >
        <StandardTable
          columns={columnsForActiveTab}
          data={statementRowsData as unknown as Array<Record<string, unknown> & { id: string }>}
          selectedRowId={selectedId}
          onRowClick={(row) => onSelectRow(row as unknown as FinanceStatementRow)}
          onRowDoubleClick={(row) => handleOpenFull(row as unknown as FinanceStatementRow)}
          rowDescription={() => null}
          defaultSort={{ columnId: 'updatedAt', direction: 'desc' }}
          persistKey="finance.statements.list"
          selection={{ selectedIds: selectedStatementIds, onChange: setSelectedStatementIds }}
          activeFilters={activeFilters}
          onFilterChange={setActiveFilters}
          empty={{
            icon: FileText,
            title: t('finance.empty.statementsTitle', 'No statements yet'),
            description: emptyMessage,
            actionLabel: t('finance.cta.importStatement', 'Import statement'),
            onAction: () => setShowImportWizard(true),
          }}
          rowMenu={(row): StandardRowMenu => {
            const statementRow = row as unknown as FinanceStatementRow;
            const isConfirmed = String(statementRow.rawStatus || '').toLowerCase() === 'confirmed';
            return {
              primary: [
                {
                  id: 'open',
                  label: t('common.open', 'Open'),
                  icon: ExternalLink,
                  onClick: () => handleOpenFull(statementRow),
                },
                ...(statementRow.isWorkable
                  ? [
                      {
                        id: 'createModel',
                        label: t('finance.row.createModelFromStatement', 'Utwórz model'),
                        icon: TrendingUp,
                        onClick: () => handleCreateModelFromStatement(statementRow),
                      },
                    ]
                  : []),
              ],
              statusTransitions:
                statementRow.isWorkable && !isConfirmed
                  ? [
                      {
                        id: 'confirm',
                        label: t('finance.row.confirmStatement', 'Potwierdź'),
                        onClick: async () => {
                          try {
                            await Api.post(
                              `/api/finance-statements/${statementRow.id}/confirm`,
                              {}
                            );
                            await loadStatements();
                            toast.success(
                              t('finance.toast.statementConfirmed', 'Statement potwierdzony')
                            );
                          } catch (e: any) {
                            toast.error(
                              e?.response?.data?.error ||
                                t('finance.toast.approveFailed', 'Nie udało się zatwierdzić')
                            );
                          }
                        },
                      },
                    ]
                  : undefined,
              universalHandlers: {
                preview: () => onSelectRow(statementRow),
                edit: () => handleOpenFull(statementRow),
                // Brak API archiwizacji statementu — pozycja disabled z notą (StandardTable dokłada ją sama).
              },
              destructive: {
                onClick: () => void handleFinanceDelete(statementRow),
              },
            };
          }}
        />
      </TableWithPreviewLayout>
    ),
    [
      columnsForActiveTab,
      statementRowsData,
      selectedId,
      selectedStatementRow,
      onSelectRow,
      handleOpenFull,
      activeFilters,
      emptyMessage,
      t,
      selectedStatementIds,
      handleCreateModelFromStatement,
      handleFinanceDelete,
      loadStatements,
      deselectRow,
      statementPreviewActions,
    ]
  );

  // ---- Table + Preview (Triada standard — Models/Analysis/Prediction/Valuation/
  // Investment share this block; columns/data are parametrized by activeTab via
  // columnsForActiveTab/filteredRows. Same StandardTable+StandardPreview wiring
  // as the Statements block above — docs/ui-standards/TRIADA_KANON.md A4-A7). ----

  // RowAction ids that represent a positive state-changing transition for the
  // active kind (approve/confirm/compute/generate/computeDcf) — surfaced as the
  // "resolutions" row (positive variant) in the preview, ahead of Delete.
  const RESOLUTION_ACTION_IDS = useMemo(
    () => new Set(['approve', 'compute', 'generate', 'computeDcf', 'confirm']),
    []
  );
  // RowAction ids folded into the manifest StandardTable already renders itself
  // (blocks 4-5: Open preview/Edit/Archive/Delete) — excluded from rowMenu/
  // preview mapping below to avoid duplicating them.
  const MANIFEST_ACTION_IDS = useMemo(() => new Set(['preview', 'edit', 'archive', 'delete']), []);

  // Maps the existing per-kind getRowActions(row) (RowAction[]) onto the
  // StandardRowMenu 5-block contract (kebab). Blocks 4-5 (Open preview / Edit /
  // Archive / Delete) are appended automatically by StandardTable — we only
  // declare blocks 1-3 here.
  const financeRowMenu = useCallback(
    (row: FinanceRow): StandardRowMenu => {
      const actions = getRowActions(row);
      const primary: StandardRowMenu['primary'] = [];
      const statusTransitions: StandardRowMenu['statusTransitions'] = [];
      for (const action of actions) {
        if (MANIFEST_ACTION_IDS.has(action.id)) continue;
        const mapped = {
          id: action.id,
          label: action.label,
          icon: action.icon,
          onClick: action.disabled ? undefined : action.onClick,
          disabled: action.disabled,
          note: action.description,
        };
        if (RESOLUTION_ACTION_IDS.has(action.id)) statusTransitions.push(mapped);
        else primary.push(mapped);
      }
      return {
        primary,
        statusTransitions,
        universalHandlers: {
          preview: () => onSelectRow(row),
          edit: () => handleOpenFull(row),
          // Brak API archiwizacji pozycji Finance — disabled z notą (StandardTable dokłada ją sama).
        },
        destructive: {
          onClick: () => void handleFinanceDelete(row),
        },
      };
    },
    [
      getRowActions,
      onSelectRow,
      handleOpenFull,
      handleFinanceDelete,
      MANIFEST_ACTION_IDS,
      RESOLUTION_ACTION_IDS,
    ]
  );

  // Maps the same getRowActions(row) onto the StandardPreview action-button
  // contract (positive/destructive/warning/neutral, canon A7.6/A8): the
  // resolution action (if any) + Delete go in "resolutions"; everything else
  // (Open, contextual creates, export, chat, duplicate) goes in "informational".
  // RowAction.icon jest typowane szeroko (React.ElementType), ale wszystkie
  // ikony akcji Finance pochodzą z lucide-react (useFinanceRowActions) —
  // zawężenie do LucideIcon jest typowo poprawne w runtime.
  const toLucideIcon = (icon: React.ElementType | undefined): LucideIcon | undefined =>
    icon as LucideIcon | undefined;

  const financePreviewActions = useCallback(
    (row: FinanceRow): StandardPreviewActions => {
      const actions = getRowActions(row).filter((a) => a.id !== 'archive');
      const resolutions: StandardPreviewActions['resolutions'] = [];
      const informational: StandardPreviewActions['informational'] = [];
      for (const action of actions) {
        if (action.id === 'preview') continue; // preview pane already open
        if (action.id === 'delete') {
          resolutions.push({
            id: 'delete',
            variant: 'destructive',
            label: action.label,
            icon: toLucideIcon(action.icon),
            onClick: action.onClick,
            disabled: action.disabled,
          });
          continue;
        }
        if (RESOLUTION_ACTION_IDS.has(action.id)) {
          resolutions.push({
            id: action.id,
            variant: 'positive',
            label: action.label,
            icon: toLucideIcon(action.icon),
            onClick: action.onClick,
            disabled: action.disabled,
          });
          continue;
        }
        informational.push({
          id: action.id,
          variant: 'neutral',
          label: action.label,
          icon: toLucideIcon(action.icon),
          shortcut: action.id === 'edit' ? 'O' : undefined,
          onClick: action.onClick,
          disabled: action.disabled,
        });
      }
      return { resolutions, informational };
    },
    [getRowActions, RESOLUTION_ACTION_IDS]
  );

  const selectedFinanceRow: FinanceRow | null =
    selectedId && selectedItem && selectedItem.kind !== 'statements' ? selectedItem : null;

  const financePreviewActionsForSelected = useMemo(
    () => (selectedFinanceRow ? financePreviewActions(selectedFinanceRow) : undefined),
    [selectedFinanceRow, financePreviewActions]
  );

  // Esc closes preview; single-key shortcuts active while preview open (kanon B.24/B.31).
  useEffect(() => {
    if (activeTab === 'statements' || !selectedFinanceRow) return;
    const shortcuts = standardPreviewShortcuts(financePreviewActionsForSelected);
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable)
        return;
      if (e.key === 'Escape') {
        deselectRow();
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
  }, [activeTab, selectedFinanceRow, financePreviewActionsForSelected, deselectRow]);

  const handleBulkDeleteFinanceRows = useCallback(async () => {
    if (selectedFinanceRowIds.size === 0) return;
    const confirmMsg = t(
      'finance.preview.confirmBulkDeleteRows',
      'Are you sure you want to delete {{value}} item(s)? This cannot be undone.',
      { value: selectedFinanceRowIds.size }
    );
    if (!window.confirm(confirmMsg)) return;
    const ids = Array.from(selectedFinanceRowIds);
    for (const id of ids) {
      const row = filteredRows.find((r) => r.id === id);
      if (row) await handleFinanceDelete(row);
    }
    setSelectedFinanceRowIds(new Set());
  }, [selectedFinanceRowIds, filteredRows, handleFinanceDelete, t]);

  const financeBulkCommandRowContent =
    activeTab !== 'statements' && selectedFinanceRowIds.size > 0 ? (
      <div className={MENU_3_INNER_CLASS}>
        <div className={MENU_3_LEFT_CLASS}>
          <span className="inline-flex h-7 items-center rounded-full px-2.5 text-[11px] font-semibold text-c-text whitespace-nowrap">
            {`${selectedFinanceRowIds.size} selected`}
          </span>
          <Menu3Chip
            onClick={() => setSelectedFinanceRowIds(new Set(filteredRows.map((r) => r.id)))}
          >
            {t('common.selectAll', 'Select all')}
          </Menu3Chip>
          <Menu3Chip onClick={() => setSelectedFinanceRowIds(new Set())}>
            {t('common.clear', 'Clear')}
          </Menu3Chip>
        </div>
        <div className={MENU_3_RIGHT_CLASS}>
          <button
            type="button"
            onClick={() => void handleBulkDeleteFinanceRows()}
            className={MENU_3_ACTION_DANGER}
          >
            <Trash2 size={12} />
            {t('common.delete', 'Delete')}
          </button>
        </div>
      </div>
    ) : null;

  const tableWithPreview = useMemo(
    () => (
      <div className="h-full flex overflow-hidden">
        <div className="flex-1 min-w-0 overflow-auto pl-4 pr-1.5 pt-3 pb-4">
          <StandardTable
            columns={columnsForActiveTab}
            data={filteredRows as unknown as Array<Record<string, unknown> & { id: string }>}
            selectedRowId={selectedId}
            onRowClick={(row) => onSelectRow(row as unknown as FinanceRow)}
            onRowDoubleClick={(row) => handleOpenFull(row as unknown as FinanceRow)}
            rowDescription={() => null}
            defaultSort={{ columnId: 'updatedAt', direction: 'desc' }}
            persistKey={`finance.${activeTab}.list`}
            selection={{ selectedIds: selectedFinanceRowIds, onChange: setSelectedFinanceRowIds }}
            activeFilters={activeFilters}
            onFilterChange={setActiveFilters}
            empty={{
              icon: EMPTY_STATE_ICON_BY_TAB[activeTab] ?? Calculator,
              title: emptyMessage,
            }}
            rowMenu={(row) => financeRowMenu(row as unknown as FinanceRow)}
          />
        </div>

        {selectedFinanceRow ? (
          <aside className="w-[400px] shrink-0 bg-slate-50 dark:bg-navy-950 p-3 overflow-hidden">
            {/*
              Header (block 1) comes from StandardPreview (title/pin/Open/×,
              canon A7.1). Blocks 2-3 (meta card + Details) and 4-6 (AI hints /
              relations / action bar) are supplied via children/actions from
              the existing per-kind renderPreviewBody/renderPreviewFooter
              (useFinancePreview) — same content the legacy TableWithPreviewLayout
              rendered, now hosted inside the canonical shell. `meta`/`details`
              props are intentionally omitted here to avoid double-rendering
              the meta/details blocks that renderPreviewBody already supplies.
            */}
            <StandardPreview
              title={selectedFinanceRow.title}
              onClose={() => deselectRow()}
              onOpenFull={() => handleOpenFull(selectedFinanceRow)}
              actions={financePreviewActionsForSelected}
            >
              {renderPreviewBody(selectedFinanceRow)}
              {renderPreviewFooter(selectedFinanceRow)}
            </StandardPreview>
          </aside>
        ) : null}
      </div>
    ),
    [
      columnsForActiveTab,
      filteredRows,
      selectedId,
      selectedFinanceRow,
      onSelectRow,
      handleOpenFull,
      activeFilters,
      emptyMessage,
      activeTab,
      selectedFinanceRowIds,
      financeRowMenu,
      financePreviewActionsForSelected,
      deselectRow,
      renderPreviewBody,
      renderPreviewFooter,
    ]
  );

  const gridView = useMemo(
    () => (
      <GridView
        items={gridItems}
        selectedItemId={selectedId}
        onItemClick={(item) => {
          const row = filteredRows.find((r) => r.id === item.id);
          if (row) onSelectRow(row);
        }}
        onItemAction={(action, item) => {
          const row = filteredRows.find((r) => r.id === item.id);
          if (!row) return;
          const actionObj = getRowActions(row).find((a) => a.id === action);
          actionObj?.onClick?.();
        }}
        emptyMessage={emptyMessage}
      />
    ),
    [gridItems, selectedId, filteredRows, emptyMessage, onSelectRow, getRowActions]
  );

  // ---- Full view ----
  const fullView = useMemo(() => {
    const canonicalArtifactType = searchParams.get('canonicalArtifactType');
    const canonicalArtifactId = searchParams.get('canonicalArtifactId');
    const canonicalBusinessVersionId = searchParams.get('canonicalBusinessVersionId');
    if (
      canonicalArtifactType === 'HISTORICAL_ANALYSIS' &&
      canonicalArtifactId &&
      canonicalBusinessVersionId &&
      financeV3AnalysisFlag.enabled
    ) {
      const closeCanonical = () => {
        const next = new URLSearchParams(searchParams);
        next.delete('canonicalArtifactType');
        next.delete('canonicalArtifactId');
        next.delete('canonicalBusinessVersionId');
        setSearchParams(next);
      };
      return (
        <div className="p-4 lg:p-6">
          <div className="h-[calc(100vh-120px)] min-h-[620px] overflow-hidden rounded-xl border border-c-border-subtle bg-c-surface">
            <CanonicalFinanceWorkspaceMount
              artifactId={canonicalArtifactId}
              businessVersionId={canonicalBusinessVersionId}
              artifactType="HISTORICAL_ANALYSIS"
            >
              <FinanceV3AnalysisWorkspace
                artifactId={canonicalArtifactId}
                businessVersionId={canonicalBusinessVersionId}
                role="preparer"
                onNavigateBack={closeCanonical}
              />
            </CanonicalFinanceWorkspaceMount>
          </div>
        </div>
      );
    }
    if (!activeDocumentId || !activeDocument) return null;
    const code = getTypeCode(activeDocument.kind);
    const activeModelRow = activeDocument as FinanceModelRow;

    // AP_MOUNT §B — Finance v3 mount branches. `resolveFinanceDetailBranches`
    // is the ONE place that decides which detail component renders; each
    // `openV3*` flag is `false` unless a local override was set (default OFF,
    // CLAUDE.md #7/#9), and when ALL FOUR are `false` every field here is
    // byte-identical to what this block computed before AP_MOUNT (see
    // `resolveFinanceDetailBranches.test.ts` — same kind/predictionType in,
    // same isBudgetPrediction/openStatement/isModelWorkspace/openAnalysis/
    // openValuation/needsFullHeight out, verified by an exhaustive
    // flags-all-false table plus a negative control).
    //
    // ★ KNOWN GAP (documented, not fixed here — out of AP_MOUNT's UI-mounting
    // scope): `activeDocument.id`/`.status` come from the OLD `/api/v8/finance/*`
    // list (`V8FinanceApi.getModels/getAnalyses/getValuations`, `FinanceStatus`
    // = DRAFT|REVIEW|APPROVED) — a DIFFERENT data model than the NEW
    // `/api/v8/finance-v2/*` canonical schema these v3 workspaces are built
    // against (`BusinessVersionStatus`, 8 values, real `entityId`/period data).
    // There is no ID bridge between the two systems today, so a row opened
    // from today's list will pass an old-system id into a new-system
    // component; the component's own honest-UI error handling (already
    // proven in its unit tests) surfaces this as a visible error, never a
    // crash or silent corruption — but it will NOT show real data until a
    // data-model bridge exists (separate initiative, not part of this task).
    const {
      isBudgetPrediction,
      openStatement,
      isModelWorkspace,
      openAnalysis,
      openValuation,
      openV3Baseline,
      openV3Prediction,
      openV3Analysis,
      openV3Valuation,
      openFinanceV3,
      needsFullHeight,
    } = resolveFinanceDetailBranches(activeDocument.kind, activeModelRow.predictionType, {
      baseline: financeV3BaselineFlag.enabled,
      prediction: financeV3PredictionFlag.enabled,
      analysis: financeV3AnalysisFlag.enabled,
      valuation: financeV3ValuationFlag.enabled,
    });

    return (
      <div className="p-4 lg:p-6">
        <div className="bg-c-surface backdrop-blur border border-slate-200/60 dark:border-white/[0.03] rounded-xl overflow-hidden">
          {/* v3 branches carry their own identity/back-button in FinanceWorkspaceBar
              (CLAUDE.md UI rule #1: zero repeated headers) — suppress this generic
              header for them too, same as the existing `openStatement` suppression. */}
          {!openStatement && !openFinanceV3 && (
            <div className="px-4 py-3 border-b border-c-border-subtle flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wider text-c-text-muted">{code}</div>
                <div className="text-sm font-semibold text-c-text truncate">
                  {activeDocument.title}
                </div>
              </div>
              <button
                className="h-9 px-4 rounded-full border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text-secondary hover:bg-c-surface-raised transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-2 focus-visible:ring-offset-c-bg"
                onClick={handleShowList}
              >
                {t('common.backToList', 'Wróć do listy')}
              </button>
            </div>
          )}
          <div
            className={
              needsFullHeight
                ? 'flex h-[calc(100vh-120px)] min-h-[620px] flex-col overflow-hidden'
                : 'p-4'
            }
          >
            <Suspense
              fallback={
                <div className="p-6">
                  <LoadingState template="panel" />
                </div>
              }
            >
              {isBudgetPrediction ? (
                <BudgetWorkspace
                  initialBudgetId={getBudgetRawId(activeDocument.id)}
                  hideSidebar
                  onBudgetChanged={handleBudgetChanged}
                />
              ) : openStatement && financeV3StatementPackFlag.enabled ? (
                <FinanceLegacyBridgeGate
                  legacyTable="financial_statement_packs"
                  legacyId={activeDocument.id}
                  onBackToList={handleShowList}
                >
                  {(resolved) => (
                    <CanonicalFinanceWorkspaceMount
                      artifactId={resolved.artifactId}
                      businessVersionId={resolved.businessVersionId ?? ''}
                      artifactType="STATEMENT_PACK"
                    >
                      <FinanceV3StatementPackWorkspace
                        businessVersionId={resolved.businessVersionId ?? ''}
                        resolveLineLabel={(rowKey, canonicalLineId, lineCode) =>
                          lineCode ?? canonicalLineId ?? rowKey
                        }
                        onOpenArtifact={() => toast('Otwórz powiązany artefakt z listy Finance.')}
                        onCreateNew={(artifactType, sourceBusinessVersionId) =>
                          void handleCreateRelatedArtifact(artifactType, sourceBusinessVersionId)
                        }
                        onOpenReportResult={() => navigate('/outputs')}
                        onNavigateBack={handleShowList}
                      />
                    </CanonicalFinanceWorkspaceMount>
                  )}
                </FinanceLegacyBridgeGate>
              ) : openStatement ? (
                <FinancialStatementPackWorkspace
                  statementPackId={activeDocument.id}
                  onStatementChanged={handleStatementChanged}
                  onCreateModelFromPack={handleCreateModelFromStatement}
                  onCreateAnalysisFromPack={handleCreateAnalysisFromStatements}
                />
              ) : openV3Baseline ? (
                // AP_MOUNT §B (Pakiet F) — `financeBaselineWorkspaceV1`. ID_BRIDGE
                // (Gate E) fix: `activeDocument.id` is a LEGACY `financial_models.id`
                // — resolved through `FinanceLegacyBridgeGate` (reads
                // `finance_artifact_aliases`) into the real canonical
                // `{artifactId, businessVersionId}`. The workspace then loads its
                // persisted entity/opening/forecast context from the canonical API;
                // the legacy list row is never treated as authority for those values.
                <FinanceLegacyBridgeGate
                  legacyTable="financial_models"
                  legacyId={activeDocument.id}
                  onBackToList={handleShowList}
                >
                  {(resolved) => (
                    <CanonicalFinanceWorkspaceMount
                      artifactId={resolved.artifactId}
                      businessVersionId={resolved.businessVersionId ?? ''}
                      artifactType="BASELINE_MODEL"
                    >
                      <FinanceV3BaselineWorkspace
                        artifactId={resolved.artifactId}
                        businessVersionId={resolved.businessVersionId ?? ''}
                        name={activeDocument.title}
                        status={mapLegacyFinanceStatusToV3(activeDocument.status)}
                        freshness="NEVER_COMPUTED"
                        version={1}
                        role="preparer"
                        contextValues={{ type: 'Model bazowy (Baseline)' }}
                        onNavigateBack={handleShowList}
                      />
                    </CanonicalFinanceWorkspaceMount>
                  )}
                </FinanceLegacyBridgeGate>
              ) : openV3Prediction ? (
                // AP_MOUNT §B (Pakiet G) — `financePredictionWorkspaceV1`. ID_BRIDGE
                // (Gate E) fix: same legacy->canonical resolution as Baseline above.
                // Prediction is additionally fixed at the component level
                // (`PredictionWorkspace.tsx`) to stop silently rendering an empty
                // draft when no real `businessVersionId` is available — this gate is
                // defense-in-depth, not the only fix (see that component's header).
                <FinanceLegacyBridgeGate
                  legacyTable="financial_models"
                  legacyId={activeDocument.id}
                  onBackToList={handleShowList}
                >
                  {(resolved) => (
                    <CanonicalFinanceWorkspaceMount
                      artifactId={resolved.artifactId}
                      businessVersionId={resolved.businessVersionId ?? ''}
                      artifactType="PREDICTION_SCENARIO"
                    >
                      <FinanceV3PredictionWorkspace
                        artifactId={resolved.artifactId}
                        businessVersionId={resolved.businessVersionId}
                        onNavigateBack={handleShowList}
                      />
                    </CanonicalFinanceWorkspaceMount>
                  )}
                </FinanceLegacyBridgeGate>
              ) : isModelWorkspace ? (
                // #82c/#82f — FinanceModelDocumentView (read-only P&L/BS/CF table) had no
                // way to edit assumptions, add events, compute, approve, or refresh from
                // source: FinancialModelWorkspace is the superset (same tabs' data PLUS
                // Inputs & Assumptions editing incl. #82f assumptionsRegistry status,
                // Events Timeline CRUD, Compute, Approve, Refresh from source) and already
                // follows the same initialXId/hideSidebar/onXChanged contract as the
                // sibling Analysis/Valuation/Budget workspaces below.
                <FinancialModelWorkspace
                  initialModelId={activeDocument.id}
                  hideSidebar
                  onModelChanged={handleModelChanged}
                />
              ) : openV3Analysis ? (
                // AP_MOUNT §B (Pakiet E) — `financeAnalysisWorkspaceV1`. ID_BRIDGE
                // (Gate E) fix: same legacy->canonical resolution as Baseline above
                // — `activeDocument.id` is a legacy `financial_analyses.id`.
                <FinanceLegacyBridgeGate
                  legacyTable="financial_analyses"
                  legacyId={activeDocument.id}
                  onBackToList={handleShowList}
                >
                  {(resolved) => (
                    <CanonicalFinanceWorkspaceMount
                      artifactId={resolved.artifactId}
                      businessVersionId={resolved.businessVersionId ?? ''}
                      artifactType="HISTORICAL_ANALYSIS"
                    >
                      <FinanceV3AnalysisWorkspace
                        artifactId={resolved.artifactId}
                        businessVersionId={resolved.businessVersionId ?? ''}
                        role="preparer"
                        onNavigateBack={handleShowList}
                      />
                    </CanonicalFinanceWorkspaceMount>
                  )}
                </FinanceLegacyBridgeGate>
              ) : openAnalysis ? (
                <FinancialAnalysisWorkspace
                  initialAnalysisId={activeDocument.id}
                  hideSidebar
                  onAnalysisChanged={handleAnalysisChanged}
                />
              ) : openV3Valuation ? (
                // AP_MOUNT §B (Pakiet H) — `financeValuationWorkspaceV1`. ID_BRIDGE
                // (Gate E) fix: same legacy->canonical resolution as Baseline above
                // — `activeDocument.id` is a legacy `valuations.id`.
                <FinanceLegacyBridgeGate
                  legacyTable="valuations"
                  legacyId={activeDocument.id}
                  onBackToList={handleShowList}
                >
                  {(resolved) => (
                    <CanonicalFinanceWorkspaceMount
                      artifactId={resolved.artifactId}
                      businessVersionId={resolved.businessVersionId ?? ''}
                      artifactType="VALUATION_CASE"
                    >
                      <FinanceV3ValuationWorkspace
                        businessVersionId={resolved.businessVersionId ?? ''}
                        legacyValuationId={activeDocument.id}
                        role="preparer"
                        onNavigateBack={handleShowList}
                      />
                    </CanonicalFinanceWorkspaceMount>
                  )}
                </FinanceLegacyBridgeGate>
              ) : openValuation ? (
                <ValuationWorkspace
                  initialValuationId={activeDocument.id}
                  hideSidebar
                  onValuationChanged={handleValuationChanged}
                />
              ) : (
                <div className="p-4">
                  <EmptyStateInline
                    icon={FileText}
                    message={t(
                      'finance.document.unsupported.message',
                      'This finance document type is not yet available in the full workspace.'
                    )}
                    hint={t(
                      'finance.document.unsupported.hint',
                      'Return to the list and reopen a supported statement pack, model, analysis, budget, or valuation.'
                    )}
                    action={{
                      label: t('common.backToList', 'Wróć do listy'),
                      onClick: handleShowList,
                      // Nawigacja powrotna, nie tworzenie nowego obiektu — bez "+".
                      showPrefix: false,
                      neutralAccent: true,
                    }}
                  />
                </div>
              )}
            </Suspense>
          </div>
        </div>
      </div>
    );
  }, [
    activeDocumentId,
    activeDocument,
    financeV3AnalysisFlag.enabled,
    handleCreateRelatedArtifact,
    searchParams,
    setSearchParams,
    handleModelChanged,
    handleAnalysisChanged,
    handleBudgetChanged,
    handleStatementChanged,
    handleValuationChanged,
    getBudgetRawId,
    t,
    handleShowList,
    handleCreateModelFromStatement,
    handleCreateAnalysisFromStatements,
    // AP_MOUNT §B
    financeV3BaselineFlag.enabled,
    financeV3PredictionFlag.enabled,
    financeV3AnalysisFlag.enabled,
    financeV3ValuationFlag.enabled,
    financeV3StatementPackFlag.enabled,
  ]);

  const handleImportWizardComplete = useCallback(
    async (statementId: string) => {
      setShowImportWizard(false);
      let statementDetail: any = null;
      try {
        const data = await V8FinanceApi.getStatement(statementId);
        statementDetail = data?.statement ?? null;
      } catch (error) {
        if (!shouldFallbackToLegacyFinance(error)) {
          throw error;
        }
        statementDetail = (await Api.get(`/api/finance-statements/${statementId}`)) as any;
      }
      const statementPackId = String(
        statementDetail.statement_pack_id || statementDetail.statementPackId || ''
      );
      let packs: any[] = [];
      try {
        const data = await V8FinanceApi.getStatementPacks();
        packs = Array.isArray(data?.statementPacks) ? data.statementPacks : [];
      } catch (error) {
        if (!shouldFallbackToLegacyFinance(error)) {
          throw error;
        }
        const data = await Api.get('/api/finance-statements/packs');
        packs = Array.isArray(data) ? data : [];
      }
      await refreshFinanceTruth(['statements']);
      const pack = Array.isArray(packs)
        ? packs.find((item: any) => String(item.id) === statementPackId)
        : null;
      const statementRow: FinanceStatementRow = pack
        ? {
            id: String(pack.id),
            title:
              sanitizeStatementTitle(pack.entity_name) ||
              sanitizeStatementTitle(pack.period_label) ||
              String(pack.id),
            kind: 'statements',
            status:
              String(pack.pack_readiness_status || '').toLowerCase() === 'ready'
                ? 'APPROVED'
                : String(pack.pack_readiness_status || '').toLowerCase() === 'recoverable'
                  ? 'REVIEW'
                  : 'DRAFT',
            statementType: 'PACK',
            statementPackId: String(pack.id),
            entityName: String(pack.entity_name || ''),
            // FIN-005: the same guard as the statements list above. This branch
            // (post-import refresh) built the row with a bare `String(...)`, so
            // a pack whose period columns still carry a raw Date value showed
            // it in the PERIOD column of the freshly imported row.
            periodStart: sanitizeStatementTitle(pack.period_start),
            periodEnd: sanitizeStatementTitle(pack.period_end),
            periodLabel: sanitizeStatementTitle(pack.period_label),
            currency: String(pack.currency || 'PLN'),
            scaling: String(pack.scaling || 'units'),
            sourceFileName: '',
            validationStatus: String(pack.pack_status || 'pending'),
            mappedLineCount: 0,
            totalLineCount: 0,
            unmappedLineCount: 0,
            sourceStatementCount: Number(pack.source_statement_count ?? 0),
            statementIds: [],
            missingStatementTypes:
              typeof pack.missing_statement_types === 'string' &&
              pack.missing_statement_types.trim().startsWith('[')
                ? JSON.parse(pack.missing_statement_types)
                : Array.isArray(pack.missing_statement_types)
                  ? pack.missing_statement_types
                  : [],
            completenessLabel: '',
            childStatements: [],
            overallConfidence: 0,
            rawStatus: String(pack.pack_status || 'draft'),
            readinessStatus: String(pack.pack_readiness_status || 'pending'),
            readinessScore: Number(pack.pack_readiness_score ?? 0),
            readinessSummary: String(pack.pack_quality_summary || ''),
            readinessReasonCodes: [],
            isWorkable: String(pack.pack_readiness_status || '').toLowerCase() === 'ready',
            updatedAt: String(pack.updated_at || new Date().toISOString()),
          }
        : statementRows.find((row) => row.id === statementPackId) || statementRows[0];
      if (!statementRow) return;
      setActiveTab('statements');
      focusStatementQueue(statementRow.status);
      handleOpenFull(statementRow);
      toast.success(
        statementRow.isWorkable
          ? t('finance.importWizard.completed', 'Completed')
          : statementRow.readinessStatus === 'rejected'
            ? t(
                'finance.importWizard.rejected',
                'Import finished, but the file was rejected and requires another attempt.'
              )
            : t(
                'finance.importWizard.requiresReview',
                'Import finished. The statement went to the recovery queue and requires quality closure.'
              )
      );
    },
    [refreshFinanceTruth, statementRows, setActiveTab, focusStatementQueue, handleOpenFull, t]
  );

  const content = useMemo(() => {
    // Import wizard renders INSIDE the ModuleHub shell (sidebar + topbar stay
    // visible) as an instrument-archetype panel — not a viewport overlay that
    // hides the app navigation. See H2.9 / H2.10.
    if (showImportWizard)
      return (
        <Suspense
          fallback={
            <div className="p-6">
              <LoadingState template="panel" />
            </div>
          }
        >
          <FinancialStatementImportWizard
            embedded
            onClose={() => setShowImportWizard(false)}
            onComplete={handleImportWizardComplete}
            onOpenKnowledgeBase={() => navigate('/knowledge-base')}
            onOpenAi={() =>
              openChatWithContext({
                entityType: 'finance_statement_import',
                entityId: 'statement-import',
                entityName: t('finance.importWizard.title', 'Financial statement import'),
                contextData: {
                  activeTab: 'statements',
                  organizationName: currentOrganization?.name,
                },
              })
            }
          />
        </Suspense>
      );
    if (loadingTab)
      return (
        <div className="p-6">
          <LoadingState template="list" rows={6} />
        </div>
      );
    if (!activeDocumentId && loadError)
      return (
        <EmptyState
          variant="error"
          title={t('finance.errors.realSourceTitle', 'Real finance source needs attention')}
          description={`${loadError} — ${t(
            'finance.errors.realSourceHint',
            'No synthetic demo fallback was injected. Verify active DB, organization scope, and data-context before retrying.'
          )}`}
        />
      );
    if (!activeDocumentId && activeTab === 'investment' && filteredRows.length === 0)
      return (
        <>
          <div className="flex items-center justify-center p-6">
            <div className="w-full max-w-3xl rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-6">
              <div className="flex items-start gap-4">
                <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-300">
                  <Target size={20} />
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-semibold text-c-text">
                    {t('finance.investment.emptyTitle', 'Investment analysis workspace')}
                  </div>
                  <div className="mt-1 text-sm text-c-text-secondary">
                    {t(
                      'finance.investment.emptyBody',
                      'Use this tab for initiative-level investment cases and go/no-go decisions based on NPV, IRR, payback, and ROI.'
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {['NPV', 'IRR', 'Payback', 'ROI'].map((metric) => (
                      <span
                        key={metric}
                        className="inline-flex items-center rounded-full bg-c-surface-raised px-3 py-1 text-xs font-medium text-c-text-secondary"
                      >
                        {metric}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 text-xs uppercase tracking-wide text-c-text-muted">
                    {t(
                      'finance.investment.emptyHint',
                      'Create a dedicated investment case with NPV, IRR, payback, and ROI metrics from this tab.'
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      );
    if (!activeDocumentId && activeTab === 'models' && filteredRows.length === 0)
      return (
        <>
          <div className="flex items-center justify-center p-6">
            <div className="w-full max-w-3xl rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-6">
              <div className="flex items-start gap-4">
                <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-crimson-500/10 text-crimson-600 dark:text-crimson-300">
                  <Calculator size={20} />
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-semibold text-c-text">
                    {t('finance.model.emptyTitle', 'Build your first financial model')}
                  </div>
                  <div className="mt-1 text-sm text-c-text-secondary">
                    {t(
                      'finance.model.emptyBody',
                      'A financial model turns a statement pack into a board-ready business case: P&L, balance sheet, cash flow, and the NPV / ROI / payback story for the client.'
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateModelModal(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-crimson-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-crimson-700"
                    >
                      <Plus size={14} />
                      {t('finance.model.createModel', 'Create Financial Model')}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        openChatWithContext({
                          entityType: 'finance_module',
                          entityId: 'finance',
                          entityName: t('finance.aiChat', 'Finance'),
                          contextData: {
                            activeTab,
                            organizationName: currentOrganization?.name,
                            teresaPrompt: buildFinanceTeresaPrompt('models', t),
                          },
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3.5 py-2 text-sm font-medium text-c-text-secondary transition hover:border-crimson-300 hover:text-crimson-700 dark:hover:text-crimson-300"
                    >
                      <Sparkles size={14} />
                      {t('finance.model.emptyAskTeresa', 'Ask Teresa to start')}
                    </button>
                  </div>
                  <div className="mt-4 text-xs uppercase tracking-wide text-c-text-muted">
                    {t(
                      'finance.model.emptyHint',
                      'Seed a model from a statement pack or start from scratch — Teresa proposes the assumptions.'
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      );
    if (
      (activeDocumentId && activeDocument) ||
      (searchParams.get('canonicalArtifactType') === 'HISTORICAL_ANALYSIS' &&
        searchParams.get('canonicalArtifactId') &&
        searchParams.get('canonicalBusinessVersionId'))
    )
      return fullView;
    // Finance tabs are list surfaces. Analysis tools, planners and charts belong
    // to the record workspace opened from a row, never below the list itself.
    // Keeping this return unconditional is the canonical guard against the
    // legacy flag-driven panel stack reappearing under a populated table.
    return viewMode === 'grid'
      ? gridView
      : activeTab === 'statements'
        ? statementsTableWithPreview
        : tableWithPreview;
  }, [
    loadingTab,
    loadError,
    t,
    activeTab,
    filteredRows.length,
    currentOrganization?.name,
    openChatWithContext,
    activeDocumentId,
    activeDocument,
    fullView,
    searchParams,
    viewMode,
    gridView,
    tableWithPreview,
    statementsTableWithPreview,
    showImportWizard,
    handleImportWizardComplete,
  ]);

  // ---- Render ----
  // NOTE (2026-07-13, root-cause fix): previously this returned a blank
  // "Finance module is not enabled for this organization" screen whenever the
  // V8 rollout flag `finance` was off — which, per the same Z82 split-brain
  // pattern already fixed for Results (see 22a436f338 "Results falls back to
  // legacy KPIs when v8 returns empty-200"), is a V8 rollout flag, NOT an
  // entitlement gate. useFinanceData() below fetches the legacy
  // statements/models/analyses/valuations/budgets independently of this flag,
  // and `isFinanceRuntimeV8` already guards every V8-only affordance further
  // down (dashboard, degraded banner, lane panel). So when V8-finance is off
  // (true for every org on demo right now — atelier/DBR77 explicitly
  // disabled 2026-07-10, and every ephemeral `demo-org-session-*` "Try demo"
  // org never gets a v8_feature_flags row at all), Finance must fall through
  // to the legacy-driven UI below instead of going blank. Real entitlement
  // gating stays on `isFinanceBlocked` just below, untouched.
  if (isFinanceBlocked) {
    return (
      <div className="flex h-full items-center justify-center text-c-text-muted p-8 text-center">
        <div>
          <Calculator size={40} className="mx-auto mb-4 opacity-40" />
          <p className="text-lg font-medium">
            {t(
              'finance.blocked',
              "Access to the Finance module is restricted by your organization's policy."
            )}
          </p>
        </div>
      </div>
    );
  }

  // Import is a focused document workflow. Generic Finance search, filters,
  // view switches, AI and duplicate CTA would act on the list behind it.
  if (showImportWizard) return <>{content}</>;

  return (
    <>
      <StandardModuleBar
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onSearch={setSearchQuery}
        openItems={openDocuments}
        activeItemId={activeDocumentId}
        onSelectItem={(id) => {
          setActiveDocumentId(id);
          const row = rowsForActiveTab.find((r) => r.id === id) || null;
          setActiveDocument(row);
        }}
        onCloseItem={handleCloseDocument}
        onShowList={handleShowList}
        activeFilters={activeFilters}
        onRemoveFilter={handleRemoveFilter}
        onClearFilters={handleClearFilters}
        viewModes={['table', 'grid']}
        primaryCtaContent={primaryCta}
        commandRowContent={
          statementsBulkCommandRowContent ?? financeBulkCommandRowContent ?? commandRowContent
        }
      >
        {isFinanceRuntimeV8 && (
          <FinanceDegradedBanner
            degradedAlerts={lane.degradedAlerts}
            onViewAll={() => setLanePanelOpen(true)}
          />
        )}
        {content}
      </StandardModuleBar>

      {isFinanceRuntimeV8 && (
        <FinanceLanePanel
          open={lanePanelOpen}
          onClose={() => setLanePanelOpen(false)}
          activeLaneRun={lane.activeLaneRun}
          degradedAlerts={lane.degradedAlerts}
          mutationAudits={lane.mutationAudits}
          kpiCoherence={lane.kpiCoherence}
          versionSnapshots={lane.versionSnapshots}
          onAdvanceStep={lane.advanceStep}
          onFinalizeVersion={async (snapshotId) => {
            try {
              await V8FinanceApi.finalizeVersion(snapshotId);
              toast.success(t('finance.lane.finalized', 'Version finalized'));
              await lane.refreshLane();
            } catch (err: any) {
              toast.error(getFinanceErrorMessage(err));
            }
          }}
          onRefreshCoherence={lane.refreshCoherence}
          loading={lane.loading}
        />
      )}

      <Suspense fallback={null}>
        {showCreateModelModal && (
          <CreateModelModal
            availableStatements={readyStatementRows}
            initialSourceStatementPackId={createModelSourceStatementPackId}
            onClose={() => {
              setShowCreateModelModal(false);
              setCreateModelSourceStatementPackId(null);
            }}
            onCreated={async (row) => {
              await refreshFinanceTruth(['models']);
              setShowCreateModelModal(false);
              setCreateModelSourceStatementPackId(null);
              handleOpenFull(row);
            }}
          />
        )}

        {showAnalysisCreateModal && (
          <CreateAnalysisModal
            defaultAnalysisType={activeTab === 'investment' ? 'investment_case' : 'comprehensive'}
            availableStatements={readyStatementRows}
            initialStatementPackId={analysisSourceStatementPackId}
            initialTitle={analysisInitialTitle}
            onClose={() => {
              setShowAnalysisCreateModal(false);
              setAnalysisSourceStatementPackId(null);
              setAnalysisInitialTitle('');
            }}
            onCreated={async (row) => {
              await refreshFinanceTruth(['analysis']);
              setShowAnalysisCreateModal(false);
              setAnalysisSourceStatementPackId(null);
              setAnalysisInitialTitle('');
              handleOpenFull(row);
            }}
          />
        )}

        {showPredictionCreateModal && (
          <CreateBudgetModal
            initialTitle={budgetInitialTitle}
            onClose={() => {
              setShowPredictionCreateModal(false);
              setBudgetInitialTitle('');
            }}
            onCreated={async (row) => {
              await refreshFinanceTruth(['prediction']);
              setShowPredictionCreateModal(false);
              setBudgetInitialTitle('');
              handleOpenFull(row);
            }}
          />
        )}

        {showValuationCreateModal && (
          <CreateValuationModal
            initialSourceType={valuationInitialSource.type}
            initialSourceId={valuationInitialSource.id}
            initialTitle={valuationInitialTitle}
            onClose={() => {
              setShowValuationCreateModal(false);
              setValuationInitialSource({});
              setValuationInitialTitle('');
            }}
            onCreated={async (row) => {
              await refreshFinanceTruth(['valuation']);
              setShowValuationCreateModal(false);
              setValuationInitialSource({});
              setValuationInitialTitle('');
              handleOpenFull(row);
            }}
          />
        )}

        {showLinkInitiativeModal && (
          <LinkInitiativeModal
            onClose={() => setShowLinkInitiativeModal(false)}
            onLinked={() => {
              setShowLinkInitiativeModal(false);
              lane.refreshLane?.();
            }}
          />
        )}

        {exportDialogOpen && exportTarget && (
          <ExportToOutputDialog
            open={exportDialogOpen}
            onClose={() => setExportDialogOpen(false)}
            analysisId={exportTarget.id}
            analysisTitle={exportTarget.title}
            analysisType={exportTarget.sourceType}
            onExportComplete={(result) => {
              toast.success(t('finance.export.created', 'Output created'));
              setExportDialogOpen(false);
              navigate(`/reports/builder/${result.outputId}`);
            }}
          />
        )}
      </Suspense>
    </>
  );
};

export default FinanceHub;

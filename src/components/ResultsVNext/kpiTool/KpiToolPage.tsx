/**
 * `/results/kpi/:kpiId` — RN-G3 lane: full KPI tool, klasa L (D03 — resolves
 * `RN_G2_UI_SCOPE.md` open question #2 FOR KPI SPECIFICALLY: klasa S's
 * 4-section limit is implausible given the real sub-resource count uncovered
 * there — Measurements, Deviations, Corrective Actions, Initiative Impacts
 * are all independent CRUD surfaces, same precedent that already forced
 * Task/Decision S->L in `src/components/standard/registry.ts`).
 *
 * -- SHELL CHOICE: uses `NModeShell` + `ArtifactRightPanel` DIRECTLY, not the
 * `StandardArtifactShell` wrapper. Reason: `StandardArtifactShell` requires
 * `karta: KartaNKey`, a CLOSED registry (`src/components/standard/registry.ts`)
 * that does not include a KPI/ROI/OKR full-tool entry today — extending it is
 * explicitly a Platform-owned edit outside this package's allowlist. This is
 * the SAME choice `../kpiScorecards/ResultsKpiScorecardDetailPage.tsx`
 * documents (its own header, "ARCHETYPE DECISION") for the sibling Scorecard
 * detail screen, and the same pattern `InitiativeDocumentView.tsx`/
 * `KnownToolDetailView.tsx` already use in this codebase (`NModeShell`
 * directly, no `StandardArtifactShell`). `ArtifactRightPanel` — the actual
 * shared SPEC-A contract (`ARTIFACT_ANATOMY_STANDARD.md` §10.2/§11.2) — is
 * used unmodified, satisfying CLAUDE.md rule #6's "powłoka wspólna" without
 * touching the closed registry.
 *
 * Sections (plan `02_KPI_IMPLEMENTATION_PLAN.md` §6.8, 8 named):
 *   1. Performance         — real (latest measurement + KPI-level lifecycle)
 *   2. Contract             — PARTIAL: no GET anywhere returns the joined
 *                             `rvn_kpi_definition_versions` row (name/unit/
 *                             target geometry/approval status) — see
 *                             `../kpiApi.ts` file header, "HONEST-DATA
 *                             CAVEAT". This section shows only the fields
 *                             that ARE reachable from `GET /kpi/:kpiId`.
 *   3. Record / Measurements — real, embeds the EXISTING
 *                             `ResultsKpiMeasurementsPanel` (task brief:
 *                             "panel istnieje, wepnij go w pełne narzędzie")
 *                             unmodified.
 *   4. Deviations           — real, `listDeviationCases({kpiId})`; cases are
 *                             ONLY ever created by the server
 *                             (`openOrEscalateDeviationCase`, called from
 *                             inside `recordMeasurement`/`correctMeasurement`
 *                             — verified: no `POST /deviation-cases` route
 *                             exists anywhere), so this section has NO
 *                             "create case" affordance — inventing one would
 *                             be a fabricated capability.
 *   5. Corrective Actions   — PARTIAL: no cross-case aggregate read endpoint
 *                             exists (`kpiDeviationApi.ts` "KNOWN GAP #2");
 *                             this section links into each open case's own
 *                             subview instead of faking a rollup table.
 *   6. Initiatives affecting KPI — real,
 *                             `GET /kpi/:kpiId/initiative-impacts` + the
 *                             full propose/commit/review/supersede command
 *                             set.
 *   7. Scorecards and contexts — real reverse lookup by KPI.
 *   8. History / Lineage    — real immutable KPI event history.
 *
 * D07 (scorecard snapshot payload filtering) does not apply to this screen —
 * it never renders `snapshot_payload`; that's `kpiScorecardPresenters.tsx`'s
 * concern, unmodified here.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  Activity,
  AlertTriangle,
  ArchiveIcon,
  Blocks,
  ClipboardCheck,
  FileText,
  GitBranch,
  History,
  LayoutGrid,
  MessageSquare,
  Link2,
  ListChecks,
  Play,
  Settings2,
  ShieldAlert,
} from 'lucide-react';

import { NModeShell } from '@/components/shared/NModeLayout/NModeShell';
import { NModeMenu2 } from '@/components/shared/NModeLayout/NModeMenu2';
import { SectionsManagerMenu } from '@/components/shared/NModeLayout/NModeCardManager';
import { NCardAIAnalysisPanel } from '@/components/shared/NModeLayout/NCardAIAnalysisPanel';
import { useCardAIAnalysis } from '@/components/shared/NModeLayout/useCardAIAnalysis';
import { useCardLayout } from '@/components/shared/NModeLayout/useCardLayout';
import type { CardAnalysisChange, CardAnalysisField } from '@/services/cardAnalysis';
import { PracujZAI } from '@/components/standard/PracujZAI';
import type { ZrodloUzupelnienia } from '@/components/standard/PracujZAI.types';
import type { NModeHeaderConfig, NModeHeaderPrimaryAction, NModeSection } from '@/components/shared/NModeLayout/types';
import { ArtifactRightPanel, type ArtifactRightPanelSection } from '@/components/standard/ArtifactRightPanel';
import { ArtifactBreadcrumb } from '@/components/standard/ArtifactBreadcrumb';
import { ArtifactPropertiesTable, type ArtifactPropertyRow } from '@/components/standard/ArtifactPropertiesTable';
import { StandardGridCard, type StandardGridCard as StandardGridCardData } from '@/components/standard/StandardGridCard';
import { StatusChip } from '@/components/ui/primitives';
import { MENU_1_PRIMARY_CTA } from '@/components/shared/ModuleMenu3';
import { memberNameOrUnknown, useOrganizationMemberNames } from '@/hooks/useOrganizationMemberNames';
import { ROUTES } from '@/routes/routeConfig';
import { ActionCardList } from '@/components/standard/ActionCardList';
import type { ActionCardModel } from '@/components/standard/ActionCard.types';
import { closeActionCard, createTaskFromActionCard, listActionCards } from '@/services/actionCards';
import { EmptyState } from '@/components/shared/states';

import { HonestValueCell } from '../HonestValue';
import {
  KartaWynikowChrome,
  PasekZapisuAI,
  useZapisPolAI,
  zbudujSpecSekcji,
} from '../shared/kartaWynikow';
import { ResultsVNextForbiddenState } from '../ResultsVNextForbiddenState';
import type { ResultsVNextForbiddenDetail } from '../types';
import { isResultsVNextFlagEnabled } from '../resultsVNextFeatureFlags';
import {
  activateKpi,
  archiveKpi,
  editKpiDraft,
  getKpi,
  getKpiCurrentDefinitionVersion,
  getKpiHistory,
  listKpiMeasurements,
  newKpiIdempotencyKey,
  suspendKpi,
  type EditKpiDraftInput,
  type KpiDefinitionDto,
  type KpiDefinitionVersionDto,
  type KpiHistoryEntryDto,
  type KpiMeasurementDto,
  type KpiStatus,
} from '../kpiApi';
import {
  getKpiScorecard,
  getKpiScorecardPeriodMatrix,
  listKpiScorecardsForKpi,
  type KpiScorecardDto,
  type ScorecardPeriodMatrixItemDto,
} from '../kpiScorecards/kpiScorecardApi';
import {
  KPI_SCORECARD_STATUS_TONE,
  kpiScorecardStatusLabel,
} from '../kpiScorecards/kpiScorecardMappers';
import { ResultsKpiMeasurementsPanel } from '../kpiMeasurements/ResultsKpiMeasurementsPanel';
import {
  KPI_DATA_QUALITY_STATUS_TONE,
  KPI_PERFORMANCE_STATUS_TONE,
  kpiDataQualityStatusLabel,
  kpiPerformanceStatusLabel,
} from '../kpiMeasurements/kpiMeasurementMappers';
import {
  listDeviationCases,
  type DeviationCaseDto,
} from './kpiDeviationApi';
import {
  commitInitiativeKpiImpact,
  listInitiativeImpactsForKpi,
  proposeInitiativeKpiImpact,
  recordReviewedAttribution,
  type InitiativeKpiImpactDto,
} from './kpiInitiativeImpactApi';
import { KpiReviewedAttributionDialog } from './KpiReviewedAttributionDialog';
import {
  isUnassignedCardSetId,
  KPI_CARD_SET_PARAM,
  kpiReportPath,
  withOwnerSampleData,
} from './kpiCardSetPath';
import { toUserFacingErrorMessage } from '../shared/errorMessage';
import {
  DEVIATION_CASE_STATUS_TONE,
  DEVIATION_SEVERITY_TONE,
  INITIATIVE_KPI_IMPACT_STATUS_TONE,
  KPI_APPROVAL_STATUS_TONE,
  deviationCaseStatusLabel,
  deviationSeverityLabel,
  escalatedOverlayLabel,
  initiativeKpiImpactStatusLabel,
  kpiApprovalStatusLabel,
  kpiTargetGeometryLabel,
} from './kpiToolMappers';

/** Ton pigułki statusu w Menu 1 (`NModeHeaderConfig.statusTone` — ZAMKNIĘTA,
 * inna unia niż `StatusChip`). Zatwierdzony obraz karty KPI
 * (`evidence/grafika/26-wyniki-karty-n/wskaznik-jedna-karta__PO__light__*.png`)
 * ma pigułkę OBOK TYTUŁU w Menu 1 — na żywo stała w centrum sekcji „Wyniki",
 * co właściciel widział jako inną kompozycję. */
const HEADER_STATUS_TONE: Record<KpiStatus, 'draft' | 'review' | 'approved' | 'rejected' | 'neutral'> = {
  draft: 'draft',
  pending_approval: 'review',
  active: 'approved',
  suspended: 'review',
  archived: 'neutral',
};

const STATUS_LABEL: Record<KpiStatus, { pl: string; en: string }> = {
  draft: { pl: 'Szkic', en: 'Draft' },
  pending_approval: { pl: 'Do zatwierdzenia', en: 'Pending approval' },
  active: { pl: 'Aktywny', en: 'Active' },
  suspended: { pl: 'Zawieszony', en: 'Suspended' },
  archived: { pl: 'Zarchiwizowany', en: 'Archived' },
};

function statusLabel(status: KpiStatus, isPolish: boolean): string {
  return isPolish ? STATUS_LABEL[status].pl : STATUS_LABEL[status].en;
}

const FIELD_CLASS =
  'w-full h-9 rounded-lg border border-c-border bg-c-surface px-3 text-sm text-c-text ' +
  'placeholder:text-c-text-muted transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:border-c-border-strong';
const TEXTAREA_CLASS =
  'w-full min-h-[64px] rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text ' +
  'placeholder:text-c-text-muted transition-colors resize-y ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:border-c-border-strong';
const LABEL_CLASS = 'block text-[11px] font-semibold uppercase tracking-wide text-c-text-muted mb-1.5';
const GHOST_BUTTON_CLASS =
  'inline-flex h-9 items-center gap-2 rounded-lg border border-c-border bg-transparent px-4 ' +
  'text-sm font-medium text-c-text transition-colors hover:bg-c-surface-raised ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:opacity-50';
const PRIMARY_BUTTON_CLASS = `${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`;

function shortId(id: string | null | undefined): string {
  if (!id) return '—';
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

function formatDate(iso: string | null | undefined, isPolish: boolean): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function honestNumber(value: number | null, isPolish: boolean): React.ReactNode {
  return <HonestValueCell isPolish={isPolish} value={value} align="right" />;
}

/** Contract section (task 3) — exactly the bound fields
 * `targetGeometryEvaluator.ts` reads for this geometry, same set
 * `KpiDraftFormModal.tsx`'s edit form shows (that file's own per-geometry
 * `{targetGeometry === '...' ? ... : null}` blocks), read-only here via
 * `HonestValueCell` so a genuinely-never-set bound reads "—", never `0`. */
function targetGeometryRows(v: KpiDefinitionVersionDto, isPolish: boolean): ArtifactPropertyRow[] {
  switch (v.targetGeometry) {
    case 'threshold_min':
      return [
        { id: 'targetValue', label: isPolish ? 'Próg (min.)' : 'Threshold (min)', value: honestNumber(v.targetValue, isPolish), mono: true },
        { id: 'warningLow', label: isPolish ? 'Ostrzeżenie od' : 'Warning from', value: honestNumber(v.warningLow, isPolish), mono: true },
        { id: 'criticalLow', label: isPolish ? 'Krytyczne od' : 'Critical from', value: honestNumber(v.criticalLow, isPolish), mono: true },
      ];
    case 'threshold_max':
      return [
        { id: 'targetValue', label: isPolish ? 'Próg (maks.)' : 'Threshold (max)', value: honestNumber(v.targetValue, isPolish), mono: true },
        { id: 'warningHigh', label: isPolish ? 'Ostrzeżenie do' : 'Warning up to', value: honestNumber(v.warningHigh, isPolish), mono: true },
        { id: 'criticalHigh', label: isPolish ? 'Krytyczne do' : 'Critical up to', value: honestNumber(v.criticalHigh, isPolish), mono: true },
      ];
    case 'range':
      return [
        { id: 'targetMin', label: isPolish ? 'Cel od' : 'Target from', value: honestNumber(v.targetMin, isPolish), mono: true },
        { id: 'targetMax', label: isPolish ? 'Cel do' : 'Target to', value: honestNumber(v.targetMax, isPolish), mono: true },
        { id: 'warningLow', label: isPolish ? 'Ostrzeżenie od' : 'Warning from', value: honestNumber(v.warningLow, isPolish), mono: true },
        { id: 'warningHigh', label: isPolish ? 'Ostrzeżenie do' : 'Warning to', value: honestNumber(v.warningHigh, isPolish), mono: true },
      ];
    case 'exact':
      return [
        { id: 'targetValue', label: isPolish ? 'Wartość dokładna' : 'Exact value', value: honestNumber(v.targetValue, isPolish), mono: true },
        { id: 'warningLow', label: isPolish ? 'Tolerancja od' : 'Tolerance from', value: honestNumber(v.warningLow, isPolish), mono: true },
        { id: 'warningHigh', label: isPolish ? 'Tolerancja do' : 'Tolerance to', value: honestNumber(v.warningHigh, isPolish), mono: true },
        { id: 'criticalLow', label: isPolish ? 'Krytyczne od' : 'Critical from', value: honestNumber(v.criticalLow, isPolish), mono: true },
        { id: 'criticalHigh', label: isPolish ? 'Krytyczne do' : 'Critical to', value: honestNumber(v.criticalHigh, isPolish), mono: true },
      ];
    case 'binary':
      return [
        {
          id: 'binarySuccessValue',
          label: isPolish ? 'Wartość sukcesu (0 lub 1)' : 'Success value (0 or 1)',
          value: honestNumber(v.binarySuccessValue, isPolish),
          mono: true,
        },
      ];
    case 'custom':
      return [{ id: 'formulaText', label: isPolish ? 'Formuła' : 'Formula', value: v.formulaText ?? '—' }];
    default:
      return [];
  }
}

const GapNotice: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    role="note"
    className="flex items-start gap-2 rounded-lg border border-c-warning/30 bg-c-warning/10 px-3 py-2 text-[11px] text-c-text-secondary"
  >
    <AlertTriangle size={14} className="mt-0.5 shrink-0 text-c-warning" />
    <span>{children}</span>
  </div>
);

export const KpiToolPage: React.FC = () => {
  const { i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const t = useCallback((pl: string, en: string) => (isPolish ? pl : en), [isPolish]);
  const navigate = useNavigate();
  const { kpiId } = useParams<{ kpiId: string }>();
  const enabled = isResultsVNextFlagEnabled('kpiRegistry');

  // ── POZIOM 3 trzypoziomowej formuły (odrzucenie właściciela 2026-09-05) ──
  // Karta N wskaźnika otwarta Z LISTY ZESTAWIENIA (poziom 2) niesie id tego
  // zestawienia w querystringu — dzięki temu ścieżka pokazuje pełne
  // „Rejestr KPI › <zestawienie> › <wskaźnik>", przeżywa odświeżenie i daje
  // się podlinkować (patrz `kpiCardSetPath.ts`).
  const [searchParams] = useSearchParams();
  const fromCardSetId = searchParams.get(KPI_CARD_SET_PARAM);
  const [pathCardSetName, setPathCardSetName] = useState<string | null>(null);

  const [kpi, setKpi] = useState<KpiDefinitionDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState<ResultsVNextForbiddenDetail | null>(null);
  const [pending, setPending] = useState<'activate' | 'suspend' | 'archive' | null>(null);

  // 143-resztki (2026-08-31) — Properties panel showed the RAW `ownerUserId`
  // ("user-pio…") instead of a name. Same id->name resolver convention
  // `ResultsRoiHub.tsx`/`ResultsOkrHub.tsx`/`attentionPresenters.tsx` already
  // use in this same ResultsVNext family (real org member list via
  // `OrganizationApi.getOrganizationMembers`, honest fallback to the id when
  // unresolved) — `GET /kpi/:kpiId` itself has no owner-name join (verified:
  // `kpiRepository.ts` only joins `dv.name`, never a users/members table), so
  // this is a client-side stitch against a real, already-fetched-elsewhere
  // endpoint, not a fabricated field.
  // 2026-09-05 (runda 3 odbioru): wspólny hak; fallback to już nie skrócony
  // identyfikator, tylko uczciwe „Nieznany użytkownik" (UUID w kolumnie
  // z człowiekiem był defektem rodziny zgłoszonym przez właściciela).
  const resolveMemberNameRaw = useOrganizationMemberNames();
  const resolveMemberName = useCallback(
    (userId: string | null | undefined): string =>
      memberNameOrUnknown(resolveMemberNameRaw, userId, isPolish),
    [resolveMemberNameRaw, isPolish]
  );

  const [measurement, setMeasurement] = useState<KpiMeasurementDto | null | 'loading'>(null);
  // RN-G6 UI fix (task 3) — Contract section previously showed ONLY the raw
  // `currentDefinitionVersionId` (fields from `GET /kpi/:kpiId` alone), even
  // though `GET /kpi/:kpiId/version` (P0-D, `getKpiCurrentDefinitionVersion`
  // in `../kpiApi.ts`) now returns the joined name/unit/target-geometry row.
  // `null` here means "fetch completed, nothing visible/found" (D06-generic
  // 404, same discipline `ResultsKpiRegistryPage.tsx`'s own effect uses for
  // this same call) — never conflated with `'loading'`.
  const [definitionVersion, setDefinitionVersion] = useState<KpiDefinitionVersionDto | null | 'loading'>('loading');
  /**
   * YTD miernika (SSOT §2, sekcja „Wyniki"). Liczy je serwer dla CAŁEGO
   * raportu (`GET .../scorecards/:id/periods`) — karta bierze z tej odpowiedzi
   * SWÓJ wiersz, zamiast liczyć drugą, własną sumę. Dwie prawdy o YTD (jedna
   * na poziomie 2, druga na karcie) byłyby gorsze niż brak YTD na karcie.
   * Bez `?zbior=` w adresie nie wiadomo, w którym raporcie liczyć — wtedy
   * kafelek pokazuje „—" z podpisem, a nie zgadniętą liczbę.
   */
  const [ytdWiersz, setYtdWiersz] = useState<ScorecardPeriodMatrixItemDto | null>(null);
  const [deviationCases, setDeviationCases] = useState<DeviationCaseDto[] | 'loading'>('loading');
  /* P7K część B — KARTY DZIAŁANIA tego miernika (kręgosłup P9, `action_cards`).
     Osobne od SPRAW ODCHYLENIA (`rvn_kpi_deviation_cases`): sprawa jest
     zapisem „miernik wyszedł poza limit", karta jest ZOBOWIĄZANIEM osoby.
     Filtrujemy po kluczu źródła `<kpiId>:<okres>` — serwer nie ma dziś filtra
     po mierniku, a doklejanie parametru do trasy P9 byłoby zmianą kontraktu
     dla pozostałych czterech rodzajów źródeł. */
  const [actionCards, setActionCards] = useState<ActionCardModel[] | 'loading'>('loading');
  const [actionCardBusyId, setActionCardBusyId] = useState<string | null>(null);
  const [initiativeImpacts, setInitiativeImpacts] = useState<InitiativeKpiImpactDto[] | 'loading'>('loading');
  const [scorecards, setScorecards] = useState<KpiScorecardDto[] | 'loading'>('loading');
  const [scorecardsError, setScorecardsError] = useState<string | null>(null);
  const [historyEntries, setHistoryEntries] = useState<KpiHistoryEntryDto[] | 'loading'>('loading');
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [impactBusy, setImpactBusy] = useState(false);

  // "Record reviewed attribution" dialog (replaces `window.prompt` — RN-G3
  // prompt-removal pass, 2026-08-11, extended scope). Kept OUTSIDE
  // `impactBusy`/toast on purpose: a rejected submit must keep the dialog
  // open with the server's error shown inline, not bounce the user to a
  // toast and lose the typed value.
  const [attributionTarget, setAttributionTarget] = useState<InitiativeKpiImpactDto | null>(null);
  const [attributionBusy, setAttributionBusy] = useState(false);
  const [attributionError, setAttributionError] = useState<string | null>(null);

  /* `?sekcja=<id>` — wejście z poziomu 2 wprost w KARTY DZIAŁANIA (P7K część B:
     ikona przy wierszu raportu prowadzi DO KARTY, nie na środek ekranu).
     Wartość spoza listy sekcji jest ignorowana: ekran startuje wtedy jak dotąd
     na „Wyniki", zamiast pokazać pustkę pod nieistniejącym identyfikatorem. */
  const SEKCJE_Z_ADRESU = new Set([
    'performance',
    'contract',
    'measurements',
    'deviations',
    'actionCards',
    'correctiveActions',
    'scorecards',
    'history',
  ]);
  const sekcjaZAdresu = searchParams.get('sekcja');
  const [activeSection, setActiveSection] = useState(
    sekcjaZAdresu && SEKCJE_Z_ADRESU.has(sekcjaZAdresu) ? sekcjaZAdresu : 'performance'
  );

  // Propose-impact form state.
  const [proposeInitiativeId, setProposeInitiativeId] = useState('');
  const [proposeContributionValue, setProposeContributionValue] = useState('');
  const [proposeDirection, setProposeDirection] = useState<'increase' | 'decrease'>('increase');

  const loadKpi = useCallback(async () => {
    if (!kpiId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const record = await getKpi(kpiId);
      if (!record) {
        setForbidden({ reason: 'NO_VISIBILITY_RECORD' });
        setKpi(null);
        return;
      }
      setForbidden(null);
      setKpi(record);
    } catch (err) {
      setLoadError(toUserFacingErrorMessage(err, isPolish));
    } finally {
      setLoading(false);
    }
  }, [kpiId]);

  useEffect(() => {
    if (!enabled) return;
    void loadKpi();
  }, [enabled, loadKpi]);

  useEffect(() => {
    if (!enabled || !kpiId) return;
    setMeasurement('loading');
    listKpiMeasurements(kpiId, { limit: 1 })
      .then((list) => setMeasurement(list[0] ?? null))
      .catch(() => setMeasurement(null));
  }, [enabled, kpiId]);

  useEffect(() => {
    if (!enabled || !kpiId) return;
    setDefinitionVersion('loading');
    getKpiCurrentDefinitionVersion(kpiId)
      .then((version) => setDefinitionVersion(version))
      .catch(() => setDefinitionVersion(null));
  }, [enabled, kpiId]);

  const loadDeviationCases = useCallback(() => {
    if (!kpiId) return;
    setDeviationCases('loading');
    listDeviationCases({ kpiId })
      .then(setDeviationCases)
      .catch(() => setDeviationCases([]));
  }, [kpiId]);

  useEffect(() => {
    if (!enabled) return;
    loadDeviationCases();
  }, [enabled, loadDeviationCases]);

  const loadActionCards = useCallback(() => {
    if (!kpiId) return;
    setActionCards('loading');
    listActionCards({ sourceKind: 'kpi_deviation' })
      .then((cards) => setActionCards(cards.filter((c) => c.sourceId.startsWith(`${kpiId}:`))))
      .catch(() => setActionCards([]));
  }, [kpiId]);

  useEffect(() => {
    if (!enabled) return;
    loadActionCards();
  }, [enabled, loadActionCards]);

  const handleActionCardTask = useCallback(
    async (card: ActionCardModel) => {
      setActionCardBusyId(card.id);
      try {
        const task = await createTaskFromActionCard(card.id);
        toast.success(
          isPolish ? `Zadanie utworzone: ${task.title}` : `Task created: ${task.title}`
        );
      } catch {
        toast.error(isPolish ? 'Nie udało się utworzyć zadania.' : 'Could not create the task.');
      } finally {
        setActionCardBusyId(null);
      }
    },
    [isPolish]
  );

  const handleActionCardClose = useCallback(
    async (card: ActionCardModel) => {
      setActionCardBusyId(card.id);
      try {
        await closeActionCard(card.id);
        toast.success(isPolish ? 'Karta zamknięta.' : 'Action card closed.');
        loadActionCards();
      } catch {
        toast.error(isPolish ? 'Nie udało się zamknąć karty.' : 'Could not close the card.');
      } finally {
        setActionCardBusyId(null);
      }
    },
    [isPolish, loadActionCards]
  );

  const loadInitiativeImpacts = useCallback(() => {
    if (!kpiId) return;
    setInitiativeImpacts('loading');
    listInitiativeImpactsForKpi(kpiId)
      .then(setInitiativeImpacts)
      .catch(() => setInitiativeImpacts([]));
  }, [kpiId]);

  useEffect(() => {
    if (!enabled) return;
    loadInitiativeImpacts();
  }, [enabled, loadInitiativeImpacts]);

  useEffect(() => {
    if (!enabled || !kpiId) return;
    setScorecards('loading');
    setScorecardsError(null);
    listKpiScorecardsForKpi(kpiId)
      .then(setScorecards)
      .catch((err) => {
        setScorecards([]);
        setScorecardsError(toUserFacingErrorMessage(err, isPolish));
      });
  }, [enabled, isPolish, kpiId]);

  // Nazwa zestawienia do ścieżki poziomów. Pobierana TYLKO gdy adres niesie
  // `?zbior=<id>` i NIE jest to zestawienie systemowe „Bez zestawienia"
  // (tamto nie ma rekordu w bazie — pytanie o nie API byłoby żądaniem o
  // zasób, którego nie ma). Wejście bez parametru nie robi żadnego żądania
  // ekstra — nazwę zestawienia bierze wtedy z sekcji „Zestawienia", którą ta
  // karta i tak już pobrała (`listKpiScorecardsForKpi`).
  useEffect(() => {
    if (!enabled || !fromCardSetId || isUnassignedCardSetId(fromCardSetId)) {
      setPathCardSetName(null);
      return;
    }
    getKpiScorecard(fromCardSetId)
      .then((sc) => setPathCardSetName(sc?.name ?? null))
      .catch(() => setPathCardSetName(null));
  }, [enabled, fromCardSetId]);

  /* YTD z matrycy okresów RAPORTU, z którego przyszliśmy — patrz `ytdWiersz`. */
  useEffect(() => {
    if (!enabled || !kpiId || !fromCardSetId || isUnassignedCardSetId(fromCardSetId)) {
      setYtdWiersz(null);
      return;
    }
    let anulowane = false;
    getKpiScorecardPeriodMatrix(fromCardSetId)
      .then((matrix) => {
        if (anulowane) return;
        setYtdWiersz(matrix?.items.find((i) => i.kpiId === kpiId) ?? null);
      })
      .catch(() => {
        if (!anulowane) setYtdWiersz(null);
      });
    return () => {
      anulowane = true;
    };
  }, [enabled, kpiId, fromCardSetId]);

  useEffect(() => {
    if (!enabled || !kpiId) return;
    setHistoryEntries('loading');
    setHistoryError(null);
    getKpiHistory(kpiId)
      .then((page) => setHistoryEntries(page.entries))
      .catch((err) => {
        setHistoryEntries([]);
        setHistoryError(toUserFacingErrorMessage(err, isPolish));
      });
  }, [enabled, isPolish, kpiId]);

  const submitReviewedAttribution = useCallback(
    (value: number) => {
      if (!attributionTarget) return;
      setAttributionBusy(true);
      setAttributionError(null);
      recordReviewedAttribution(attributionTarget.impactId, {
        expectedVersion: attributionTarget.rowVersion,
        reviewedAttributionValue: value,
        reviewRationale: t('Przegląd z narzędzia KPI', 'Review from KPI tool'),
      })
        .then(() => {
          toast.success(t('Atrybucja zapisana', 'Attribution recorded'));
          setAttributionTarget(null);
          loadInitiativeImpacts();
        })
        .catch((err) => setAttributionError(toUserFacingErrorMessage(err, isPolish)))
        .finally(() => setAttributionBusy(false));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attributionTarget, t, loadInitiativeImpacts]
  );

  const runLifecycleAction = useCallback(
    async (action: 'activate' | 'suspend' | 'archive') => {
      if (!kpi) return;
      setPending(action);
      try {
        const runner = action === 'activate' ? activateKpi : action === 'suspend' ? suspendKpi : archiveKpi;
        await runner({ kpiId: kpi.kpiId, expectedVersion: kpi.rowVersion });
        await loadKpi();
      } catch (err) {
        toast.error(toUserFacingErrorMessage(err, isPolish));
      } finally {
        setPending(null);
      }
    },
    [kpi, loadKpi]
  );

  const openCasesCount = useMemo(
    () => (Array.isArray(deviationCases) ? deviationCases.filter((c) => c.status !== 'closed').length : 0),
    [deviationCases]
  );

  // ══════════════════════════════════════════════════════════════════════════
  // [ODMROZENIE 16_GLOBAL_STANDARDS DEC-422] KARTA N MIERNIKA — Menu 5,
  // „Pracuj z AI", przyklejone nagłówki.
  //
  // SŁOWA WŁAŚCICIELA (06.09.2026, otwarta karta miernika): „Znowu nie ma
  // drugiego, trzeciego menu; nie otwiera się ta karta w trzecim menu, nie da
  // się tym zarządzać. Nie ma przycisku Work with AI. To normalne N-type
  // narzędzie, muszą tu być wszystkie narzędzia z nim związane."
  //
  // SSOT: docs/ssot/STEROWANIE_KART_N_I_AI.md (zasady 2, 2b, 3).
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * ZASADA 2b — JEDYNE sprawdzenie prawa edycji, jakie ta karta MA.
   *
   * Zmierzone, nie założone: w całym `KpiToolPage.tsx` nie było ANI JEDNEGO
   * `canEdit`/`readOnly`/sprawdzenia roli (grep 06.09.2026 = 0 trafień). Ale
   * serwer ma twardą bramkę: `PUT /vnext/results/kpi/:kpiId/draft` odrzuca
   * zapis kodem `NOT_A_DRAFT`, gdy bieżąca wersja definicji nie jest szkicem
   * (`kpiDefinitionCommands.ts` L575-578). To jest realne prawo edycji tej
   * karty i to ono steruje przełącznikiem „Edycja | Podgląd" oraz pozycjami
   * „Uzupełnij…". Nie wymyślamy roli, której backend nie zna.
   *
   * Miernik ARCHIWALNY jest zamknięty niezależnie od stanu wersji.
   */
  const wersjaDefinicji = definitionVersion !== 'loading' ? definitionVersion : null;
  const mozeEdytowac =
    !!kpi &&
    kpi.status !== 'archived' &&
    !!wersjaDefinicji &&
    wersjaDefinicji.approvalStatus === 'draft';

  /**
   * Domyślnie karta startuje w tym trybie, na jaki użytkownik ma prawo:
   * z prawem edycji — „Edycja", bez prawa — „Podgląd" (a przełącznika po
   * prostu nie ma, Zasada 2b). Start w „Podgląd" mimo prawa ukrywałby
   * „Uzupełnij…" za dodatkowym kliknięciem, którego nikt nie zamawiał.
   */
  const [readMode, setReadMode] = useState(!mozeEdytowac);
  useEffect(() => {
    setReadMode(!mozeEdytowac);
  }, [mozeEdytowac]);

  /**
   * Bieżąca wersja definicji trzymana w ref — każdy zapis szkicu PODNOSI
   * `rowVersion` (CAS), więc drugie pole z tej samej propozycji musi wysłać
   * wersję zwróconą przez pierwszy zapis, nie tę z pierwszego renderu.
   */
  const wersjaRef = React.useRef<KpiDefinitionVersionDto | null>(null);
  useEffect(() => {
    wersjaRef.current = wersjaDefinicji;
  }, [wersjaDefinicji]);

  /** Pola kontraktu miernika, do których backend REALNIE potrafi zapisać. */
  const POLA_KONTRAKTU: Record<string, 'name' | 'description' | 'formulaText'> = useMemo(
    () => ({
      name: 'name',
      description: 'description',
      formulaText: 'formulaText',
    }),
    []
  );

  const zapiszPoleKontraktu = useCallback(
    async (poleId: string, wartosc: string) => {
      const klucz = POLA_KONTRAKTU[poleId];
      const wersja = wersjaRef.current;
      if (!klucz) throw Object.assign(new Error('FIELD_NOT_WRITABLE'), { code: 'FIELD_NOT_WRITABLE' });
      if (!kpiId || !wersja) throw Object.assign(new Error('NO_CURRENT_VERSION'), { code: 'NO_CURRENT_VERSION' });
      // Klucz WPROST, nie `[klucz]: wartosc` — pole wyliczane rozszerzyłoby typ
      // obiektu o indeks `[x: string]`, przez co kompilator przestałby pilnować
      // zgodności z `EditKpiDraftInput` (czyli dokładnie tego, po co ten typ jest).
      const patch: EditKpiDraftInput = {
        expectedVersion: wersja.rowVersion,
        idempotencyKey: newKpiIdempotencyKey(),
      };
      if (klucz === 'name') patch.name = wartosc;
      else if (klucz === 'description') patch.description = wartosc;
      else patch.formulaText = wartosc;
      const nowa = await editKpiDraft(kpiId, patch);
      wersjaRef.current = nowa;
      setDefinitionVersion(nowa);
    },
    [POLA_KONTRAKTU, kpiId]
  );

  const zapisAI = useZapisPolAI(zapiszPoleKontraktu);

  /**
   * Deklaracja pól per sekcja — JEDNO źródło dla „Analizuj" i „Uzupełnij…".
   * Zapisywalne są WYŁĄCZNIE trzy pola tekstowe kontraktu. Świadomie NIE ma
   * tu ani właściciela, ani progów celu:
   *   · `ownerUserId` — `POST /vnext/results/kpi` w ogóle go nie przyjmuje,
   *     a `PUT .../draft` nie ma go w schemacie (kpiApi.ts, komentarz
   *     „ownerUserId is deliberately NOT accepted here"); nie ma dokąd zapisać,
   *   · progi/geometria celu — to LICZBY; generowanie liczby przez model
   *     byłoby zmyśleniem pomiaru, nie uzupełnieniem prozy.
   * Oba braki są zgłoszone w meldunku, nie ukryte.
   */
  const kpiPolaSekcji = useCallback(
    (sekcjaId: string): CardAnalysisField[] => {
      const w = wersjaDefinicji;
      if (sekcjaId === 'contract') {
        if (!w) return [];
        return [
          {
            id: 'name',
            label: isPolish ? 'Nazwa miernika' : 'Metric name',
            value: w.name ?? '',
            kind: 'text',
            writable: mozeEdytowac,
            hint: isPolish
              ? 'Krótka, jednoznaczna nazwa mierzonego zjawiska.'
              : 'A short, unambiguous name of the measured phenomenon.',
          },
          {
            id: 'description',
            label: isPolish ? 'Definicja miernika' : 'Metric definition',
            value: w.description ?? '',
            kind: 'text',
            writable: mozeEdytowac,
            hint: isPolish
              ? 'Co dokładnie mierzymy, na jakiej populacji i w jakim okresie.'
              : 'What exactly is measured, on which population and over which period.',
          },
          {
            id: 'formulaText',
            label: isPolish ? 'Formuła obliczania' : 'Calculation formula',
            value: w.formulaText ?? '',
            kind: 'text',
            writable: mozeEdytowac,
            hint: isPolish
              ? 'Licznik, mianownik, źródło danych i moment odczytu.'
              : 'Numerator, denominator, data source and read moment.',
          },
          {
            id: 'unit',
            label: isPolish ? 'Jednostka' : 'Unit',
            value: w.unit ?? '',
            kind: 'text',
            writable: false,
          },
        ];
      }
      if (sekcjaId === 'performance') {
        const pomiar = measurement !== 'loading' ? measurement : null;
        return [
          {
            id: 'lastMeasurement',
            label: isPolish ? 'Ostatni pomiar' : 'Latest measurement',
            value:
              pomiar && pomiar.actualValue !== null
                ? `${pomiar.actualValue} (${pomiar.periodStart} – ${pomiar.periodEnd})`
                : '',
            kind: 'text',
            writable: false,
          },
        ];
      }
      return [];
    },
    [wersjaDefinicji, mozeEdytowac, isPolish, measurement]
  );

  /** Sekcje, w których „Uzupełnij tę sekcję" ma co robić (Zasada 3). */
  const SEKCJE_Z_POLAMI_TEKSTOWYMI = useMemo(() => new Set(['contract']), []);

  const kpiWritableFieldIds = useMemo(
    () => (mozeEdytowac ? Object.keys(POLA_KONTRAKTU) : []),
    [mozeEdytowac, POLA_KONTRAKTU]
  );

  /**
   * ZAPIS z panelu „Analizuj" — ta sama, jedyna droga co „Uzupełnij…".
   * Dwie ścieżki AI nie mogą mieć dwóch dróg zapisu do tego samego pola.
   */
  const kpiApplyChange = useCallback(
    (change: CardAnalysisChange): boolean => {
      if (!mozeEdytowac || readMode) return false;
      if (!POLA_KONTRAKTU[change.fieldId]) return false;
      return zapisAI.zastosuj(change.fieldId, change.proposedValue);
    },
    [mozeEdytowac, readMode, POLA_KONTRAKTU, zapisAI]
  );

  const kpiCardAnalysis = useCardAIAnalysis({
    activeCardId: activeSection,
    buildInput: () => ({
      artifactType: 'metric',
      cardId: activeSection,
      artifactTitle:
        (definitionVersion !== 'loading' && definitionVersion?.name) || kpi?.name || kpi?.kpiCode || '',
      artifactContext: [
        kpi ? `Kod KPI: ${kpi.kpiCode}` : '',
        kpi ? `Cykl życia: ${kpi.status}` : '',
        wersjaDefinicji ? `Status zatwierdzenia wersji: ${wersjaDefinicji.approvalStatus}` : '',
        wersjaDefinicji ? `Geometria celu: ${wersjaDefinicji.targetGeometry}` : '',
        `Otwarte sprawy odchylenia: ${openCasesCount}`,
      ]
        .filter(Boolean)
        .join('\n'),
      fields: kpiPolaSekcji(activeSection),
      isPolish,
    }),
    applyChange: kpiApplyChange,
  });

  /**
   * Źródła „Uzupełnij…" — komponent `PracujZAI` generuje treść istniejącym
   * generatorem i woła `zastosuj` DOPIERO po kliknięciu „Zatwierdź".
   */
  const zrodloSekcji = useMemo<ZrodloUzupelnienia>(
    () => ({
      rodzaj: 'pola',
      pola: ({ sekcjaId }) =>
        (sekcjaId ? kpiPolaSekcji(sekcjaId) : [])
          .filter((f) => f.writable)
          .map((f) => ({
            id: f.id,
            etykieta: f.label,
            wartosc: String(f.value ?? ''),
            format: 'paragraph' as const,
            sekcjaId: sekcjaId ?? undefined,
            sekcjaEtykieta: isPolish ? 'Kontrakt' : 'Contract',
          })),
      zastosuj: zapisAI.zastosuj,
    }),
    [kpiPolaSekcji, isPolish, zapisAI.zastosuj]
  );

  const zrodloDokumentu = useMemo<ZrodloUzupelnienia>(
    () => ({
      rodzaj: 'pola',
      pola: () =>
        [...SEKCJE_Z_POLAMI_TEKSTOWYMI].flatMap((id) =>
          kpiPolaSekcji(id)
            .filter((f) => f.writable)
            .map((f) => ({
              id: f.id,
              etykieta: f.label,
              wartosc: String(f.value ?? ''),
              format: 'paragraph' as const,
              sekcjaId: id,
              sekcjaEtykieta: isPolish ? 'Kontrakt' : 'Contract',
            }))
        ),
      zastosuj: zapisAI.zastosuj,
    }),
    [SEKCJE_Z_POLAMI_TEKSTOWYMI, kpiPolaSekcji, isPolish, zapisAI.zastosuj]
  );

  /** Menu 5 → „Sekcje": kanoniczny `SectionsManagerMenu` na spec-u karty. */
  const specSekcji = useMemo(
    () =>
      zbudujSpecSekcji(
        [
          { id: 'performance', label: { pl: 'Wyniki', en: 'Performance' }, ikona: 'BarChart3' },
          { id: 'contract', label: { pl: 'Kontrakt', en: 'Contract' }, ikona: 'FileText' },
          { id: 'measurements', label: { pl: 'Pomiary', en: 'Measurements' }, ikona: 'CheckSquare' },
          { id: 'deviations', label: { pl: 'Odchylenia', en: 'Deviations' }, ikona: 'ShieldAlert' },
          { id: 'actionCards', label: { pl: 'Karty działania', en: 'Action cards' }, ikona: 'Rocket' },
          { id: 'correctiveActions', label: { pl: 'Działania', en: 'Corrective actions' }, ikona: 'CheckSquare' },
          { id: 'scorecards', label: { pl: 'Raporty', en: 'Reports' }, ikona: 'Layers' },
          { id: 'history', label: { pl: 'Historia', en: 'History' }, ikona: 'History' },
        ],
        { pl: 'Karta miernika', en: 'Metric card' }
      ),
    []
  );
  const ukladSekcji = useCardLayout({ artifactType: 'tool', spec: specSekcji });

  if (!enabled) {
    return (
      <div className="h-full flex items-center justify-center p-6" data-testid="results-vnext-kpi-tool-disabled">
        <EmptyState
          variant="new"
          icon={Blocks}
          title={t('Narzędzie KPI — jeszcze nie włączone', 'KPI tool — not yet enabled')}
          description={t(
            'Ten ekran jest w budowie. Wróć później albo poproś administratora o dostęp za flagą.',
            'This screen is still being built. Check back later, or ask an administrator for flag access.'
          )}
          compact
        />
      </div>
    );
  }

  if (forbidden) {
    return <ResultsVNextForbiddenState forbidden={forbidden} onBack={() => navigate(ROUTES.RESULTS_KPI.ROOT)} />;
  }

  if (loading || (!kpi && !loadError)) {
    return (
      <div className="h-full flex items-center justify-center" data-testid="results-vnext-kpi-tool-loading">
        <div className="text-sm text-c-text-muted">{t('Ładowanie KPI…', 'Loading KPI…')}</div>
      </div>
    );
  }

  if (loadError || !kpi) {
    return (
      <div className="h-full flex items-center justify-center p-6" data-testid="results-vnext-kpi-tool-error">
        <EmptyState
          variant="error"
          icon={AlertTriangle}
          title={t('Nie udało się wczytać KPI', 'Could not load the KPI')}
          description={loadError ?? undefined}
          onRetry={() => void loadKpi()}
          compact
        />
      </div>
    );
  }

  const isBusy = pending !== null;
  const hasApprovedDefinition =
    definitionVersion !== 'loading' && definitionVersion?.approvalStatus === 'approved';
  const noApprovedVersionReason = t(
    'Aktywacja wymaga zatwierdzonej wersji definicji KPI.',
    'Activation requires an approved KPI definition version.'
  );
  const archivedReason = t('KPI zarchiwizowane — stan końcowy, tylko odczyt.', 'KPI archived — terminal state, read-only.');

  // NModeHeaderPrimaryAction.label/title are BILINGUAL objects
  // ({ pl, en }), never a pre-resolved string — a real, visually-caught bug
  // (dev-render screenshot showed a blank primary CTA button) fixed here:
  // the earlier `t('Aktywuj', 'Activate')` call resolves to a single string,
  // which NModeHeader then reads as `label.pl`/`label.en` (both undefined).
  let primaryAction: NModeHeaderPrimaryAction | undefined;
  if (kpi.status === 'suspended') {
    primaryAction = { label: { pl: 'Aktywuj', en: 'Activate' }, onClick: () => void runLifecycleAction('activate'), disabled: isBusy };
  } else if (kpi.status === 'active') {
    primaryAction = { label: { pl: 'Zawieś', en: 'Suspend' }, onClick: () => void runLifecycleAction('suspend'), disabled: isBusy };
  } else if (kpi.status === 'draft' || kpi.status === 'pending_approval') {
    primaryAction = {
      label: { pl: 'Aktywuj', en: 'Activate' },
      onClick: () => void runLifecycleAction('activate'),
      disabled: isBusy || !hasApprovedDefinition,
      title: hasApprovedDefinition
        ? undefined
        : { pl: noApprovedVersionReason, en: noApprovedVersionReason },
    };
  } else {
    primaryAction = {
      label: { pl: 'Aktywuj', en: 'Activate' },
      onClick: () => {},
      disabled: true,
      title: { pl: archivedReason, en: archivedReason },
    };
  }

  // RN-G2 i18n/141 (2026-08-31) FIX: the H1 used to be the raw `kpiCode`
  // unconditionally (e.g. "OEE-LINIA-PAKOWANIA") — no name, no signature —
  // even though the business name IS reachable here: `definitionVersion`
  // (fetched above via `getKpiCurrentDefinitionVersion`, same join the
  // Contract section already reads `definitionVersion.name` from) carries it
  // whenever the joined fetch resolves. Falls back to the bare `kpiCode`
  // only while `definitionVersion` is still loading/null (honest-missing,
  // same discipline as every other field in this file) — the code itself
  // remains visible unconditionally in the Contract section's "Kod KPI" row
  // below, this is not losing that value, only no longer using it as the
  // ONLY thing the H1 ever shows.
  const kpiTitle =
    (definitionVersion !== 'loading' && definitionVersion?.name) || kpi.name || kpi.kpiCode;

  const header: NModeHeaderConfig = {
    title: kpiTitle,
    onTitleChange: () => {},
    titleReadOnly: true,
    // Pigułka statusu w Menu 1, obok tytułu — 1:1 z zatwierdzonym obrazem.
    statusLabel: statusLabel(kpi.status, isPolish),
    statusTone: HEADER_STATUS_TONE[kpi.status],
    artifactType: 'kpi',
    artifactId: kpi.kpiId,
    onSave: () => {},
    saveState: 'saved',
    onClose: () => navigate(ROUTES.RESULTS_KPI.ROOT),
    primaryAction,
    extraOverflowItems:
      kpi.status !== 'archived'
        ? [
            {
              id: 'archive',
              label: t('Archiwizuj', 'Archive'),
              icon: ArchiveIcon,
              onClick: () => void runLifecycleAction('archive'),
              danger: true,
            },
          ]
        : [],
  };

  // `process`/`responsePolicy` stay raw ids on purpose — grepped
  // `resultsVnextKpi.validators.ts`/`kpiTypes.ts`/`KpiDraftFormModal.tsx`:
  // both are free-form strings with NO backing registry/table anywhere in
  // production (no processes/policies list, no name join, no picker), unlike
  // `ownerUserId` (real org members) or `currentDefinitionVersionId` (real
  // `GET /kpi/:kpiId/version` join, already fetched into `definitionVersion`
  // below for the Contract section) — showing a name here would be invented.
  const definitionVersionDisplay =
    definitionVersion && definitionVersion !== 'loading' &&
    definitionVersion.definitionVersionId === kpi.currentDefinitionVersionId
      ? `${definitionVersion.name} (v${definitionVersion.versionNumber})`
      : shortId(kpi.currentDefinitionVersionId);

  const propertyRows: ArtifactPropertyRow[] = [
    { id: 'owner', label: t('Właściciel', 'Owner'), value: resolveMemberName(kpi.ownerUserId) },
    { id: 'process', label: t('Proces', 'Process'), value: shortId(kpi.primaryProcessId) },
    { id: 'responsePolicy', label: t('Polityka odpowiedzi', 'Response policy'), value: shortId(kpi.responsePolicyId) },
    { id: 'definitionVersion', label: t('Bieżąca wersja definicji', 'Current definition version'), value: definitionVersionDisplay },
    {
      id: 'cardSets',
      label: t('Występuje w raportach', 'Appears in reports'),
      value:
        scorecards === 'loading'
          ? '…'
          : scorecards.length === 0
            ? '—'
            : String(scorecards.length),
    },
    { id: 'created', label: t('Utworzono', 'Created'), value: formatDate(kpi.createdAt, isPolish) },
    { id: 'updated', label: t('Zaktualizowano', 'Updated'), value: formatDate(kpi.updatedAt, isPolish) },
  ];

  /**
   * ── PRAWY PANEL ARTEFAKTU — SZEŚĆ SEKCJI SPEC-A §10.2 ────────────────────
   *
   * Do 2026-09-05 panel miał TRZY sekcje (Akcje · Właściwości · Powiązania),
   * a kanon powłoki artefaktu (`ARTIFACT_ANATOMY_STANDARD.md` §10.2, SSOT
   * Wyniki §6) wymienia sześć: Akcje · Właściwości · Powiązania · Źródła
   * i założenia · Komentarze · Historia. Zaakceptowany prototyp pokazuje
   * wszystkie sześć.
   *
   * TERESA — DEC-419 (właściciel, 06.09.2026, karta Inicjatywy): przycisk
   * „Zapytaj Teresę o ten miernik" USUNIĘTY z sekcji Akcje — jedyne wejście
   * do Teresy jest teraz w Menu 1 (DEC-404). Do 06.09 panel dostawał
   * `TeresaEntryButton` jako zamiennik zdjętej zakładki-czatu (decyzja
   * 01.09 „JEDNA TERESA, W SWOIM OKNIE"); ten zamiennik okazał się drugim
   * wejściem do tej samej rozmowy i też poszedł.
   */
  const rightPanelSections: ArtifactRightPanelSection[] = [
    {
      id: 'actions',
      label: t('Akcje', 'Actions'),
      icon: Settings2,
      defaultOpen: true,
      children: (
        <div className="flex flex-col gap-2">
          {kpi.status === 'active' ? (
            <button type="button" disabled={isBusy} className={GHOST_BUTTON_CLASS} onClick={() => void runLifecycleAction('suspend')}>
              {t('Zawieś', 'Suspend')}
            </button>
          ) : kpi.status === 'suspended' ? (
            <button type="button" disabled={isBusy} className={GHOST_BUTTON_CLASS} onClick={() => void runLifecycleAction('activate')}>
              {t('Aktywuj', 'Activate')}
            </button>
          ) : (
            <p className="text-[11px] text-c-text-muted">
              {kpi.status === 'archived' ? archivedReason : noApprovedVersionReason}
            </p>
          )}
          <button type="button" className={GHOST_BUTTON_CLASS} onClick={() => setActiveSection('measurements')}>
            {t('Dodaj pomiar', 'Record measurement')}
          </button>
          {openCasesCount > 0 ? (
            <button type="button" className={GHOST_BUTTON_CLASS} onClick={() => setActiveSection('deviations')}>
              {t('Otwórz kartę działania', 'Open action card')}
            </button>
          ) : null}
        </div>
      ),
    },
    {
      id: 'properties',
      label: t('Właściwości', 'Properties'),
      icon: ListChecks,
      defaultOpen: true,
      children: (
        <ArtifactPropertiesTable rows={propertyRows} propertyLabel={t('Właściwość', 'Property')} valueLabel={t('Wartość', 'Value')} />
      ),
    },
    {
      id: 'relations',
      label: t('Powiązania', 'Relations'),
      icon: Link2,
      defaultOpen: false,
      isEmpty: openCasesCount === 0 && (!Array.isArray(initiativeImpacts) || initiativeImpacts.length === 0),
      emptyLabel: t('Brak powiązań', 'No relations'),
      badge: openCasesCount,
      children: (
        <div className="space-y-1.5">
          {openCasesCount > 0 ? (
            <button type="button" className="text-xs text-c-info underline" onClick={() => setActiveSection('deviations')}>
              {t(`${openCasesCount} otwarta(-e) sprawa(-y) odchylenia`, `${openCasesCount} open deviation case(s)`)}
            </button>
          ) : null}
          {Array.isArray(initiativeImpacts) && initiativeImpacts.length > 0 ? (
            <button type="button" className="text-xs text-c-info underline block" onClick={() => setActiveSection('correctiveActions')}>
              {t(`${initiativeImpacts.length} powiązana(-e) inicjatywa(-y)`, `${initiativeImpacts.length} linked initiative(s)`)}
            </button>
          ) : null}
        </div>
      ),
    },
    {
      /**
       * ŹRÓDŁA I ZAŁOŻENIA — to, na czym stoi liczba: metoda liczenia
       * i definicja z wersji definicji miernika oraz źródło ostatniego pomiaru.
       * Zero wymyślonych „dowodów": pola, których wersja definicji nie ma,
       * pokazują „—".
       */
      id: 'evidence',
      label: t('Źródła i założenia', 'Sources and assumptions'),
      icon: FileText,
      defaultOpen: false,
      isEmpty:
        (definitionVersion === 'loading' || !definitionVersion || (!definitionVersion.formulaText && !definitionVersion.description)) &&
        (measurement === 'loading' || !measurement),
      emptyLabel: t('Brak zapisanych źródeł', 'No sources recorded'),
      children: (
        <div className="space-y-2 text-xs text-c-text-secondary">
          <p>
            <span className="text-c-text-muted">{t('Metoda liczenia', 'Calculation method')}: </span>
            {definitionVersion && definitionVersion !== 'loading' ? (definitionVersion.formulaText ?? '—') : '—'}
          </p>
          <p>
            <span className="text-c-text-muted">{t('Definicja', 'Definition')}: </span>
            {definitionVersion && definitionVersion !== 'loading' ? (definitionVersion.description ?? '—') : '—'}
          </p>
          <p>
            <span className="text-c-text-muted">{t('Źródło ostatniego pomiaru', 'Latest measurement source')}: </span>
            {measurement && measurement !== 'loading' ? (measurement.source ?? '—') : '—'}
          </p>
        </div>
      ),
    },
    {
      /**
       * KOMENTARZE — sekcja kanonu SPEC-A, dla której miernik NIE MA dziś
       * wątku w modelu (sprawdzone: `rvn_kpi_*` nie ma tabeli komentarzy,
       * żadna trasa `kpi` ich nie wystawia). Pokazujemy ją WIDOCZNĄ
       * I WYŁĄCZONĄ Z POWODEM, zamiast udawać pusty wątek albo cicho
       * pominąć pozycję kanonu.
       */
      id: 'comments',
      label: t('Komentarze', 'Comments'),
      icon: MessageSquare,
      defaultOpen: false,
      isEmpty: true,
      emptyLabel: t(
        'Komentarze do miernika nie są jeszcze podpięte do modelu.',
        'Indicator comments are not wired to the model yet.'
      ),
      children: null,
    },
    {
      id: 'history',
      label: t('Historia', 'History'),
      icon: History,
      defaultOpen: false,
      isEmpty: !Array.isArray(historyEntries) || historyEntries.length === 0,
      emptyLabel: t('Brak zapisanych zdarzeń', 'No recorded events'),
      children: (
        <div className="space-y-1.5 text-xs text-c-text-secondary">
          {Array.isArray(historyEntries)
            ? historyEntries.slice(0, 3).map((entry) => (
                <p key={entry.entryId}>
                  {formatDate(entry.occurredAt, isPolish)} · {entry.summaryCode}
                </p>
              ))
            : null}
          <button type="button" className="text-xs text-c-info underline" onClick={() => setActiveSection('history')}>
            {t('Pokaż pełną historię', 'Show full history')}
          </button>
        </div>
      ),
    },
  ];

  // ── Section 1: Performance ──
  /**
   * ── SEKCJA „WYNIKI" (SSOT §2) ─────────────────────────────────────────────
   *
   * SSOT: „ostatni okres (CEL / Rezultat / odchylenie / stan), (…) YTD".
   * Do 2026-09-05 sekcja pokazywała TYLKO Rezultat — bez CELU nie da się
   * powiedzieć, czy 11 620 to dużo, czy mało, a odchylenie musiał liczyć
   * w głowie czytelnik.
   *
   * CEL i odchylenie liczymy z pomiaru (`periodTargetValue`, kolumna dołożona
   * migracją 20261124 z fallbackiem na zapis seeda). Gdy celu okresu nie ma —
   * pokazujemy „—" i NIE podstawiamy rocznego celu wersji definicji: cel roku
   * w kratce miesiąca byłby liczbą wymyśloną.
   */
  const okresowyCel =
    measurement && measurement !== 'loading' ? (measurement.periodTargetValue ?? null) : null;
  const okresowyWynik = measurement && measurement !== 'loading' ? measurement.actualValue : null;
  const odchylenieProc =
    okresowyCel != null && okresowyCel !== 0 && okresowyWynik != null
      ? ((okresowyWynik - okresowyCel) / Math.abs(okresowyCel)) * 100
      : null;
  /* `== null` (nie `=== null`) ŚWIADOMIE: pole `periodTargetValue` może być
     nieobecne w odpowiedzi sprzed tej zmiany, a `undefined.toLocaleString()`
     wywraca całą kartę na biało. Złapane testem `KpiToolPage.test.tsx`, nie
     oglądaniem — w harnessie fikstura pole miała. Nieliczba też daje „—". */
  const liczba = (v: number | null | undefined, ulamek = 0) =>
    v == null || !Number.isFinite(v)
      ? '—'
      : v.toLocaleString(isPolish ? 'pl-PL' : 'en-US', {
          minimumFractionDigits: ulamek,
          maximumFractionDigits: ulamek,
        });

  const performanceSection: NModeSection = {
    id: 'performance',
    icon: Activity,
    label: { pl: 'Wyniki', en: 'Performance' },
    hasData: true,
    alwaysShow: true,
    component: (
      <div className="space-y-4">
        {/* Pigułka statusu NIE jest tu powtarzana — mieszka w Menu 1 obok
            tytułu (zatwierdzony obraz karty KPI). */}
        <div className="rounded-xl border border-c-border-subtle p-4">
          <p className={LABEL_CLASS}>
            {measurement && measurement !== 'loading'
              ? `${t('Wyniki · okres', 'Results · period')} ${formatDate(measurement.periodStart, isPolish)} – ${formatDate(measurement.periodEnd, isPolish)}`
              : t('Wyniki · ostatni okres', 'Results · latest period')}
          </p>
          {measurement === 'loading' ? (
            <span className="text-sm text-c-text-muted">{t('Ładowanie…', 'Loading…')}</span>
          ) : measurement ? (
            <>
              <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <div className="text-xs text-c-text-muted">{t('CEL', 'TARGET')}</div>
                  <div className="whitespace-nowrap text-xl font-semibold tabular-nums text-c-text">
                    {liczba(okresowyCel)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-c-text-muted">{t('Rezultat', 'Actual')}</div>
                  <div
                    className={`whitespace-nowrap text-xl font-semibold tabular-nums ${
                      measurement.performanceStatus === 'critical'
                        ? 'text-c-danger'
                        : measurement.performanceStatus === 'warning'
                          ? 'text-c-warning'
                          : 'text-c-text'
                    }`}
                  >
                    {liczba(okresowyWynik)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-c-text-muted">{t('Odchylenie', 'Deviation')}</div>
                  <div
                    className={`whitespace-nowrap text-xl font-semibold tabular-nums ${
                      odchylenieProc !== null && odchylenieProc < 0 ? 'text-c-danger' : 'text-c-text'
                    }`}
                  >
                    {odchylenieProc === null
                      ? '—'
                      : `${odchylenieProc > 0 ? '+' : '−'}${Math.abs(odchylenieProc).toLocaleString(isPolish ? 'pl-PL' : 'en-US', { maximumFractionDigits: 1 })}%`}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-c-text-muted">
                    {t('YTD (rezultat / cel)', 'YTD (actual / target)')}
                  </div>
                  <div
                    className="whitespace-nowrap text-xl font-semibold tabular-nums text-c-text"
                    title={
                      ytdWiersz
                        ? undefined
                        : t(
                            'YTD liczy się w kontekście raportu — otwórz miernik z raportu, żeby je zobaczyć.',
                            'YTD is computed in the context of a report — open the indicator from a report to see it.'
                          )
                    }
                  >
                    {ytdWiersz
                      ? `${liczba(ytdWiersz.ytdActualValue)} / ${liczba(ytdWiersz.ytdTargetValue)}`
                      : '—'}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <StatusChip label={kpiPerformanceStatusLabel(measurement.performanceStatus, isPolish)} tone={KPI_PERFORMANCE_STATUS_TONE[measurement.performanceStatus]} />
                <StatusChip label={kpiDataQualityStatusLabel(measurement.dataQualityStatus, isPolish)} tone={KPI_DATA_QUALITY_STATUS_TONE[measurement.dataQualityStatus]} />
              </div>
            </>
          ) : (
            <span className="text-xs text-c-text-muted">{t('Brak zarejestrowanych pomiarów.', 'No measurements recorded yet.')}</span>
          )}
        </div>
        <button type="button" className={GHOST_BUTTON_CLASS} onClick={() => setActiveSection('measurements')}>
          {t('Otwórz pełną historię pomiarów', 'Open full measurement history')}
        </button>
      </div>
    ),
  };

  // ── Section 2: Contract ──
  // RN-G6 UI fix (task 3) — was a permanent "no GET returns this" notice
  // with only the raw version ID visible. `GET /kpi/:kpiId/version` (P0-D)
  // now exists, fetched above into `definitionVersion` — this section shows
  // the real name/unit/target-geometry/approval-status data whenever that
  // fetch resolves, and only falls back to an honest gap notice while
  // loading or if the fetch genuinely comes back empty (D06-generic, same
  // as any other visibility-denied read in this package).
  const contractSection: NModeSection = {
    id: 'contract',
    icon: FileText,
    label: { pl: 'Kontrakt', en: 'Contract' },
    hasData: true,
    alwaysShow: true,
    component: (
      <div className="space-y-3">
        {definitionVersion === 'loading' ? (
          <p className="text-sm text-c-text-muted">{t('Ładowanie…', 'Loading…')}</p>
        ) : definitionVersion === null ? (
          <GapNotice>
            {t(
              'Nie udało się wczytać złączonej wersji definicji (GET /kpi/:kpiId/version) — poniżej wyłącznie pola dostępne z GET /kpi/:kpiId.',
              'Could not load the joined definition version (GET /kpi/:kpiId/version) — below are only the fields reachable from GET /kpi/:kpiId.'
            )}
          </GapNotice>
        ) : (
          <ArtifactPropertiesTable
            rows={[
              { id: 'name', label: t('Nazwa', 'Name'), value: definitionVersion.name },
              { id: 'description', label: t('Opis', 'Description'), value: definitionVersion.description ?? '—' },
              { id: 'unit', label: t('Jednostka', 'Unit'), value: definitionVersion.unit ?? '—' },
              {
                id: 'targetGeometry',
                label: t('Geometria celu', 'Target geometry'),
                value: kpiTargetGeometryLabel(definitionVersion.targetGeometry, isPolish),
              },
              ...targetGeometryRows(definitionVersion, isPolish),
              {
                id: 'approvalStatus',
                label: t('Status zatwierdzenia', 'Approval status'),
                value: (
                  <StatusChip
                    tone={KPI_APPROVAL_STATUS_TONE[definitionVersion.approvalStatus]}
                    label={kpiApprovalStatusLabel(definitionVersion.approvalStatus, isPolish)}
                  />
                ),
              },
              {
                id: 'versionNumber',
                label: t('Numer wersji', 'Version number'),
                value: definitionVersion.versionNumber,
                mono: true,
              },
            ]}
            propertyLabel={t('Właściwość', 'Property')}
            valueLabel={t('Wartość', 'Value')}
          />
        )}
        <ArtifactPropertiesTable
          rows={[
            { id: 'kpiCode', label: t('Kod KPI', 'KPI code'), value: kpi.kpiCode },
            { id: 'status', label: t('Cykl życia', 'Lifecycle'), value: statusLabel(kpi.status, isPolish) },
            { id: 'definitionVersion', label: t('ID bieżącej wersji', 'Current version id'), value: shortId(kpi.currentDefinitionVersionId), mono: true },
          ]}
          propertyLabel={t('Właściwość', 'Property')}
          valueLabel={t('Wartość', 'Value')}
        />
      </div>
    ),
  };

  // ── Section 3: Measurements (embeds the real existing panel) ──
  const measurementsSection: NModeSection = {
    id: 'measurements',
    icon: ListChecks,
    label: { pl: 'Pomiary', en: 'Measurements' },
    hasData: true,
    alwaysShow: true,
    component: (
      <div className="h-[70vh] rounded-xl border border-c-border-subtle overflow-hidden">
        <ResultsKpiMeasurementsPanel kpi={kpi} isPolish={isPolish} onBack={() => setActiveSection('performance')} />
      </div>
    ),
  };

  // ── Section 4: Deviations ──
  const deviationsSection: NModeSection = {
    id: 'deviations',
    icon: ShieldAlert,
    label: { pl: 'Odchylenia', en: 'Deviations' },
    title: { pl: 'Sprawy odchyleń', en: 'Deviation cases' },
    hasData: true,
    alwaysShow: true,
    component: (
      <div className="space-y-3">
        <GapNotice>
          {t(
            'Sprawy odchyleń tworzy WYŁĄCZNIE serwer, automatycznie, przy krytycznym/ostrzegawczym pomiarze (openOrEscalateDeviationCase, wołane z recordMeasurement/correctMeasurement) — brak POST do ręcznego utworzenia sprawy, więc ten ekran nie ma przycisku „Nowa sprawa".',
            'Deviation cases are created ONLY by the server, automatically, on a critical/warning measurement (openOrEscalateDeviationCase, called from recordMeasurement/correctMeasurement) — no POST exists to create one manually, so this screen has no "New case" button.'
          )}
        </GapNotice>
        {deviationCases === 'loading' ? (
          <p className="text-sm text-c-text-muted">{t('Ładowanie…', 'Loading…')}</p>
        ) : deviationCases.length === 0 ? (
          <EmptyState
            variant="new"
            icon={ShieldAlert}
            title={t('Brak spraw odchyleń', 'No deviation cases')}
            description={t('Ten KPI nie miał jeszcze krytycznego/ostrzegawczego pomiaru.', 'This KPI has not had a critical/warning measurement yet.')}
            compact
          />
        ) : (
          <ul className="space-y-2">
            {deviationCases.map((c) => (
              <li key={c.caseId}>
                <button
                  type="button"
                  className="w-full text-left rounded-xl border border-c-border-subtle p-3 hover:bg-c-surface-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                  onClick={() => navigate(`${ROUTES.RESULTS_KPI.TOOL.replace(':kpiId', kpi.kpiId)}/deviation-cases/${c.caseId}`)}
                  data-testid={`kpi-deviation-case-row-${c.caseId}`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-c-text">{shortId(c.caseId)}</span>
                    <StatusChip label={deviationCaseStatusLabel(c.status, isPolish)} tone={DEVIATION_CASE_STATUS_TONE[c.status]} />
                    <StatusChip label={deviationSeverityLabel(c.severity, isPolish)} tone={DEVIATION_SEVERITY_TONE[c.severity]} />
                    {c.escalated ? <StatusChip label={escalatedOverlayLabel(isPolish)} tone="danger" /> : null}
                  </div>
                  <p className="mt-1 text-[11px] text-c-text-muted">
                    {t('Wykryto ', 'Detected ')}
                    {formatDate(c.detectedAt, isPolish)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    ),
  };

  // ── Section 5: Corrective actions (rollup notice + links) ──
  /**
   * ── INICJATYWY WPŁYWAJĄCE NA MIERNIK — BLOK, NIE ÓSMA SEKCJA ─────────────
   *
   * SSOT `SSOT_WYNIKI_KPI_OKR_ROI.md` §2 wymienia DOKŁADNIE siedem sekcji
   * karty miernika: Wyniki · Kontrakt · Pomiary · Odchylenia · Działania ·
   * Raporty · Historia — i tyle pokazuje zaakceptowany przez właściciela
   * prototyp. Ósma pozycja w lewej nawigacji byłaby widoczną różnicą wobec
   * obrazu, na którym stanął akcept.
   *
   * Ale ta powierzchnia to działający zestaw komend (zaproponuj / zatwierdź /
   * przejrzyj / zastąp) — skasowanie jej, żeby lewa nawigacja zgadzała się
   * z rysunkiem, byłoby zniszczeniem funkcji dla wyglądu. Dlatego treść
   * zostaje w CAŁOŚCI, jako drugi blok sekcji „Działania": obie rzeczy
   * odpowiadają na to samo pytanie — „co robimy, żeby ten miernik wrócił do
   * normy" — a blok zachowuje pełną szerokość centrum karty (w prawym panelu,
   * przy 320 px, byłby ściśnięty).
   */
  const initiativeImpactsBlock = (
      <div className="space-y-4">
        {initiativeImpacts === 'loading' ? (
          <p className="text-sm text-c-text-muted">{t('Ładowanie…', 'Loading…')}</p>
        ) : initiativeImpacts.length === 0 ? (
          <EmptyState
            variant="new"
            icon={GitBranch}
            title={t('Brak powiązanych inicjatyw', 'No linked initiatives')}
            description={t('Żadna inicjatywa nie zaproponowała jeszcze wpływu na ten KPI.', 'No initiative has proposed an impact on this KPI yet.')}
            compact
          />
        ) : (
          <ul className="space-y-2">
            {initiativeImpacts.map((imp) => (
              <li key={imp.impactId} className="rounded-xl border border-c-border-subtle p-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-medium text-c-text">{shortId(imp.initiativeId)}</span>
                  <StatusChip label={initiativeKpiImpactStatusLabel(imp.status, isPolish)} tone={INITIATIVE_KPI_IMPACT_STATUS_TONE[imp.status]} />
                </div>
                <p className="mt-1 text-[11px] text-c-text-muted">
                  {t('Oczekiwany wpływ: ', 'Expected contribution: ')}
                  {imp.expectedContributionValue ?? '—'} ({imp.expectedContributionDirection ?? '—'})
                </p>
                {imp.baselineValueAtCommitment !== null ? (
                  <p className="text-[11px] text-c-text-muted">
                    {t('Baseline (zamrożony przy commit): ', 'Baseline (frozen at commit): ')}
                    {imp.baselineValueAtCommitment}
                  </p>
                ) : null}
                {imp.reviewedAttributionValue !== null ? (
                  <p className="text-[11px] text-c-text-muted">
                    {t('Zweryfikowana atrybucja: ', 'Reviewed attribution: ')}
                    {imp.reviewedAttributionValue}
                  </p>
                ) : null}
                <div className="mt-2 flex items-center gap-2">
                  {imp.status === 'proposed' ? (
                    <button
                      type="button"
                      disabled={impactBusy}
                      className={GHOST_BUTTON_CLASS}
                      onClick={() => {
                        setImpactBusy(true);
                        commitInitiativeKpiImpact(imp.impactId, { expectedVersion: imp.rowVersion })
                          .then(() => {
                            toast.success(t('Wpływ zatwierdzony (baseline zamrożony)', 'Impact committed (baseline frozen)'));
                            loadInitiativeImpacts();
                          })
                          .catch((err) => toast.error(toUserFacingErrorMessage(err, isPolish)))
                          .finally(() => setImpactBusy(false));
                      }}
                    >
                      {t('Zatwierdź (commit)', 'Commit')}
                    </button>
                  ) : null}
                  {(imp.status === 'committed' || imp.status === 'superseded') && !imp.reviewedAttributionValue ? (
                    <button
                      type="button"
                      disabled={impactBusy}
                      className={GHOST_BUTTON_CLASS}
                      onClick={() => {
                        setAttributionError(null);
                        setAttributionTarget(imp);
                      }}
                      data-testid={`kpi-tool-record-reviewed-attribution-${imp.impactId}`}
                    >
                      {t('Zapisz zweryfikowaną atrybucję', 'Record reviewed attribution')}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="rounded-xl border border-c-border-subtle p-4 space-y-2">
          <p className={LABEL_CLASS}>{t('Zaproponuj wpływ inicjatywy', 'Propose an initiative impact')}</p>
          <input
            value={proposeInitiativeId}
            onChange={(e) => setProposeInitiativeId(e.target.value)}
            placeholder={t('ID inicjatywy', 'Initiative id')}
            className={FIELD_CLASS}
            data-testid="kpi-tool-propose-initiative-id"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={proposeContributionValue}
              onChange={(e) => setProposeContributionValue(e.target.value)}
              placeholder={t('Oczekiwana wartość (opcjonalnie)', 'Expected value (optional)')}
              className={FIELD_CLASS}
            />
            <select value={proposeDirection} onChange={(e) => setProposeDirection(e.target.value as 'increase' | 'decrease')} className={FIELD_CLASS}>
              <option value="increase">{t('Wzrost', 'Increase')}</option>
              <option value="decrease">{t('Spadek', 'Decrease')}</option>
            </select>
          </div>
          <button
            type="button"
            disabled={impactBusy || !proposeInitiativeId.trim()}
            className={PRIMARY_BUTTON_CLASS}
            data-testid="kpi-tool-propose-initiative-submit"
            onClick={() => {
              setImpactBusy(true);
              proposeInitiativeKpiImpact({
                kpiId: kpi.kpiId,
                initiativeId: proposeInitiativeId.trim(),
                expectedContributionValue: proposeContributionValue ? Number(proposeContributionValue) : null,
                expectedContributionDirection: proposeDirection,
              })
                .then(() => {
                  toast.success(t('Wpływ zaproponowany', 'Impact proposed'));
                  setProposeInitiativeId('');
                  setProposeContributionValue('');
                  loadInitiativeImpacts();
                })
                .catch((err) => toast.error(toUserFacingErrorMessage(err, isPolish)))
                .finally(() => setImpactBusy(false));
            }}
          >
            {t('Zaproponuj', 'Propose')}
          </button>
        </div>
      </div>
  );

  /* ── Sekcja: KARTY DZIAŁANIA (P7K część B, KRĘGOSŁUP §2.4/§3) ──────────
     Jedyny komponent karty w całej aplikacji (`src/components/standard/
     ActionCard.tsx`) — ten ekran go OSADZA, nie buduje własnego. Karta
     powstaje po stronie serwera, gdy rezultat okresu wypadnie poza limit;
     tutaj człowiek dopisuje przyczynę i działanie, robi z niej zadanie albo
     ją zamyka. */
  const actionCardsSection: NModeSection = {
    id: 'actionCards',
    icon: ClipboardCheck,
    label: { pl: 'Karty działania', en: 'Action cards' },
    title: { pl: 'Karty działania', en: 'Action cards' },
    hasData: true,
    alwaysShow: true,
    component: (
      <div className="space-y-3" data-testid="kpi-action-cards-section">
        {actionCards === 'loading' ? (
          <p className="text-sm text-c-text-muted">{t('Wczytywanie…', 'Loading…')}</p>
        ) : (
          <ActionCardList
            cards={actionCards}
            onCreateTask={handleActionCardTask}
            onCloseCard={handleActionCardClose}
            busyId={actionCardBusyId}
            emptyLabel={t(
              'Brak kart działania — żaden rezultat tego miernika nie wyszedł poza limit.',
              'No action cards — no result of this indicator fell outside its limits.'
            )}
          />
        )}
      </div>
    ),
  };

  const correctiveActionsSection: NModeSection = {
    id: 'correctiveActions',
    icon: Play,
    /* SSOT §2 nazywa tę sekcję po prostu „Działania" — tak samo jak
       zaakceptowany prototyp. „Działania korygujące" było nazwą techniczną
       z modelu spraw odchylenia, nie słowem właściciela. */
    label: { pl: 'Działania', en: 'Actions' },
    hasData: true,
    alwaysShow: true,
    component: (
      <div className="space-y-3">
        <GapNotice>
          {t(
            'Brak zbiorczego GET dla działań korygujących ponad wszystkimi sprawami tego KPI (kpiDeviationRepository.listCorrectiveActions istnieje, ale żaden route go nie wystawia — patrz kpiDeviation.routes.ts, sekcja „DESIGN NOTE"). Działania żyją WEWNĄTRZ każdej sprawy odchylenia — otwórz sprawę poniżej.',
            'No aggregate GET exists for corrective actions across this KPI\'s cases (kpiDeviationRepository.listCorrectiveActions exists but no route exposes it — see kpiDeviation.routes.ts "DESIGN NOTE"). Actions live INSIDE each deviation case — open a case below.'
          )}
        </GapNotice>
        {Array.isArray(deviationCases) && deviationCases.filter((c) => c.status !== 'closed').length > 0 ? (
          <ul className="space-y-1.5">
            {deviationCases
              .filter((c) => c.status !== 'closed')
              .map((c) => (
                <li key={c.caseId}>
                  <button
                    type="button"
                    className="text-xs text-c-info underline"
                    onClick={() => navigate(`${ROUTES.RESULTS_KPI.TOOL.replace(':kpiId', kpi.kpiId)}/deviation-cases/${c.caseId}`)}
                  >
                    {t('Otwórz sprawę ', 'Open case ')}
                    {shortId(c.caseId)} ({deviationCaseStatusLabel(c.status, isPolish)})
                  </button>
                </li>
              ))}
          </ul>
        ) : (
          <p className="text-xs text-c-text-muted">{t('Brak otwartych spraw z działaniami do pokazania.', 'No open cases with actions to show.')}</p>
        )}
        <div className="border-t border-c-border-subtle pt-3">
          <h3 className="mb-2 text-sm font-semibold text-c-text">
            {t('Inicjatywy wpływające na ten miernik', 'Initiatives affecting this indicator')}
          </h3>
          {initiativeImpactsBlock}
        </div>
      </div>
    ),
  };

  // ── Section 6: Raporty (SSOT §2) ──
  const scorecardsSection: NModeSection = {
    id: 'scorecards',
    icon: LayoutGrid,
    /* SSOT §2: „Raporty (w których występuje)". Jedna tożsamość miernika,
       wiele raportów okresowych — dlatego liczba mnoga i słowo RAPORT, a nie
       „zestawienie". */
    label: { pl: 'Raporty', en: 'Reports' },
    title: { pl: 'Raporty, w których występuje ten miernik', en: 'Reports this indicator appears in' },
    hasData: Array.isArray(scorecards) && scorecards.length > 0,
    alwaysShow: true,
    component: (
      scorecards === 'loading' ? (
        <p className="text-sm text-c-text-muted">{t('Ładowanie…', 'Loading…')}</p>
      ) : scorecardsError ? (
        <EmptyState variant="error" icon={AlertTriangle} title={t('Nie udało się wczytać kart wyników', 'Could not load scorecards')} description={scorecardsError} compact />
      ) : scorecards.length === 0 ? (
        <EmptyState variant="new" icon={LayoutGrid} title={t('Brak kart wyników', 'No scorecards')} description={t('Ten KPI nie należy jeszcze do żadnej widocznej karty wyników.', 'This KPI does not belong to any visible scorecard yet.')} compact />
      ) : (
        <div className="space-y-3" data-testid="kpi-tool-scorecards-list">
          <p className="text-[11px] text-c-text-muted">
            {t(
              'Piętro WYŻEJ: wejdź w zestawienie, żeby zobaczyć jego listę — opis i wszystkie wskaźniki, do których ten należy.',
              'One level UP: open a card set to see its list — the description and every indicator it holds, including this one.'
            )}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {scorecards.map((scorecard) => {
              const card: StandardGridCardData = {
                id: scorecard.scorecardId,
                title: scorecard.name,
                description: scorecard.description ?? t('Brak opisu', 'No description'),
                statusLabel: kpiScorecardStatusLabel(scorecard.lifecycleStatus, isPolish),
                statusTone: KPI_SCORECARD_STATUS_TONE[scorecard.lifecycleStatus],
                footerRight: formatDate(scorecard.updatedAt, isPolish),
              };
              return (
                <div key={scorecard.scorecardId} data-testid={`kpi-tool-scorecard-tile-${scorecard.scorecardId}`}>
                  <StandardGridCard
                    card={card}
                    onClick={() => navigate(withOwnerSampleData(kpiReportPath(scorecard.scorecardId)))}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )
    ),
  };

  // ── Section 8: History / Lineage ──
  const historySection: NModeSection = {
    id: 'history',
    icon: History,
    /* SSOT §2: „Historia". „Rodowód" było kalką z `lineage` — słowo
       techniczne, nie słowo właściciela. */
    label: { pl: 'Historia', en: 'History' },
    title: { pl: 'Historia zmian miernika', en: 'Indicator change history' },
    hasData: Array.isArray(historyEntries) && historyEntries.length > 0,
    alwaysShow: true,
    component: (
      historyEntries === 'loading' ? (
        <p className="text-sm text-c-text-muted">{t('Ładowanie…', 'Loading…')}</p>
      ) : historyError ? (
        <EmptyState variant="error" icon={AlertTriangle} title={t('Nie udało się wczytać historii KPI', 'Could not load KPI history')} description={historyError} compact />
      ) : historyEntries.length === 0 ? (
        <EmptyState variant="new" icon={FileText} title={t('Brak historii KPI', 'No KPI history')} description={t('Dla tego KPI nie zapisano jeszcze zdarzeń domenowych.', 'No domain events have been recorded for this KPI yet.')} compact />
      ) : (
        <ul className="space-y-2" data-testid="kpi-tool-history-list">
          {historyEntries.map((entry) => (
            <li key={entry.entryId} className="rounded-xl border border-c-border-subtle p-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-medium text-c-text">{entry.summaryCode}</span>
                <StatusChip label={entry.kind} tone="neutral" />
              </div>
              <p className="mt-1 text-[11px] text-c-text-muted">
                {formatDate(entry.occurredAt, isPolish)} · {t('wersja', 'version')} {entry.sourceVersion}
              </p>
            </li>
          ))}
        </ul>
      )
    ),
  };

  /**
   * SIEDEM SEKCJI, W KOLEJNOŚCI SSOT §2:
   *   Wyniki · Kontrakt · Pomiary · Odchylenia · Działania · Raporty · Historia.
   * Dokładnie tyle i w tej kolejności pokazuje zaakceptowany prototyp
   * (`evidence/p7k-wyniki/prototype/kpi-l3--light.png`). Inicjatywy wpływające
   * na miernik są drugim BLOKIEM sekcji „Działania" — patrz komentarz przy
   * `initiativeImpactsBlock`.
   */
  const wszystkieSekcje: NModeSection[] = [
    performanceSection,
    contractSection,
    measurementsSection,
    deviationsSection,
    actionCardsSection,
    correctiveActionsSection,
    scorecardsSection,
    historySection,
  ];
  // Kolejność i widoczność sekcji pochodzi z Menu 5 → „Sekcje" (kanoniczny
  // `useCardLayout.applyToSections`), a nie z kolejności zapisanej w tym pliku.
  const sections: NModeSection[] = ukladSekcji.applyToSections(wszystkieSekcje);

  // ── ŚCIEŻKA POZIOMÓW (element ㉛ Menu 1, SPEC-A §9.2/§11.2) ──────────────
  // Trzy stopnie, dokładnie te, o które upomniał się właściciel 05.09:
  //   „Rejestr KPI (tabela zestawień) › <zestawienie> › <ten wskaźnik>".
  // Stopień środkowy pochodzi z adresu (`?zbior=`), a gdy go nie ma — z
  // REALNEJ przynależności wskaźnika (`listKpiScorecardsForKpi`, już pobrane
  // na tę stronę). Gdy wskaźnik nie należy do żadnego widocznego zestawienia,
  // środkowym stopniem jest zestawienie systemowe „Bez zestawienia" — nigdy
  // pusty stopień ani zmyślona nazwa.
  const fallbackCardSet =
    !fromCardSetId && Array.isArray(scorecards) && scorecards.length > 0 ? scorecards[0] : null;
  const crumbCardSetId = fromCardSetId ?? fallbackCardSet?.scorecardId ?? null;
  const crumbCardSetName = isUnassignedCardSetId(crumbCardSetId)
    ? t('Bez zestawienia', 'Not in any card set')
    : (pathCardSetName ?? fallbackCardSet?.name ?? null);

  const breadcrumbItems: { label: string; onClick?: () => void }[] = [
    { label: t('Rejestr KPI', 'KPI registry'), onClick: () => navigate(withOwnerSampleData(ROUTES.RESULTS_KPI.ROOT)) },
  ];
  if (crumbCardSetId) {
    breadcrumbItems.push({
      label: crumbCardSetName ?? t('Zestawienie', 'Card set'),
      onClick: () => navigate(withOwnerSampleData(kpiReportPath(crumbCardSetId))),
    });
  }
  breadcrumbItems.push({ label: kpiTitle });

  /** Kropka statusu pigułki Menu 3 — mapa z cyklu życia miernika. */
  const statusPigulki =
    kpi.status === 'archived'
      ? 'ARCHIVED'
      : kpi.status === 'active'
        ? 'TRACKING'
        : kpi.status === 'suspended'
          ? 'BLOCKED'
          : 'DRAFT';

  return (
    <KartaWynikowChrome
      domena="kpi"
      kartaId={kpi.kpiId}
      kartaNazwa={kpiTitle}
      kartaOdznaka="KPI"
      kartaStatus={statusPigulki}
      onPokazListe={() => navigate(withOwnerSampleData(ROUTES.RESULTS_KPI.ROOT))}
      testId="results-vnext-kpi-tool-chrome"
    >
    <div className="flex h-full min-h-0 flex-col" data-testid="results-vnext-kpi-tool-page">
      <ArtifactBreadcrumb items={breadcrumbItems} />
      <PasekZapisuAI stan={zapisAI.stan} isPolish={isPolish} onZamknij={zapisAI.wyczysc} />
      <div className="min-h-0 flex-1">
      <NModeShell
        header={header}
        sections={sections}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        presentationMode="n"
        onPresentationModeChange={() => {}}
        showModeSwitcher={false}
        readMode={readMode}
        /* DEC-407 zasada 2 — Menu 4 (nagłówek) i Menu 5 jako JEDEN przyklejony
           stos; przewija się tylko treść sekcji. */
        stickyStosMenu45
        renderActionBar={() => (
          <NModeMenu2
            isPolish={isPolish}
            sectionsMenu={<SectionsManagerMenu layout={ukladSekcji} isPolish={isPolish} />}
            readMode={readMode}
            /* Zasada 2b: bez prawa edycji przełącznik NIE renderuje się
               (`NModeMenu2` pokazuje go tylko, gdy dostanie `onReadModeChange`). */
            onReadModeChange={mozeEdytowac ? setReadMode : undefined}
            aiButton={
              <PracujZAI
                isPolish={isPolish}
                onAnalizuj={kpiCardAnalysis.run}
                analizaWToku={kpiCardAnalysis.loading}
                analizaOtwarta={kpiCardAnalysis.open}
                aktywnaSekcja={activeSection}
                kontekstArtefaktu={{
                  title: kpiTitle,
                  status: kpi.status,
                  type: 'metric',
                }}
                moznaEdytowac={mozeEdytowac && !readMode}
                powodTylkoOdczyt={
                  kpi.status === 'archived'
                    ? isPolish
                      ? 'miernik zarchiwizowany'
                      : 'metric is archived'
                    : !wersjaDefinicji || wersjaDefinicji.approvalStatus !== 'draft'
                      ? isPolish
                        ? 'wersja definicji nie jest szkicem (serwer: NOT_A_DRAFT)'
                        : 'the definition version is not a draft (server: NOT_A_DRAFT)'
                      : isPolish
                        ? 'karta otwarta w trybie Podgląd'
                        : 'card opened in Preview mode'
                }
                /* Sekcje bez pól tekstowych (Pomiary, Odchylenia, Historia…)
                   dostają pozycję WYSZARZONĄ, zamiast obiecywać uzupełnienie,
                   którego nie ma gdzie zapisać. */
                uzupelnijSekcje={
                  SEKCJE_Z_POLAMI_TEKSTOWYMI.has(activeSection) ? zrodloSekcji : undefined
                }
                uzupelnijDokument={zrodloDokumentu}
              />
            }
          />
        )}
        rightPanel={<ArtifactRightPanel sections={rightPanelSections} ariaLabel={t('Panel KPI', 'KPI panel')} />}
      />
      </div>
      <NCardAIAnalysisPanel
        open={kpiCardAnalysis.open}
        onClose={kpiCardAnalysis.close}
        loading={kpiCardAnalysis.loading}
        result={kpiCardAnalysis.result}
        errorCode={kpiCardAnalysis.errorCode}
        serverErrorCode={kpiCardAnalysis.serverErrorCode}
        onRerun={kpiCardAnalysis.rerun}
        onApplyChange={kpiCardAnalysis.applyChange}
        writableFieldIds={kpiWritableFieldIds}
        readMode={readMode}
        isPolish={isPolish}
      />
      <KpiReviewedAttributionDialog
        open={!!attributionTarget}
        isPolish={isPolish}
        onClose={() => (attributionBusy ? undefined : setAttributionTarget(null))}
        onSubmit={submitReviewedAttribution}
        busy={attributionBusy}
        errorMessage={attributionError}
      />
    </div>
    </KartaWynikowChrome>
  );
};

export default KpiToolPage;

/**
 * ResultsRoiHub — RN-G2 P2/G2-create, the real "/results/roi" screen: ROI
 * Case registry list + preview (RN_G2_UI_SCOPE.md §G #11), quick-create
 * (§G #12, master plan §9 Etap 3 "quick create zapisujący prawdziwy Draft")
 * and 7 lifecycle transitions (§G #16 subset), built on the P0 shared shell
 * (`ResultsVNextRegistryShell`). PLUS (added RN-G2 §G #12-14 model-setup
 * package, RE-ROUTED by RN-G5 2026-08-12): the row-menu "Open full tool"
 * action `navigate()`s to `ROUTES.RESULTS_ROI.CASE`
 * (`/results/roi/cases/:roiCaseId`, `RoiCaseToolPage.tsx`) — the FOUR-PHASE
 * `RoiCaseFullTool` (Build Case → Decision → Realize Value → Learn), not a
 * local-state swap anymore. See `RoiCaseToolPage.tsx`'s header for why: D03
 * closed the "klasa S vs L" question a real route would have silently
 * pre-decided, and a route is required for the deep-link/reload/cold-open
 * contract (`RN_G2_UI_SCOPE.md` §H). Deliberately NOT the rest of the
 * 15-sub-resource ROI Case tool beyond the four phases
 * (scenarios/forecast/actuals/variances/PIR/finance links are INSIDE those
 * phases already, per `RoiCaseFullTool.tsx`'s own phase breakdown).
 *
 * RETURN-CONTEXT PRESERVATION (RN-G5): navigating to the full tool and back
 * unmounts/remounts this component (different `<Route>`s) — plain
 * `useState` for `tab`/`chip`/the two selected-row ids would reset to
 * defaults on return, silently discarding whatever filter/selection the
 * user had. Restored from/persisted to `sessionStorage` under
 * `results-vnext.roi-registry.ui-state` — ONE key for the whole SURFACE
 * (tab-switch/reload/back-nav all share it), never a per-record key (D09's
 * warning applies to this too, not just `StandardTable`'s own
 * `persistKey`). `sessionStorage`, not `localStorage`: this is transient
 * "where was I" navigation context, not a durable preference — a closed tab
 * should not resurrect a stale selection days later.
 *
 * Two Menu 2 tabs, both real backend data, no fabricated rows:
 *  - "All cases"           → `GET /cases` (§C `roi.routes.ts`), the actual
 *                             registry. NPV/IRR are NOT columns here — the
 *                             list endpoint does not return them (only
 *                             `rvn_roi_cases` fields, see `roiRepository.ts`
 *                             `listRoiCases` — bare `SELECT rc.*`), and
 *                             fetching them per-row would mean an N+1 calc-
 *                             run request per visible row. They ARE shown in
 *                             the PREVIEW, lazily fetched for the one
 *                             selected case only. The Menu 2 `primaryCta`
 *                             ("New ROI case") opens `RoiCaseCreateModal` —
 *                             only on THIS tab, quick-create has no meaning
 *                             on the org rollup tab below.
 *  - "Benefits realization" → `GET /org/benefits-realization` (§C
 *                             `roiPerspectives.routes.ts`), a manager-chain-
 *                             scoped rollup that DOES carry two honest-
 *                             missing numeric amounts + a derived percentage
 *                             per row already — the cheap, real source of a
 *                             table-level HonestValueCell showcase.
 *
 * A Menu 2 status dropdown on "All cases" (`roiStatusFilterControl`, DEC-422
 * 06.09) buckets the real 13-state machine into 4 groups + "all"
 * (`ROI_STATUS_BUCKET` in `roiRegistryMappers.ts`) — counts always shown in
 * the option label, including 0, computed from the currently loaded page.
 * Was 5 Menu 3 chips until DEC-422's odbiór flagged that as a kanon
 * violation (Menu 3 ≤3 chips or none) — moved to Menu 2, Menu 3 now empty
 * on this tab.
 *
 * Quick create's `initiativeId` picker uses `InitiativeApi.getInitiatives()`
 * (`src/services/api/initiatives.api.ts`) — the SAME real, already-used
 * endpoint `InitiativeObservabilityTable.tsx` calls for its own initiative
 * picker (`GET /initiatives`, org-scoped server-side via auth) — not a new
 * endpoint, not a mock list.
 */
import { Plus } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import type { StandardCounterChip, TableRow } from '@/components/standard';
import { SelectField } from '@/components/ui/primitives';
import { useOrganizationMemberNames } from '@/hooks/useOrganizationMemberNames';
import { ROUTES } from '@/routes/routeConfig';
import { InitiativeApi } from '@/services/api/initiatives.api';
import { tokenService } from '@/services/tokenService';

import {
  getResultsDomainPath,
  getResultsDomainTabs,
  isResultsDomain,
} from '../resultsDomainNavigation';
import { ResultsVNextRegistryShell } from '../ResultsVNextRegistryShell';
import { shouldUseResultsVNextOwnerSampleData } from '../resultsVNextOwnerSampleData';
import { toUserFacingErrorMessage } from '../shared/errorMessage';
import {
  approveRoiCase,
  cancelRoiCase,
  closeRoiCase,
  createRoiCase,
  getLatestRoiCalculationRun,
  getRoiVisibilityPolicyStatus,
  listOrgRoiBenefitsRealization,
  listRoiCases,
  markRoiCasePostInvestmentReviewDueCase,
  markRoiCaseReadyForReview,
  newRoiIdempotencyKey,
  publishRoiVisibilityPolicy,
  rejectRoiCase,
  reopenRoiCaseForRevision,
  requestChangesOnRoiCase,
  RoiApiError,
  type RoiCalculationRunSummary,
  type RoiCaseListItem,
  type RoiOrgBenefitsRealizationRow,
  type RoiTransitionResult,
  type RoiVisibilityPolicyStatus,
  startModelingRoiCase,
  startPirRoiCase,
  startRoiCaseBenefitsRealizationCase,
  startRoiCaseTrackingCase,
  submitRoiCaseForApprovalCase,
} from './roiApi';
import {
  type RoiCaseCreateFormValues,
  type RoiCaseCreateInitiativeOption,
  RoiCaseCreateModal,
} from './RoiCaseCreateModal';
import {
  ROI_STATUS_BUCKET,
  ROI_STATUS_BUCKET_LABEL,
  type RoiStatusBucket,
  type RoiTransitionId,
} from './roiRegistryMappers';
import {
  buildRoiBenefitsRealizationColumns,
  buildRoiBenefitsRealizationPreview,
  buildRoiCaseColumns,
  buildRoiCasePreview,
  buildRoiCaseRowMenu,
  type RoiBenefitsRealizationRowVm,
} from './roiRegistryPresenters';
import { RoiTransitionDialog } from './RoiTransitionDialog';
// ROI (P7K C) — poziom 1 wg SSOT §4: tabela ANALIZ ze wskaźnikami i
// rekomendacją. `GET /registry` liczy CAPEX / roczną korzyść / ROI / Payback
// jednym zapytaniem z agregatami po stronie Postgresa, więc powód, dla którego
// te kolumny dotąd nie istniały („N+1 wywołanie kalkulacji per wiersz", patrz
// nagłówek tego pliku), przestał obowiązywać. `listRoiCases` zostaje obok —
// niesie status cyklu życia, `rowVersion` i wszystko, czego potrzebują chipy,
// kebab i siedem przejść; nowy odczyt jest DODANY, nie podmieniony.
import { listRoiRegistry, type RoiRegistryRow } from './card/roiCardApi';
import {
  buildRoiRegistryColumns,
  buildRoiRegistryPreview,
} from './card/roiCardRegistryPresenters';

type RoiTab = 'all' | 'benefits';
const ROI_CASES_FETCH_LIMIT = 200;

/** Same JWT-decode pattern already used by `DeckCommentsPanel.tsx`/
 * `DocumentCommentsPanel.tsx` (`resolveCurrentUserIdFromToken`) — there is
 * no generally-available "list org members" endpoint a normal member can
 * call (`/users` is ADMIN/OWNER/SUPERADMIN-only, `users.routes.ts` L134),
 * so quick-create's `ownerUserId` defaults to (and is not editable beyond)
 * the current user, resolved the same real way every other "who am I"
 * read in this codebase already does. */
function resolveCurrentUserIdFromToken(): string | null {
  try {
    const token = tokenService.getToken();
    if (!token) return null;
    return tokenService.decodeToken(token)?.id ?? null;
  } catch {
    return null;
  }
}

/** Routes a transition id to its `roiApi.ts` call with the right body shape
 * — the one place that knows all 7 endpoints' distinct field names
 * (`rejectionReason`/`changeRequestNotes`/plain `reason`). Mandatory-reason
 * transitions are asserted non-null defensively (should be unreachable:
 * `RoiTransitionDialog` already blocks submit when its field is required
 * and empty) rather than silently sent as `''`. */
async function runRoiTransition(
  id: RoiTransitionId,
  caseId: string,
  expectedVersion: number,
  reason: string | null,
  idempotencyKey: string
): Promise<RoiTransitionResult> {
  switch (id) {
    case 'start_modeling':
      return startModelingRoiCase(caseId, { expectedVersion, reason, idempotencyKey });
    case 'ready_for_review':
      return markRoiCaseReadyForReview(caseId, { expectedVersion, reason, idempotencyKey });
    case 'submit_for_approval':
      return submitRoiCaseForApprovalCase(caseId, { expectedVersion, reason, idempotencyKey });
    case 'start_tracking':
      return startRoiCaseTrackingCase(caseId, { expectedVersion, reason, idempotencyKey });
    case 'start_benefits_realization':
      return startRoiCaseBenefitsRealizationCase(caseId, {
        expectedVersion,
        reason,
        idempotencyKey,
      });
    case 'mark_pir_due':
      return markRoiCasePostInvestmentReviewDueCase(caseId, {
        expectedVersion,
        reason,
        idempotencyKey,
      });
    case 'approve':
      return approveRoiCase(caseId, { expectedVersion, reason, idempotencyKey });
    case 'reject':
      if (!reason) throw new Error('rejectionReason is required');
      return rejectRoiCase(caseId, { expectedVersion, rejectionReason: reason, idempotencyKey });
    case 'request_changes':
      if (!reason) throw new Error('changeRequestNotes is required');
      return requestChangesOnRoiCase(caseId, {
        expectedVersion,
        changeRequestNotes: reason,
        idempotencyKey,
      });
    case 'reopen_for_revision':
      if (!reason) throw new Error('reason is required');
      return reopenRoiCaseForRevision(caseId, { expectedVersion, reason, idempotencyKey });
    case 'cancel':
      if (!reason) throw new Error('reason is required');
      return cancelRoiCase(caseId, { expectedVersion, reason, idempotencyKey });
    case 'start_pir':
      return startPirRoiCase(caseId, { expectedVersion, reason, idempotencyKey });
    case 'close':
      return closeRoiCase(caseId, { expectedVersion, reason, idempotencyKey });
    default: {
      const exhaustive: never = id;
      throw new Error(`Unknown ROI transition id: ${exhaustive}`);
    }
  }
}

function withId<T extends { caseId: string }>(row: T): T & { id: string } {
  return { ...row, id: row.caseId };
}

// RN-G5 (2026-08-12) — see file header "RETURN-CONTEXT PRESERVATION". ONE
// sessionStorage key for the whole surface, never per-record.
const UI_STATE_KEY = 'results-vnext.roi-registry.ui-state';

interface RoiHubUiState {
  tab?: RoiTab;
  chip?: 'all' | RoiStatusBucket;
  selectedCaseId?: string | null;
  selectedBenefitsCaseId?: string | null;
}

function readRoiHubUiState(): RoiHubUiState {
  try {
    const raw = window.sessionStorage.getItem(UI_STATE_KEY);
    return raw ? (JSON.parse(raw) as RoiHubUiState) : {};
  } catch {
    return {};
  }
}

function writeRoiHubUiState(state: RoiHubUiState): void {
  try {
    window.sessionStorage.setItem(UI_STATE_KEY, JSON.stringify(state));
  } catch {
    // no-op — sessionStorage unavailable (private mode) is not fatal, it
    // only means the next mount starts from defaults instead of restoring.
  }
}

export const ResultsRoiHub: React.FC = () => {
  const { i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const navigate = useNavigate();

  // 2026-08-26 night-fixes-a P0 (NIGHT_SWEEP_A_REPORT_20260826.md #6): the
  // Owner column/preview used to show the raw ownerUserId id — same
  // id->name resolver convention as Results Attention
  // (attentionPresenters.tsx) and useMentionAutocomplete: real org member
  // list, honest fallback to the id when unresolved.
  // 2026-09-05 (runda 3 odbioru): patrz `useOrganizationMemberNames` —
  // lokalna kopia czytała pola, których API nie zwraca (snake_case),
  // przez co kolumna Właściciel pokazywała surowy identyfikator.
  const resolveMemberName = useOrganizationMemberNames();

  const restoredUiState = useMemo(() => readRoiHubUiState(), []);
  const [tab] = useState<RoiTab>(restoredUiState.tab ?? 'all');
  const [chip, setChip] = useState<'all' | RoiStatusBucket>(restoredUiState.chip ?? 'all');

  // "All cases" tab state
  const [cases, setCases] = useState<RoiCaseListItem[] | null>(null);
  const [casesError, setCasesError] = useState<string | null>(null);
  const [casesLoading, setCasesLoading] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(
    restoredUiState.selectedCaseId ?? null
  );
  const [calculationRun, setCalculationRun] = useState<RoiCalculationRunSummary | null | undefined>(
    undefined
  );

  // --- Polityka widoczności ROI (blokada odbioru 05.09) --------------------
  //
  // Domena ROI jest fail-closed: bez opublikowanej polityki `ROI_GOVERNED`
  // `GET /cases` zwraca PUSTĄ listę (nigdy 403 — celowo, żeby nie wyciekać
  // istnienia zasobów), a `POST /cases` odmawia z
  // `ROI_CASE_CREATION_NOT_AUTHORIZED`. Bez tego odczytu ekran pokazywał
  // właścicielowi „Brak spraw ROI" i przycisk, który zawsze kończył się
  // błędem — czyli kłamał o przyczynie. Teraz stan jest czytany wprost i
  // ekran mówi, czego brakuje i kto może to włączyć.
  const [policyStatus, setPolicyStatus] = useState<RoiVisibilityPolicyStatus | null>(null);
  const [policyBusy, setPolicyBusy] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);

  const loadPolicyStatus = useCallback(() => {
    getRoiVisibilityPolicyStatus()
      .then((status) => setPolicyStatus(status))
      // Odczyt stanu polityki jest DODATKIEM do rejestru, nie warunkiem jego
      // działania — gdy sam ten odczyt padnie, tabela ma nadal pokazać to, co
      // zwrócił `GET /cases`, a nie zamienić się w ekran błędu.
      .catch(() => setPolicyStatus(null));
  }, []);

  const handlePublishPolicy = useCallback(() => {
    setPolicyBusy(true);
    setPolicyError(null);
    publishRoiVisibilityPolicy(newRoiIdempotencyKey())
      .then(() => {
        loadPolicyStatus();
        loadCases();
      })
      .catch((err) => setPolicyError(toUserFacingErrorMessage(err, isPolish)))
      .finally(() => setPolicyBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadPolicyStatus]);

  // "Benefits realization" tab state
  const [benefitsRows, setBenefitsRows] = useState<RoiOrgBenefitsRealizationRow[] | null>(null);
  const [benefitsError, setBenefitsError] = useState<string | null>(null);
  const [benefitsLoading, setBenefitsLoading] = useState(false);
  const [selectedBenefitsCaseId, setSelectedBenefitsCaseId] = useState<string | null>(
    restoredUiState.selectedBenefitsCaseId ?? null
  );

  // RN-G5 — persist tab/chip/selection so navigating to the full tool
  // (`ROUTES.RESULTS_ROI.CASE`) and back restores the list context instead
  // of resetting to defaults on remount.
  useEffect(() => {
    writeRoiHubUiState({ tab, chip, selectedCaseId, selectedBenefitsCaseId });
  }, [tab, chip, selectedCaseId, selectedBenefitsCaseId]);

  // ROI (P7K C) — wiersze rejestru ze wskaźnikami, indeksowane po `caseId`.
  // Osobny stan, a nie zastąpienie `cases`: brak/awaria tego odczytu ma
  // degradować kolumny wskaźników do „—", a NIE wywracać całej listy.
  const [registryRows, setRegistryRows] = useState<Map<string, RoiRegistryRow>>(new Map());

  const loadCases = useCallback(() => {
    setCasesLoading(true);
    setCasesError(null);
    Promise.all([
      listRoiCases({ limit: ROI_CASES_FETCH_LIMIT }),
      listRoiRegistry().catch(() => [] as RoiRegistryRow[]),
    ])
      .then(([rows, registry]) => {
        setCases(rows);
        setRegistryRows(new Map(registry.map((r) => [r.caseId, r])));
      })
      .catch((err) => setCasesError(toUserFacingErrorMessage(err, isPolish)))
      .finally(() => setCasesLoading(false));
  }, []);

  const loadBenefits = useCallback(() => {
    setBenefitsLoading(true);
    setBenefitsError(null);
    listOrgRoiBenefitsRealization()
      .then((res) => setBenefitsRows(res.cases))
      .catch((err) => setBenefitsError(toUserFacingErrorMessage(err, isPolish)))
      .finally(() => setBenefitsLoading(false));
  }, []);

  // Quick-create ("New ROI case") state — resolved once, real endpoints only.
  const currentUserId = useMemo(() => resolveCurrentUserIdFromToken(), []);
  const [initiatives, setInitiatives] = useState<RoiCaseCreateInitiativeOption[] | null>(null);
  const [initiativesLoading, setInitiativesLoading] = useState(false);
  const [initiativesError, setInitiativesError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createIsConflict, setCreateIsConflict] = useState(false);
  const [createIdempotencyKey, setCreateIdempotencyKey] = useState<string>('');

  // Lifecycle-transition dialog state — one shared dialog for all 7 wired
  // transitions (§G #16 subset), keyed by {row, transitionId}.
  const [transition, setTransition] = useState<{
    row: RoiCaseListItem;
    id: RoiTransitionId;
  } | null>(null);
  const [transitionBusy, setTransitionBusy] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [transitionIsConflict, setTransitionIsConflict] = useState(false);
  const [transitionIdempotencyKey, setTransitionIdempotencyKey] = useState<string>('');

  const loadInitiatives = useCallback(() => {
    setInitiativesLoading(true);
    setInitiativesError(null);
    InitiativeApi.getInitiatives()
      .then((list) =>
        setInitiatives(
          [...list]
            // RN-G6-C2: the live `getInitiatives()` response carries `name`,
            // NOT the stale `Initiative.title` the TS client declares — the
            // exact gotcha already documented and defensively handled in
            // `InitiativeObservabilityTable.tsx` ("row.title || row.name ||
            // row.id"), missed here. Without this fallback every quick-create
            // initiative picker load throws `Cannot read properties of
            // undefined (reading 'localeCompare')` on the very first sort —
            // reproduced live while running the ROI gold flow end-to-end.
            .map((i) => ({
              id: i.id,
              title: i.title || (i as unknown as { name?: string }).name || i.id,
            }))
            .sort((a, b) => a.title.localeCompare(b.title))
        )
      )
      .catch((err) => setInitiativesError(toUserFacingErrorMessage(err, isPolish)))
      .finally(() => setInitiativesLoading(false));
  }, []);

  const openCreateModal = useCallback(() => {
    setCreateError(null);
    setCreateIsConflict(false);
    // Fresh idempotency key per form OPEN, not per submit — a retry within
    // the same open (e.g. after a transient network error) reuses it so a
    // double-send can never create two cases (RN_G2_UI_SCOPE.md §A).
    setCreateIdempotencyKey(newRoiIdempotencyKey());
    setCreateOpen(true);
    if (initiatives === null && !initiativesLoading) loadInitiatives();
  }, [initiatives, initiativesLoading, loadInitiatives]);

  const handleCreateSubmit = useCallback(
    (values: RoiCaseCreateFormValues) => {
      setCreateBusy(true);
      setCreateError(null);
      setCreateIsConflict(false);
      createRoiCase({ ...values, idempotencyKey: createIdempotencyKey })
        .then((res) => {
          const newCase = res.case;
          // Merge the server-returned case immediately (honest, real data —
          // not a fabricated optimistic row) so selection/preview work
          // without waiting on the refetch below, then refresh from the
          // server for full list consistency (chip counts, ordering).
          setCases((prev) => {
            const withoutDup = (prev ?? []).filter((c) => c.caseId !== newCase.caseId);
            return [newCase, ...withoutDup];
          });
          setSelectedCaseId(newCase.caseId);
          setChip('all'); // ensure the new row is visible regardless of prior filter
          setCreateOpen(false);
          loadCases();
        })
        .catch((err) => {
          const isConflict = err instanceof RoiApiError && err.status === 409;
          setCreateIsConflict(isConflict);
          setCreateError(toUserFacingErrorMessage(err, isPolish));
        })
        .finally(() => setCreateBusy(false));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [createIdempotencyKey, loadCases]
  );

  const openTransition = useCallback((row: RoiCaseListItem, id: RoiTransitionId) => {
    setTransitionError(null);
    setTransitionIsConflict(false);
    setTransitionIdempotencyKey(newRoiIdempotencyKey());
    setTransition({ row, id });
  }, []);

  const handleTransitionSubmit = useCallback(
    (reason: string | null) => {
      if (!transition) return;
      const { row, id } = transition;
      setTransitionBusy(true);
      setTransitionError(null);
      setTransitionIsConflict(false);
      runRoiTransition(id, row.caseId, row.rowVersion, reason, transitionIdempotencyKey)
        .then((res) => {
          const updated = res.case;
          setCases((prev) => (prev ?? []).map((c) => (c.caseId === updated.caseId ? updated : c)));
          setTransition(null);
          loadCases();
        })
        .catch((err) => {
          const isConflict = err instanceof RoiApiError && err.status === 409;
          setTransitionIsConflict(isConflict);
          setTransitionError(toUserFacingErrorMessage(err, isPolish));
        })
        .finally(() => setTransitionBusy(false));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transition, transitionIdempotencyKey, loadCases]
  );

  useEffect(() => {
    if (tab === 'all' && cases === null && !casesLoading) loadCases();
    if (tab === 'all' && policyStatus === null) loadPolicyStatus();
    if (tab === 'benefits' && benefitsRows === null && !benefitsLoading) loadBenefits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Lazy per-case calculation-run fetch for the "All cases" preview — only
  // ever ONE in-flight request (the selected row), never N per visible row.
  useEffect(() => {
    if (!selectedCaseId) {
      setCalculationRun(undefined);
      return;
    }
    let cancelled = false;
    setCalculationRun(undefined);
    getLatestRoiCalculationRun(selectedCaseId)
      .then((run) => {
        if (!cancelled) setCalculationRun(run);
      })
      .catch(() => {
        if (!cancelled) setCalculationRun(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCaseId]);

  const bucketCounts = useMemo(() => {
    const counts: Record<RoiStatusBucket, number> = {
      in_progress: 0,
      in_review: 0,
      active: 0,
      closed_out: 0,
    };
    for (const c of cases ?? []) counts[ROI_STATUS_BUCKET[c.status]] += 1;
    return counts;
  }, [cases]);

  const filteredCases = useMemo(() => {
    if (!cases) return [];
    if (chip === 'all') return cases;
    return cases.filter((c) => ROI_STATUS_BUCKET[c.status] === chip);
  }, [cases, chip]);

  const selectedCase = useMemo(
    () => (cases ?? []).find((c) => c.caseId === selectedCaseId) ?? null,
    [cases, selectedCaseId]
  );
  const selectedBenefitsRow = useMemo(
    () => (benefitsRows ?? []).find((r) => r.caseId === selectedBenefitsCaseId) ?? null,
    [benefitsRows, selectedBenefitsCaseId]
  );

  /**
   * DEC-422 (06.09, odbiór Piotra) — 5 chipów w Menu 3 ("Wszystkie · W toku ·
   * Do akceptacji · Aktywne · Zamknięte/odrzucone") naruszały kanon TRIADA §B
   * (Menu 3 = ≤3 chipy albo nic). Zamiast wybierać, które 3 z 5 nazwanych
   * przez właściciela stanów są "ważniejsze" (arbitralne, nie zmierzone),
   * CAŁY filtr statusu schodzi do dropdownu w Menu 2 (`filterControls`,
   * ten sam wzorzec co `AssessmentHub.tsx`'s `statusDropdownControl` i
   * `DiscoveryToolsHub.tsx`'s `StatusFilterDropdown`) — Menu 3 nie ma teraz
   * żadnych chipów na tym ekranie. Liczby (`count`) zostają w etykiecie
   * opcji, jak dotąd w chipach.
   */
  const roiStatusOptions: StandardCounterChip[] = [
    { id: 'all', label: isPolish ? 'Wszystkie' : 'All', count: cases?.length ?? 0 },
    {
      id: 'in_progress',
      label: isPolish
        ? ROI_STATUS_BUCKET_LABEL.in_progress.pl
        : ROI_STATUS_BUCKET_LABEL.in_progress.en,
      count: bucketCounts.in_progress,
    },
    {
      id: 'in_review',
      label: isPolish ? ROI_STATUS_BUCKET_LABEL.in_review.pl : ROI_STATUS_BUCKET_LABEL.in_review.en,
      count: bucketCounts.in_review,
    },
    {
      id: 'active',
      label: isPolish ? ROI_STATUS_BUCKET_LABEL.active.pl : ROI_STATUS_BUCKET_LABEL.active.en,
      count: bucketCounts.active,
    },
    {
      id: 'closed_out',
      label: isPolish
        ? ROI_STATUS_BUCKET_LABEL.closed_out.pl
        : ROI_STATUS_BUCKET_LABEL.closed_out.en,
      count: bucketCounts.closed_out,
    },
  ];
  const roiStatusFilterControl = (
    <div data-testid="roi-registry-status-filter">
      <SelectField
        value={chip}
        onChange={(id) => setChip(id as 'all' | RoiStatusBucket)}
        options={roiStatusOptions.map((opt) => ({
          value: opt.id,
          label: `${opt.label} (${opt.count ?? 0})`,
        }))}
        fullWidth={false}
        wrapperClassName="w-auto"
        className="min-w-[13rem]"
        aria-label={isPolish ? 'Filtruj wg statusu' : 'Filter by status'}
      />
    </div>
  );

  // Shared across both tabs: the transition dialog can be triggered from the
  // "All cases" kebab only, but is rendered once here regardless of `tab` so
  // it survives (and is memory-cheap to always mount).
  const transitionDialog = (
    <RoiTransitionDialog
      open={!!transition}
      transitionId={transition?.id ?? null}
      caseTitle={transition?.row.title ?? ''}
      isPolish={isPolish}
      onClose={() => (transitionBusy ? undefined : setTransition(null))}
      onSubmit={handleTransitionSubmit}
      busy={transitionBusy}
      errorMessage={transitionError}
      isConflict={transitionIsConflict}
    />
  );

  if (tab === 'benefits') {
    const rows: TableRow[] = (benefitsRows ?? []).map(withId);
    return (
      <>
        <ResultsVNextRegistryShell
          domain="roi"
          sampleData={shouldUseResultsVNextOwnerSampleData()}
          moduleBar={{
            tabs: getResultsDomainTabs(),
            activeTab: 'roi',
            onTabChange: (id) => {
              if (id === 'search' || id === 'legacy' || isResultsDomain(id)) navigate(getResultsDomainPath(id));
            },
            showTabCounts: false,
            viewModes: ['table'],
            viewMode: 'table',
          }}
          table={{
            columns: buildRoiBenefitsRealizationColumns(isPolish),
            data: rows,
            persistKey: 'results-vnext.roi-registry.benefits',
            loading: benefitsLoading,
            error: benefitsError,
            onRetry: loadBenefits,
            empty:
              !benefitsLoading && !benefitsError && rows.length === 0
                ? {
                    title: isPolish ? 'Brak spraw w realizacji' : 'No cases in realization',
                    description: isPolish
                      ? 'Żadna sprawa w Twoim łańcuchu zarządzania nie jest obecnie w fazie śledzenia/realizacji.'
                      : 'No case in your management chain is currently tracking or realizing benefits.',
                  }
                : undefined,
            selectedRowId: selectedBenefitsCaseId,
            // `row` is `TableRow` (`{id: string; [key: string]: any}`) — `caseId`
            // reads through the index signature, no cast needed/possible (the
            // shapes don't sufficiently overlap for a direct `as`).
            onRowClick: (row) => setSelectedBenefitsCaseId(String(row.caseId)),
            defaultSort: { columnId: 'realizationPct', direction: 'desc' },
          }}
          preview={
            selectedBenefitsRow
              ? buildRoiBenefitsRealizationPreview(
                  selectedBenefitsRow as RoiBenefitsRealizationRowVm,
                  isPolish,
                  () => setSelectedBenefitsCaseId(null)
                )
              : null
          }
        />
        {transitionDialog}
      </>
    );
  }

  // Domena ROI wygaszona dla organizacji — jedna prawda dla pustego stanu i
  // dla przycisku Menu 2, żeby ekran nie proponował akcji, która na pewno
  // skończy się 403.
  const roiDisabledForOrg = policyStatus !== null && !policyStatus.published;
  const roiActivationCta = roiDisabledForOrg && policyStatus.canPublish;
  const activationTitle = isPolish
    ? 'ROI nie jest włączone w tej organizacji'
    : 'ROI is not enabled for this organization';
  const activationDescription = roiActivationCta
    ? isPolish
      ? 'Sprawy ROI wymagają jednorazowego opublikowania polityki widoczności ROI przez właściciela lub administratora organizacji. Po włączeniu rejestr, model i pełne narzędzie ROI działają na realnych danych.'
      : 'ROI cases require a one-time publication of the ROI visibility policy by an organization owner or admin. Once enabled, the registry, the model and the full ROI tool work on real data.'
    : isPolish
      ? 'Politykę widoczności ROI może opublikować wyłącznie właściciel lub administrator tej organizacji. Poproś go o włączenie domeny ROI.'
      : 'Only an owner or admin of this organization can publish the ROI visibility policy. Ask them to enable the ROI domain.';

  /**
   * Wiersz tabeli = sprawa (cykl życia) + jej wiersz rejestru (wskaźniki).
   * Gdy rejestru brak (starszy serwer, odmowa governance, awaria sieci),
   * kolumny wskaźników dostają `null` i rysują „—" — nigdy 0.
   */
  const rows: TableRow[] = filteredCases.map((c) => {
    const registry = registryRows.get(c.caseId);
    return withId({ ...c, ...(registry ?? {}) } as typeof c);
  });

  const selectedRegistryRow = selectedCaseId ? (registryRows.get(selectedCaseId) ?? null) : null;

  return (
    <>
      <ResultsVNextRegistryShell
        domain="roi"
        sampleData={shouldUseResultsVNextOwnerSampleData()}
        moduleBar={{
          tabs: getResultsDomainTabs(),
          activeTab: 'roi',
          onTabChange: (id) => {
            if (id === 'search' || id === 'legacy' || isResultsDomain(id)) navigate(getResultsDomainPath(id));
          },
          showTabCounts: false,
          viewModes: ['table'],
          viewMode: 'table',
          filterControls: roiStatusFilterControl,
          // Quick create (master plan §9 Etap 3) — only meaningful on the
          // real case registry, not the read-only org rollup tab.
          // Gdy domena ROI jest w tej organizacji wygaszona, przycisk Menu 2
          // NIE proponuje tworzenia sprawy (skończyłoby się 403), tylko
          // jednorazową publikację polityki — i tylko dla OWNER/ADMIN, bo
          // tylko oni mają do niej uprawnienie po stronie serwera.
          primaryCta: roiDisabledForOrg
            ? roiActivationCta
              ? {
                  label: policyBusy
                    ? isPolish
                      ? 'Włączam…'
                      : 'Enabling…'
                    : isPolish
                      ? 'Włącz ROI dla organizacji'
                      : 'Enable ROI for this organization',
                  icon: Plus,
                  onClick: policyBusy ? () => undefined : handlePublishPolicy,
                  testId: 'roi-registry-enable-cta',
                }
              : undefined
            : {
                label: isPolish ? 'Nowa analiza' : 'New ROI case',
                icon: Plus,
                onClick: openCreateModal,
                testId: 'roi-registry-create-cta',
              },
        }}
        table={{
          // Kolejność kolumn i to, co siedzi w pstryczku, to werdykt K4
          // (P7K_KROK1_WERDYKT_20260905.md) na zaakceptowanym zrzucie roi-l1.
          columns: buildRoiRegistryColumns(isPolish),
          data: rows,
          persistKey: 'results-vnext.roi-registry',
          loading: casesLoading,
          error: casesError,
          onRetry: loadCases,
          empty:
            !casesLoading && !casesError && rows.length === 0
              ? roiDisabledForOrg
                ? {
                    title: activationTitle,
                    description: policyError
                      ? `${activationDescription} ${policyError}`
                      : activationDescription,
                    ...(roiActivationCta
                      ? {
                          actionLabel: policyBusy
                            ? isPolish
                              ? 'Włączam…'
                              : 'Enabling…'
                            : isPolish
                              ? 'Włącz ROI dla organizacji'
                              : 'Enable ROI for this organization',
                          onAction: policyBusy ? () => undefined : handlePublishPolicy,
                        }
                      : {}),
                  }
                : {
                    title: isPolish ? 'Brak spraw ROI' : 'No ROI cases yet',
                    description:
                      chip === 'all'
                        ? isPolish
                          ? 'W tej organizacji nie utworzono jeszcze żadnej sprawy ROI.'
                          : 'No ROI case has been created in this organization yet.'
                        : isPolish
                          ? 'Żadna sprawa nie pasuje do tego filtra.'
                          : 'No case matches this filter.',
                    actionLabel: isPolish ? 'Nowa analiza' : 'New ROI case',
                    onAction: openCreateModal,
                  }
              : undefined,
          selectedRowId: selectedCaseId,
          onRowClick: (row) => setSelectedCaseId(String(row.caseId)),
          // Poziom 1 → poziom 2: dwuklik otwiera KARTĘ analizy w trzech
          // częściach (SSOT §4), nie pełne narzędzie edycyjne. Query string
          // przenosimy razem z trasą — bez niego sesja, która weszła tu
          // wyłącznie flagą w adresie, trafiłaby na „funkcja wyłączona".
          onRowDoubleClick: (row) =>
            navigate({
              pathname: ROUTES.RESULTS_ROI.CARD.replace(':roiCaseId', String(row.caseId)),
              search: window.location.search,
            }),
          rowMenu: (row) =>
            buildRoiCaseRowMenu(row as unknown as RoiCaseListItem, isPolish, {
              onPreview: (r) => setSelectedCaseId(r.caseId),
              onTransition: (r, id) => openTransition(r, id),
              // RN-G6-C2: `navigate(path)` alone drops the current query
              // string — since the ROI domain flag
              // (`?ff_resultsVNextRoi=1`) resolves query → localStorage →
              // env → default-OFF (`resultsVNextFeatureFlags.ts`), a user
              // who reached this registry ONLY via the URL flag (not
              // localStorage/env) lost it on this exact navigation and
              // landed on the full tool's "ROI tool — not yet enabled"
              // fallback — a dead end reproduced live while running the
              // ROI gold flow end-to-end (same class of gap the KPI
              // runbook's testdrive card already calls out as a known,
              // unfixed issue for that domain's equivalent navigation).
              // Preserving `location.search` on this one call is a local,
              // minimal fix — it does not touch the shared flag file or any
              // other domain's navigation.
              onModel: (r) =>
                navigate({
                  pathname: ROUTES.RESULTS_ROI.CASE.replace(':roiCaseId', r.caseId),
                  search: window.location.search,
                }),
            }),
          defaultSort: { columnId: 'updatedAt', direction: 'desc' },
        }}
        preview={
          // Podgląd z Executive Summary (11 wskaźników) rysujemy, gdy mamy
          // wiersz rejestru; bez niego zostaje dotychczasowy podgląd sprawy,
          // żeby awaria jednego odczytu nie zabierała podglądu w ogóle.
          selectedRegistryRow
            ? buildRoiRegistryPreview(
                selectedRegistryRow,
                isPolish,
                resolveMemberName,
                () =>
                  navigate({
                    pathname: ROUTES.RESULTS_ROI.CARD.replace(':roiCaseId', selectedRegistryRow.caseId),
                    search: window.location.search,
                  }),
                () => setSelectedCaseId(null)
              )
            : selectedCase
            ? buildRoiCasePreview(selectedCase, {
                isPolish,
                onClose: () => setSelectedCaseId(null),
                calculationRun,
                resolveMemberName,
                onOpenWorkspace: (row) =>
                  navigate({
                    pathname: ROUTES.RESULTS_ROI.CASE.replace(':roiCaseId', row.caseId),
                    search: window.location.search,
                  }),
              })
            : null
        }
      />
      <RoiCaseCreateModal
        open={createOpen}
        onClose={() => (createBusy ? undefined : setCreateOpen(false))}
        onSubmit={handleCreateSubmit}
        isPolish={isPolish}
        initiatives={initiatives ?? []}
        initiativesLoading={initiativesLoading}
        initiativesError={initiativesError}
        currentUserId={currentUserId}
        busy={createBusy}
        errorMessage={createError}
        isConflict={createIsConflict}
      />
      {transitionDialog}
    </>
  );
};

export default ResultsRoiHub;

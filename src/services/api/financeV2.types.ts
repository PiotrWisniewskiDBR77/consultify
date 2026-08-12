/**
 * Finance v3 — kanoniczny klient API `/api/v8/finance-v2/*` (Pakiet C, PKG_C_UI_PLATFORM).
 *
 * Typy w tym pliku są PORTEM (nie importem — `server/**` jest poza allowlistą
 * tego pakietu i frontend nigdy nie przekracza granicy src/↔server/src/ w tym
 * repo, grep potwierdzony przy starcie pracy) kształtów zwracanych realnie
 * przez routery pakietu B:
 *   - `server/src/types/finance/financeValueSemantics.ts` — status/semantyka wartości
 *   - `server/src/types/finance/ArtifactRef.ts` — typ artefaktu
 *   - `server/src/services/finance/canonical/lifecycleService.ts` — status wersji, akcje, rola
 *   - `server/src/services/finance/canonical/computeJobService.ts` — status joba
 *   - `server/src/routes/v8/finance-v2/{artifacts,versions,compute,models}.routes.ts` — kształt DTO odpowiedzi (pole po polu, zweryfikowane czytaniem kodu routera)
 *
 * Każdy typ DTO poniżej ma w komentarzu dokładne miejsce (plik:linia) w
 * routerze, z którego pole po polu przepisano kształt — żeby uniknąć
 * zgadywania (patrz `PKG_M_INVENTORY_report.md` §2 ostrzeżenie: „nie ufaj
 * komentarzowi bez ponownego zmierzenia" — tu odwrotnie, komentarz JEST
 * pomiarem, zrobionym przy pisaniu tego pliku 2026-08-11).
 */

// ---------------------------------------------------------------------------
// AP-00 — semantyka wartości finansowych.
// Źródło: server/src/types/finance/financeValueSemantics.ts:35-204
// ---------------------------------------------------------------------------

export const FinanceValueStatusValues = [
  'PRESENT_ZERO',
  'PRESENT_NONZERO',
  'MISSING',
  'NA',
  'NOT_APPLICABLE',
] as const;
export type FinanceValueStatus = (typeof FinanceValueStatusValues)[number];

/**
 * Twarda zasada produktu (CLAUDE.md „brak danych nigdy nie renderuje się jako
 * 0"): MISSING/NA/NOT_APPLICABLE muszą mieć `valueDecimal: null`; tylko
 * PRESENT_ZERO/PRESENT_NONZERO niosą liczbę.
 */
export interface FinanceValue {
  status: FinanceValueStatus;
  /** String dziesiętny pełnej precyzji — NIGDY `number` (utrata precyzji IEEE-754). Null iff status ∈ {MISSING,NA,NOT_APPLICABLE}. */
  valueDecimal: string | null;
  nativeCurrency: string;
  presentationCurrency: string;
  unit: 'UNITS' | 'THOUSANDS' | 'MILLIONS' | 'BILLIONS';
  multiplier: string;
  sourceRef: Record<string, unknown> | null;
  isAdjustment: boolean;
  adjustmentReason: string | null;
}

export function isPresentFinanceValue(value: Pick<FinanceValue, 'status'>): boolean {
  return value.status === 'PRESENT_ZERO' || value.status === 'PRESENT_NONZERO';
}

export function isMissingFinanceValue(value: Pick<FinanceValue, 'status'>): boolean {
  return value.status === 'MISSING';
}

/**
 * MISSING → zawsze `null` (nigdy 0). NA/NOT_APPLICABLE domyślnie też `null`,
 * z opcjonalnym opt-in per-caller (nigdy globalnie) — identyczna dyscyplina
 * jak `toArithmeticOperand` w financeValueSemantics.ts:184-204.
 */
export function financeValueToArithmeticOperand(
  value: Pick<FinanceValue, 'status' | 'valueDecimal'>,
  opts: { treatNaAsZero?: boolean; treatNotApplicableAsZero?: boolean } = {}
): number | null {
  switch (value.status) {
    case 'PRESENT_ZERO':
      return 0;
    case 'PRESENT_NONZERO':
      return value.valueDecimal === null ? null : Number(value.valueDecimal);
    case 'NA':
      return opts.treatNaAsZero ? 0 : null;
    case 'NOT_APPLICABLE':
      return opts.treatNotApplicableAsZero ? 0 : null;
    case 'MISSING':
      return null;
    default: {
      const _exhaustive: never = value.status;
      return _exhaustive;
    }
  }
}

/**
 * Formatowanie `FinanceValue` do WYŚWIETLENIA — druga (obok
 * `financeValueToArithmeticOperand`) strona tej samej zasady: MISSING/NA/
 * NOT_APPLICABLE muszą wyglądać jak „brak", NIE jak „0". `—` (em dash) jest
 * celowo różne wizualnie i semantycznie od cyfry `0`; trzy statusy braku mają
 * TEN SAM glif `—`, bo widoczne rozróżnienie MISSING/NA/NOT_APPLICABLE jest
 * zadaniem tooltipa/etykiety obok (`financeValueDisplayReasonLabel`), nie
 * samego glifu — inaczej UI musiałby wymyślić trzy różne symbole zamiast
 * jednego czytelnego „nie wiem/nie dotyczy".
 */
export interface FinanceValueDisplay {
  text: string;
  isMissingLikeGlyph: boolean;
  status: FinanceValueStatus;
}

export function formatFinanceValueForDisplay(
  value: Pick<FinanceValue, 'status' | 'valueDecimal'>,
  formatNumber: (n: number) => string = (n) => n.toLocaleString('pl-PL')
): FinanceValueDisplay {
  if (value.status === 'MISSING' || value.status === 'NA' || value.status === 'NOT_APPLICABLE') {
    return { text: '—', isMissingLikeGlyph: true, status: value.status };
  }
  const n = value.valueDecimal === null ? null : Number(value.valueDecimal);
  if (n === null || Number.isNaN(n)) {
    return { text: '—', isMissingLikeGlyph: true, status: value.status };
  }
  return { text: formatNumber(n), isMissingLikeGlyph: false, status: value.status };
}

export function financeValueDisplayReasonLabel(status: FinanceValueStatus): string | null {
  switch (status) {
    case 'MISSING':
      return 'Brak danych (luka źródłowa)';
    case 'NA':
      return 'Analityk oznaczył: nie dotyczy';
    case 'NOT_APPLICABLE':
      return 'Pole strukturalnie nie istnieje dla tej linii/branży';
    default:
      return null;
  }
}

export const FinanceArtifactFreshnessValues = [
  'NEVER_COMPUTED',
  'CURRENT',
  'STALE_SOURCE',
  'STALE_ASSUMPTIONS',
  'COMPUTE_FAILED',
] as const;
export type FinanceArtifactFreshness = (typeof FinanceArtifactFreshnessValues)[number];

// ---------------------------------------------------------------------------
// AP-00 — ArtifactRef. Źródło: server/src/types/finance/ArtifactRef.ts:29-119
// ---------------------------------------------------------------------------

export const FinanceArtifactTypeValues = [
  'STATEMENT_PACK',
  'HISTORICAL_ANALYSIS',
  'BASELINE_MODEL',
  'PREDICTION_SCENARIO',
  'VALUATION_CASE',
  'REPORT_EXPORT',
] as const;
export type FinanceArtifactType = (typeof FinanceArtifactTypeValues)[number];

export interface ArtifactRef {
  organizationId: string;
  artifactType: FinanceArtifactType;
  artifactId: string;
  businessVersionId: string;
  naturalKey: string | null;
}

/** Klucz stabilny dla React Query/mapy stanu — NIGDY samo artifactId (reopen zmienia businessVersionId przy stałym artifactId). ArtifactRef.ts:116-119. */
export function artifactRefKey(ref: Pick<ArtifactRef, 'artifactType' | 'businessVersionId'>): string {
  return `${ref.artifactType}:${ref.businessVersionId}`;
}

// ---------------------------------------------------------------------------
// WP-B02 — lifecycle. Źródło: server/src/services/finance/canonical/lifecycleService.ts:24-53
// ---------------------------------------------------------------------------

export const BusinessVersionStatusValues = [
  'DRAFT',
  'READY_FOR_REVIEW',
  'IN_REVIEW',
  'APPROVED',
  'NEEDS_CHANGES',
  'SUPERSEDED',
  'ARCHIVED',
  'INVALIDATED',
] as const;
export type BusinessVersionStatus = (typeof BusinessVersionStatusValues)[number];

export const TERMINAL_BUSINESS_VERSION_STATUSES: readonly BusinessVersionStatus[] = [
  'SUPERSEDED',
  'ARCHIVED',
  'INVALIDATED',
];

export const LifecycleActionValues = [
  'submit_for_review',
  'withdraw',
  'start_review',
  'request_changes',
  'resume_editing',
  'approve',
  'archive',
  'invalidate',
  'reopen',
] as const;
export type LifecycleAction = (typeof LifecycleActionValues)[number];

export const FinanceRoleValues = ['viewer', 'preparer', 'reviewer', 'approver', 'finance_admin'] as const;
export type FinanceRole = (typeof FinanceRoleValues)[number];

// ---------------------------------------------------------------------------
// computeJobService — status joba. Źródło: computeJobService.ts:51-52
// ---------------------------------------------------------------------------

export const ComputeJobStatusValues = ['queued', 'running', 'succeeded', 'failed', 'cancelled'] as const;
export type ComputeJobStatus = (typeof ComputeJobStatusValues)[number];

// ---------------------------------------------------------------------------
// DTO — dokładny kształt `{data, meta}` z routerów.
// ---------------------------------------------------------------------------

export interface FinanceV2Meta {
  version: 'v2';
  contract: string;
}

/** artifacts.routes.ts:85-101 (POST /artifacts). */
export interface FinanceCreateArtifactResultDto {
  artifactId: string;
  artifactType: FinanceArtifactType;
  naturalKey: string | null;
  createdAt: string;
  currentBusinessVersion: {
    businessVersionId: string;
    versionNo: number;
    version: number;
    status: BusinessVersionStatus;
    riskTier: string;
  };
  workingRevisionId: string;
}

/** artifacts.routes.ts:132-153 (GET /artifacts/:id). */
export interface FinanceArtifactDetailDto {
  artifactId: string;
  artifactType: FinanceArtifactType;
  naturalKey: string | null;
  createdAt: string;
  archivedAt: string | null;
  archivedReason: string | null;
  currentBusinessVersion: {
    businessVersionId: string;
    versionNo: number;
    version: number;
    status: BusinessVersionStatus;
    freshness: FinanceArtifactFreshness;
    freshnessReason: string | null;
    riskTier: string;
  } | null;
}

/** artifacts.routes.ts:174-189 (GET /artifacts/:id/versions), jeden wpis. */
export interface FinanceBusinessVersionSummaryDto {
  businessVersionId: string;
  versionNo: number;
  version: number;
  status: BusinessVersionStatus;
  freshness: FinanceArtifactFreshness;
  freshnessReason: string | null;
  riskTier: string;
  versionKind: string;
  parentVersionId: string | null;
  supersededByVersionId: string | null;
  createdAt: string;
  approvedAt: string | null;
}

/** artifacts.routes.ts:214-234 (GET /artifacts/:id/capabilities). */
export interface FinanceCapabilitiesDto {
  artifactId: string;
  businessVersionId: string | null;
  status: BusinessVersionStatus | null;
  version?: number;
  freshness?: FinanceArtifactFreshness;
  role: FinanceRole;
  allowedActions: LifecycleAction[];
}

/** versions.routes.ts:79-107 (GET /versions/:id). */
export interface FinanceBusinessVersionDetailDto {
  businessVersionId: string;
  artifactId: string;
  versionNo: number;
  version: number;
  status: BusinessVersionStatus;
  freshness: FinanceArtifactFreshness;
  freshnessReason: string | null;
  staleSince: string | null;
  riskTier: string;
  versionKind: string;
  parentVersionId: string | null;
  supersededByVersionId: string | null;
  computeSnapshotId: string | null;
  computeRunId: string | null;
  contentSemanticHash: string | null;
  submittedBy: string | null;
  submittedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  reopenReason: string | null;
  reopenedBy: string | null;
  reopenedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** versions.routes.ts:156-164 (POST /versions/:id/transitions), sukces. */
export interface FinanceTransitionResultDto {
  businessVersionId: string;
  status: BusinessVersionStatus;
  version: number;
  freshnessPropagation: unknown | null;
}

/** versions.routes.ts:184-199 (POST /versions/:id/compute-snapshot), sukces. */
export interface FinanceComputeSnapshotResultDto {
  computeSnapshotId: string;
  workingRevisionId: string;
  asOf: string;
  reused: boolean;
}

/** compute.routes.ts:38-54 (jobToDto). */
export interface FinanceComputeJobDto {
  jobId: string;
  jobType: string;
  status: ComputeJobStatus;
  inputArtifactId: string;
  inputRevisionHash: string;
  attemptCount: number;
  maxAttempts: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  requestedByUserId: string;
}

/** compute.routes.ts:88-93 (POST /compute/jobs), sukces — jobToDto + wasExisting. */
export interface FinanceEnqueueJobResultDto extends FinanceComputeJobDto {
  wasExisting: boolean;
}

/** models.routes.ts:174-180 (POST /models/:id/approve), sukces. */
export interface FinanceApproveModelResultDto {
  success: true;
  status: 'approved';
  idempotentReplay?: true;
}

/** models.routes.ts:255-264 (POST /models/:id/reopen), sukces. */
export interface FinanceReopenModelResultDto {
  artifactId: string;
  previousBusinessVersionId: string;
  businessVersionId: string;
  versionNo: number;
  status: BusinessVersionStatus;
  workingRevisionId: string;
  idempotentReplay: boolean;
}

// ---------------------------------------------------------------------------
// Błąd — kształt `{error, code, ...extra}` (_shared.ts:56-58, models.routes.ts).
//
// ★ ZMIERZONE, nie zgadywane (`src/services/api/baseClient.ts:194-283`, funkcja
// realnie wołana przez `v8Get`/`v8Post` — NIE `src/services/apiUtils.ts`, to
// inny, równoległy plik o tej samej nazwie eksportu w tym repo): rzucony
// `Error` dostaje `.status`/`.url`/`.data` (`.data` = CAŁE parsowane ciało
// `{error, code, ...}`), ale `.code` NIE jest ustawiane bezpośrednio na
// obiekcie błędu — trzeba czytać `err.data?.code`. `.message` jest już
// znormalizowane przez `normalizeApiErrorMessage` (src/utils/apiError.ts),
// więc samo `.message` bywa czytelne, ale `.code` (potrzebny do gałęzi typu
// `VERSION_CONFLICT`/`NOT_FOUND`) żyje pod `.data.code`.
// ---------------------------------------------------------------------------

export interface FinanceV2ApiError extends Error {
  status?: number;
  data?: { error?: string; code?: string; [key: string]: unknown };
}

export function isFinanceV2ApiError(err: unknown): err is FinanceV2ApiError {
  return err instanceof Error && ('status' in err || 'data' in err);
}

function finanaceV2ErrorCode(err: FinanceV2ApiError): string | null {
  return (err.data && typeof err.data === 'object' && typeof err.data.code === 'string' ? err.data.code : null) ?? null;
}

/**
 * Honest-UI mapowanie kodu błędu na komunikat PL — CANON.md §4.1 zakazuje
 * surowego błędu backendu jako jedynego komunikatu. `Request timed out` z
 * `fetchWithRetry` (20s hard timeout, src/services/api/baseClient.ts) NIGDY
 * nie trafia do UI bez przeformułowania.
 */
// =============================================================================================
// --- PKG-H Valuation ---
//
// Port (not import — same server/↔src/ boundary discipline as the rest of this file) of the
// shapes returned by `server/src/routes/v8/finance-v2/valuation.routes.ts` (Pakiet B3,
// UNVERIFIED_WIP at base SHA 9604652e27 — see PKG_H_VALUATION_report.md for what was measured
// vs. assumed) plus the pure types those routes wrap from
// `server/src/services/finance/canonical/valuation*.ts`.
//
// ★ MEASURED INCONSISTENCY (report this, do not silently "fix" the shape by guessing a nicer
// one): unlike every other finance-v2 router, several Valuation GET endpoints return the RAW
// Postgres row shape (snake_case field names, decimals as strings) directly as `data`, while the
// POST/PUT endpoints on the very same resources return hand-mapped camelCase DTOs:
//   - GET  .../wacc-inputs        → raw `WaccInputsRow`               (valuation.routes.ts:375-386, snake_case)
//   - PUT  .../wacc-inputs        → raw `WaccInputsRow` too           (valuation.routes.ts:426-429, snake_case — NOT camelCase, unlike bridge PUT)
//   - GET  .../bridge             → raw `{header, components}`        (valuation.routes.ts:567-577, snake_case)
//   - PUT  .../bridge             → camelCase DTO                      (valuation.routes.ts:630-633)
//   - GET  methods/:id/terminal   → raw `TerminalRow[]`                (valuation.routes.ts:641-650, snake_case)
//   - POST methods/:id/sensitivity→ camelCase cells                    (valuation.routes.ts:704-707)
//   - GET  methods/:id/sensitivity/:label → raw `{grid, cells}`        (valuation.routes.ts:711-723, snake_case)
//   - GET  .../results            → mostly camelCase wrapper keys, but `wacc`/`terminal`/`bridge`
//                                    sub-objects are raw snake_case rows (valuation.routes.ts:537-560)
//   - POST .../advisor/generate   → camelCase `PersistedAdvisorFinding[]` (valuation.routes.ts:752-755)
//   - GET  .../advisor            → raw `StoredAdvisorOutputRow[]`     (valuation.routes.ts:766-768, snake_case)
// Every type below is named/shaped to match EXACTLY what was read from the router source at the
// base SHA — including the snake_case ones — rather than normalized, so this file stays an
// honest port. `adaptValuationMethodResultToFinanceValue`-style helpers and the
// `normalizeAdvisorFinding`/camel-ifying helpers in
// `src/components/Finance/Valuation/valuationMath.ts` do the normalization for the UI layer
// instead, one layer up, where it can be unit-tested against both shapes.
// =============================================================================================

// ---------------------------------------------------------------------------
// Methods (valuationComputeService.ts) — mapMethod(), valuation.routes.ts:97-106
// ---------------------------------------------------------------------------

export const ValuationMethodTypeValues = [
  'DCF_FCFF',
  'DCF_FCFE',
  'DIVIDEND_DISCOUNT',
  'TRADING_COMPS',
  'PRECEDENT_TRANSACTIONS',
  'ASSET_BASED',
  'OTHER_WITH_POLICY',
] as const;
export type ValuationMethodType = (typeof ValuationMethodTypeValues)[number];

export const ValuationMethodReadinessValues = ['NOT_CONFIGURED', 'DATA_INCOMPLETE', 'READY', 'COMPUTE_FAILED'] as const;
export type ValuationMethodReadiness = (typeof ValuationMethodReadinessValues)[number];

/** Bit-identical to `FinanceValueStatus` above (`MethodResultValueStatus` in valuationComputeService.ts:49) — reused, not redeclared, so N/A-vs-zero logic is ONE place. */
export type ValuationMethodResultStatus = FinanceValueStatus;

/** `mapMethod()`, valuation.routes.ts:97-106. `result.valueDecimal` is `null` unless `result.status` is PRESENT_ZERO/PRESENT_NONZERO — feed straight into `formatFinanceValueForDisplay`. */
export interface ValuationMethodDto {
  methodId: string;
  methodType: ValuationMethodType;
  readiness: ValuationMethodReadiness;
  result: { status: ValuationMethodResultStatus; valueDecimal: string | null };
  isInRecommendationBasket: boolean;
  /** Decimal string, `null` for cross-checks (never weighted, DEC-FIN-005) and for un-basketed methods. */
  weightPct: string | null;
}

/** `computeWeightedRecommendation()`, valuationComputeService.ts:253-281. */
export type ValuationWeightedRecommendationDto =
  | { status: 'NO_BASKET' }
  | { status: 'INCOMPLETE'; notReadyMethodTypes: ValuationMethodType[] }
  | {
      status: 'READY';
      weightedEnterpriseValue: number;
      contributions: { methodType: ValuationMethodType; weightPct: number; resultEvDecimal: number; contribution: number }[];
    };

// ---------------------------------------------------------------------------
// Cases + Variants (valuationVariantService.ts) — valuation.routes.ts:112-223
// ---------------------------------------------------------------------------

export interface ValuationCaseDto {
  caseId: string;
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: string;
  archivedAt?: string | null;
}

export interface ValuationVariantSummaryDto {
  businessVersionId: string;
  name: string;
  description: string | null;
  status: string;
  freshness: string;
  versionNo: number;
  createdBy: string;
  createdAt: string;
}

/** GET /valuation/cases/:caseId, valuation.routes.ts:134-155. */
export interface ValuationCaseDetailDto extends ValuationCaseDto {
  variants: ValuationVariantSummaryDto[];
}

/** POST/GET/PATCH .../variants — same DTO shape across the three (valuation.routes.ts:157-223). */
export interface ValuationVariantDto extends ValuationVariantSummaryDto {
  caseId: string;
}

// ---------------------------------------------------------------------------
// WACC inputs — RAW `WaccInputsRow` passthrough, snake_case (valuationWaccService.ts:40-58,
// valuation.routes.ts:375-386 GET / :426-429 PUT). See inconsistency note above.
// ---------------------------------------------------------------------------

export interface ValuationWaccInputsRawDto {
  id: string;
  organization_id: string;
  business_version_id: string;
  risk_free_rate_pct: string | null;
  equity_risk_premium_pct: string | null;
  beta_unlevered: string | null;
  beta_relevered: string | null;
  target_capital_structure_debt_pct: string | null;
  target_capital_structure_equity_pct: string | null;
  current_capital_structure_debt_pct: string | null;
  current_capital_structure_equity_pct: string | null;
  cost_of_debt_pretax_pct: string | null;
  credit_spread_pct: string | null;
  cash_tax_rate_pct: string | null;
  currency: string;
  nominal_or_real: 'NOMINAL' | 'REAL';
  pre_or_post_tax: 'PRE_TAX' | 'POST_TAX';
  wacc_computed_pct: string | null;
}

// ---------------------------------------------------------------------------
// Terminal value — RAW `TerminalRow` passthrough, snake_case (valuationTerminalService.ts:164-177,
// valuation.routes.ts:641-650).
// ---------------------------------------------------------------------------

export interface ValuationTerminalRowRawDto {
  id: string;
  organization_id: string;
  method_id: string;
  convention: 'GORDON_GROWTH' | 'EXIT_MULTIPLE';
  g_pct: string | null;
  exit_multiple_value: string | null;
  reinvestment_rate_pct: string | null;
  roic_pct: string | null;
  terminal_value_decimal: string | null;
  terminal_share_pct: string | null;
  is_primary: boolean;
  rationale: string | null;
}

// ---------------------------------------------------------------------------
// EV -> Equity bridge — two DIFFERENT shapes for the SAME resource (see inconsistency note).
// ---------------------------------------------------------------------------

export type ValuationBridgeComponentKind =
  | 'DEBT'
  | 'LEASES'
  | 'PENSIONS_PROVISIONS'
  | 'MINORITIES'
  | 'ASSOCIATES_INVESTMENTS'
  | 'CASH'
  | 'RESTRICTED_CASH'
  | 'NON_OPERATING_ASSETS'
  | 'OPTIONS_DILUTION'
  | 'OTHER';
export type ValuationBridgeComponentSign = 'SUBTRACT_FROM_EV' | 'ADD_TO_EV';

export interface ValuationBridgeComponentInput {
  sequenceOrder: number;
  componentKind: ValuationBridgeComponentKind;
  sign: ValuationBridgeComponentSign;
  /** Always non-negative — direction comes exclusively from `sign` (never inferred). */
  amountDecimal: number;
  asOfDate: string;
  rationale?: string | null;
}

/** GET .../bridge — raw `{header: BridgeHeaderRow, components: BridgeComponentRow[]}` (valuationBridgeService.ts:162-183, valuation.routes.ts:567-577). */
export interface ValuationBridgeReadDto {
  header: {
    id: string;
    organization_id: string;
    business_version_id: string;
    as_of_date: string;
    enterprise_value_decimal: string | null;
    equity_value_decimal: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
  };
  components: {
    id: string;
    sequence_order: number;
    component_kind: ValuationBridgeComponentKind;
    sign: ValuationBridgeComponentSign;
    amount_decimal: string;
    as_of_date: string;
    rationale: string | null;
  }[];
}

/** PUT .../bridge success — camelCase DTO (valuation.routes.ts:630-633). */
export interface ValuationBridgeWriteResultDto {
  bridgeId: string;
  enterpriseValueDecimal: number;
  equityValueDecimal: number;
  breakdown: { componentKind: ValuationBridgeComponentKind; sign: ValuationBridgeComponentSign; signedAmount: number }[];
}

// ---------------------------------------------------------------------------
// Sensitivity 5x5 grid — two DIFFERENT shapes for the SAME resource (see inconsistency note).
// Rows = terminal g (ascending), columns = WACC (ascending); a cell is `null` when g>=WACC for
// that combination — never clamped/hidden (valuationSensitivityService.ts:35-42).
// ---------------------------------------------------------------------------

/** POST .../sensitivity success — camelCase cells (valuation.routes.ts:704-707). */
export interface ValuationSensitivityCellDto {
  rowIndex: number; // 1..5
  colIndex: number; // 1..5
  rowAxisValue: number; // g_pct
  columnAxisValue: number; // wacc_pct
  cellValueDecimal: number | null;
  isBaseCell: boolean;
}

export interface ValuationSensitivityWriteResultDto {
  gridId: string;
  gridLabel: string;
  gridStatus: 'COMPLETE';
  baseRowIndex: number;
  baseColIndex: number;
  cells: ValuationSensitivityCellDto[];
}

/** GET .../sensitivity/:gridLabel — raw snake_case grid + cells (valuation.routes.ts:711-723). */
export interface ValuationSensitivityGridRawDto {
  grid: {
    id: string;
    organization_id: string;
    method_id: string;
    grid_label: string;
    row_axis_variable: string;
    column_axis_variable: string;
    grid_status: 'DRAFT' | 'COMPLETE';
  };
  cells: {
    id: string;
    row_index: number;
    col_index: number;
    row_axis_value: string | null;
    column_axis_value: string | null;
    cell_value_decimal: string | null;
    is_base_cell: boolean;
  }[];
}

// ---------------------------------------------------------------------------
// GET .../results — the "Results" step's one call. Sub-objects wacc/terminal/bridge/sensitivityGrids
// are raw snake_case rows even though the wrapper keys are camelCase (valuation.routes.ts:521-561,
// snapshot shape from valuationAdvisorService.ts:218-271 `ValuationAdvisorSnapshot`).
// ---------------------------------------------------------------------------

export type ValuationHeadlineEvSource = 'BRIDGE' | 'WEIGHTED_BASKET' | 'SINGLE_READY_METHOD' | 'NONE';

export interface ValuationEvidencePointerDto {
  table: string;
  column: string;
  rowId: string | null;
  observedValue: number | string | null;
  label: string;
}

export interface ValuationHeadlineEnterpriseValueDto {
  source: ValuationHeadlineEvSource;
  value: number | null;
  pointer: ValuationEvidencePointerDto | null;
}

export interface ValuationMethodAgreementWarningDto {
  ruleId: string;
  kind: string;
  title: string;
  narrative: string;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH' | null;
}

export interface ValuationResultsDto {
  businessVersionId: string;
  variant: { id: string; case_id: string; name: string; description: string | null } | null;
  status: string;
  freshness: string;
  headlineEnterpriseValue: ValuationHeadlineEnterpriseValueDto;
  weightedRecommendation: ValuationWeightedRecommendationDto;
  methods: ValuationMethodDto[];
  wacc: (Record<string, string | null> & { id: string }) | null;
  terminal: ValuationAdvisorTerminalRowDto[];
  bridge: {
    header: { id: string; as_of_date: string; enterprise_value_decimal: string | null; equity_value_decimal: string | null };
    components: { id: string; sequence_order: number; component_kind: string; sign: ValuationBridgeComponentSign; amount_decimal: string }[];
  } | null;
  sensitivityGrids: ValuationAdvisorGridSnapshotDto[];
  usableCompsByMethodId: Record<string, number>;
  methodAgreementWarnings: ValuationMethodAgreementWarningDto[];
}

export interface ValuationAdvisorTerminalRowDto {
  id: string;
  method_id: string;
  method_type: ValuationMethodType;
  convention: 'GORDON_GROWTH' | 'EXIT_MULTIPLE';
  g_pct: string | null;
  exit_multiple_value: string | null;
  reinvestment_rate_pct: string | null;
  roic_pct: string | null;
  terminal_value_decimal: string | null;
  terminal_share_pct: string | null;
  is_primary: boolean;
}

export interface ValuationAdvisorGridSnapshotDto {
  id: string;
  method_id: string;
  grid_label: string;
  row_axis_variable: string;
  column_axis_variable: string;
  grid_status: 'DRAFT' | 'COMPLETE';
  cells: {
    id: string;
    row_index: number;
    col_index: number;
    row_axis_value: string | null;
    column_axis_value: string | null;
    cell_value_decimal: string | null;
    is_base_cell: boolean;
  }[];
}

// ---------------------------------------------------------------------------
// Compute DCF/FCFF — POST .../compute/dcf, valuation.routes.ts:450-509
// ---------------------------------------------------------------------------

export interface ValuationWaccBreakdownDto {
  betaRelevered: number;
  costOfEquityPct: number;
  costOfDebtAfterTaxPct: number;
  waccPct: number;
  targetDebtWeight: number;
  targetEquityWeight: number;
}

export interface ValuationFcffYearResultDto {
  fiscalYear: number;
  status: 'PRESENT' | 'MISSING';
  ebit: number | null;
  depreciationAmortization: number | null;
  closingWorkingCapital: number | null;
  deltaWorkingCapital: number | null;
  [key: string]: unknown; // remaining FCFF build-up fields not consumed by this UI package
}

export interface ValuationDiscountedYearDto {
  fiscalYear: number;
  t: number;
  discountFactor: number;
  presentValue: number;
}

export interface ValuationDiscountResultDto {
  years: ValuationDiscountedYearDto[];
  presentValueOfExplicitFcff: number;
  presentValueOfTerminal: number;
  enterpriseValue: number;
  terminalSharePct: number | null;
}

export interface ValuationComputeDcfResultDto {
  jobId: string;
  jobStatus: string;
  methodId: string;
  enterpriseValue: number;
  wacc: ValuationWaccBreakdownDto;
  terminalValue: number;
  discounted: ValuationDiscountResultDto;
  fcffYears: ValuationFcffYearResultDto[];
}

/** Known `sendError` codes from `statusForDcfError()` (valuation.routes.ts:444-448) — includes the g<WACC gate. */
export const ValuationDcfErrorCodeValues = [
  'BUSINESS_VERSION_NOT_FOUND',
  'NO_VALUATION_SOURCE_EDGE',
  'UNKNOWN_CANONICAL_LINE',
  'NO_WACC_INPUTS',
  'MULTIPLE_VALUATION_SOURCE_EDGES',
  'JOB_NOT_RUNNING',
  'INCONSISTENT_CURRENCY',
  'WACC_COMPUTE_FAILED',
  'FCFF_NOT_FULLY_PRESENT',
  'TERMINAL_G_MUST_BE_LESS_THAN_WACC',
] as const;
export type ValuationDcfErrorCode = (typeof ValuationDcfErrorCodeValues)[number];

// ---------------------------------------------------------------------------
// Advisor — POST .../advisor/generate (camelCase) vs GET .../advisor (snake_case). See
// inconsistency note. Both are normalized to `ValuationAdvisorFindingView` in valuationMath.ts.
// ---------------------------------------------------------------------------

export type ValuationAdvisorOutputKind = 'FACT' | 'HYPOTHESIS' | 'RISK' | 'QUESTION' | 'ACTION';
export type ValuationAdvisorConfidence = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ValuationAdvisorEvidencePointerDto {
  table: string;
  column: string;
  rowId: string | null;
  observedValue: number | string | null;
  label: string;
}

export interface ValuationAdvisorEvidenceRefDto {
  ruleId: string;
  generator: 'RULE_ENGINE';
  rulesVersion: string;
  pointers: ValuationAdvisorEvidencePointerDto[];
  derived: Record<string, number | string | boolean | null>;
  impactUnit: 'CURRENCY' | 'PCT' | 'PP' | 'COUNT' | null;
}

/** POST /valuation/variants/:id/advisor/generate — `data.findings[]`, camelCase (valuation.routes.ts:752-755). */
export interface ValuationAdvisorFindingGeneratedDto {
  id: string;
  ruleId: string;
  outputKind: ValuationAdvisorOutputKind;
  title: string;
  narrative: string;
  evidenceRef: ValuationAdvisorEvidenceRefDto;
  driverRef: string | null;
  impactDecimal: number | null;
  confidence: ValuationAdvisorConfidence | null;
  isComparison: boolean;
  comparedVariants: { businessVersionId: string; role: 'PRIMARY' | 'COMPARED_AGAINST' }[];
  hallucinationEvalStatus: 'NOT_EVALUATED' | 'PASSED' | 'FLAGGED';
}

export interface ValuationAdvisorGenerateResultDto {
  variantId: string;
  computeSnapshotId: string | null;
  findings: ValuationAdvisorFindingGeneratedDto[];
  countsByKind: Record<ValuationAdvisorOutputKind, number>;
}

/** GET /valuation/variants/:id/advisor — `data[]`, RAW `StoredAdvisorOutputRow`, snake_case (valuation.routes.ts:766-768, valuationAdvisorService.ts:1951-1969). */
export interface ValuationAdvisorFindingStoredDto {
  id: string;
  business_version_id: string;
  compute_snapshot_id: string;
  output_kind: ValuationAdvisorOutputKind;
  title: string;
  narrative: string;
  evidence_ref: ValuationAdvisorEvidenceRefDto;
  driver_ref: string | null;
  impact_decimal: string | null;
  confidence: ValuationAdvisorConfidence | null;
  is_comparison: boolean;
  is_frozen: boolean;
  frozen_at: string | null;
  is_stale: boolean;
  ai_provider: string;
  ai_prompt_version: string;
  ai_hallucination_eval_status: 'NOT_EVALUATED' | 'PASSED' | 'FLAGGED';
}

// ---------------------------------------------------------------------------
// Compare variants — POST /valuation/cases/:caseId/compare-variants, valuation.routes.ts:236-270
// (only a slice of CompareVariantsResult is sent over the wire — no full snapshot).
// ---------------------------------------------------------------------------

export type ValuationComparisonMetricName = 'ENTERPRISE_VALUE' | 'EQUITY_VALUE' | 'WACC_PCT' | 'TERMINAL_SHARE_PCT' | 'TERMINAL_G_PCT';

export interface ValuationComparisonMetricDto {
  metric: ValuationComparisonMetricName;
  unit: 'CURRENCY' | 'PCT' | 'PP';
  a: number | null;
  b: number | null;
  delta: number | null;
  deltaPct: number | null;
}

export interface ValuationCompareVariantsResultDto {
  caseId: string;
  variantA: { businessVersionId: string; name: string; enterpriseValue: ValuationHeadlineEnterpriseValueDto };
  variantB: { businessVersionId: string; name: string; enterpriseValue: ValuationHeadlineEnterpriseValueDto };
  metrics: ValuationComparisonMetricDto[];
  findings: ValuationAdvisorFindingGeneratedDto[];
  computeSnapshotId: string | null;
}

// ---------------------------------------------------------------------------
// Lineage (crosscutting.routes.ts:38-70) — needed honestly by the "Source" step to prove a
// variant points at an exact immutable Baseline/Scenario version, not "latest". Cross-cutting,
// not Valuation-domain, but there is no other allowlisted place to type it for this UI.
// ---------------------------------------------------------------------------

export type ValuationLineageEdgeType = string;

export interface ValuationLineageEdgeDto {
  edgeId: string;
  sourceVersionId: string;
  sourceArtifactType: FinanceArtifactType;
  targetVersionId: string;
  targetArtifactType: FinanceArtifactType;
  edgeType: ValuationLineageEdgeType;
  transformationKind: string | null;
  assumptionSnapshotHash: string | null;
  computeRunId: string | null;
  authorId: string | null;
  createdAt: string;
}

export interface ValuationLineageDto {
  businessVersionId: string;
  ancestors: ValuationLineageEdgeDto[];
  descendants: ValuationLineageEdgeDto[];
}

// --- /PKG-H Valuation ---
// =============================================================================================

export function describeFinanceV2Error(err: unknown): { title: string; detail: string; code: string | null } {
  // Timeout ("Request timed out", fetchWithRetry's own 20s AbortController,
  // src/services/api/baseClient.ts:151) jest zwykłym `new Error(...)` BEZ
  // `.status`/`.data` — sprawdzane PRZED `isFinanceV2ApiError`, inaczej ten
  // najczęstszy przypadek „surowego timeoutu w UI" wpadłby w generyczną
  // gałąź niżej zamiast w dedykowany komunikat.
  if (err instanceof Error && err.message === 'Request timed out') {
    return {
      title: 'Operacja trwa dłużej niż zwykle',
      detail: 'Serwer nie odpowiedział w oczekiwanym czasie. Sprawdź stan po chwili lub spróbuj ponownie.',
      code: 'TIMEOUT',
    };
  }
  if (!isFinanceV2ApiError(err)) {
    return { title: 'Wystąpił nieoczekiwany błąd', detail: 'Spróbuj ponownie za chwilę.', code: null };
  }
  const code = finanaceV2ErrorCode(err);
  switch (code) {
    case 'NOT_FOUND':
      return { title: 'Nie znaleziono', detail: 'Ten artefakt lub wersja już nie istnieje albo nie masz do niej dostępu.', code };
    case 'VERSION_CONFLICT':
      return {
        title: 'Ktoś inny zmienił ten rekord',
        detail: 'Odśwież dane i spróbuj ponownie — Twoja zmiana bazowała na nieaktualnej wersji.',
        code,
      };
    case 'STATE_PRECONDITION_FAILED':
      return { title: 'Ta operacja nie jest teraz możliwa', detail: 'Stan rekordu zmienił się od ostatniego odczytu. Odśwież i spróbuj ponownie.', code };
    case 'FORBIDDEN':
    case 'SELF_APPROVAL_FORBIDDEN':
      return { title: 'Brak uprawnień', detail: 'Twoja rola nie pozwala na tę operację.', code };
    case 'IDEMPOTENCY_KEY_REQUIRED':
    case 'INVALID_BODY':
    case 'INVALID_ACTION':
    case 'EXPECTED_VERSION_REQUIRED':
    case 'INVALID_ARTIFACT_TYPE':
      return { title: 'Nieprawidłowe żądanie', detail: err.message || 'Sprawdź dane i spróbuj ponownie.', code };
    default:
      return {
        title: 'Nie udało się wykonać operacji',
        detail: err.message && err.message.length < 160 ? err.message : 'Spróbuj ponownie lub zgłoś problem.',
        code,
      };
  }
}

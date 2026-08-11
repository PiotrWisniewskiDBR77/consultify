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

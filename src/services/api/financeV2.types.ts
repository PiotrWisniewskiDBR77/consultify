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

/**
 * Ludzka etykieta PL dla `FinanceValueStatus`, dla miejsc renderujących status
 * WPROST jako pole (np. `SourceEvidencePanel`'s "Status" row w Pakiecie D —
 * przed tą funkcją renderowało surowy token `cell.value.status`, np.
 * "PRESENT_NONZERO", jako tekst widoczny dla użytkownika).
 *
 * Świadomie ODDZIELNA od `financeValueDisplayReasonLabel` (nie rozszerza jej):
 * tamta funkcja odpowiada tylko na pytanie "dlaczego liczby nie ma" i celowo
 * zwraca `null` dla PRESENT_ZERO/PRESENT_NONZERO — jest pomyślana jako
 * uzupełniający wiersz "Powód braku", widoczny OBOK etykiety statusu, nie
 * zamiast niej (patrz `SourceEvidencePanel.tsx`, oba wiersze renderują się
 * razem dla MISSING/NA/NOT_APPLICABLE). Ta funkcja musi pokryć WSZYSTKIE
 * pięć stanów z jednym krótkim, rozróżnialnym słowem/frazą — inny kontrakt,
 * inna funkcja, ten sam plik/konwencja (etykiety polskie, zero zależności
 * od i18n `t()` — ten plik jest czystym TS, używanym też poza komponentami
 * Reacta, np. `deriveStatementTable.ts`).
 *
 * `src/components/Benefits/ValuationWorkspace.tsx`'s `valuationStatusLabel`/
 * `valuationSourceLabel` (zadanie #110) rozważone i ODRZUCONE jako baza do
 * rozszerzenia: inny enum (DRAFT/REVIEW/APPROVED — zero wspólnych wartości z
 * `FinanceValueStatus`), inny język etykiet (angielski, przez `TranslateFn`
 * `t()`), inna warstwa (komponent React z zależnością od hooka i18n; ten plik
 * jest współdzielony z czystymi funkcjami derywacji bez dostępu do `t()`).
 * Wymuszenie tamtej funkcji na tym enumie oznaczałoby albo brak obsługi
 * wszystkich pięciu wartości (padłoby na domyślną gałąź "Draft"), albo
 * zaimportowanie zależności i18n do pliku, który jej dziś nie ma. Zamiast
 * tego ta funkcja PRZEDŁUŻA już istniejącą, poprawną instancję tej samej
 * klasy defektu W TYM PAKIECIE — `financeValueDisplayReasonLabel` tuż powyżej
 * — ta sama konwencja (Polski literał, brak `t()`), ten sam plik, ten sam
 * `FinanceValueStatus`.
 *
 * Etykiety celowo różne słowa (nie warianty jednego zdania), żeby użytkownik
 * odróżnił PRAWDZIWE zero (PRESENT_ZERO) od trzech RÓŻNYCH przyczyn braku
 * liczby (MISSING = luka źródłowa, NA = analityk oznaczył wprost,
 * NOT_APPLICABLE = pole strukturalnie nie istnieje) — nigdy jeden wspólny
 * "brak" dla wszystkich trzech. Etykiety statusu są CELOWO krótsze niż i
 * TEKSTOWO różne od `financeValueDisplayReasonLabel`'s pełnych zdań — obie
 * funkcje renderują się OBOK SIEBIE w tym samym wierszu-parze
 * (Status/"Powód braku"), więc identyczny tekst w obu byłby zarówno
 * redundantny wizualnie, jak i niejednoznaczny dla zapytań `getByText`.
 */
export function financeValueStatusLabel(status: FinanceValueStatus): string {
  switch (status) {
    case 'PRESENT_ZERO':
      return 'Obecna wartość: zero';
    case 'PRESENT_NONZERO':
      return 'Obecna wartość';
    case 'MISSING':
      return 'Brak danych';
    case 'NA':
      return 'Nie dotyczy (analityk)';
    case 'NOT_APPLICABLE':
      return 'Nie dotyczy (struktura)';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
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

/** Polish label for `FinanceArtifactFreshness` — never render the raw enum token. First real client-side consumer: `FinanceLineageNavigator` (AP-CLIENT). */
export function financeArtifactFreshnessLabel(freshness: FinanceArtifactFreshness): string {
  switch (freshness) {
    case 'NEVER_COMPUTED':
      return 'Nigdy nie przeliczone';
    case 'CURRENT':
      return 'Aktualne';
    case 'STALE_SOURCE':
      return 'Nieaktualne (źródło się zmieniło)';
    case 'STALE_ASSUMPTIONS':
      return 'Nieaktualne (założenia się zmieniły)';
    case 'COMPUTE_FAILED':
      return 'Błąd przeliczenia';
    default: {
      const _exhaustive: never = freshness;
      return _exhaustive;
    }
  }
}

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

/** Polish label for an artifact type — never render `artifactType` raw (task #E2 enum-label sweep). */
export function financeArtifactTypeLabel(artifactType: FinanceArtifactType): string {
  switch (artifactType) {
    case 'STATEMENT_PACK':
      return 'Sprawozdanie finansowe';
    case 'HISTORICAL_ANALYSIS':
      return 'Analiza historyczna';
    case 'BASELINE_MODEL':
      return 'Model bazowy (Baseline)';
    case 'PREDICTION_SCENARIO':
      return 'Scenariusz predykcji';
    case 'VALUATION_CASE':
      return 'Wycena przedsiębiorstwa';
    case 'REPORT_EXPORT':
      return 'Eksport raportu';
    default: {
      const _exhaustive: never = artifactType;
      return _exhaustive;
    }
  }
}

export interface ArtifactRef {
  organizationId: string;
  artifactType: FinanceArtifactType;
  artifactId: string;
  businessVersionId: string;
  naturalKey: string | null;
}

/** Klucz stabilny dla React Query/mapy stanu — NIGDY samo artifactId (reopen zmienia businessVersionId przy stałym artifactId). ArtifactRef.ts:116-119. */
export function artifactRefKey(
  ref: Pick<ArtifactRef, 'artifactType' | 'businessVersionId'>
): string {
  return `${ref.artifactType}:${ref.businessVersionId}`;
}

// ---------------------------------------------------------------------------
// ID BRIDGE (Gate E) — legacy `/api/v8/finance/*` id -> canonical
// `{artifactId, businessVersionId}`. Źródło: pole po polu z
// `server/src/routes/v8/finance-v2/artifacts.routes.ts`
// `GET /artifacts/resolve-legacy/:legacyTable/:legacyId` handler
// (`legacyIdBridgeService.ts`'s `LegacyBridgeResolution`).
//
// Trzy, i TYLKO trzy, rozróżnialne stany — nigdy nie zlewaj RESOLVED z
// NOT_MIGRATED/QUARANTINED w jeden komunikat (CLAUDE.md §2.3, ta sama
// dyscyplina co `FinanceValueStatus`).
// ---------------------------------------------------------------------------

/** Legacy tabele, z których `FinanceHub.tsx` bierze `id` swoich wierszy — musi być identyczne ze `LEGACY_FINANCE_TABLES` w `legacyIdBridgeService.ts`. */
export const LegacyFinanceTableValues = [
  'financial_statement_packs',
  'financial_analyses',
  'financial_models',
  'valuations',
] as const;
export type LegacyFinanceTable = (typeof LegacyFinanceTableValues)[number];

export interface LegacyBridgeResolvedDto {
  status: 'RESOLVED';
  artifactId: string;
  businessVersionId: string | null;
  artifactType: FinanceArtifactType;
  mappingConfidence: 'AUTO_MIGRATE' | 'MIGRATE_WITH_WARNING';
}

export interface LegacyBridgeQuarantinedDto {
  status: 'QUARANTINED';
  mappingConfidence: 'QUARANTINE' | 'EXCLUDE_WITH_REASON';
  reason: string | null;
}

export interface LegacyBridgeNotMigratedDto {
  status: 'NOT_MIGRATED';
}

export type LegacyBridgeResolutionDto =
  | LegacyBridgeResolvedDto
  | LegacyBridgeQuarantinedDto
  | LegacyBridgeNotMigratedDto;

/**
 * `LegacyBridgeQuarantinedDto.reason` (= `finance_artifact_aliases.mapping_reason`,
 * DB column `TEXT`, no CHECK constraint) is NOT a closed enum — confirmed by
 * grep against every writer of that column, `server/scripts/finance-v3-backfill-dry-run.ts`
 * (the only script that INSERTs into `finance_artifact_aliases`; grep-confirmed
 * at session start of this task, 2026-08-12). Values there range from short
 * reason CODES (`APPROVED_WITHOUT_SNAPSHOT`) to full diagnostic sentences with
 * `;`/`=` (`pack_status=...;pack_readiness_status=...`,
 * `status=DRAFT; ORCH-DEC-002: financial_analyses is the sole canonical
 * NPV/IRR/ROI source`) — the same free-text shape the WP-C03 backfill report
 * documents. `FinanceLegacyBridgeGate.tsx` used to render this raw in a
 * Polish sentence (`Powód: ${state.reason}`, e.g. "Powód: approved_without_snapshot.")
 * — its own test even ASSERTED the raw string as expected, betoning the
 * defect. `rawEnumLeakScanner.test.ts` does not catch this class (`reason`
 * is not on its scanned-property list, and values are not pure
 * SCREAMING_SNAKE_CASE — a fifth known blind spot of that scanner, alongside
 * the four documented in its own header, since the raw value here comes from
 * an API RESPONSE at runtime, not a code literal the scanner's static grep
 * can see).
 *
 * This label layer: (1) recognizes every reason CODE actually grep-confirmed
 * in the backfill script's `logQuarantine`/`logExcluded`/`insertAlias` calls
 * (`reasonCode` values plus the one literal `mappingReason` token that shares
 * that vocabulary) with an honest Polish sentence saying what happened and
 * what the user can do; (2) for anything else — the free-text diagnostic
 * sentences that are NOT a closed set and can never be exhaustively
 * enumerated — falls back to ONE honest, generic Polish sentence that never
 * echoes the raw value into user-visible text.
 */
export function financeLegacyBridgeQuarantineReasonLabel(reason: string | null): string {
  if (!reason || !reason.trim()) {
    return 'Nie zapisano szczegółowego powodu.';
  }
  // Normalize so both `APPROVED_WITHOUT_SNAPSHOT` (reasonCode style) and
  // `approved_without_snapshot` (the lowercase form seen on live screenshots)
  // hit the same lookup key.
  const normalized = reason
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const known: Record<string, string> = {
    APPROVED_WITHOUT_SNAPSHOT:
      'Rekord był oznaczony jako zatwierdzony, ale bez zapisanej migawki danych — nie mógł zostać bezpiecznie przeniesiony jako zatwierdzony. Skontaktuj się z zespołem finansowym, aby zweryfikować to zatwierdzenie.',
    DUPLICATE_VERSION_NUMBER:
      'W starym systemie ten sam numer wersji miał więcej niż jeden zapis, więc kolejność wersji nie była jednoznaczna. Wymaga ręcznego uzgodnienia przez zespół danych.',
    ORPHANED_ORG_REFERENCE:
      'Rekord odwoływał się do organizacji, która nie istnieje w systemie. Zgłoś to administratorowi.',
    ORPHAN_STATEMENT_NO_PACK:
      'Rekord nie miał przypisanego nadrzędnego zestawu sprawozdań w starym systemie, więc nie dało się go przenieść samodzielnie.',
    CROSS_ORG_STATEMENT_PACK_MISMATCH:
      'Rekord należał do innej organizacji niż jego nadrzędny zestaw sprawozdań — rozbieżność w starym systemie uniemożliwiła bezpieczne przeniesienie.',
    PARENT_STATEMENT_QUARANTINED:
      'Nadrzędny rekord również został wykluczony z przenoszenia, więc ten element odziedziczył ten sam status.',
    LEGACY_PARALLEL_STORE_UNRECONCILED:
      'Rekord pochodzi ze starszego, równoległego magazynu danych, jeszcze nie uzgodnionego z głównym źródłem. Wymaga decyzji zespołu danych, zanim trafi do nowego systemu.',
    AMBIGUOUS_DECISION_EVENT_ZERO_AMOUNT:
      'Powiązane zdarzenie decyzyjne miało zerową kwotę w starym systemie, co uniemożliwia jednoznaczną interpretację. Wymaga weryfikacji zespołu finansowego.',
    AMBIGUOUS_DECISION_EVENT_DUPLICATE:
      'Powiązane zdarzenie decyzyjne ma dokładny duplikat w starym systemie, co uniemożliwia jednoznaczne przeniesienie. Wymaga weryfikacji zespołu finansowego.',
    EVENT_ONLY_BASELINE_ARCHITECTURE:
      'Model bazuje wyłącznie na architekturze zdarzeń, która nie jest jeszcze obsługiwana w nowym systemie.',
    SOURCE_MODEL_NOT_MIGRATED:
      'Model źródłowy, z którego pochodzi ten rekord, nie został jeszcze przeniesiony do nowego systemu.',
  };
  return (
    known[normalized] ??
    'Powód jest zapisany jako wewnętrzny, techniczny zapis zespołu ds. migracji danych — skontaktuj się z zespołem finansowym, jeśli potrzebujesz szczegółów.'
  );
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

/**
 * Polish label for a business-version lifecycle status — never render `status` raw.
 * Byte-identical wording to `FinanceWorkspaceBar.tsx`'s own (module-private) `STATUS_LABELS` map
 * (WP-C02 chrome, frozen contract, out of this task's allowlist) — same source vocabulary, kept
 * here as the shared, importable copy for every OTHER consumer of `BusinessVersionStatus` that
 * isn't the workspace bar chrome itself.
 */
export function businessVersionStatusLabel(status: BusinessVersionStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'Wersja robocza';
    case 'READY_FOR_REVIEW':
      return 'Gotowe do przeglądu';
    case 'IN_REVIEW':
      return 'W przeglądzie';
    case 'APPROVED':
      return 'Zatwierdzone';
    case 'NEEDS_CHANGES':
      return 'Wymaga zmian';
    case 'SUPERSEDED':
      return 'Zastąpione';
    case 'ARCHIVED':
      return 'Zarchiwizowane';
    case 'INVALIDATED':
      return 'Unieważnione';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

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

export const FinanceRoleValues = [
  'viewer',
  'preparer',
  'reviewer',
  'approver',
  'finance_admin',
] as const;
export type FinanceRole = (typeof FinanceRoleValues)[number];

// ---------------------------------------------------------------------------
// computeJobService — status joba. Źródło: computeJobService.ts:51-52
// ---------------------------------------------------------------------------

export const ComputeJobStatusValues = [
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
] as const;
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

// --- PKG-F Baseline ---
/** artifacts.routes.ts:288-291 (POST /artifacts/:id/rename), sukces. Używane przez `BaselineWorkspace.handleCommitRename`. */
export interface FinanceRenameArtifactResultDto {
  artifactId: string;
  naturalKey: string | null;
}
// --- /PKG-F Baseline ---

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
  sourceWorkingRevisionId?: string | null;
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

// --- PKG-E Analysis ---
// Pakiet E — Analysis (KPI), `/analysis/*`. Port pole-po-polu z
// `server/src/routes/v8/finance-v2/analysis.routes.ts` (przeczytany w całości
// 2026-08-11, Pakiet B2/DEC-FIN-012, trójwarstwowy katalog KPI).
// ---------------------------------------------------------------------------

/** analysis.routes.ts:42-47 — `tier` query param dla `GET /analysis/kpi-catalog`. */
export const AnalysisKpiTierValues = ['UNIVERSAL', 'INDUSTRY', 'ORG_CUSTOM'] as const;
export type AnalysisKpiTier = (typeof AnalysisKpiTierValues)[number];

/**
 * analysis.routes.ts:69 `negativeDenominatorPolicy` — jedyne miejsce, gdzie
 * backend deklaruje politykę ujemnego mianownika PER KPI (DEC-FIN-003).
 * Wartości portowane z `kpiComputeService.ts:206` (komentarz przy funkcji
 * negującej wartość — `FORCE_NA` jest jedyną wartością realnie zaobserwowaną
 * w tamtym komentarzu; pozostałe dwie są udokumentowanym rozszerzeniem
 * kontraktu backendowego, ten klient jest wobec nich neutralny — traktuje
 * każdą nieznaną wartość jak `FORCE_NA`, nigdy jak "policz mimo to").
 */
export const AnalysisNegativeDenominatorPolicyValues = [
  'FORCE_NA',
  'ALLOW_NEGATIVE_RATIO',
  'FLAG_ONLY',
] as const;
export type AnalysisNegativeDenominatorPolicy =
  (typeof AnalysisNegativeDenominatorPolicyValues)[number];

/** analysis.routes.ts:55-71 (GET /analysis/kpi-catalog), jeden wpis katalogu. */
export interface AnalysisKpiCatalogEntryDto {
  kpiCatalogId: string;
  kpiCode: string;
  catalogVersion: number;
  status: string;
  tier: AnalysisKpiTier;
  industryCode: string | null;
  category: string | null;
  kpiName: string;
  description: string | null;
  unitType: string;
  compileStatus: string;
  resolvedOutputUnit: string | null;
  periodConvention: string | null;
  negativeDenominatorPolicy: AnalysisNegativeDenominatorPolicy | string;
  requiredCanonicalLineCodes: string[] | null;
}

/** analysis.routes.ts:112-121 (POST /analysis/:businessVersionId/compute), sukces. */
export interface AnalysisComputeResultDto {
  jobId: string;
  jobStatus: ComputeJobStatus;
  resultsCount: number;
  results: unknown[];
  readiness: unknown | null;
}

/** analysis.routes.ts:107-110 — kody błędu specyficzne dla domeny Analysis. */
export const ANALYSIS_COMPUTE_NOT_FOUND_CODES = [
  'NO_SOURCE_STATEMENT_PACK_EDGE',
  'BUSINESS_VERSION_NOT_FOUND',
] as const;

/** analysis.routes.ts:143-170 (GET /analysis/:businessVersionId/kpi-values), jeden wiersz. */
export interface AnalysisKpiValueDto {
  kpiValueId: string;
  kpiCatalogId: string;
  kpiCode: string;
  kpiName: string;
  category: string | null;
  tier: AnalysisKpiTier;
  unitType: string;
  entityId: string;
  periodId: string;
  value: {
    status: FinanceValueStatus;
    valueDecimal: string | null;
    nativeCurrency: string;
    presentationCurrency: string;
    unit: string;
    multiplier: string;
  };
  qualityFlag: string | null;
  deltaVsPriorPeriod: string | null;
  deltaPctVsPriorPeriod: string | null;
  interpretationText: string | null;
  /** Realny gap backendu (brak writera `finance_analysis_benchmarks`) — zawsze `null` dziś, analysis.routes.ts:165-167. */
  benchmark: {
    rangeLow: string;
    rangeHigh: string;
    source: string;
    asOf: string;
    industryCode: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}
// --- /PKG-E Analysis (types) — dwie dodatkowe `case` gałęzie PKG-E żyją niżej,
// WEWNĄTRZ współdzielonej `describeFinanceV2Error` (NO_SOURCE_STATEMENT_PACK_EDGE/
// BUSINESS_VERSION_NOT_FOUND) — czysto addytywne nowe etykiety `case`, żadna
// cudza gałąź nie zmieniona. ---

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

// ---------------------------------------------------------------------------
// Statements domain (Pakiet D, PKG_D_STATEMENTS) — port kształtu DTO z
// `server/src/routes/v8/finance-v2/statements.routes.ts` (Pakiet B2), pole po
// polu, zmierzone czytaniem routera 2026-08-11 (nie zgadywane).
// ---------------------------------------------------------------------------

export const StatementTypeValues = ['P&L', 'BS', 'CF'] as const;
export type StatementType = (typeof StatementTypeValues)[number];

/** statementMappingService.ts:56 — `ReconciliationBucket`. */
export const ReconciliationBucketValues = [
  'MAPPED',
  'EXCLUDED',
  'UNMAPPED',
  'DUPLICATE',
  'RECLASS',
  'ELIMINATION',
  'CANONICAL',
] as const;
export type ReconciliationBucket = (typeof ReconciliationBucketValues)[number];

/** statements.routes.ts:195-223 (GET /statements/:id/lines), jeden wiersz. */
export interface StatementLineDto {
  stmtLineId: string;
  statementType: StatementType;
  canonicalLineId: string | null;
  lineCode: string | null;
  entityId: string;
  entityCode: string | null;
  periodId: string;
  periodLabel: string | null;
  accumulationBasis: string | null;
  consolidationScope: string | null;
  value: FinanceValue;
  signConvention: string | null;
  accountingPolicy: string | null;
  reclassifiedFromLineId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** statements.routes.ts:87-96 (POST /statements/:id/map), jeden wynik mapowania. */
export interface StatementMapResultDto {
  bucket: ReconciliationBucket;
  [key: string]: unknown;
}

/** statements.routes.ts:87-96 (POST /statements/:id/map), całość odpowiedzi. */
export interface StatementMapResultSummaryDto {
  businessVersionId: string;
  rowCount: number;
  mappedCount: number;
  unmappedCount: number;
  results: StatementMapResultDto[];
}

/** statements.routes.ts:254-265 (GET .../reconciliation-runs, POST .../reconcile) — totals. */
export interface ReconciliationTotalsDto {
  sourceTotal: string | null;
  mappedTotal: string | null;
  excludedTotal: string | null;
  unmappedTotal: string | null;
  duplicateTotal: string | null;
  reclassNetTotal: string | null;
  eliminationNetTotal: string | null;
  canonicalTotal: string | null;
  residual: string | null;
  residualPct: string | null;
}

/** statements.routes.ts:247-272 (GET /statements/:id/reconciliation-runs), jeden wpis ledgera. */
export interface ReconciliationRunSummaryDto {
  reconciliationRunId: string;
  artifactId: string;
  businessVersionId: string;
  sourceSystem: string;
  status: string;
  resultQuality: string | null;
  totals: ReconciliationTotalsDto;
  materialityThresholdApplied: string | null;
  sourceValueCoveragePct: string | null;
  linkedExceptionId: string | null;
  coverageExceptionId: string | null;
  createdAt: string;
  createdBy: string;
}

/** statements.routes.ts:146-159 (POST /statements/:id/reconcile), sukces. */
export interface RunReconciliationResultDto {
  reconciliationRunId: string;
  status: string;
  resultQuality: string | null;
  totals: ReconciliationTotalsDto;
  materialityThresholdPct: number | null;
  exceptionId: string | null;
  coverageExceptionId: string | null;
  periodJumpsCount: number;
  readiness: unknown;
}

/** statements.routes.ts:305-318 (GET .../reconciliation-runs/:id), jeden wiersz detalu. */
export interface ReconciliationDetailRowDto {
  id: string;
  canonicalLineId: string | null;
  entityId: string;
  periodId: string;
  bucket: ReconciliationBucket;
  sourceAmount: string | null;
  mappedAmount: string | null;
  duplicateOfRowId: string | null;
  reclassTargetLineId: string | null;
  eliminationCounterpartyEntityId: string | null;
  reasonCode: string | null;
  sourceRowRef: Record<string, unknown> | null;
}

/** statements.routes.ts:294-321 (GET /statements/reconciliation-runs/:id), całość. */
export interface ReconciliationRunDetailDto {
  reconciliationRunId: string;
  artifactId: string;
  businessVersionId: string;
  sourceSystem: string;
  status: string;
  resultQuality: string | null;
  residual: string | null;
  residualPct: string | null;
  createdAt: string;
  rows: ReconciliationDetailRowDto[];
}

// ---------------------------------------------------------------------------
// Cross-cutting — lineage. Port z
// `server/src/routes/v8/finance-v2/crosscutting.routes.ts:54-73` (Pakiet B2),
// zmierzone 2026-08-11.
// ---------------------------------------------------------------------------

/** crosscutting.routes.ts:54-66 — jedna krawędź lineage (ancestor lub descendant). */
export interface LineageEdgeDto {
  edgeId: string;
  sourceVersionId: string;
  sourceArtifactType: FinanceArtifactType;
  targetVersionId: string;
  targetArtifactType: FinanceArtifactType;
  edgeType: string;
  transformationKind: string | null;
  assumptionSnapshotHash: string | null;
  computeRunId: string | null;
  authorId: string | null;
  createdAt: string;
}

/** crosscutting.routes.ts:68-71 (GET /versions/:id/lineage), całość. Relacje po
 * `sourceVersionId`/`targetVersionId` (immutable business-version ID) —
 * NIGDY po nazwie, zgodnie z OWN-FIN-007/022. */
export interface VersionLineageDto {
  businessVersionId: string;
  ancestors: LineageEdgeDto[];
  descendants: LineageEdgeDto[];
}

function finanaceV2ErrorCode(err: FinanceV2ApiError): string | null {
  return (
    (err.data && typeof err.data === 'object' && typeof err.data.code === 'string'
      ? err.data.code
      : null) ?? null
  );
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

/** Polish label for a valuation method type — never render `methodType` raw (DCF_FCFF, TRADING_COMPS, ... are internal codes, not UI text). DCF stays as the canonical abbreviation per product convention. */
export function valuationMethodTypeLabel(methodType: ValuationMethodType): string {
  switch (methodType) {
    case 'DCF_FCFF':
      return 'DCF (FCFF)';
    case 'DCF_FCFE':
      return 'DCF (FCFE)';
    case 'DIVIDEND_DISCOUNT':
      return 'Zdyskontowane dywidendy';
    case 'TRADING_COMPS':
      return 'Porównywalne spółki giełdowe';
    case 'PRECEDENT_TRANSACTIONS':
      return 'Transakcje precedensowe';
    case 'ASSET_BASED':
      return 'Metoda majątkowa';
    case 'OTHER_WITH_POLICY':
      return 'Inna (wg polityki)';
    default: {
      const _exhaustive: never = methodType;
      return _exhaustive;
    }
  }
}

export const ValuationMethodReadinessValues = [
  'NOT_CONFIGURED',
  'DATA_INCOMPLETE',
  'READY',
  'COMPUTE_FAILED',
] as const;
export type ValuationMethodReadiness = (typeof ValuationMethodReadinessValues)[number];

/** Polish label for a valuation method's readiness state — never render `readiness` raw. */
export function valuationMethodReadinessLabel(readiness: ValuationMethodReadiness): string {
  switch (readiness) {
    case 'NOT_CONFIGURED':
      return 'Nieskonfigurowana';
    case 'DATA_INCOMPLETE':
      return 'Dane niekompletne';
    case 'READY':
      return 'Gotowa';
    case 'COMPUTE_FAILED':
      return 'Obliczenia nieudane';
    default: {
      const _exhaustive: never = readiness;
      return _exhaustive;
    }
  }
}

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
      contributions: {
        methodType: ValuationMethodType;
        weightPct: number;
        resultEvDecimal: number;
        contribution: number;
      }[];
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
  breakdown: {
    componentKind: ValuationBridgeComponentKind;
    sign: ValuationBridgeComponentSign;
    signedAmount: number;
  }[];
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

export type ValuationHeadlineEvSource =
  | 'BRIDGE'
  | 'WEIGHTED_BASKET'
  | 'SINGLE_READY_METHOD'
  | 'NONE';

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
    header: {
      id: string;
      as_of_date: string;
      enterprise_value_decimal: string | null;
      equity_value_decimal: string | null;
    };
    components: {
      id: string;
      sequence_order: number;
      component_kind: string;
      sign: ValuationBridgeComponentSign;
      amount_decimal: string;
    }[];
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

/** Polish label for an advisor finding's confidence — never render LOW/MEDIUM/HIGH raw. */
export function valuationAdvisorConfidenceLabel(confidence: ValuationAdvisorConfidence): string {
  switch (confidence) {
    case 'LOW':
      return 'Niska';
    case 'MEDIUM':
      return 'Średnia';
    case 'HIGH':
      return 'Wysoka';
    default: {
      const _exhaustive: never = confidence;
      return _exhaustive;
    }
  }
}

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

export type ValuationComparisonMetricName =
  | 'ENTERPRISE_VALUE'
  | 'EQUITY_VALUE'
  | 'WACC_PCT'
  | 'TERMINAL_SHARE_PCT'
  | 'TERMINAL_G_PCT';

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
  variantA: {
    businessVersionId: string;
    name: string;
    enterpriseValue: ValuationHeadlineEnterpriseValueDto;
  };
  variantB: {
    businessVersionId: string;
    name: string;
    enterpriseValue: ValuationHeadlineEnterpriseValueDto;
  };
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

/**
 * Polish label for a lineage `transformationKind` — never render the raw code (e.g.
 * `VALUATION_FROM_BASELINE`). Open-ended (`string | null`, not a closed union — this file has no
 * enum of every kind a `finance_lineage_edges` row can carry), so known codes get a real Polish
 * sentence and anything else gets a readable fallback (underscores -> spaces, sentence case)
 * instead of the raw SCREAMING_SNAKE_CASE token — the whole point being that NOTHING renders as a
 * bare code, known or not.
 */
export function financeLineageTransformationKindLabel(kind: string | null): string {
  if (kind === null) return '—';
  switch (kind) {
    case 'VALUATION_FROM_BASELINE':
      return 'Wycena na bazie modelu bazowego (Baseline)';
    case 'VALUATION_FROM_SCENARIO':
      return 'Wycena na bazie scenariusza predykcji';
    default:
      return kind
        .toLowerCase()
        .split('_')
        .filter(Boolean)
        .map((word, i) => (i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
        .join(' ');
  }
}

// --- /PKG-H Valuation ---
// =============================================================================================

export function describeFinanceV2Error(err: unknown): {
  title: string;
  detail: string;
  code: string | null;
} {
  // Timeout ("Request timed out", fetchWithRetry's own 20s AbortController,
  // src/services/api/baseClient.ts:151) jest zwykłym `new Error(...)` BEZ
  // `.status`/`.data` — sprawdzane PRZED `isFinanceV2ApiError`, inaczej ten
  // najczęstszy przypadek „surowego timeoutu w UI" wpadłby w generyczną
  // gałąź niżej zamiast w dedykowany komunikat.
  if (err instanceof Error && err.message === 'Request timed out') {
    return {
      title: 'Operacja trwa dłużej niż zwykle',
      detail:
        'Serwer nie odpowiedział w oczekiwanym czasie. Sprawdź stan po chwili lub spróbuj ponownie.',
      code: 'TIMEOUT',
    };
  }
  if (!isFinanceV2ApiError(err)) {
    return {
      title: 'Wystąpił nieoczekiwany błąd',
      detail: 'Spróbuj ponownie za chwilę.',
      code: null,
    };
  }
  const code = finanaceV2ErrorCode(err);
  switch (code) {
    case 'NOT_FOUND':
      return {
        title: 'Nie znaleziono',
        detail: 'Ten artefakt lub wersja już nie istnieje albo nie masz do niej dostępu.',
        code,
      };
    case 'NO_SOURCE_STATEMENT_PACK_EDGE':
      // Pakiet E — realny, potwierdzony gap: `POST /analysis/:id/compute` (analysis.routes.ts:108)
      // wymaga istniejącej krawędzi lineage do źródłowego Statement Pack, ale
      // żaden router `finance-v2` nie eksponuje jej zapisu (grep potwierdzony
      // 2026-08-11 — patrz PKG_E_ANALYSIS_report.md §"Blocked"). Ten komunikat
      // jest Honest UI, nie ukrywa przyczyny za ogólnym „coś poszło nie tak".
      return {
        title: 'Brak połączenia ze źródłowym pakietem sprawozdań',
        detail:
          'Ta analiza nie ma jeszcze ustalonego źródła danych (Statement Pack Version). Wróć do kreatora i wybierz źródło ponownie.',
        code,
      };
    case 'BUSINESS_VERSION_NOT_FOUND':
      return {
        title: 'Wersja analizy nie istnieje',
        detail: 'Ta wersja analizy została usunięta lub nie masz do niej dostępu.',
        code,
      };
    case 'VERSION_CONFLICT':
      return {
        title: 'Ktoś inny zmienił ten rekord',
        detail: 'Odśwież dane i spróbuj ponownie — Twoja zmiana bazowała na nieaktualnej wersji.',
        code,
      };
    case 'STATE_PRECONDITION_FAILED':
      return {
        title: 'Ta operacja nie jest teraz możliwa',
        detail: 'Stan rekordu zmienił się od ostatniego odczytu. Odśwież i spróbuj ponownie.',
        code,
      };
    case 'FORBIDDEN':
    case 'SELF_APPROVAL_FORBIDDEN':
      return { title: 'Brak uprawnień', detail: 'Twoja rola nie pozwala na tę operację.', code };
    case 'IDEMPOTENCY_KEY_REQUIRED':
    case 'INVALID_BODY':
    case 'INVALID_ACTION':
    case 'EXPECTED_VERSION_REQUIRED':
    case 'INVALID_ARTIFACT_TYPE':
      return {
        title: 'Nieprawidłowe żądanie',
        detail: err.message || 'Sprawdź dane i spróbuj ponownie.',
        code,
      };
    default:
      return {
        title: 'Nie udało się wykonać operacji',
        detail:
          err.message && err.message.length < 160
            ? err.message
            : 'Spróbuj ponownie lub zgłoś problem.',
        code,
      };
  }
}

// --- PKG-F Baseline ---
// Pakiet F — Baseline (`/baseline/*`). Źródło:
// server/src/routes/v8/finance-v2/baseline.routes.ts (czytane w całości
// 2026-08-11) + server/src/services/finance/canonical/baselineComputeService.ts
// (BASELINE_SCHEDULE_TYPES:725-729, BASELINE_ASSUMPTION_RULES:732-735,
// BASELINE_ASSUMPTION_QUALITIES:738, CANONICAL_CODES:112-120,
// STATEMENT_TYPE_OF:122-129). Kształt DTO PORTOWANY pole-po-polu z routera
// (nie zgadywany) — `server/**` poza allowlistą tego pakietu.
// Blok ciągnie się do końca pliku (ostatni blok pliku na 2026-08-11).
// ---------------------------------------------------------------------------

export interface BaselineWorkspacePeriodDto {
  periodId: string;
  label: string;
  periodStart: string;
  periodEnd: string;
}

export interface BaselineWorkspaceContextDto {
  businessVersionId: string;
  entityId: string;
  openingBalanceSheetPeriodId: string;
  forecastPeriods: BaselineWorkspacePeriodDto[];
  assumptionRowOrder: Array<{
    scheduleType: BaselineScheduleType;
    driverCode: string;
    entityId: string;
    periodId: string;
  }>;
  version: number;
}

export const BaselineScheduleTypeValues = [
  'revenue_pvm',
  'headcount',
  'cogs_opex',
  'wc_dso_dio_dpo',
  'capex_depreciation',
  'leases',
  'debt_maturity',
  'tax_nol',
  'equity_re',
] as const;
export type BaselineScheduleType = (typeof BaselineScheduleTypeValues)[number];

export const BaselineAssumptionRuleValues = [
  'HISTORICAL_AVERAGE',
  'GROWTH_RATE',
  'FIXED_VALUE',
  'LINKED_TO_ANALYSIS_KPI',
  'FORMULA',
  'MANUAL_OVERRIDE',
] as const;
export type BaselineAssumptionRule = (typeof BaselineAssumptionRuleValues)[number];

export const BaselineAssumptionQualityValues = [
  'CONFIRMED',
  'ESTIMATED',
  'DEGRADED_INSUFFICIENT_HISTORY',
] as const;
export type BaselineAssumptionQuality = (typeof BaselineAssumptionQualityValues)[number];

/** baseline.routes.ts:75-90 — węższy kształt wartości niż `FinanceValue` (brak native/presentation currency, multiplier, isAdjustment). */
export interface BaselineAssumptionValue {
  status: FinanceValueStatus;
  valueDecimal: string | null;
  unit: string;
  sourceRef: Record<string, unknown> | null;
}

/** baseline.routes.ts:74-92 (GET .../assumptions), jeden wiersz. */
export interface BaselineAssumptionDto {
  assumptionId: string;
  scheduleType: BaselineScheduleType;
  driverCode: string;
  entityId: string;
  periodId: string;
  basePeriodId: string | null;
  rule: BaselineAssumptionRule;
  value: BaselineAssumptionValue;
  rangeLow: string | null;
  rangeHigh: string | null;
  quality: BaselineAssumptionQuality;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** baseline.routes.ts:116-146 — wejście POST batch (ciało). */
export interface BaselineAssumptionUpsertInput {
  scheduleType: BaselineScheduleType;
  driverCode: string;
  entityId: string;
  periodId: string;
  basePeriodId?: string | null;
  rule: BaselineAssumptionRule;
  valueStatus: FinanceValueStatus;
  valueDecimal?: number | null;
  unit: string;
  sourceRef?: Record<string, unknown> | null;
  rangeLow?: number | null;
  rangeHigh?: number | null;
  quality: BaselineAssumptionQuality;
}

/** baseline.routes.ts:150-153 (POST .../assumptions), sukces. */
export interface BaselineAssumptionUpsertResultDto {
  businessVersionId: string;
  writtenCount: number;
  assumptions: Array<{
    assumptionId: string;
    scheduleType: BaselineScheduleType;
    driverCode: string;
    entityId: string;
    periodId: string;
  }>;
}

/** baseline.routes.ts:159-191 — wejście POST compute (ciało). */
export interface BaselineComputeParams {
  businessVersionId: string;
  entityId: string;
  forecastPeriodIds: string[];
  openingBalanceSheetPeriodId: string;
  engineManifestId?: string;
}

/**
 * baselineComputeService.ts `PeriodComputeSummary` (linia ~631-638) — jeden
 * miesiąc obliczenia. `qualityFlag: 'FUNDING_GAP'` gdy `cash < 0` — TO jest
 * źródło alarmu luki finansowania (DEC-FIN-002): silnik NIGDY nie podnosi
 * gotówki do zera (brak plugu), tylko oznacza okres flagą.
 */
export interface BaselinePeriodComputeSummaryDto {
  periodId: string;
  converged: boolean;
  iterationsUsed: number;
  cash: number;
  netIncome: number;
  qualityFlag: 'FUNDING_GAP' | null;
}

/** baseline.routes.ts:203-206 (POST .../compute), sukces. */
export interface BaselineComputeResultDto {
  jobId: string;
  jobStatus: string;
  periodsComputed: number;
  monthlyResults: BaselinePeriodComputeSummaryDto[];
}

/**
 * baseline.routes.ts:195-201 — błąd compute. `NO_SOURCE_STATEMENT_PACK_EDGE`/
 * `NO_BASELINE_MODEL_ROW` → 404; wszystko inne → 409 (m.in.
 * `CIRCULARITY_NOT_CONVERGED` z `failedAtPeriodId`/`partialResults`,
 * `TIE_OUT_FAILED`, `FORECAST_PERIOD_COUNT_MISMATCH`,
 * `MISSING_DEBT_MATURITY_SCHEDULE`, `JOB_NOT_RUNNING`).
 */
export interface BaselineComputeErrorExtra {
  failedAtPeriodId?: string;
  partialResults?: BaselinePeriodComputeSummaryDto[];
}

export const BASELINE_SCHEDULE_TYPE_LABELS_PL: Record<BaselineScheduleType, string> = {
  revenue_pvm: 'Przychody (cena/wolumen/mix)',
  headcount: 'Zatrudnienie',
  cogs_opex: 'Koszty (COGS/OPEX)',
  wc_dso_dio_dpo: 'Kapitał obrotowy (DSO/DIO/DPO)',
  capex_depreciation: 'CAPEX i amortyzacja',
  leases: 'Leasingi',
  debt_maturity: 'Harmonogram zadłużenia',
  tax_nol: 'Podatek',
  equity_re: 'Kapitał własny / zyski zatrzymane',
};

export const BASELINE_ASSUMPTION_RULE_LABELS_PL: Record<BaselineAssumptionRule, string> = {
  HISTORICAL_AVERAGE: 'Średnia historyczna',
  GROWTH_RATE: 'Stopa wzrostu',
  FIXED_VALUE: 'Wartość stała',
  LINKED_TO_ANALYSIS_KPI: 'Powiązane z KPI analizy',
  FORMULA: 'Formuła',
  MANUAL_OVERRIDE: 'Ręczna korekta',
};

export const BASELINE_ASSUMPTION_QUALITY_LABELS_PL: Record<BaselineAssumptionQuality, string> = {
  CONFIRMED: 'Potwierdzona',
  ESTIMATED: 'Szacowana',
  DEGRADED_INSUFFICIENT_HISTORY: 'Ograniczona (za mało historii)',
};

// ---------------------------------------------------------------------------
// Baseline outputs — baseline.routes.ts:215-265 (GET .../outputs)
// ---------------------------------------------------------------------------

export interface BaselineOutputValue {
  status: FinanceValueStatus;
  valueDecimal: string | null;
  nativeCurrency: string;
  presentationCurrency: string;
  unit: 'UNITS' | 'THOUSANDS' | 'MILLIONS' | 'BILLIONS';
  multiplier: string;
}

export type BaselineStatementType = 'P&L' | 'BS' | 'CF';
export type BaselineValueKind = 'ACTUAL' | 'FORECAST';

/** baselineComputeService.ts CANONICAL_CODES (112-120) — jedna linia kanoniczna z jej grupą sprawozdania. */
export const BASELINE_CANONICAL_LINE_ORDER: readonly string[] = [
  'REVENUE',
  'COGS',
  'GROSS_MARGIN',
  'OPEX',
  'EBITDA',
  'DEPRECIATION',
  'EBIT',
  'INTEREST_EXPENSE',
  'TAX_EXPENSE',
  'NET_INCOME',
  'CASH',
  'AR',
  'INVENTORY',
  'CURRENT_ASSETS',
  'FIXED_ASSETS',
  'TOTAL_ASSETS',
  'AP',
  'CURRENT_LIABILITIES',
  'LONG_TERM_DEBT',
  'TOTAL_LIABILITIES',
  'EQUITY',
  'TOTAL_LIABILITIES_EQUITY',
  'RETAINED_EARNINGS',
  'DIVIDENDS_DECLARED',
  'WORKING_CAPITAL',
  'CFO',
  'CFI',
  'CFF',
  'NET_CHANGE_CASH',
  'CAPEX',
  'FCF',
];

/** baseline.routes.ts:240-260, jeden wiersz. */
export interface BaselineOutputDto {
  outputId: string;
  statementType: BaselineStatementType;
  canonicalLineId: string;
  lineCode: string;
  entityId: string;
  periodId: string;
  periodLabel: string;
  consolidationScope: string;
  value: BaselineOutputValue;
  valueKind: BaselineValueKind;
  drivingScheduleType: string | null;
  createdBy: string;
  createdAt: string;
}
// --- /PKG-F Baseline ---

// ---------------------------------------------------------------------------
// --- PKG-G Prediction ---
//
// DTO kształty przepisane POLE-PO-POLU z realnie zamontowanego routera
// `server/src/routes/v8/finance-v2/prediction.routes.ts` (Pakiet B2, DEC-FIN-004: preflight i
// calculate są DWOMA OSOBNYMI endpointami, nigdy nie łączyć). `CanonicalCode` jest PORTEM
// `baselineComputeService.ts:112-120` (`CANONICAL_CODES`) — server/** poza allowlistą tego pakietu.
//
// Wywóz z inwentaryzacji (zapisany też w PKG_G_PREDICTION_report.md): backend NIE MA jeszcze HTTP
// CRUD do zapisu `finance_prediction_scenarios`/`_driver_overrides`/`_initiatives`/`_impact_chain`/
// `_financing` — tylko te dwa endpointy odczytowo-analityczne (preflight) i wyliczeniowe (calculate)
// istnieją. Typy poniżej pokrywają WYŁĄCZNIE to, co jest realnie zamontowane.
// ---------------------------------------------------------------------------

/** Port `server/src/services/finance/canonical/baselineComputeService.ts:112-120`, reużywany bit-identycznie przez prediction. */
export const CANONICAL_CODE_VALUES = [
  'REVENUE',
  'COGS',
  'GROSS_MARGIN',
  'OPEX',
  'EBITDA',
  'DEPRECIATION',
  'EBIT',
  'INTEREST_EXPENSE',
  'TAX_EXPENSE',
  'NET_INCOME',
  'CASH',
  'AR',
  'INVENTORY',
  'CURRENT_ASSETS',
  'FIXED_ASSETS',
  'TOTAL_ASSETS',
  'AP',
  'CURRENT_LIABILITIES',
  'LONG_TERM_DEBT',
  'TOTAL_LIABILITIES',
  'EQUITY',
  'TOTAL_LIABILITIES_EQUITY',
  'RETAINED_EARNINGS',
  'DIVIDENDS_DECLARED',
  'WORKING_CAPITAL',
  'CFO',
  'CFI',
  'CFF',
  'NET_CHANGE_CASH',
  'CAPEX',
  'FCF',
] as const;
export type CanonicalCode = (typeof CANONICAL_CODE_VALUES)[number];

export const PREDICTION_FINDING_KIND_VALUES = [
  'OVERLAP_DOUBLE_COUNTING',
  'CONTRADICTORY_SIGNS',
] as const;
export type PredictionFindingKind = (typeof PREDICTION_FINDING_KIND_VALUES)[number];

/** `prediction.routes.ts` `POST /prediction/:businessVersionId/preflight`, sukces (201), jeden finding — pole-po-polu z `PreflightFindingPreview`. */
export interface FinancePredictionPreflightFindingDto {
  findingId: string;
  findingKind: PredictionFindingKind;
  entityId: string;
  canonicalLineId: string;
  periodId: string;
  sourceCount: number;
  /** Layer 1 (naiwna, jednostko-agnostyczna suma) — traceability, NIGDY liczba pokazywana użytkownikowi jako wynik. */
  layer1CombinedImpactDecimal: number | null;
  /** Layer 2 (realna waluta) — TA liczba idzie do UI. */
  layer2CombinedImpactDecimal: number;
  requiresResolution: boolean;
}

/** `prediction.routes.ts` `POST /prediction/:businessVersionId/preflight`, sukces (201) — pełna koperta `data`. */
export interface FinancePredictionPreflightResultDto {
  preflightRunId: string;
  findingsCount: number;
  requiredResolutionsCount: number;
  findings: FinancePredictionPreflightFindingDto[];
}

/** `prediction.routes.ts` `POST /prediction/:businessVersionId/calculate`, mode='STANDARD_BASE'. */
export interface FinancePredictionCalculateStandardBaseResultDto {
  mode: 'STANDARD_BASE';
  jobId: string;
  jobStatus: ComputeJobStatus;
  baselineJobId: string | null;
  passthroughRowCount: number;
}

export interface FinancePredictionPeriodResultDto {
  periodId: string;
  values: Partial<Record<CanonicalCode, number>>;
  varianceVsBaseline: Partial<Record<CanonicalCode, number>>;
}

/** `prediction.routes.ts` `POST /prediction/:businessVersionId/calculate`, każdy inny `scenario_mode`. */
export interface FinancePredictionCalculateComputedResultDto {
  mode: 'COMPUTED';
  jobId: string;
  jobStatus: ComputeJobStatus;
  periodsComputed: number;
  periods: FinancePredictionPeriodResultDto[];
}

export type FinancePredictionCalculateResultDto =
  | FinancePredictionCalculateStandardBaseResultDto
  | FinancePredictionCalculateComputedResultDto;

export const PREDICTION_SCENARIO_MODE_VALUES = [
  'STANDARD_BASE',
  'STANDARD_UPSIDE',
  'STANDARD_DOWNSIDE',
  'DRIVER_OVERRIDE',
  'FUNDAMENTAL_INITIATIVE',
] as const;
export type PredictionScenarioMode = (typeof PREDICTION_SCENARIO_MODE_VALUES)[number];

/** `crosscutting.routes.ts` `GET /exceptions/open`, jeden wpis — reużywany przez widok Modele/Wyniki (rejestr wyjątków, DEC-FIN-009). */
export interface FinanceExceptionOpenDto {
  exceptionGroupId: string;
  artifactId: string;
  businessVersionId: string;
  severity: string;
  state: string;
  sourceRef: unknown;
  expected: unknown;
  observed: unknown;
  delta: unknown;
  unit: string | null;
  reasonCode: string | null;
  createdAt: string;
}

// =============================================================================================
// --- AP-CLIENT (Gate J) ---
//
// Client types for five capabilities whose HTTP routes were built and tested but had ZERO
// frontend client method and ZERO UI (`docs/validation/finance-v3/generated/gate-e/
// PKG_AP_LAYER_INVENTORY_2026-08-12.md`, capabilities #5/#6/#7/#4/#10). Port (not import — same
// server/↔src/ boundary discipline this whole file documents) of the shapes read from:
//   - `server/src/routes/v8/finance-v2/compare.routes.ts` (Compare, 6 endpoints)
//   - `server/src/routes/v8/finance-v2/comments.routes.ts` (Comments + review checklist, 17 endpoints)
//   - `server/src/routes/v8/finance-v2/saved-views.routes.ts` (Saved views, 6 endpoints)
//   - `server/src/routes/v8/finance-v2/export-import.routes.ts` (Excel export/import, 4 endpoints)
//   - `server/src/routes/v8/finance-v2/lineage-navigator.routes.ts` (Lineage navigator, 2 endpoints)
// All five routers already strip `organization_id` from every DTO they return (it is always the
// caller's own org) — these client types follow that same convention, camelCase throughout.
// =============================================================================================

// --- AP-CLIENT Compare ---
// Port of `server/src/services/finance/canonical/financeCompareService.ts` (AP-05) result shapes,
// as returned VERBATIM by `compare.routes.ts`'s `respondCompare()` (`{data: CompareResult}`, plus
// an optional `relationship` string some callers attach).
// ---------------------------------------------------------------------------

export type CompareCellPresenceDto = 'PRESENT' | 'MISSING' | 'NA' | 'NOT_APPLICABLE' | 'NO_ROW';

/** financeCompareService.ts `CellRef` field is the full server `CellRef` shape — treated as an opaque, re-postable blob on the client (never hand-assembled here). */
export interface CompareCellPointDto {
  presence: CompareCellPresenceDto;
  valueStatus: FinanceValueStatus | null;
  businessVersionId: string;
  cellRef: Record<string, unknown> | null;
  fullUnitValue: number | null;
  rawValueDecimal: string | null;
  unit: 'UNITS' | 'THOUSANDS' | 'MILLIONS' | 'BILLIONS' | null;
  multiplier: string | null;
  nativeCurrency: string | null;
  presentationCurrency: string | null;
}

export type CompareDiffKindDto =
  | 'BOTH_PRESENT'
  | 'MISSING_IN_A'
  | 'MISSING_IN_B'
  | 'MISSING_IN_BOTH'
  | 'CURRENCY_MISMATCH';

export interface CompareRowDto {
  matchKey: string;
  dimensions: Record<string, string>;
  a: CompareCellPointDto;
  b: CompareCellPointDto;
  diffKind: CompareDiffKindDto;
  absoluteDiff: number | null;
  pctDiff: number | null;
  materialityFlag: boolean;
  note: string | null;
}

export type CompareComparisonTypeDto =
  | 'PERIOD'
  | 'VERSION'
  | 'ENTITY'
  | 'SCENARIO'
  | 'VALUATION_METHOD'
  | 'ACTUAL_VS_FORECAST'
  | 'GENERIC';

export interface CompareSummaryDto {
  totalRows: number;
  bothPresent: number;
  missingInA: number;
  missingInB: number;
  missingInBoth: number;
  currencyMismatch: number;
  materialCount: number;
}

/** Human labels for `diffKind`/`presence` — CLAUDE.md enum-leak rule: never render the raw token. */
export function compareDiffKindLabel(kind: CompareDiffKindDto): string {
  switch (kind) {
    case 'BOTH_PRESENT':
      return 'Obie strony mają wartość';
    case 'MISSING_IN_A':
      return 'Brak w A';
    case 'MISSING_IN_B':
      return 'Brak w B';
    case 'MISSING_IN_BOTH':
      return 'Brak w obu';
    case 'CURRENCY_MISMATCH':
      return 'Niezgodność walut';
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function compareComparisonTypeLabel(type: CompareComparisonTypeDto): string {
  switch (type) {
    case 'PERIOD':
      return 'Okres / okres';
    case 'VERSION':
      return 'Wersja / wersja';
    case 'ENTITY':
      return 'Podmiot / podmiot';
    case 'SCENARIO':
      return 'Scenariusz / baseline';
    case 'VALUATION_METHOD':
      return 'Metoda / metoda';
    case 'ACTUAL_VS_FORECAST':
      return 'Actual / forecast';
    case 'GENERIC':
      return 'Porównanie ogólne';
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

/** `compare.routes.ts` `respondCompare()` — every `/compare/*` endpoint returns this shape under `data`. */
export interface CompareResultDto {
  comparisonType: CompareComparisonTypeDto;
  generatedAt: string;
  sourceA: { artifactType: FinanceArtifactType; businessVersionId: string; label: string };
  sourceB: { artifactType: FinanceArtifactType; businessVersionId: string; label: string };
  ignoreDimensions: readonly string[];
  materialityThresholdPct: number;
  onlyMaterial: boolean;
  summary: CompareSummaryDto;
  rows: CompareRowDto[];
  /** Only present on `compareEntities` (financeCompareService.ts's own optional field, passed through `respondCompare`). */
  relationship?: string;
}

export type CompareErrorCodeDto =
  | 'ARTIFACT_NOT_FOUND'
  | 'ORGANIZATION_MISMATCH'
  | 'UNSUPPORTED_ARTIFACT_TYPE'
  | 'AMBIGUOUS_MATCH_KEY'
  | 'VERSION_ARTIFACT_MISMATCH'
  | 'ENTITY_CODE_NOT_FOUND'
  | 'INVALID_ARTIFACT_REF'
  | 'INVALID_BODY';
// --- /AP-CLIENT Compare ---

// --- AP-CLIENT Comments ---
// Port of `comments.routes.ts`'s `toCommentDto`/`toCommentAssignmentDto`/`toChecklistItemDto`
// mappers (camelCase, `organization_id` dropped) — measured field-by-field from the route file,
// not from the underlying `commentService.ts` row shape.
// ---------------------------------------------------------------------------

/** Opaque `CellRef` blob — same convention as `CompareCellPointDto.cellRef` (never hand-assembled client-side; round-tripped from a server read, e.g. `StatementLineDto` would need one added upstream to originate one). */
export type FinanceCellRefInput = Record<string, unknown>;

export interface FinanceCommentDto {
  id: string;
  artifactId: string;
  businessVersionId: string;
  anchor: FinanceCellRefInput | null;
  authorId: string;
  body: string;
  mentions: string[];
  isBlocking: boolean;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceCommentAssignmentDto {
  id: string;
  commentId: string;
  assigneeId: string;
  dueDate: string | null;
  assignedBy: string;
  assignedAt: string;
}

export interface FinanceReviewChecklistItemDto {
  id: string;
  businessVersionId: string;
  item: string;
  required: boolean;
  checkedBy: string | null;
  checkedAt: string | null;
  createdBy: string;
  createdAt: string;
}

export interface FinanceChangedCellDto {
  cellKey?: string;
  [key: string]: unknown;
}

export interface FinanceChangedCellsResultDto {
  hasPreviousApproved: boolean;
  previousBusinessVersionId: string | null;
  changedCells: FinanceChangedCellDto[];
}
// --- /AP-CLIENT Comments ---

// --- AP-CLIENT SavedViews ---
// Port of `saved-views.routes.ts`'s `toSavedViewDto` mapper + `savedViewService.ts`'s
// `GridViewStateSnapshot`/`SavedViewFilter` shapes (structural port, not the zod schemas).
// ---------------------------------------------------------------------------

export const FinanceSavedViewScopeValues = ['PERSONAL', 'TEAM'] as const;
export type FinanceSavedViewScope = (typeof FinanceSavedViewScopeValues)[number];

export function financeSavedViewScopeLabel(scope: FinanceSavedViewScope): string {
  switch (scope) {
    case 'PERSONAL':
      return 'Osobisty';
    case 'TEAM':
      return 'Zespołowy';
    default: {
      const _exhaustive: never = scope;
      return _exhaustive;
    }
  }
}

export interface GridViewColumnStateInput {
  columnId: string;
  hidden: boolean;
  pinned: 'LEFT' | 'RIGHT' | null;
  groupId: string | null;
}

export interface GridViewRowStateInput {
  rowId: string;
  hidden: boolean;
  groupId: string | null;
}

export interface GridViewGroupStateInput {
  groupId: string;
  label: string;
  axis: 'ROW' | 'COLUMN';
  collapsed: boolean;
  memberIds: string[];
}

/** `savedViewService.ts` `GridViewStateSnapshotSchema` — schemaVersion is always `1` today. */
export interface GridViewStateSnapshotInput {
  schemaVersion: 1;
  freezeRowsCount: number;
  freezeColumnsCount: number;
  columns: GridViewColumnStateInput[];
  rows: GridViewRowStateInput[];
  groups: GridViewGroupStateInput[];
}

export function emptyGridViewStateSnapshot(): GridViewStateSnapshotInput {
  return {
    schemaVersion: 1,
    freezeRowsCount: 0,
    freezeColumnsCount: 0,
    columns: [],
    rows: [],
    groups: [],
  };
}

/** `savedViewService.ts`'s `SavedViewFilterSchema` discriminated union, ported field-for-field. */
export type SavedViewFilterInput =
  | { type: 'category'; values: string[] }
  | { type: 'quality'; values: FinanceValueStatus[] }
  | { type: 'missing'; onlyMissing: boolean }
  | { type: 'changed'; changedOnly: boolean }
  | { type: 'materiality'; minAbsValueDecimal: string | null }
  | { type: 'source'; values: string[] }
  | { type: 'owner'; values: string[] }
  | { type: 'downstream_use'; values: FinanceArtifactType[] }
  | { type: 'entity'; values: string[] }
  | { type: 'period'; values: string[] };

export interface FinanceSavedViewColumnAvailabilityDto {
  columnId: string;
  available: boolean;
  reason: 'KPI_DEPRECATED' | null;
}

/** `saved-views.routes.ts` `toSavedViewDto()` — `columnAvailability` present only on get/list/shared reads. */
export interface FinanceSavedViewDto {
  id: string;
  artifactId: string;
  artifactType: FinanceArtifactType;
  scope: FinanceSavedViewScope;
  ownerUserId: string;
  name: string;
  viewState: {
    schemaVersion: 1;
    gridViewState: GridViewStateSnapshotInput;
    filters: SavedViewFilterInput[];
  };
  shareToken: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  columnAvailability?: FinanceSavedViewColumnAvailabilityDto[];
}
// --- /AP-CLIENT SavedViews ---

// --- AP-CLIENT ExportImport ---
// Port of `financeExcelShared.ts` (`FinanceExcelManifest`), `financeImportService.ts`
// (`ParsedFinanceImport`/`FinanceImportPreviewResult`/`ApplyFinanceImportResult`) and
// `export-import.routes.ts` (response envelope + manifest header on the export download).
// ---------------------------------------------------------------------------

/** `financeExcelShared.ts:58-72` — round-trip manifest embedded in every export and required on every import call. */
export interface FinanceExcelManifestDto {
  manifestVersion: 1;
  source: 'consultify-finance-v3-ap02';
  exportId: string;
  organizationId: string;
  artifactId: string;
  artifactType: FinanceArtifactType;
  businessVersionId: string;
  businessVersionStatus: BusinessVersionStatus;
  businessVersionNo: number;
  businessVersionCasVersion: number;
  workingRevisionId: string;
  asOf: string;
  defaultUnit: 'UNITS' | 'THOUSANDS' | 'MILLIONS' | 'BILLIONS';
  defaultPresentationCurrency: string;
  rowCount: number;
}

/** `financeImportService.ts` `RawImportRow` — one raw Values-sheet row keyed by its own column headers, plus the source row number. */
export type FinanceImportRawRow = Record<string, unknown> & { __rowNumber: number };

/** `POST /import/parse` response (`ParsedFinanceImport`). */
export interface FinanceImportParsedDto {
  manifest: FinanceExcelManifestDto | null;
  manifestIssues: string[];
  rows: FinanceImportRawRow[];
}

export interface FinanceImportRowErrorDto {
  rowNumber: number;
  message: string;
}

export interface FinanceImportDiffChangeDto {
  cellKey: string;
  cellRef: FinanceCellRefInput;
  before: { status: FinanceValueStatus; valueDecimal: string | null };
  after: {
    rowNumber: number;
    cellKey: string;
    cellRef: FinanceCellRefInput;
    value: Record<string, unknown>;
  };
}

export interface FinanceImportDiffDto {
  toAdd: {
    rowNumber: number;
    cellKey: string;
    cellRef: FinanceCellRefInput;
    value: Record<string, unknown>;
  }[];
  toChange: FinanceImportDiffChangeDto[];
  toClear: { cellKey: string; cellRef: FinanceCellRefInput }[];
  unchangedCount: number;
}

export interface FinanceExcelManifestCheckDto {
  ok: boolean;
  issues: string[];
}

/** `POST /import/preview` response (`FinanceImportPreviewResult`) — read-only, no write happens here. */
export interface FinanceImportPreviewDto {
  ok: boolean;
  manifestCheck: FinanceExcelManifestCheckDto;
  diff: FinanceImportDiffDto;
  rowErrors: FinanceImportRowErrorDto[];
  totalRows: number;
}

/** `POST /import/apply` success shape (`export-import.routes.ts:216-226`) — one transactional `Operation.batch`, all-or-nothing (never partial). */
export interface FinanceImportApplyResultDto {
  businessVersionId: string;
  newWorkingRevisionId: string;
  newRevisionSeq: number;
  appliedCount: { added: number; changed: number; cleared: number };
  idempotentReplay: boolean;
  reopened: boolean;
}

export type FinanceImportApplyErrorCodeDto =
  | 'NOT_FOUND'
  | 'MANIFEST_MISMATCH'
  | 'STATE_PRECONDITION_FAILED'
  | 'WORKING_REVISION_CONFLICT'
  | 'VALIDATION_FAILED'
  | 'REOPEN_FAILED';
// --- /AP-CLIENT ExportImport ---

// --- AP-CLIENT LineageNavigator ---
// Port of `lineageNavigatorContract.ts` (AP-11) presentation shapes, as returned VERBATIM by
// `lineage-navigator.routes.ts`'s `GET /versions/:businessVersionId/lineage-navigator`.
// `WorkspaceBarLabel` ({key, pl}) is reused as-is — always render `.pl`, never `.key` (enum-leak
// rule: the PL text is already server-authored, so the client never needs its own switch/case for
// these labels the way it does for raw enum tokens like `CompareDiffKindDto`).
// ---------------------------------------------------------------------------

export interface FinanceLabelDto {
  key: string;
  pl: string;
}

/** `lineageNavigatorContract.ts` `LineageNodeMetadata` — everything the trail/panel shows about one business version. */
export interface LineageNodeMetadataDto {
  versionId: string;
  artifactId: string;
  artifactType: FinanceArtifactType;
  name: string;
  versionLabel: string;
  periodLabel: string | null;
  status: BusinessVersionStatus;
  freshness: FinanceArtifactFreshness;
  variantLabel: string | null;
}

export type LineageStaleBadgeKindDto =
  | 'SOURCE_CHANGED'
  | 'ASSUMPTIONS_CHANGED'
  | 'DOWNSTREAM_STALE'
  | 'ORPHANED'
  | 'NEVER_COMPUTED'
  | 'COMPUTE_FAILED'
  | 'ARCHIVED'
  | 'SUPERSEDED'
  | 'INVALIDATED';

export interface LineageStaleBadgeDto {
  kind: LineageStaleBadgeKindDto;
  label: FinanceLabelDto;
  severity: 'info' | 'warning' | 'error';
}

export interface LineageTrailNodeDto {
  kind: 'node';
  metadata: LineageNodeMetadataDto;
  displayName: string;
  isFocus: boolean;
  outgoingEdgeType: string | null;
  staleBadge: LineageStaleBadgeDto | null;
  stateBadge: LineageStaleBadgeDto | null;
  isDimmed: boolean;
}

export interface LineageTrailCollapsedDto {
  kind: 'collapsed';
  hiddenCount: number;
  hiddenVersionIds: readonly string[];
}

export type LineageTrailItemDto = LineageTrailNodeDto | LineageTrailCollapsedDto;

/** Ordered ROOT → FOCUS — the reading order of `Statement pack v3 → Analysis v2 → Baseline v4 → Scenario Bull v2 → Valuation v1`. */
export interface LineageTrailDto {
  items: readonly LineageTrailItemDto[];
  totalNodeCount: number;
  hasAlternatePaths: boolean;
  unresolvedVersionIds: readonly string[];
  cycleVersionIds: readonly string[];
}

export interface LineageRelatedEntryDto {
  metadata: LineageNodeMetadataDto;
  displayName: string;
  edgeType: string;
  depth: number;
  staleBadge: LineageStaleBadgeDto | null;
  stateBadge: LineageStaleBadgeDto | null;
  isDimmed: boolean;
}

export interface LineageRelatedGroupDto {
  artifactType: FinanceArtifactType;
  count: number;
  entries: readonly LineageRelatedEntryDto[];
}

export interface LineageCreateNewActionDto {
  targetArtifactType: FinanceArtifactType;
  label: FinanceLabelDto;
  preselectedSource: {
    artifactId: string;
    artifactType: FinanceArtifactType;
    businessVersionId: string;
  };
}

/** "Powiązane" panel (OWN-FIN-007) — groups with counts + `+ Nowy` action per downstream type. */
export interface LineageRelatedPanelDto {
  focus: LineageNodeMetadataDto;
  parents: readonly LineageRelatedGroupDto[];
  indirectAncestors: readonly LineageRelatedGroupDto[];
  children: readonly LineageRelatedGroupDto[];
  indirectDescendants: readonly LineageRelatedGroupDto[];
  siblings: readonly LineageRelatedEntryDto[];
  createNew: readonly LineageCreateNewActionDto[];
  createNewBlockedReason: 'TERMINAL_SOURCE_STATUS' | 'NO_DOWNSTREAM_TYPE' | null;
  createNewBlockedLabel: FinanceLabelDto | null;
  focusBadges: readonly LineageStaleBadgeDto[];
  terminalVisibility: 'show' | 'dim' | 'hide';
  hiddenTerminalCount: number;
  cycleVersionIds: readonly string[];
}

/** `GET /versions/:businessVersionId/lineage-navigator` full response, under `data`. */
export interface FinanceLineageNavigatorDto {
  businessVersionId: string;
  trail: LineageTrailDto;
  relatedPanel: LineageRelatedPanelDto;
  fullGraphView: {
    id: string;
    label: FinanceLabelDto;
    auxiliary: boolean;
    defaultVisible: boolean;
  };
}

/** `POST /versions/lineage-edges` success shape (`lineage-navigator.routes.ts:268-283`). */
export interface FinanceLineageEdgeCreatedDto {
  edgeId: string;
  sourceVersionId: string;
  sourceArtifactType: FinanceArtifactType;
  targetVersionId: string;
  targetArtifactType: FinanceArtifactType;
  edgeType: string;
  transformationKind: string;
  assumptionSnapshotHash: string | null;
  authorId: string;
  createdAt: string;
}
// --- /AP-CLIENT LineageNavigator ---

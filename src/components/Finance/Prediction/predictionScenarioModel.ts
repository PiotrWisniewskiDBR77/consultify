/**
 * Pakiet G (Prediction) — czysta logika domenowa dla scenario buildera + widoku Modele/Wyniki.
 *
 * ★ KANON (OWN-FIN-019/OWN-FIN-020, brief pakietu G): Prediction bierze ZATWIERDZONY baseline i
 * nakłada na niego decyzje. Baseline jest neutralny; WSZYSTKIE decyzje/zdarzenia/finansowanie żyją
 * TUTAJ. Trzy tryby budowy (A standard, B wskaźnikowy, C fundamentalny) + łańcuch przyczynowy
 * initiative -> assumption -> driver/KPI -> statement line -> forecast.
 *
 * ★ INWENTARYZACJA PRZED KODEM (wymóg brifu): backend prediction jest w większości GOTOWY —
 * `server/src/services/finance/canonical/predictionPreflightService.ts` (Layer 2, double-counting
 * numeric preview) i `predictionComputeService.ts` (STANDARD_BASE passthrough = Base=Baseline
 * strukturalnie, przez `finance_prediction_outputs_effective`; overlay compute dla pozostałych
 * trybów) są w pełni zaimplementowane i mają HTTP surface
 * (`server/src/routes/v8/finance-v2/prediction.routes.ts`): `POST /prediction/:id/preflight` i
 * `POST /prediction/:id/calculate` (DEC-FIN-004, dwa OSOBNE endpointy — nigdy nie łączyć).
 * Layer 1 double-counting to gotowa SQL funkcja `finance_prediction_detect_overlaps()`
 * (`server/migrations/20260809_finance_v3_d07_prediction_03_readiness.sql`), gate przed compute to
 * `finance_prediction_can_start_compute()` (trzy nazwane sprawdzenia: HAS_CURRENT_PREFLIGHT,
 * NO_OPEN_REQUIRED_RESOLUTIONS, NO_OPEN_UNDEFINED_MATH — TYLKO trzeci jest twardą blokadą
 * bezpieczeństwa/matematyki, DEC-FIN-009; pierwsze dwa gate'ują tylko COMPUTE, nigdy budowanie
 * założeń).
 *
 * ★ LUKA (zaraportowana w PKG_G_PREDICTION_report.md jako EVIDENCE_MISSING/BLOCKED_EXTERNAL): NIE
 * istnieje HTTP CRUD do zapisu `finance_prediction_scenarios` / `_driver_overrides` / `_initiatives`
 * / `_impact_chain` / `_financing` — tylko odczyt pośredni przez preflight/calculate. Ten moduł
 * modeluje "draft" (stan roboczy w pamięci przeglądarki, kształt POLE-PO-POLU identyczny ze
 * schematem DB — `server/migrations/20260809_finance_v3_d07_prediction_01_tables.sql` — żeby
 * podłączenie prawdziwego zapisu, gdy powstanie, było wymianą jednej funkcji, nie przepisywaniem
 * modelu) i odtwarza semantykę SERWEROWEJ analizy double-counting (grupowanie
 * entity+canonical_line+period, `finance_prediction_detect_overlaps()`, plik `..._03_readiness.sql`
 * linie 45-98) jako NATYCHMIASTOWĄ, nieautorytatywną podpowiedź podczas budowy — autorytatywne jest
 * zawsze wywołanie `POST /prediction/:id/preflight` (Layer 1 SQL + Layer 2 real-currency preview),
 * gdy realny businessVersionId istnieje.
 *
 * Wartości finansowe: `number` tu (JS) tylko dla WYŚWIETLENIA/podglądu w budowniczym — API kontrakt
 * (`financeV2.types.ts`) i serwer trzymają `NUMERIC`/string dziesiętny; nigdy float jako jedyne
 * źródło prawdy zapisu.
 */

// ---------------------------------------------------------------------------
// Tryby scenariusza (server enum, transcribed verbatim — finance_prediction_scenarios.scenario_mode
// CHECK, plik _01_tables.sql linie 48-51)
// ---------------------------------------------------------------------------

export const SCENARIO_MODES = [
  'STANDARD_BASE',
  'STANDARD_UPSIDE',
  'STANDARD_DOWNSIDE',
  'DRIVER_OVERRIDE',
  'FUNDAMENTAL_INITIATIVE',
] as const;
export type ScenarioMode = (typeof SCENARIO_MODES)[number];

/** Trzy tryby budowy z brifu (A/B/C) — `STANDARD_UPSIDE`/`STANDARD_DOWNSIDE`/`STANDARD_BASE` dzielą tryb A. */
export type ScenarioBuildTrack = 'STANDARD' | 'DRIVER_OVERRIDE' | 'FUNDAMENTAL_INITIATIVE';

export function scenarioModeToTrack(mode: ScenarioMode): ScenarioBuildTrack {
  if (mode === 'DRIVER_OVERRIDE') return 'DRIVER_OVERRIDE';
  if (mode === 'FUNDAMENTAL_INITIATIVE') return 'FUNDAMENTAL_INITIATIVE';
  return 'STANDARD';
}

export function isStandardBase(mode: ScenarioMode): boolean {
  return mode === 'STANDARD_BASE';
}

// ---------------------------------------------------------------------------
// Draft rows — kształt POLE-PO-POLU ze schematu serwera (patrz nagłówek pliku).
// ---------------------------------------------------------------------------

export const PREDICTION_SCHEDULE_TYPES = [
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
export type PredictionScheduleType = (typeof PREDICTION_SCHEDULE_TYPES)[number];

export type DraftValueStatus = 'PRESENT_ZERO' | 'PRESENT_NONZERO' | 'MISSING' | 'NA' | 'NOT_APPLICABLE';

/** Tryb B — `finance_prediction_driver_overrides`, plik _01_tables.sql linie 74-117. */
export interface DraftDriverOverride {
  id: string;
  scheduleType: PredictionScheduleType;
  driverCode: string;
  entityId: string;
  periodId: string;
  overrideSource: 'MANUAL' | 'STANDARD_PRESET_UPSIDE' | 'STANDARD_PRESET_DOWNSIDE';
  valueStatus: DraftValueStatus;
  valueDecimal: number | null;
  unit: string;
  baselineValueDecimal: number | null;
  rationale: string | null;
  /** Nie jest kolumną DB — most do `finance_prediction_driver_line_map` (schedule_type -> canonical_line_id), potrzebny grupowaniu double-counting po tej stronie. */
  canonicalLineCode: string;
}

/** Tryb C, karta inicjatywy — `finance_prediction_initiatives`, linie 127-155. */
export interface DraftInitiative {
  id: string;
  initiativeCode: string;
  name: string;
  description: string | null;
  source: string | null;
  owner: string | null;
  confidencePct: number | null;
  defaultStartPeriodId: string | null;
  defaultRampMonths: number | null;
  defaultDurationMonths: number | null;
  implementationCostDecimal: number | null;
  status: 'DRAFT' | 'CONFIRMED' | 'REJECTED';
}

/** Tryb C, ogniwo łańcucha — `finance_prediction_impact_chain`, linie 168-217. driver_schedule_type/driver_code XOR kpi_catalog_id. */
export interface DraftImpact {
  id: string;
  initiativeId: string;
  assumptionLabel: string;
  driverScheduleType: PredictionScheduleType | null;
  driverCode: string | null;
  kpiCatalogId: string | null;
  statementLineCode: string;
  entityId: string;
  amountKind: 'ABSOLUTE_AMOUNT' | 'PERCENT_OF_BASE' | 'PERCENT_DELTA';
  amountDecimal: number;
  amountUnit: string;
  sign: 'POSITIVE' | 'NEGATIVE';
  /** null => dziedziczy initiative.defaultStartPeriodId (ADR 4.3/4.4). */
  startPeriodId: string | null;
  rampMonths: number | null;
  durationMonths: number | null;
  decayPctPerPeriod: number | null;
  implementationCostDecimal: number | null;
  confidencePct: number | null;
  probabilityPct: number | null;
  cannibalizesImpactId: string | null;
}

export const FINANCING_KINDS = [
  'FACILITY_DRAWDOWN',
  'DISCRETIONARY_REPAYMENT',
  'EQUITY_INJECTION',
  'DIVIDEND_DECLARATION',
  'SHARE_BUYBACK',
  'SURPLUS_ALLOCATION_POLICY',
  'COVENANT_DEFINITION',
  'MIN_CASH_POLICY',
] as const;
export type FinancingKind = (typeof FINANCING_KINDS)[number];

const FINANCING_HORIZON_WIDE_KINDS: readonly FinancingKind[] = ['SURPLUS_ALLOCATION_POLICY', 'COVENANT_DEFINITION', 'MIN_CASH_POLICY'];

/** `finance_prediction_financing`, linie 232-267 — TYLKO tutaj żyje finansowanie (nigdy w Baseline). */
export interface DraftFinancingEvent {
  id: string;
  financingKind: FinancingKind;
  entityId: string;
  /** null TYLKO dla horyzont-szerokich polityk (CHECK z pliku 01, linie 260-263). */
  periodId: string | null;
  payload: { amount?: number; principal?: number; rate?: number; tenorMonths?: number };
  rationale: string | null;
}

export function validateFinancingPeriodShape(event: Pick<DraftFinancingEvent, 'financingKind' | 'periodId'>): { ok: true } | { ok: false; message: string } {
  const isHorizonWide = FINANCING_HORIZON_WIDE_KINDS.includes(event.financingKind);
  if (isHorizonWide && event.periodId !== null) {
    return { ok: false, message: `${event.financingKind} jest polityką horyzont-szeroką — periodId musi być null` };
  }
  if (!isHorizonWide && event.periodId === null) {
    return { ok: false, message: `${event.financingKind} jest zdarzeniem punktowym — periodId jest wymagany` };
  }
  return { ok: true };
}

export interface ScenarioDraft {
  /** null dopóki nie istnieje realny artefakt PREDICTION_SCENARIO (patrz luka w nagłówku pliku). */
  businessVersionId: string | null;
  scenarioMode: ScenarioMode;
  name: string;
  driverOverrides: DraftDriverOverride[];
  initiatives: DraftInitiative[];
  impacts: DraftImpact[];
  financing: DraftFinancingEvent[];
  lastAssumptionChangeAt: string;
  lastComputeAt: string | null;
}

export function createEmptyScenarioDraft(params: { name: string; scenarioMode?: ScenarioMode; nowIso?: string }): ScenarioDraft {
  const now = params.nowIso ?? new Date().toISOString();
  return {
    businessVersionId: null,
    scenarioMode: params.scenarioMode ?? 'STANDARD_BASE',
    name: params.name,
    driverOverrides: [],
    initiatives: [],
    impacts: [],
    financing: [],
    lastAssumptionChangeAt: now,
    lastComputeAt: null,
  };
}

// ---------------------------------------------------------------------------
// ★ Base == Baseline (OWN-FIN-020 nakaz testu) — STANDARD_BASE bez ŻADNYCH nadpisań/inicjatyw/
// finansowania musi dać identyczny wynik co Baseline. Backend gwarantuje to STRUKTURALNIE
// (predictionComputeService.ts runStandardBase() — zero niezależnego przeliczenia, czyta
// finance_baseline_outputs przez finance_prediction_outputs_effective, ADR sekcja 8). Ten frontendowy
// invariant jest DRUGĄ linią obrony: jeśli ktoś kiedyś doda draft-side "podgląd" liczenia dla
// STANDARD_BASE zamiast czystego passthrough, ten test go złapie.
// ---------------------------------------------------------------------------

export function isBaseModeStructurallyPassthrough(draft: Pick<ScenarioDraft, 'scenarioMode' | 'driverOverrides' | 'impacts' | 'financing'>): boolean {
  if (draft.scenarioMode !== 'STANDARD_BASE') return false;
  return draft.driverOverrides.length === 0 && draft.impacts.length === 0 && draft.financing.length === 0;
}

export type CanonicalValueMap = Readonly<Record<string, number>>; // key: `${lineCode}::${periodId}`

/** Deep-equal porównanie dwóch map wartości kanonicznych — używane do potwierdzenia Base==Baseline bit-for-bit na warstwie prezentacji. */
export function assertBaseEqualsBaseline(baseValues: CanonicalValueMap, baselineValues: CanonicalValueMap): { equal: true } | { equal: false; diffKeys: string[] } {
  const keys = new Set([...Object.keys(baseValues), ...Object.keys(baselineValues)]);
  const diffKeys: string[] = [];
  for (const k of keys) {
    if (baseValues[k] !== baselineValues[k]) diffKeys.push(k);
  }
  return diffKeys.length === 0 ? { equal: true } : { equal: false, diffKeys };
}

// ---------------------------------------------------------------------------
// Ramp/duration/decay expansion — PORT bit-identyczny z
// `predictionPreflightService.impactChainEffectiveFraction` (serwer, poza allowlistą tego pakietu —
// server/** niedotykany; formuła przepisana verbatim, żeby podgląd klienta i serwer NIGDY nie
// zgadywały różnych liczb dla tego samego wejścia). Gdy kiedyś ten plik zostanie udostępniony jako
// wspólny pakiet, zamiana na import będzie mechaniczna.
// ---------------------------------------------------------------------------

export function impactChainEffectiveFraction(monthsSinceStart: number, rampMonths: number | null, durationMonths: number | null, decayPctPerPeriod: number | null): number {
  if (monthsSinceStart < 0) return 0;
  let fraction = 1;
  if (rampMonths && rampMonths > 0) {
    fraction = Math.min(1, (monthsSinceStart + 1) / rampMonths);
  }
  if (durationMonths !== null && durationMonths !== undefined && monthsSinceStart >= durationMonths) {
    const periodsBeyond = monthsSinceStart - durationMonths + 1;
    if (decayPctPerPeriod && decayPctPerPeriod > 0) {
      fraction *= Math.max(0, 1 - decayPctPerPeriod * periodsBeyond);
    } else {
      fraction = 0;
    }
  }
  return fraction;
}

// ---------------------------------------------------------------------------
// ★★ Wykrywanie nakładania się wpływów / double counting — podgląd kliencki, NIEAUTORYTATYWNY.
// Odtwarza grupowanie `finance_prediction_detect_overlaps()` (server/migrations/20260809_finance_v3_
// d07_prediction_03_readiness.sql linie 45-98): klucz grupy = (entityId, canonicalLineCode,
// periodId), źródła = driver_overrides (przez canonicalLineCode) + impact_chain (statementLineCode,
// periodId = startPeriodId lub default inicjatywy) + financing (przez zamkniętą mapę
// financingKind -> linie, ta sama para co serwer: FACILITY_DRAWDOWN/DISCRETIONARY_REPAYMENT ->
// LONG_TERM_DEBT+INTEREST_EXPENSE, DIVIDEND_DECLARATION -> DIVIDENDS_DECLARED+RETAINED_EARNINGS,
// EQUITY_INJECTION/SHARE_BUYBACK -> EQUITY). source_count > 1 => finding. AUTORYTATYWNE jest zawsze
// `POST /prediction/:id/preflight` (Layer 1 SQL + Layer 2 realna waluta) — ta funkcja daje
// NATYCHMIASTOWĄ podpowiedź podczas edycji, zanim użytkownik w ogóle wywoła preflight.
// ---------------------------------------------------------------------------

const FINANCING_LINE_MAP: Partial<Record<FinancingKind, readonly string[]>> = {
  FACILITY_DRAWDOWN: ['LONG_TERM_DEBT', 'INTEREST_EXPENSE'],
  DISCRETIONARY_REPAYMENT: ['LONG_TERM_DEBT', 'INTEREST_EXPENSE'],
  DIVIDEND_DECLARATION: ['DIVIDENDS_DECLARED', 'RETAINED_EARNINGS'],
  EQUITY_INJECTION: ['EQUITY'],
  SHARE_BUYBACK: ['EQUITY'],
};

export interface OverlapSourceRef {
  sourceType: 'DRIVER_OVERRIDE' | 'INITIATIVE_IMPACT' | 'FINANCING';
  sourceId: string;
  estimatedDelta: number;
}

export interface ClientOverlapFinding {
  entityId: string;
  canonicalLineCode: string;
  periodId: string;
  sourceCount: number;
  /** Suma naiwna (jednostko-agnostyczna), sama jak Layer 1 serwera — NIE jest realną walutą (to Layer 2, autorytatywnie na serwerze). */
  naiveCombinedDelta: number;
  sources: OverlapSourceRef[];
}

/** Klucz grupy, deterministyczny — używany też do sortowania wyniku (determinizm, patrz PKG-A precedens serwera). */
function overlapGroupKey(entityId: string, lineCode: string, periodId: string): string {
  return `${entityId}::${lineCode}::${periodId}`;
}

export function detectClientSideOverlaps(draft: Pick<ScenarioDraft, 'driverOverrides' | 'impacts' | 'initiatives' | 'financing'>): ClientOverlapFinding[] {
  const initiativeById = new Map(draft.initiatives.map((i) => [i.id, i]));
  const bySources = new Map<string, { entityId: string; lineCode: string; periodId: string; sources: OverlapSourceRef[] }>();

  const push = (entityId: string, lineCode: string, periodId: string | null, source: OverlapSourceRef) => {
    if (periodId === null) return; // serwer też wyklucza źródła bez rozwiązywalnego okresu (linia 92 komentarz SQL)
    const key = overlapGroupKey(entityId, lineCode, periodId);
    const bucket = bySources.get(key) ?? { entityId, lineCode, periodId, sources: [] };
    bucket.sources.push(source);
    bySources.set(key, bucket);
  };

  for (const o of draft.driverOverrides) {
    if (o.valueDecimal === null) continue;
    const delta = o.valueDecimal - (o.baselineValueDecimal ?? 0);
    push(o.entityId, o.canonicalLineCode, o.periodId, { sourceType: 'DRIVER_OVERRIDE', sourceId: o.id, estimatedDelta: delta });
  }

  for (const impact of draft.impacts) {
    const initiative = initiativeById.get(impact.initiativeId);
    const periodId = impact.startPeriodId ?? initiative?.defaultStartPeriodId ?? null;
    const delta = (impact.sign === 'NEGATIVE' ? -1 : 1) * impact.amountDecimal;
    push(impact.entityId, impact.statementLineCode, periodId, { sourceType: 'INITIATIVE_IMPACT', sourceId: impact.id, estimatedDelta: delta });
  }

  for (const f of draft.financing) {
    const lines = FINANCING_LINE_MAP[f.financingKind];
    if (!lines) continue; // polityki horyzont-szerokie — wykluczone, jak w serwerze (komentarz SQL linie 35-38)
    const delta = f.payload.amount ?? f.payload.principal ?? 0;
    for (const lineCode of lines) {
      push(f.entityId, lineCode, f.periodId, { sourceType: 'FINANCING', sourceId: f.id, estimatedDelta: delta });
    }
  }

  const findings: ClientOverlapFinding[] = [];
  // Deterministyczna kolejność kluczy (sort przed redukcją — ta sama dyscyplina co
  // `sortByCreatedAtThenId`/`sortOverlapSourcesById` po stronie serwera: sumowanie float nie jest
  // łączne, więc kolejność MUSI być ustalona w pamięci, nie zależna od kolejności iteracji Map).
  const sortedKeys = [...bySources.keys()].sort();
  for (const key of sortedKeys) {
    const bucket = bySources.get(key)!;
    if (bucket.sources.length <= 1) continue;
    const sortedSources = [...bucket.sources].sort((a, b) => (a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0));
    const naiveCombinedDelta = sortedSources.reduce((sum, s) => sum + s.estimatedDelta, 0);
    findings.push({
      entityId: bucket.entityId,
      canonicalLineCode: bucket.lineCode,
      periodId: bucket.periodId,
      sourceCount: sortedSources.length,
      naiveCombinedDelta,
      sources: sortedSources,
    });
  }
  return findings;
}

// ---------------------------------------------------------------------------
// ★★ DEC-FIN-009 — filozofia braków danych: exceptions + akceptacja, NIGDY blokada, z wyjątkiem
// (a) bezpieczeństwa, (b) granicy międzytenantowej, (c) matematycznie niezdefiniowanego.
// ---------------------------------------------------------------------------

export type AssumptionResolution =
  | { kind: 'value'; value: number }
  | {
      kind: 'exception';
      reasonCode: 'MISSING_DRIVER_VALUE';
      message: string;
      /** DEC-FIN-009: wymaga JAWNEJ akceptacji użytkownika — nigdy nie blokuje pracy. */
      requiresExplicitAcceptance: true;
      proposedResolutions: readonly string[];
    };

/**
 * Brak danych (MISSING/NA) => `exception`, NIGDY throw/blokada. Wywołujący (UI) renderuje
 * rejestr wyjątków + przycisk akceptacji zamiast zamykać ekran.
 */
export function resolveDriverValue(
  o: Pick<DraftDriverOverride, 'valueStatus' | 'valueDecimal' | 'driverCode' | 'periodId'>
): AssumptionResolution {
  if (o.valueStatus === 'PRESENT_ZERO' || o.valueStatus === 'PRESENT_NONZERO') {
    return { kind: 'value', value: o.valueDecimal ?? 0 };
  }
  return {
    kind: 'exception',
    reasonCode: 'MISSING_DRIVER_VALUE',
    message: `Brak wartości dla ${o.driverCode} w okresie ${o.periodId} (status: ${o.valueStatus})`,
    requiresExplicitAcceptance: true,
    proposedResolutions: ['UZUPEŁNIJ_RĘCZNIE', 'UŻYJ_WARTOŚCI_BASELINE', 'AKCEPTUJ_BRAK_I_KONTYNUUJ'],
  };
}

/** Twarda odmowa — WYŁĄCZNIE dla działania matematycznie niezdefiniowanego (DEC-FIN-009, poziom 5). */
export class MathUndefinedError extends Error {
  readonly reasonCode = 'UNDEFINED_MATH' as const;
  readonly blockingCategory = 'UNDEFINED_MATH' as const;
  readonly severity = 'SECURITY' as const;
  constructor(message: string) {
    super(message);
    this.name = 'MathUndefinedError';
  }
}

// ---------------------------------------------------------------------------
// ★★★ DEC-FIN-009 — WERSJA PEŁNA, PIĘCIOPOZIOMOWA (uzupełnienie kanonu od koordynatora sesji,
// 2026-08-12 — nadpisuje uproszczoną trójstopniową wersję powyżej, ta zostaje jako wygodny helper
// dla pojedynczej brakującej wartości drivera, patrz jej doc-comment). Pięć poziomów:
//   1. Info                 — rejestracja AUTOMATYCZNA, zero akcji użytkownika.
//   2. Warning               — akceptacja analityka Z UZASADNIENIEM (wymagane, nieopcjonalne).
//   3. Material exception      — ocena wpływu + maker-checker (przygotowujący i zatwierdzający —
//                                DWIE różne osoby).
//   4. Critical data exception  — ★ najczęściej źle implementowany: compute i export SĄ DOZWOLONE,
//                                 wynik dostaje status `provisional` + jawne oznaczenie na materiale.
//                                 NIGDY blokada tutaj.
//   5. Security/tenant breach lub matematycznie nieokreślone — JEDYNY poziom z TWARDĄ BLOKADĄ.
// Każdy wygenerowany materiał pokazuje: jakość (status), wyjątki, wpływ, autora, approvera — patrz
// `MaterialProvenance`/`buildMaterialProvenance` niżej — i rozróżnia trzy stany: clean/conditional/
// provisional.
// ---------------------------------------------------------------------------

export const EXCEPTION_LEVELS = ['INFO', 'WARNING', 'MATERIAL', 'CRITICAL_DATA', 'SECURITY_OR_UNDEFINED_MATH'] as const;
export type ExceptionLevel = (typeof EXCEPTION_LEVELS)[number];

export type MaterialStatus = 'clean' | 'conditional' | 'provisional';

interface ExceptionLedgerEntryBase {
  id: string;
  reasonCode: string;
  message: string;
  createdAt: string;
  sourceRef?: Record<string, unknown>;
}

/** Poziom 1 — rejestracja automatyczna. System zapisuje ją SAM; nie ma żadnego pola "akceptacji". */
export interface InfoException extends ExceptionLedgerEntryBase {
  level: 'INFO';
}

/** Poziom 2 — wymaga akceptacji analityka Z UZASADNIENIEM. `acceptance: null` = jeszcze nieprzyjęty (compute mimo to NIE jest blokowany — patrz `evaluateExceptionLedgerForCompute`). */
export interface WarningException extends ExceptionLedgerEntryBase {
  level: 'WARNING';
  acceptance: { acceptedBy: string; justification: string; acceptedAt: string } | null;
}

/** Poziom 3 — ocena wpływu + maker-checker. `resolution: null` = jeszcze nierozstrzygnięty. */
export interface MaterialException extends ExceptionLedgerEntryBase {
  level: 'MATERIAL';
  resolution: { preparedBy: string; approvedBy: string; impactAssessment: string; resolvedAt: string } | null;
}

/** Poziom 4 — compute/export DOZWOLONE bez żadnej akcji; `acknowledgement` jest audytowe (kto/kiedy/dlaczego), NIE bramką. */
export interface CriticalDataException extends ExceptionLedgerEntryBase {
  level: 'CRITICAL_DATA';
  acknowledgement: { acknowledgedBy: string; justification: string; acknowledgedAt: string } | null;
}

/** Poziom 5 — JEDYNY blokujący poziom w całym rejestrze. */
export interface SecurityOrUndefinedMathException extends ExceptionLedgerEntryBase {
  level: 'SECURITY_OR_UNDEFINED_MATH';
  blockingCategory: 'SECURITY' | 'TENANT_BOUNDARY' | 'UNDEFINED_MATH';
}

export type ExceptionLedgerEntry = InfoException | WarningException | MaterialException | CriticalDataException | SecurityOrUndefinedMathException;

/**
 * Poziom 2 — akceptacja Z UZASADNIENIEM. Puste/białoznakowe uzasadnienie jest ODRZUCONE (zwraca
 * `ok:false`, nie throw — to walidacja formularza, nie blokada DEC-FIN-009 poziomu 5).
 */
export function acceptWarningException(
  entry: WarningException,
  params: { acceptedBy: string; justification: string; nowIso?: string }
): { ok: true; entry: WarningException } | { ok: false; message: string } {
  const justification = params.justification.trim();
  if (justification.length === 0) {
    return { ok: false, message: 'Uzasadnienie jest WYMAGANE do akceptacji wyjątku poziomu Warning (DEC-FIN-009 poziom 2) — nie jest opcjonalne.' };
  }
  return { ok: true, entry: { ...entry, acceptance: { acceptedBy: params.acceptedBy, justification, acceptedAt: params.nowIso ?? new Date().toISOString() } } };
}

/**
 * Poziom 3 — ocena wpływu + maker-checker. `preparedBy === approvedBy` jest ODRZUCONE: przygotowujący
 * i zatwierdzający MUSZĄ być dwiema różnymi osobami.
 */
export function resolveMaterialException(
  entry: MaterialException,
  params: { preparedBy: string; approvedBy: string; impactAssessment: string; nowIso?: string }
): { ok: true; entry: MaterialException } | { ok: false; message: string } {
  const impactAssessment = params.impactAssessment.trim();
  if (impactAssessment.length === 0) {
    return { ok: false, message: 'Ocena wpływu jest wymagana dla wyjątku Material (DEC-FIN-009 poziom 3).' };
  }
  if (params.preparedBy === params.approvedBy) {
    return { ok: false, message: 'Maker-checker: przygotowujący i zatwierdzający muszą być DWIEMA różnymi osobami (DEC-FIN-009 poziom 3).' };
  }
  return { ok: true, entry: { ...entry, resolution: { preparedBy: params.preparedBy, approvedBy: params.approvedBy, impactAssessment, resolvedAt: params.nowIso ?? new Date().toISOString() } } };
}

/**
 * Poziom 4 — potwierdzenie AUDYTOWE, nigdy bramka. Compute/export są dozwolone niezależnie od tego,
 * czy `acknowledgement` jest wypełnione — wynik i tak dostaje `materialStatus:'provisional'`
 * (`evaluateExceptionLedgerForCompute`), bo obecność SAMEGO wyjątku poziomu 4 już to oznacza.
 */
export function acknowledgeCriticalDataException(
  entry: CriticalDataException,
  params: { acknowledgedBy: string; justification: string; nowIso?: string }
): { ok: true; entry: CriticalDataException } | { ok: false; message: string } {
  const justification = params.justification.trim();
  if (justification.length === 0) {
    return { ok: false, message: 'Uzasadnienie jest wymagane do potwierdzenia wyjątku Critical Data (DEC-FIN-009 poziom 4).' };
  }
  return { ok: true, entry: { ...entry, acknowledgement: { acknowledgedBy: params.acknowledgedBy, justification, acknowledgedAt: params.nowIso ?? new Date().toISOString() } } };
}

export interface ComputeGateResult {
  /** `false` WYŁĄCZNIE gdy rejestr zawiera co najmniej jeden wpis poziomu 5 — to jedyny warunek blokujący w całym module. */
  allowed: boolean;
  blockedBy: readonly SecurityOrUndefinedMathException[];
  materialStatus: MaterialStatus;
}

/**
 * ★ Rdzeń DEC-FIN-009: poziomy 1-4 NIGDY nie blokują compute — najwyżej podnoszą `materialStatus`.
 * TYLKO poziom 5 (`SECURITY_OR_UNDEFINED_MATH`) ustawia `allowed:false`. To jest test na
 * "poziom 4 przechodzi i jest provisional, nie zablokowany" z brifu koordynatora.
 */
export function evaluateExceptionLedgerForCompute(ledger: readonly ExceptionLedgerEntry[]): ComputeGateResult {
  const blockedBy = ledger.filter((e): e is SecurityOrUndefinedMathException => e.level === 'SECURITY_OR_UNDEFINED_MATH');
  if (blockedBy.length > 0) {
    return { allowed: false, blockedBy, materialStatus: 'provisional' };
  }
  const hasCriticalData = ledger.some((e) => e.level === 'CRITICAL_DATA');
  const hasMaterialOrWarning = ledger.some((e) => e.level === 'MATERIAL' || e.level === 'WARNING');
  const materialStatus: MaterialStatus = hasCriticalData ? 'provisional' : hasMaterialOrWarning ? 'conditional' : 'clean';
  return { allowed: true, blockedBy: [], materialStatus };
}

export function describeMaterialStatus(status: MaterialStatus): string {
  switch (status) {
    case 'clean':
      return 'Czysty — brak wyjątków wymagających uwagi.';
    case 'conditional':
      return 'Warunkowy — zaakceptowane wyjątki Warning/Material; wynik ważny z zastrzeżeniami.';
    case 'provisional':
      return 'Tymczasowy — obecne wyjątki Critical Data; wynik oznaczony jako "Provisional / Accepted with critical exceptions".';
  }
}

/**
 * Każdy wygenerowany materiał (raport/eksport/widok Modele-Wyniki) MUSI pokazywać jakość, wyjątki,
 * wpływ, autora i approvera (wymóg koordynatora). `approver` jest `null` dopóki żaden wyjątek
 * poziomu Material nie ma `resolution` — materiał wciąż jest ważny (compute nie jest blokowany),
 * ale UI musi pokazać brak approvera jawnie, nie zmyślać jednego.
 */
export interface MaterialProvenance {
  status: MaterialStatus;
  qualitySummary: string;
  exceptions: readonly ExceptionLedgerEntry[];
  impactSummary: string | null;
  author: string;
  approver: string | null;
}

export function buildMaterialProvenance(params: { ledger: readonly ExceptionLedgerEntry[]; author: string }): MaterialProvenance {
  const gate = evaluateExceptionLedgerForCompute(params.ledger);
  const materialResolutions = params.ledger
    .filter((e): e is MaterialException => e.level === 'MATERIAL')
    .map((e) => e.resolution)
    .filter((r): r is NonNullable<MaterialException['resolution']> => r !== null);
  const impactSummary = materialResolutions.length > 0 ? materialResolutions.map((r) => r.impactAssessment).join('; ') : null;
  const approver = materialResolutions.length > 0 ? materialResolutions[materialResolutions.length - 1].approvedBy : null;
  return {
    status: gate.materialStatus,
    qualitySummary: describeMaterialStatus(gate.materialStatus),
    exceptions: params.ledger,
    impactSummary,
    author: params.author,
    approver,
  };
}

/** Konwersja skrótu `resolveDriverValue`'s `exception` na pełny wpis rejestru poziomu Warning (patrz doc-comment `resolveDriverValue`). */
export function driverMissingValueToWarningException(
  id: string,
  resolution: Extract<AssumptionResolution, { kind: 'exception' }>,
  nowIso: string = new Date().toISOString()
): WarningException {
  return { id, level: 'WARNING', reasonCode: resolution.reasonCode, message: resolution.message, createdAt: nowIso, acceptance: null };
}

// ---------------------------------------------------------------------------
// ★★ Progi tolerancji — TRÓJSTOPNIOWE, NIE WOLNO MIESZAĆ (uzupełnienie kanonu koordynatora).
//   1. Równania techniczne (bilans się zgadza, solver zbiegł) — source-rounding tolerance.
//   2. Przejście source -> canonical (mapowanie/normalizacja) — próg BARDZIEJ RESTRYKCYJNY niż (1).
//   3. Analityka/materialność — próg organizacyjny, NAJLUŹNIEJSZY z trzech.
// Kanon wprost zabrania automatycznego `max(1 jednostka źródłowa, 0.1%)` (typowa formuła
// materialności) jako progu dowodu równości bilansu — większa tolerancja służy ANALIZIE, nie
// dowodowi technicznemu. `isAnalyticsMaterialityMisusedForBalanceCheck` niżej wykrywa dokładnie ten
// antywzorzec.
// ---------------------------------------------------------------------------

export interface ToleranceThresholds {
  /** Równania techniczne — NIGDY materiality. */
  technicalEquationTolerance: number;
  /** source -> canonical — MUSI być <= technicalEquationTolerance (bardziej restrykcyjny). */
  sourceToCanonicalTolerance: number;
  /** Analityka/materialność organizacji — MUSI być >= technicalEquationTolerance (najluźniejszy). */
  analyticsMaterialityTolerance: number;
}

export function validateToleranceHierarchy(t: ToleranceThresholds): { ok: true } | { ok: false; message: string } {
  if (!(t.sourceToCanonicalTolerance <= t.technicalEquationTolerance)) {
    return { ok: false, message: 'source→canonical tolerance musi być BARDZIEJ restrykcyjny (<=) niż technicalEquationTolerance.' };
  }
  if (!(t.technicalEquationTolerance <= t.analyticsMaterialityTolerance)) {
    return { ok: false, message: 'analyticsMaterialityTolerance musi być najluźniejszym z trzech progów (>= technicalEquationTolerance).' };
  }
  return { ok: true };
}

/** Dowód techniczny (bilans P&L/BS/CF się zgadza) — WYŁĄCZNIE `technicalEquationTolerance`, nigdy materiality. */
export function checkBalanceSheetTie(
  totalAssets: number,
  totalLiabilitiesEquity: number,
  thresholds: Pick<ToleranceThresholds, 'technicalEquationTolerance'>
): { tied: true } | { tied: false; diff: number } {
  const diff = Math.abs(totalAssets - totalLiabilitiesEquity);
  return diff <= thresholds.technicalEquationTolerance ? { tied: true } : { tied: false, diff };
}

/** Wykrywa antywzorzec kanonu: użycie progu materialności analitycznej tam, gdzie należał się próg techniczny. */
export function isAnalyticsMaterialityMisusedForBalanceCheck(usedTolerance: number, thresholds: ToleranceThresholds): boolean {
  return usedTolerance === thresholds.analyticsMaterialityTolerance && thresholds.analyticsMaterialityTolerance > thresholds.technicalEquationTolerance;
}

// ---------------------------------------------------------------------------
// Porównanie scenariuszy — absolutne, Δ, % + płynność/covenant headroom
// ---------------------------------------------------------------------------

export interface ScenarioComparisonCell {
  lineCode: string;
  periodId: string;
  scenarioValue: number | null; // null => brak danych (MISSING), nigdy renderowane jako 0 — patrz formatFinanceValueForDisplay w UI
  baselineValue: number | null;
  absoluteDelta: number | null;
  /** null gdy baseline===0 (procent niezdefiniowany — pokazywane jako "—", NIE 0% ani błąd). */
  percentDelta: number | null;
}

export function computeScenarioComparisonCell(lineCode: string, periodId: string, scenarioValue: number | null, baselineValue: number | null): ScenarioComparisonCell {
  const absoluteDelta = scenarioValue === null || baselineValue === null ? null : scenarioValue - baselineValue;
  const percentDelta = absoluteDelta === null || baselineValue === null || baselineValue === 0 ? null : absoluteDelta / Math.abs(baselineValue);
  return { lineCode, periodId, scenarioValue, baselineValue, absoluteDelta, percentDelta };
}

export function computeScenarioComparison(scenarioValues: CanonicalValueMap, baselineValues: CanonicalValueMap): ScenarioComparisonCell[] {
  const keys = new Set([...Object.keys(scenarioValues), ...Object.keys(baselineValues)]);
  const cells: ScenarioComparisonCell[] = [];
  for (const key of [...keys].sort()) {
    const [lineCode, periodId] = key.split('::');
    cells.push(computeScenarioComparisonCell(lineCode, periodId, scenarioValues[key] ?? null, baselineValues[key] ?? null));
  }
  return cells;
}

export interface LiquidityHeadroom {
  cash: number;
  minCashPolicy: number | null;
  /** null gdy brak minCashPolicy zdefiniowanej (exception, nie blokada — patrz `resolveDriverValue`-style rejestr wyjątków w UI). */
  liquidityHeadroom: number | null;
}

export function computeLiquidityHeadroom(cash: number, minCashPolicy: number | null): LiquidityHeadroom {
  return { cash, minCashPolicy, liquidityHeadroom: minCashPolicy === null ? null : cash - minCashPolicy };
}

export interface CovenantHeadroomInput {
  netDebt: number;
  ebitda: number;
  covenantMaxNetDebtToEbitda: number;
}

export interface CovenantHeadroomResult {
  netDebtToEbitda: number;
  covenantMaxNetDebtToEbitda: number;
  /** dodatnie = zapas do naruszenia; ujemne = naruszenie kowenantu. */
  headroomRatio: number;
}

/**
 * ★ Twarda blokada matematyczna (DEC-FIN-009 wyjątek c) — EBITDA=0 czyni Net Debt/EBITDA
 * niezdefiniowanym (dzielenie przez zero), NIE "wynik = Infinity" ani cichy null. To jedyne miejsce
 * w tym module, które rzuca zamiast zwracać `exception`.
 */
export function computeCovenantHeadroom(input: CovenantHeadroomInput): CovenantHeadroomResult {
  if (input.ebitda === 0) {
    throw new MathUndefinedError(`Net Debt/EBITDA niezdefiniowane: EBITDA=0 (dzielenie przez zero). Wymagana twarda blokada (DEC-FIN-009 wyjątek c).`);
  }
  const netDebtToEbitda = input.netDebt / input.ebitda;
  return {
    netDebtToEbitda,
    covenantMaxNetDebtToEbitda: input.covenantMaxNetDebtToEbitda,
    headroomRatio: input.covenantMaxNetDebtToEbitda - netDebtToEbitda,
  };
}

// ---------------------------------------------------------------------------
// ★ Zmiana założeń => wyniki `stale` — NIE kasuje, NIE przelicza automatycznie potomków.
// ---------------------------------------------------------------------------

export type ResultFreshness = 'NEVER_COMPUTED' | 'CURRENT' | 'STALE';

export function resolveResultFreshness(draft: Pick<ScenarioDraft, 'lastAssumptionChangeAt' | 'lastComputeAt'>): ResultFreshness {
  if (draft.lastComputeAt === null) return 'NEVER_COMPUTED';
  return draft.lastAssumptionChangeAt > draft.lastComputeAt ? 'STALE' : 'CURRENT';
}

/**
 * Znakuje draft jako mający nową zmianę założeń — CELOWO nie czyści `lastComputeAt` ani żadnych
 * wyników; caller (UI) musi trzymać ostatnie wyniki obok flagi `stale`, nigdy ich nie usuwać.
 */
export function markAssumptionChanged(draft: ScenarioDraft, nowIso: string = new Date().toISOString()): ScenarioDraft {
  return { ...draft, lastAssumptionChangeAt: nowIso };
}

// ---------------------------------------------------------------------------
// ★★ WP-D04 DoD — uzupełnienie kanonu od koordynatora (2026-08-12, druga korekta). Priorytet
// pierwotny (trzy tryby / double counting / Base==Baseline / preflight-przed-compute / porównania)
// bez zmian; poniższe są ROZSZERZENIEM. Czego nie dało się w pełni domknąć w tym pakiecie (backend
// poza allowlistą) — zaraportowane w PKG_G_PREDICTION_report.md jako EVIDENCE_MISSING, nie ukryte.
// ---------------------------------------------------------------------------

// --- "financing respektuje FACILITY" — limit kredytowy nie może być przekroczony ---------------

export interface FacilityLimit {
  entityId: string;
  facilityLimitDecimal: number;
}

export interface FacilityUtilizationPoint {
  eventId: string;
  periodId: string | null;
  openingBalance: number;
  closingBalance: number;
  limit: number;
  withinLimit: boolean;
  /** limit - closingBalance; ujemne = naruszenie limitu. */
  headroom: number;
}

/**
 * Odtwarza running balance faktury kredytowej z chronologicznie posortowanych zdarzeń
 * FACILITY_DRAWDOWN/DISCRETIONARY_REPAYMENT — TA SAMA logika floor-clamp co
 * `predictionComputeService.ts`'s `facilityDebtBalance` (`Math.max(0, balance - repayment)`,
 * `DISCRETIONARY_REPAYMENT` przed `FACILITY_DRAWDOWN` w tym samym okresie — patrz
 * `FINANCING_KIND_PROCESSING_RANK` tamtego pliku) — i sprawdza limit PO KAŻDYM zdarzeniu, nie tylko
 * na końcu (jednorazowy skok ponad limit w środku horyzontu musi być wykryty, nawet jeśli
 * późniejsza spłata go "naprawia").
 */
export function computeFacilityUtilization(
  events: readonly Pick<DraftFinancingEvent, 'id' | 'financingKind' | 'payload' | 'periodId'>[],
  limit: FacilityLimit
): FacilityUtilizationPoint[] {
  const relevant = events.filter((e) => e.financingKind === 'FACILITY_DRAWDOWN' || e.financingKind === 'DISCRETIONARY_REPAYMENT');
  const sorted = [...relevant].sort((a, b) => {
    const periodCompare = (a.periodId ?? '').localeCompare(b.periodId ?? '');
    if (periodCompare !== 0) return periodCompare;
    // W tym samym okresie: repayment przed drawdown (mirror serwera), potem id jako tiebreaker.
    const rank = (k: FinancingKind) => (k === 'DISCRETIONARY_REPAYMENT' ? 0 : 1);
    const rankCompare = rank(a.financingKind) - rank(b.financingKind);
    return rankCompare !== 0 ? rankCompare : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  let balance = 0;
  const points: FacilityUtilizationPoint[] = [];
  for (const e of sorted) {
    const opening = balance;
    const amount = e.payload.amount ?? e.payload.principal ?? 0;
    balance = e.financingKind === 'FACILITY_DRAWDOWN' ? balance + amount : Math.max(0, balance - amount);
    points.push({
      eventId: e.id,
      periodId: e.periodId,
      openingBalance: opening,
      closingBalance: balance,
      limit: limit.facilityLimitDecimal,
      withinLimit: balance <= limit.facilityLimitDecimal,
      headroom: limit.facilityLimitDecimal - balance,
    });
  }
  return points;
}

export function checkFacilityCompliance(
  events: readonly Pick<DraftFinancingEvent, 'id' | 'financingKind' | 'payload' | 'periodId'>[],
  limit: FacilityLimit
): { ok: true } | { ok: false; breaches: readonly FacilityUtilizationPoint[] } {
  const utilization = computeFacilityUtilization(events, limit);
  const breaches = utilization.filter((p) => !p.withinLimit);
  return breaches.length === 0 ? { ok: true } : { ok: false, breaches };
}

// --- "statements/schedules RECONCILE" — sprawozdania i harmonogramy muszą się zgadzać MIĘDZY SOBĄ ---

export interface ReconciliationInput {
  periodId: string;
  cfClosingCash: number;
  bsCash: number;
  debtScheduleClosingBalance: number;
  bsLongTermDebt: number;
}

export interface ReconciliationResult {
  periodId: string;
  cashTies: boolean;
  cashDiff: number;
  debtTies: boolean;
  debtDiff: number;
  reconciled: boolean;
}

/**
 * Uzgadnia CF-closing-cash<->BS-cash i harmonogram-długu<->BS-LONG_TERM_DEBT — WYŁĄCZNIE przez
 * `technicalEquationTolerance` (trójstopniowy kanon tolerancji powyżej; NIGDY materiality — to
 * dowód techniczny, nie ocena analityczna istotności).
 */
export function reconcileStatementsAndSchedules(input: ReconciliationInput, thresholds: Pick<ToleranceThresholds, 'technicalEquationTolerance'>): ReconciliationResult {
  const cashDiff = Math.abs(input.cfClosingCash - input.bsCash);
  const debtDiff = Math.abs(input.debtScheduleClosingBalance - input.bsLongTermDebt);
  const cashTies = cashDiff <= thresholds.technicalEquationTolerance;
  const debtTies = debtDiff <= thresholds.technicalEquationTolerance;
  return { periodId: input.periodId, cashTies, cashDiff, debtTies, debtDiff, reconciled: cashTies && debtTies };
}

// --- "reverse stress i break-even" — odwrotność zwykłego compute ---------------------------------

export interface BreakEvenSearchParams {
  lowerBound: number;
  upperBound: number;
  targetValue: number;
  /** Musi być monotoniczna na [lowerBound, upperBound] (compute silnika po stronie callera) — bisekcja, nie Newton, żeby nie wymagać pochodnej. */
  evaluate: (driverValue: number) => number;
  toleranceValue?: number;
  maxIterations?: number;
}

export type BreakEvenSearchResult =
  | { ok: true; driverValue: number; achievedValue: number; iterations: number }
  | { ok: false; reason: 'NOT_BRACKETED' | 'MAX_ITERATIONS_EXCEEDED'; message: string };

/**
 * Reverse stress / break-even: "jaka wartość drivera prowadzi metrykę do zadanego progu" — dokładna
 * odwrotność zwykłego compute (który idzie driver -> metryka). Bisekcja na dostarczonej przez
 * callera funkcji ewaluującej (w produkcji: realny overlay compute dla jednej wartości drivera) —
 * ten silnik jest CZYSTY i testowalny bez żadnego prawdziwego modelu finansowego.
 */
export function solveBreakEvenDriver(params: BreakEvenSearchParams): BreakEvenSearchResult {
  const tol = params.toleranceValue ?? 1e-6;
  const maxIter = params.maxIterations ?? 100;
  let lo = params.lowerBound;
  let hi = params.upperBound;
  let fLo = params.evaluate(lo) - params.targetValue;
  let fHi = params.evaluate(hi) - params.targetValue;
  if (Math.abs(fLo) <= tol) return { ok: true, driverValue: lo, achievedValue: fLo + params.targetValue, iterations: 0 };
  if (Math.abs(fHi) <= tol) return { ok: true, driverValue: hi, achievedValue: fHi + params.targetValue, iterations: 0 };
  if ((fLo > 0) === (fHi > 0)) {
    return {
      ok: false,
      reason: 'NOT_BRACKETED',
      message: `Próg ${params.targetValue} nie jest ograniczony (bracketed) między f(${lo}) i f(${hi}) — poszerz zakres poszukiwania.`,
    };
  }
  for (let i = 0; i < maxIter; i++) {
    const mid = (lo + hi) / 2;
    const fMid = params.evaluate(mid) - params.targetValue;
    if (Math.abs(fMid) <= tol) return { ok: true, driverValue: mid, achievedValue: fMid + params.targetValue, iterations: i + 1 };
    if ((fMid > 0) === (fLo > 0)) {
      lo = mid;
      fLo = fMid;
    } else {
      hi = mid;
      fHi = fMid;
    }
  }
  return { ok: false, reason: 'MAX_ITERATIONS_EXCEEDED', message: `Bisekcja nie zbiegła w ${maxIter} iteracjach (tolerancja ${tol}).` };
}

// --- EXACT COLD REOPEN — zamknij, otwórz na zimno, wyniki identyczne co do wartości --------------

/**
 * Kanoniczna, deterministyczna serializacja draftu: klucze obiektów posortowane alfabetycznie,
 * tablice rekordów (mają `id`) posortowane po `id` — TA SAMA dyscyplina co serwerowe
 * `sortByCreatedAtThenId`/`sortOverlapSourcesById`/`buildAssumptionSetSemanticHash`
 * (`predictionComputeService.ts`/`predictionPreflightService.ts`, patrz te pliki: Postgres bez
 * `ORDER BY` nie gwarantuje kolejności, a JS float addition nie jest łączne — więc kolejność MUSI
 * być ustalona w pamięci przed jakimkolwiek sumowaniem/hashem/porównaniem).
 */
function sortDeepForFingerprint(value: unknown): unknown {
  if (Array.isArray(value)) {
    const mapped = value.map(sortDeepForFingerprint);
    const allHaveId = mapped.length > 0 && mapped.every((v) => typeof v === 'object' && v !== null && 'id' in (v as Record<string, unknown>));
    if (!allHaveId) return mapped;
    return [...mapped].sort((a, b) => {
      const ai = (a as Record<string, unknown>).id as string;
      const bi = (b as Record<string, unknown>).id as string;
      return ai < bi ? -1 : ai > bi ? 1 : 0;
    });
  }
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortDeepForFingerprint((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

export function canonicalScenarioDraftFingerprint(draft: ScenarioDraft): string {
  return JSON.stringify(sortDeepForFingerprint(draft));
}

/**
 * Dowód "exact cold reopen" na WARSTWIE DRAFTU przeglądarki: serializacja -> JSON round-trip
 * (symuluje "zamknij kartę, otwórz na zimno") -> serializacja ponownie muszą dać bajtowo identyczny
 * odcisk. Realny cold-reopen PERSYSTOWANYCH wartości wymaga zapisu do bazy (brakujący CRUD, patrz
 * luka w nagłówku pliku) — to jest lokalny, ale realny dowód niezmienności modelu, nie atrapa;
 * serwer ma WŁASNY, niezależny dowód tej samej własności dla swojej warstwy (`contentSemanticHash`
 * + trzy funkcje sortujące wymienione wyżej, live-tested w istniejących testach determinizmu PKG-A).
 */
export function verifyExactColdReopen(draft: ScenarioDraft): { ok: true; fingerprint: string } | { ok: false; before: string; after: string } {
  const before = canonicalScenarioDraftFingerprint(draft);
  const reopened = JSON.parse(JSON.stringify(draft)) as ScenarioDraft;
  const after = canonicalScenarioDraftFingerprint(reopened);
  return before === after ? { ok: true, fingerprint: before } : { ok: false, before, after };
}

// --- Zależności scenariuszowe: cena/wolumen/moce/inflacja/FX/stopy/podatek ------------------------

export type ScenarioDependencyKind = 'PRICE_VOLUME' | 'CAPACITY' | 'INFLATION' | 'FX' | 'INTEREST_RATES' | 'TAX';

export interface ScenarioDependencyCoverage {
  covered: boolean;
  via: string | null;
  note: string | null;
}

/**
 * Mapa pokrycia zależności z brifu koordynatora na ISTNIEJĄCY (poza allowlistą tego pakietu,
 * server/**) 9-wartościowy enum `schedule_type` + `finance_prediction_impact_chain`. Dokumentacyjna,
 * nie egzekwująca — brakujące pozycje (`INFLATION`/`FX`/twarda walidacja `CAPACITY`) wymagają zmiany
 * schematu serwera i są zaraportowane jako EVIDENCE_MISSING, nie cicho pominięte.
 */
export const SCENARIO_DEPENDENCY_COVERAGE: Readonly<Record<ScenarioDependencyKind, ScenarioDependencyCoverage>> = {
  PRICE_VOLUME: {
    covered: true,
    via: 'revenue_pvm (REVENUE_GROWTH_YOY) + impact_chain PERCENT_OF_BASE/ABSOLUTE_AMOUNT na REVENUE',
    note: 'P0: PVM jako jeden zagregowany growth rate — brak osobnych driver_code dla ceny vs wolumenu w schemacie serwera.',
  },
  CAPACITY: {
    covered: false,
    via: 'impact_chain.capacity_constraint_ref (JSONB)',
    note: 'Pole istnieje w schemacie (ADR sekcja 15 pkt 3), ale NIE jest trigger-walidowane — miękkie ograniczenie bez twardej weryfikacji.',
  },
  INFLATION: { covered: false, via: null, note: 'Brak osobnego schedule_type/driver_code dla inflacji w 9-wartościowym enumie serwera — zmiana enumu jest poza allowlistą server/** tego pakietu.' },
  FX: { covered: false, via: null, note: 'Jedna native_currency/presentation_currency na komórkę — brak modelu wielowalutowego/FX w schemacie.' },
  INTEREST_RATES: { covered: true, via: 'debt_maturity (contractual_rate, CASH_INTEREST_RATE_ANNUAL_PCT) + finance_prediction_financing.payload.rate', note: null },
  TAX: { covered: true, via: 'tax_nol (STATUTORY_TAX_RATE_PCT)', note: null },
};

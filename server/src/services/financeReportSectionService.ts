/**
 * Finance Report Section — silnik → raport (F5 wiring, `_KONCEPT_FINANCE_2026-07-10.md` §3/§5).
 * =============================================================================================
 * Wzorzec 1:1 z `execution/threeAxisReportService.ts` (PM2 flagowy raport 3 osi, migracja 913):
 * cienki READ-MODEL + KOMPOZYTOR nad TRZEMA już istniejącymi, gotowymi silnikami Finance —
 * ZERO nowej matematyki, ZERO LLM do liczb (narracja jest oddzielnym, opcjonalnym krokiem
 * dopisywanym NAD policzonymi liczbami, nigdy w ich miejsce).
 *
 * DLACZEGO TEN PLIK (reuse-not-rebuild):
 *   1. WSKAŹNIKI  — `financeRatioFamilyCatalog.computeFinanceRatioFamilyCatalog` (Z111, 24
 *      wskaźników / 5 rodzin + DuPont). Ten silnik istniał, ale (wg jego własnego docblocka)
 *      "is not imported by any existing route/service" — martwy silnik. Ten plik jest jego
 *      pierwszym callerem: dokładnie cel zadania ("doprowadzić silnik DO USERA przez raport").
 *      Benchmark per wskaźnik REUŻYWA `ratioAnalysisService.buildRatioBenchmark` +
 *      `financeIndustryBenchmarks.getRatioBenchmark` (kody się pokrywają: GROSS_MARGIN,
 *      OPERATING_MARGIN, EBITDA_MARGIN, NET_MARGIN, ROE, ROA, CURRENT_RATIO, QUICK_RATIO,
 *      DEBT_TO_EQUITY, DSO, DIO — 11 z 12 kluczy `CATALOG_TO_BENCHMARK_CODE`), więc benchmark
 *      NIE jest przeliczany drugi raz, tylko wołany z tym samym kodem wskaźnika.
 *   2. RECONCILE R1-R8 — `reconciliationService` (shadow). Wyniki są JUŻ persystowane per
 *      pakiet w `financial_statement_validations` (scope='pack') przez
 *      `financialStatementPackService.recomputeStatementPack` → `shadowReconcilePack` przy
 *      KAŻDYM przeliczeniu pakietu. Ta sekcja WYŁĄCZNIE CZYTA ten persystowany wynik przez
 *      `getStatementPackDetail` — nie woła `reconcileStatements` drugi raz (uniknięcie
 *      podwójnego liczenia i gwarancja spójności z tym, co widać gdzie indziej w Finance).
 *   3. EV KOSZYK — `valuationBasketService.buildBasketFromResults` (czysta synteza M1-M4 nad
 *      `valuationService.computeValuation`/`getValuation` wynikami) — football-field.
 *
 * ADDITIVE: nie zmienia zachowania żadnego istniejącego raportu/endpointu. Jedyne dotknięcia
 * istniejących plików to (a) eksport `loadOrganizationIndustry` z `ratioAnalysisService.ts`
 * (był prywatny, teraz re-używalny) i (b) poszerzenie unii `ReportSourceType` o
 * `'FINANCE_SECTION'` w `reportBuilderService.ts` (dokładnie wzorzec, którym `'PROGRAM_3AXIS'`
 * dostał własny discriminant zamiast przeciążać `'FINANCIAL_ANALYSIS'`/`'VALUATION'`).
 *
 * DETERMINIZM: `composeFinanceReportSection` jest CZYSTĄ funkcją (żadnego I/O) — testowalna
 * w izolacji, wzorzec `renderThreeAxisMarkdown`/pure-math sekcji `threeAxisReportService.ts`.
 * `loadFinanceReportSectionData` jest cienką orkiestracją DB (fail-soft, wzorzec
 * `buildThreeAxisReport`/`projectFinanceRollupService`), która zasila powyższą funkcję.
 */

import { all as dbAll } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import {
  deriveConfidence,
  type EvidenceContract,
  type EvidenceContractSource,
} from './evidence/evidenceContract.js';
import {
  attachSource as attachEvidenceSource,
  type EvidenceAssumption,
  type EvidenceAssumptionSourceType,
  type EvidenceEnvelope,
  type EvidenceSource,
  type EvidenceSourceType,
  upsertEnvelope as upsertEvidenceEnvelope,
} from './evidence/evidenceEnvelopeService.js';
import {
  type ComputedFamilyRatio,
  computeDupontFromLines,
  computeFinanceRatioFamilyCatalog,
  type DupontFromLines,
  groupByFamily,
  type LineValueMap,
  type RatioFamily,
} from './financeRatioFamilyCatalog.js';
import { getStatementPackDetail, loadPackValueMaps } from './financialStatementPackService.js';
import {
  buildRatioBenchmark,
  type ComputedRatio,
  loadOrganizationIndustry,
} from './ratioAnalysisService.js';
import { RECONCILE_ENFORCE } from './reconciliationService.js';
import ReportContract, { type ReportScope } from './report/reportContract.js';
import ReportBuilderService from './reportBuilderService.js';
import {
  type BasketConfig,
  type BasketResult,
  buildBasketFromResults,
} from './valuationBasketService.js';
import { getOrgDefaultWacc, getValuation, listValuations } from './valuationService.js';

/* ────────────────────────────────────────────────────────────────────────────
   Typy
   ──────────────────────────────────────────────────────────────────────────── */

export type RagLabel = 'GREEN' | 'AMBER' | 'RED' | 'NA';

/** Wskaźnik wzbogacony o benchmark (reuse `ratioAnalysisService.buildRatioBenchmark`). */
export interface FinanceReportRatioRow extends ComputedFamilyRatio {
  benchmark?: ComputedRatio['benchmark'];
}

export interface FinanceReconcileCheckRow {
  checkCode: string;
  checkName: string;
  severity: 'error' | 'warning' | 'info';
  status: 'pass' | 'warning' | 'fail';
  message: string;
  difference: number | null;
  tolerance: number | null;
}

export interface FinanceReconcileSummary {
  /** false = pakiet nigdy nie przeszedł recompute → brak persystowanych wyników R1-R8. */
  available: boolean;
  /** RECONCILE_ENFORCE (shadow master switch) — false = obserwacyjny, nie blokuje readiness. */
  enforceMode: boolean;
  overallStatus: 'pass' | 'warning' | 'fail' | 'na';
  summary: { passed: number; warnings: number; failed: number; skipped: number } | null;
  checks: FinanceReconcileCheckRow[];
  computedAt: string | null;
  /**
   * Persystowany `ReconcileResult.blocksReady` z ostatniego `recomputeStatementPack`
   * (`reconciliationService.reconcileStatements` → `checks.some(error && fail)`), CZYTANY
   * z `RECONCILE_SUMMARY.details_json`, NIE przeliczany drugi raz. Samo w sobie nic nie
   * blokuje — bramkę stanowi `RECONCILE_ENFORCE && blocksReady`, patrz
   * `publishFinanceReportSectionSnapshot`. false gdy niedostępny (brak recompute).
   */
  blocksReady: boolean;
}

export interface FinanceValuationSummary {
  available: boolean;
  valuationId: string | null;
  valuationTitle: string | null;
  basket: BasketResult | null;
}

/* ────────────────────────────────────────────────────────────────────────────
   LINEAGE (#82g) — jawny ślad źródeł dla kluczowych liczb sekcji finansowej.
   "Każda liczba ma ślad do źródła": SKĄD (pakiet/okres) · PRZEZ CO (formuła
   wskaźnika / check reconcile R1-R8 / metoda EV) · Z JAKIMI ZAŁOŻENIAMI
   (WACC, tryb enforce reconcile). Pure — zero I/O, budowane WYŁĄCZNIE z tego,
   co `composeFinanceReportSection` już policzył (żadnego przeliczania drugi
   raz). Ten sam obiekt zasila (a) odczyt live (przed publikacją) i (b) Evidence
   Envelope przy publikacji (patrz `lineageToEvidenceInputs` niżej) — jedno
   źródło prawdy, nie dwa niezależnie utrzymywane zbiory źródeł/założeń.
   ──────────────────────────────────────────────────────────────────────────── */

/** Pakiet/okres, z którego wywodzi się liczba — powtarzalny fragment lineage. */
export interface FinanceLineageSourcePack {
  packId: string;
  entityName: string | null;
  periodLabel: string | null;
  periodEnd: string | null;
  currency: string;
}

/** Założenie w formacie lineage (mapuje 1:1 na `EvidenceAssumption`, patrz evidenceEnvelopeService). */
export interface FinanceLineageAssumption {
  key: string;
  value: unknown;
  sourceType: EvidenceAssumptionSourceType;
  rationale?: string;
}

export type FinanceLineageCategory = 'ratio' | 'reconcile' | 'valuation';

/** Jeden wpis lineage — jedna liczba/pozycja z jawnym śladem pochodzenia. */
export interface FinanceReportLineageEntry {
  /** Stabilny id: kod wskaźnika / checkCode reconcile / klucz metody EV. */
  id: string;
  category: FinanceLineageCategory;
  label: string;
  /** Wartość jako string do prezentacji (np. "12.4%") — null gdy pominięta/niedostępna. */
  value: string | null;
  /** PRZEZ CO: formuła wskaźnika / nazwa checku reconcile / opis metody EV. */
  method: string;
  family?: RatioFamily;
  /** Linie kanoniczne (financeCanonicalRegistry) czytane przez formułę — tylko dla category='ratio'. */
  requiredLineCodes?: string[];
  reconcileStatus?: FinanceReconcileCheckRow['status'];
  severity?: FinanceReconcileCheckRow['severity'];
  /** SKĄD: pakiet sprawozdań/okres — null tylko dla wpisów bez powiązanego pakietu. */
  sourcePack: FinanceLineageSourcePack | null;
  /** Z JAKIMI ZAŁOŻENIAMI: puste dla większości wpisów, niepuste np. dla ROIC_WACC_SPREAD (WACC). */
  assumptions: FinanceLineageAssumption[];
}

/** Pełny ślad lineage sekcji — nagłówek (pakiet/okres) + lista wpisów per liczba. */
export interface FinanceReportLineage {
  packId: string | null;
  sourcePack: FinanceLineageSourcePack | null;
  generatedAt: string;
  /** Założenia silnika na poziomie sekcji (nie per-liczba) — np. które engine'y liczyły co. */
  assumptions: FinanceLineageAssumption[];
  entries: FinanceReportLineageEntry[];
}

function emptyFinanceReportLineage(asOf: string): FinanceReportLineage {
  return { packId: null, sourcePack: null, generatedAt: asOf, assumptions: [], entries: [] };
}

/**
 * Buduje lineage z JUŻ POLICZONYCH wyników trzech silników (ratios/reconcile/valuation) —
 * PURE, zero I/O, zero przeliczania. Wołane z `composeFinanceReportSection` (patrz niżej),
 * więc lineage jest zawsze spójne z liczbami widocznymi w sekcji (ten sam input).
 */
export function buildFinanceReportLineage(
  pack: PackContextInput,
  ratios: FinanceReportRatioRow[],
  reconcile: FinanceReconcileSummary,
  valuation: FinanceValuationSummary,
  waccPct: number | undefined,
  asOf: string
): FinanceReportLineage {
  const sourcePack: FinanceLineageSourcePack = {
    packId: pack.packId,
    entityName: pack.entityName,
    periodLabel: pack.periodLabel,
    periodEnd: pack.periodEnd,
    currency: pack.currency,
  };

  const sectionAssumptions: FinanceLineageAssumption[] = [
    {
      key: 'ratio_engine',
      value:
        'financeRatioFamilyCatalog.computeFinanceRatioFamilyCatalog (Z111, 24 wskaźników / 5 rodzin + DuPont)',
      sourceType: 'imported',
      rationale:
        'Brak wartości linii kanonicznej = skipped (null), nigdy 0 (doktryna "no guessing").',
    },
    {
      key: 'reconcile_engine',
      value:
        'reconciliationService.reconcileStatements (R1-R8) — CZYTANE z persystowanego shadow-wyniku, nie przeliczane',
      sourceType: 'imported',
      rationale: `RECONCILE_ENFORCE=${RECONCILE_ENFORCE} — obserwacyjny, nie blokuje readiness pakietu.`,
    },
    {
      key: 'valuation_engine',
      value:
        'valuationBasketService.buildBasketFromResults (M1 DCF, M2 comps, M3 precedent, M4 asset/income)',
      sourceType: 'imported',
    },
  ];
  if (typeof waccPct === 'number' && Number.isFinite(waccPct)) {
    sectionAssumptions.push({
      key: 'wacc_pct',
      value: waccPct,
      sourceType: 'imported',
      rationale:
        'valuationService.getOrgDefaultWacc — organization_settings.finance.defaultWacc (fallback 12% gdy organizacja nie ustawiła własnego).',
    });
  }

  const entries: FinanceReportLineageEntry[] = [];

  for (const r of ratios) {
    entries.push({
      id: r.code,
      category: 'ratio',
      label: r.labelPl,
      value: r.status === 'computed' ? `${r.value}${r.unit}` : null,
      method: r.formula,
      family: r.family,
      requiredLineCodes: r.requiredLineCodes,
      sourcePack,
      assumptions:
        r.code === 'ROIC_WACC_SPREAD' && typeof waccPct === 'number'
          ? [
              {
                key: 'wacc_pct',
                value: waccPct,
                sourceType: 'imported',
                rationale:
                  'Wejście z silnika wyceny (valuationService.getOrgDefaultWacc), nie z linii kanonicznej pakietu.',
              },
            ]
          : [],
    });
  }

  for (const c of reconcile.checks) {
    entries.push({
      id: c.checkCode,
      category: 'reconcile',
      label: c.checkName,
      value: c.status,
      method: `Reconcile R1-R8 (shadow${reconcile.enforceMode ? ', enforce' : ', obserwacyjny'}) — ${c.message}`,
      reconcileStatus: c.status,
      severity: c.severity,
      sourcePack,
      assumptions: [],
    });
  }

  if (valuation.basket) {
    for (const m of valuation.basket.methods) {
      entries.push({
        id: m.key,
        category: 'valuation',
        label: m.label,
        value: `${m.low}–${m.high} (mid ${m.mid})`,
        method: `Koszyk EV — waga ${Math.round(m.weight * 100)}% (valuationBasketService.buildBasketFromResults)`,
        sourcePack,
        assumptions: [],
      });
    }
  }

  return {
    packId: pack.packId,
    sourcePack,
    generatedAt: asOf,
    assumptions: sectionAssumptions,
    entries,
  };
}

/**
 * Mapuje lineage sekcji na wejścia Evidence Envelope (`sources`/`assumptions`) — REUŻYWA
 * `buildFinanceReportLineage`, nie buduje drugiego, niezależnego zbioru źródeł. Wołane
 * WYŁĄCZNIE z `publishFinanceReportSectionSnapshot` (jedyne miejsce, które persystuje
 * envelope). Truncation (30/20 wpisów) — jak wcześniej — chroni przed nadmiarowym JSON
 * przy dużych katalogach wskaźników/checków, envelope to koperta dowodowa, nie pełny dump.
 */
export function lineageToEvidenceInputs(lineage: FinanceReportLineage): {
  sources: EvidenceSource[];
  assumptions: EvidenceAssumption[];
} {
  const categoryToSourceType: Record<FinanceLineageCategory, EvidenceSourceType> = {
    ratio: 'statement_pack',
    reconcile: 'statement_pack',
    valuation: 'kpi_series',
  };

  const perCategoryLimit: Record<FinanceLineageCategory, number> = {
    ratio: 30,
    reconcile: 20,
    valuation: 20,
  };
  const seenPerCategory: Record<FinanceLineageCategory, number> = {
    ratio: 0,
    reconcile: 0,
    valuation: 0,
  };

  const sources: EvidenceSource[] = [];
  for (const entry of lineage.entries) {
    if (entry.category === 'ratio' && entry.value === null) continue; // skipped ratios nie są "source", nie ma czego cytować
    if (seenPerCategory[entry.category] >= perCategoryLimit[entry.category]) continue;
    seenPerCategory[entry.category] += 1;
    const packRef = entry.sourcePack
      ? ` [pakiet ${entry.sourcePack.packId}${entry.sourcePack.periodLabel ? `, ${entry.sourcePack.periodLabel}` : ''}]`
      : '';
    sources.push({
      type: categoryToSourceType[entry.category],
      ref: entry.id,
      snippet: `${entry.label}: ${entry.value ?? '—'} · ${entry.method}${packRef}`,
    });
  }

  const assumptions: EvidenceAssumption[] = lineage.assumptions.map((a) => ({
    key: a.key,
    value: a.value,
    source_type: a.sourceType,
    rationale: a.rationale,
  }));

  return { sources, assumptions };
}

export interface FinanceReportSection {
  organizationId: string;
  packId: string | null;
  entityName: string | null;
  periodLabel: string | null;
  currency: string;
  asOf: string;
  /** Worst-of(reconcile.overallStatus, valuation.consistencyFlag) — RAGuje TYLKO to, co ma
   *  jawny próg gdzie indziej w silniku; wskaźniki same z siebie nie mają RAG (§ doktryna
   *  "no guessing" financeRatioFamilyCatalog — ten kompozytor jej nie łamie). */
  verdict: RagLabel;
  headline: string;
  ratios: {
    total: number;
    computed: number;
    skipped: number;
    byFamily: Record<RatioFamily, FinanceReportRatioRow[]>;
    dupont: DupontFromLines;
  };
  reconcile: FinanceReconcileSummary;
  valuation: FinanceValuationSummary;
  dataQuality: {
    statementTypesPresent: string[];
    missingStatementTypes: string[];
    resolvedLineCount: number;
  };
  /** #82g — jawny ślad źródeł per liczba (pakiet/okres · formuła/check/metoda · założenia). */
  lineage: FinanceReportLineage;
  /**
   * HP-14 Evidence Contract — warstwa dowodowa sekcji (źródła/założenia/ryzyka/pewność/
   * do-weryfikacji). Wyprowadzana DETERMINISTYCZNIE z lineage + reconcile + dataQuality
   * (zero LLM). Ten sam obiekt zasila render FE (HP-16) i log jakości.
   */
  evidence: EvidenceContract;
}

/* ────────────────────────────────────────────────────────────────────────────
   Pure compose — zero I/O, testowalne bez DB
   ──────────────────────────────────────────────────────────────────────────── */

export interface PackContextInput {
  packId: string;
  entityName: string | null;
  periodLabel: string | null;
  periodEnd: string | null;
  currency: string;
  statementTypesPresent: string[];
  missingStatementTypes: string[];
}

interface OrgBenchmarkRow {
  ratio_code: string;
  p25?: number;
  median?: number;
  p75?: number;
  target_min?: number;
  target_max?: number;
  source_label?: string;
}

/** Row shape read straight off `financial_statement_validations` (scope='pack'). */
export interface RawReconcileValidationRow {
  check_code: string;
  check_name: string;
  severity: string;
  status: string;
  message: string;
  difference: number | null;
  tolerance: number | null;
  details_json: unknown;
  computed_at: string;
}

export interface RawFinanceReportInputs {
  organizationId: string;
  /** null = brak pakietu → pusty stan (kontrakt: "brak packa→pusty stan"). */
  pack: PackContextInput | null;
  /** Zmergowana mapa linii kanonicznych (P&L+BS+CF) — {} gdy brak pakietu. */
  lineValues: LineValueMap;
  /** WACC z silnika wyceny (`valuationService.getOrgDefaultWacc`) — zamyka lukę ROIC_WACC_SPREAD. */
  waccPct?: number;
  orgIndustry?: string;
  orgBenchmarkRows: OrgBenchmarkRow[];
  /** null = pakiet nigdy nie przeszedł recompute (brak wpisów w financial_statement_validations). */
  reconcileValidations: RawReconcileValidationRow[] | null;
  valuation: { id: string; title: string | null; basket: BasketResult | null } | null;
  asOf?: number;
}

function ratioRag(overallStatus: FinanceReconcileSummary['overallStatus']): RagLabel {
  if (overallStatus === 'fail') return 'RED';
  if (overallStatus === 'warning') return 'AMBER';
  if (overallStatus === 'pass') return 'GREEN';
  return 'NA';
}

function worstRag(rags: RagLabel[]): RagLabel {
  const order: RagLabel[] = ['RED', 'AMBER', 'GREEN', 'NA'];
  let best = order.length - 1;
  for (const r of rags) {
    const idx = order.indexOf(r);
    if (idx >= 0 && idx < best) best = idx;
  }
  return order[best];
}

function safeParseDetails(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Pure: parsuje persystowany shadow-wynik reconcile R1-R8 (financial_statement_validations,
 * scope='pack') do struktury gotowej pod UI badge. `null` wejście = pakiet nigdy nie przeszedł
 * recompute (kontrakt "brak wpisów → niedostępny", nie "0 checków"). Ekstraktowane z
 * `composeFinanceReportSection`, żeby `loadReconcileSummaryForPack` (lekki endpoint UI-badge)
 * mógł reużyć IDENTYCZNĄ logikę bez przechodzenia przez pełną sekcję raportu (wskaźniki+EV).
 */
export function summarizeReconcileValidations(
  reconcileValidations: RawReconcileValidationRow[] | null
): FinanceReconcileSummary {
  if (reconcileValidations === null) {
    return {
      available: false,
      enforceMode: RECONCILE_ENFORCE,
      overallStatus: 'na',
      summary: null,
      checks: [],
      computedAt: null,
      blocksReady: false,
    };
  }
  const summaryRow = reconcileValidations.find((v) => v.check_code === 'RECONCILE_SUMMARY') || null;
  const summaryDetails = summaryRow ? safeParseDetails(summaryRow.details_json) : {};
  const checks: FinanceReconcileCheckRow[] = reconcileValidations
    .filter((v) => v.check_code !== 'RECONCILE_SUMMARY')
    .map((v) => ({
      checkCode: v.check_code,
      checkName: v.check_name,
      severity: (v.severity as FinanceReconcileCheckRow['severity']) || 'warning',
      status: (v.status as FinanceReconcileCheckRow['status']) || 'warning',
      message: v.message,
      difference: v.difference,
      tolerance: v.tolerance,
    }));
  const overallStatus =
    (summaryDetails.overallStatus as FinanceReconcileSummary['overallStatus']) || 'na';
  // Persisted `ReconcileResult.blocksReady` from the last recompute (shadowReconcilePack
  // writes it verbatim into RECONCILE_SUMMARY.details_json). Fallback to re-deriving from
  // the checks themselves (identical formula to reconciliationService.reconcileStatements)
  // for older rows written before this field existed, so historical packs are not silently
  // treated as non-blocking once enforce flips on.
  const blocksReady =
    typeof summaryDetails.blocksReady === 'boolean'
      ? summaryDetails.blocksReady
      : checks.some((c) => c.severity === 'error' && c.status === 'fail');
  return {
    available: Boolean(summaryRow) || checks.length > 0,
    enforceMode: RECONCILE_ENFORCE,
    overallStatus,
    summary: (summaryDetails.summary as FinanceReconcileSummary['summary']) || null,
    checks,
    computedAt: summaryRow?.computed_at ?? null,
    blocksReady,
  };
}

/** Maps raw `financial_statement_validations` rows (as returned by `getStatementPackDetail`) into
 *  `RawReconcileValidationRow[]` — `null` gdy pakiet nigdy nie przeszedł recompute. */
export function mapPackValidationsToReconcileRows(
  packValidations: Array<Record<string, any>>
): RawReconcileValidationRow[] | null {
  if (!Array.isArray(packValidations) || packValidations.length === 0) return null;
  return packValidations.map((v) => ({
    check_code: String(v.check_code),
    check_name: String(v.check_name),
    severity: String(v.severity),
    status: String(v.status),
    message: String(v.message || ''),
    difference: v.difference == null ? null : Number(v.difference),
    tolerance: v.tolerance == null ? null : Number(v.tolerance),
    details_json: v.details_json,
    computed_at: String(v.computed_at || ''),
  }));
}

/** Emptied section — kontrakt "brak packa→pusty stan" (żadnych zgadywanych liczb). */
/**
 * HP-14: buduje `EvidenceContract` sekcji finansowej — DETERMINISTYCZNIE, zero LLM, zero I/O.
 * REUŻYWA `lineageToEvidenceInputs` (nie buduje drugiego zbioru źródeł). Sygnały pewności są
 * REALNE: liczba źródeł lineage, nierozwiązane luki (brakujące sprawozdania + failed reconcile),
 * jakość = udział policzonych wskaźników. `risks`/`toVerify` cytują realne braki, nie zgadywanie.
 */
export function buildFinanceEvidenceContract(
  lineage: FinanceReportLineage,
  reconcile: FinanceReconcileSummary,
  valuation: FinanceValuationSummary,
  ratios: { total: number; computed: number; skipped: number },
  missingStatementTypes: string[]
): EvidenceContract {
  const { sources: envSources, assumptions: envAssumptions } = lineageToEvidenceInputs(lineage);
  const sources: EvidenceContractSource[] = envSources.map((s) => ({
    type: s.type,
    ref: s.ref,
    snippet: s.snippet,
    url: s.url,
  }));

  const assumptions: string[] = envAssumptions.map(
    (a) => `${a.key}: ${String(a.value ?? '—')}${a.rationale ? ` — ${a.rationale}` : ''}`
  );

  const risks: string[] = [];
  const failedChecks = reconcile.available
    ? reconcile.checks.filter((c) => c.status === 'fail' || c.status === 'warning')
    : [];
  failedChecks.forEach((c) => risks.push(`Reconcile ${c.checkCode} (${c.status}): ${c.checkName}`));
  if (valuation.basket?.consistencyFlag?.triggered) {
    risks.push('Wycena EV: rozbieżność metod >20% (football field niespójny).');
  }
  missingStatementTypes.forEach((t) => risks.push(`Brak sprawozdania: ${t}`));

  const toVerify: string[] = [];
  if (!reconcile.available) {
    toVerify.push('Reconcile R1-R8 nie policzony (pakiet nie przeszedł recompute).');
  }
  if (ratios.skipped > 0) {
    toVerify.push(
      `${ratios.skipped}/${ratios.total} wskaźników pominiętych (brak linii kanonicznych).`
    );
  }
  missingStatementTypes.forEach((t) => toVerify.push(`Uzupełnij sprawozdanie: ${t}.`));

  const qualityScore = ratios.total > 0 ? (ratios.computed / ratios.total) * 100 : undefined;
  const confidence = deriveConfidence({
    sourceCount: sources.length,
    unresolvedGaps: missingStatementTypes.length + failedChecks.length,
    qualityScore,
  });

  return { sources, assumptions, risks, confidence, toVerify };
}

function emptyFinanceReportSection(organizationId: string, asOf: string): FinanceReportSection {
  const byFamily = groupByFamily([]);
  const reconcile: FinanceReconcileSummary = {
    available: false,
    enforceMode: RECONCILE_ENFORCE,
    overallStatus: 'na',
    summary: null,
    checks: [],
    computedAt: null,
    blocksReady: false,
  };
  const valuation: FinanceValuationSummary = {
    available: false,
    valuationId: null,
    valuationTitle: null,
    basket: null,
  };
  const lineage = emptyFinanceReportLineage(asOf);
  const missingStatementTypes = ['P&L', 'BS', 'CF'];
  const ratios = { total: 0, computed: 0, skipped: 0 };
  return {
    organizationId,
    packId: null,
    entityName: null,
    periodLabel: null,
    currency: 'PLN',
    asOf,
    verdict: 'NA',
    headline: 'Brak gotowego pakietu sprawozdań — sekcja finansowa raportu jest pusta.',
    ratios: { ...ratios, byFamily, dupont: computeDupontFromLines({}) },
    reconcile,
    valuation,
    dataQuality: {
      statementTypesPresent: [],
      missingStatementTypes,
      resolvedLineCount: 0,
    },
    lineage,
    evidence: buildFinanceEvidenceContract(
      lineage,
      reconcile,
      valuation,
      ratios,
      missingStatementTypes
    ),
  };
}

/**
 * Komponuje sekcję finansową raportu z JUŻ POLICZONYCH wyników trzech silników.
 * PURE: żadnego DB/LLM. Ta funkcja jest sercem testów (fixture-driven, bez mocków DB).
 */
export function composeFinanceReportSection(input: RawFinanceReportInputs): FinanceReportSection {
  const asOf = new Date(input.asOf ?? Date.now()).toISOString();
  if (!input.pack) return emptyFinanceReportSection(input.organizationId, asOf);

  // 1) Wskaźniki (Z111) — silnik istniejący, zero duplikacji matematyki.
  const rawRatios = computeFinanceRatioFamilyCatalog(input.lineValues, { waccPct: input.waccPct });
  const benchmarkByCode = new Map(input.orgBenchmarkRows.map((r) => [r.ratio_code, r]));
  const ratios: FinanceReportRatioRow[] = rawRatios.map((r) => ({
    ...r,
    benchmark: buildRatioBenchmark(r.code, benchmarkByCode.get(r.code), input.orgIndustry, r.value),
  }));
  const byFamily = groupByFamily(ratios) as Record<RatioFamily, FinanceReportRatioRow[]>;
  const dupont = computeDupontFromLines(input.lineValues);
  const computedCount = ratios.filter((r) => r.status === 'computed').length;

  // 2) Reconcile R1-R8 — CZYTANE z persystowanego shadow-wyniku (financial_statement_validations),
  //    NIE przeliczane drugi raz (patrz docblock pliku, punkt 2).
  const reconcile: FinanceReconcileSummary = summarizeReconcileValidations(
    input.reconcileValidations
  );

  // 3) Koszyk EV — football field. Basket już policzony przez wołającego (orkiestracja DB
  //    poniżej), tu tylko przenoszony do struktury sekcji.
  const valuation: FinanceValuationSummary = input.valuation
    ? {
        available: Boolean(input.valuation.basket),
        valuationId: input.valuation.id,
        valuationTitle: input.valuation.title,
        basket: input.valuation.basket,
      }
    : { available: false, valuationId: null, valuationTitle: null, basket: null };

  const verdict = worstRag([
    ratioRag(reconcile.available ? reconcile.overallStatus : 'na'),
    valuation.basket ? (valuation.basket.consistencyFlag.triggered ? 'AMBER' : 'GREEN') : 'NA',
  ]);

  const headline =
    `Pakiet ${input.pack.periodLabel || input.pack.packId}: ` +
    `${computedCount}/${ratios.length} wskaźników policzonych (Z111) · ` +
    `reconcile R1-R8 ${reconcile.available ? reconcile.overallStatus : 'niedostępny'} (shadow${RECONCILE_ENFORCE ? '' : ', nie blokuje'}) · ` +
    `EV koszyk ${valuation.basket ? `${valuation.basket.methods.length} metod${valuation.basket.consistencyFlag.triggered ? ', ROZBIEŻNOŚĆ >20%' : ''}` : 'niedostępny'}.`;

  const lineage = buildFinanceReportLineage(
    input.pack,
    ratios,
    reconcile,
    valuation,
    input.waccPct,
    asOf
  );

  return {
    organizationId: input.organizationId,
    packId: input.pack.packId,
    entityName: input.pack.entityName,
    periodLabel: input.pack.periodLabel,
    currency: input.pack.currency,
    asOf,
    verdict,
    headline,
    ratios: {
      total: ratios.length,
      computed: computedCount,
      skipped: ratios.length - computedCount,
      byFamily,
      dupont,
    },
    reconcile,
    valuation,
    dataQuality: {
      statementTypesPresent: input.pack.statementTypesPresent,
      missingStatementTypes: input.pack.missingStatementTypes,
      resolvedLineCount: Object.keys(input.lineValues).length,
    },
    lineage,
    evidence: buildFinanceEvidenceContract(
      lineage,
      reconcile,
      valuation,
      { total: ratios.length, computed: computedCount, skipped: ratios.length - computedCount },
      input.pack.missingStatementTypes
    ),
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   DB orchestration (fail-soft) — zasila composeFinanceReportSection
   ──────────────────────────────────────────────────────────────────────────── */

export interface FinanceReportSectionScope {
  organizationId: string;
  /** Id `financial_statement_packs`. Gdy brak/nie znaleziony → pusty stan (kontrakt). */
  packId?: string;
  /** Id `valuations`. Gdy pominięty, próbujemy najnowszą wycenę organizacji (best-effort). */
  valuationId?: string;
  asOf?: number;
}

async function loadOrgBenchmarkRows(organizationId: string): Promise<OrgBenchmarkRow[]> {
  try {
    const rows = await dbAll<OrgBenchmarkRow>(
      `SELECT ratio_code, p25, median, p75, target_min, target_max, source_label
         FROM financial_ratio_benchmarks WHERE organization_id = ?`,
      [organizationId]
    );
    return rows || [];
  } catch (err) {
    logger.warn(
      `[financeReportSectionService] loadOrgBenchmarkRows failed (degrading to empty): ${(err as Error)?.message || err}`
    );
    return [];
  }
}

async function resolveValuation(
  organizationId: string,
  valuationId: string | undefined
): Promise<{ id: string; title: string | null; basket: BasketResult | null } | null> {
  try {
    let id = valuationId;
    if (!id) {
      const list = await listValuations(organizationId);
      id = list?.[0]?.id;
    }
    if (!id) return null;

    const val = await getValuation(organizationId, id);
    if (!val) return null;

    const results = (val.results && typeof val.results === 'object' ? val.results : {}) as Record<
      string,
      any
    >;
    // Reuse an already-computed basket verbatim (no recompute) when present; otherwise
    // synthesize purely from whatever DCF/comps results already exist (no I/O, no side
    // effect on the valuation row — a report read must not mutate valuation state).
    let basket: BasketResult | null = (results.basket as BasketResult) || null;
    if (!basket && (results.dcf || results.comps)) {
      const config: BasketConfig =
        results?.assumptions?.basket && typeof results.assumptions.basket === 'object'
          ? results.assumptions.basket
          : {};
      basket = buildBasketFromResults(results, config);
    }
    return { id, title: val.title || null, basket };
  } catch (err) {
    logger.warn(
      `[financeReportSectionService] resolveValuation failed (degrading to unavailable): ${(err as Error)?.message || err}`
    );
    return null;
  }
}

/** Orkiestracja DB: pack detail + benchmark + persystowany reconcile + koszyk EV → compose. */
export async function loadFinanceReportSectionData(
  scope: FinanceReportSectionScope
): Promise<FinanceReportSection> {
  const asOf = new Date(scope.asOf ?? Date.now()).toISOString();
  if (!scope.packId) return emptyFinanceReportSection(scope.organizationId, asOf);

  const detail = await getStatementPackDetail(scope.organizationId, scope.packId);
  if (!detail) return emptyFinanceReportSection(scope.organizationId, asOf);

  const statements: Array<{ id: string; statement_type: string }> = Array.isArray(detail.statements)
    ? detail.statements
    : [];
  const statementTypesPresent = Array.from(new Set(statements.map((s) => s.statement_type)));
  const requiredTypes = ['P&L', 'BS', 'CF'];
  const missingStatementTypes = requiredTypes.filter((t) => !statementTypesPresent.includes(t));

  const [maps, waccPct, orgIndustry, orgBenchmarkRows, valuation] = await Promise.all([
    loadPackValueMaps(statements),
    getOrgDefaultWacc(scope.organizationId).catch(() => undefined),
    loadOrganizationIndustry(scope.organizationId).catch(() => undefined),
    loadOrgBenchmarkRows(scope.organizationId),
    resolveValuation(scope.organizationId, scope.valuationId),
  ]);
  const lineValues: LineValueMap = { ...maps.pnl, ...maps.bs, ...maps.cf };

  const packValidations: Array<Record<string, any>> = Array.isArray(detail.validations)
    ? detail.validations
    : [];
  const reconcileValidations = mapPackValidationsToReconcileRows(packValidations);

  return composeFinanceReportSection({
    organizationId: scope.organizationId,
    pack: {
      packId: scope.packId,
      entityName: detail.entity_name ?? null,
      periodLabel: detail.period_label ?? null,
      periodEnd: detail.period_end ?? null,
      currency: detail.currency || 'PLN',
      statementTypesPresent,
      missingStatementTypes,
    },
    lineValues,
    waccPct: typeof waccPct === 'number' && Number.isFinite(waccPct) ? waccPct : undefined,
    orgIndustry,
    orgBenchmarkRows,
    reconcileValidations,
    valuation,
    asOf: scope.asOf,
  });
}

export interface PackReconcileSummary extends FinanceReconcileSummary {
  packId: string;
}

/**
 * Lekki READ-ONLY wrapper (UI badge use case, Delta route-wiring F5): zwraca WYŁĄCZNIE
 * persystowany wynik reconcile R1-R8 dla pakietu (`financial_statement_validations`,
 * scope='pack') bez liczenia wskaźników/EV (w odróżnieniu od `loadFinanceReportSectionData`,
 * który komponuje pełną sekcję raportu). `null` = pakiet nie istnieje/nie należy do org.
 */
export async function loadReconcileSummaryForPack(
  organizationId: string,
  packId: string
): Promise<PackReconcileSummary | null> {
  const detail = await getStatementPackDetail(organizationId, packId);
  if (!detail) return null;
  const packValidations: Array<Record<string, any>> = Array.isArray(detail.validations)
    ? detail.validations
    : [];
  const reconcileValidations = mapPackValidationsToReconcileRows(packValidations);
  return { packId, ...summarizeReconcileValidations(reconcileValidations) };
}

export interface PackLineageResult {
  packId: string;
  /** false gdy pakiet nie ma jeszcze policzonych wskaźników/reconcile/wyceny (pusty stan). */
  available: boolean;
  lineage: FinanceReportLineage;
}

/**
 * #82g — Lekki READ-ONLY endpoint pod kartę raportu Finance: jawny LINEAGE (skąd/przez co/z
 * jakimi założeniami) dla sekcji finansowej, LIVE (przed publikacją) — bez tworzenia
 * raportu/snapshotu/envelope. Woła `loadFinanceReportSectionData` (te same trzy silniki co
 * publish), zwraca WYŁĄCZNIE `section.lineage`. Ten sam lineage trafia do Evidence Envelope
 * przy `publishFinanceReportSectionSnapshot` (patrz `lineageToEvidenceInputs`) — jedno źródło
 * prawdy dla obu ścieżek (patrz/publikuj). `null` = pakiet nie istnieje/nie należy do org.
 */
export async function loadFinanceReportLineageForPack(
  organizationId: string,
  packId: string,
  valuationId?: string
): Promise<PackLineageResult | null> {
  const detail = await getStatementPackDetail(organizationId, packId);
  if (!detail) return null;
  const section = await loadFinanceReportSectionData({ organizationId, packId, valuationId });
  return { packId, available: section.packId !== null, lineage: section.lineage };
}

/* ────────────────────────────────────────────────────────────────────────────
   Markdown — anatomia: nagłówek+werdykt / tabela wskaźników+benchmark / reconcile / EV / narracja
   ──────────────────────────────────────────────────────────────────────────── */

function ragEmoji(rag: RagLabel): string {
  return rag === 'GREEN' ? '🟢' : rag === 'AMBER' ? '🟡' : rag === 'RED' ? '🔴' : '⚪';
}

const FAMILY_LABELS_PL: Record<RatioFamily, string> = {
  liquidity: 'Płynność',
  profitability: 'Rentowność',
  leverage: 'Zadłużenie',
  efficiency: 'Efektywność',
  value: 'Wartość / inwestorskie',
};

export function renderFinanceReportMarkdown(section: FinanceReportSection): Record<string, string> {
  const header = [
    `# Sekcja finansowa raportu`,
    ``,
    `**Pakiet:** ${section.periodLabel || section.packId || '—'}${section.entityName ? ` (${section.entityName})` : ''}`,
    `**Stan na:** ${section.asOf}`,
    `**Werdykt:** ${ragEmoji(section.verdict)} ${section.verdict}`,
    ``,
    section.headline,
  ].join('\n');

  const ratioHeader =
    '| Wskaźnik | Rodzina | Wartość | Jedn. | Benchmark (mediana) | Status |\n|---|---|---:|---|---:|---|';
  const ratioRows = (Object.keys(section.ratios.byFamily) as RatioFamily[])
    .flatMap((family) =>
      section.ratios.byFamily[family].map((r) => {
        const bench = r.benchmark?.median != null ? String(r.benchmark.median) : '—';
        return `| ${r.labelPl} | ${FAMILY_LABELS_PL[family]} | ${r.value ?? '—'} | ${r.unit} | ${bench} | ${r.status === 'computed' ? '✓' : '— brak danych'} |`;
      })
    )
    .join('\n');
  const dupontLine =
    section.ratios.dupont.status === 'computed'
      ? `DuPont ROE = ${section.ratios.dupont.roe}% (marża ${section.ratios.dupont.netMarginPct}% × rotacja ${section.ratios.dupont.assetTurnover} × dźwignia ${section.ratios.dupont.equityMultiplier})`
      : 'DuPont — pominięty (brakujące linie kanoniczne).';
  const ratioTable = [
    `## Wskaźniki (${section.ratios.computed}/${section.ratios.total} policzonych)`,
    '',
    ratioHeader,
    ratioRows || '| — | — | — | — | — | — |',
    '',
    dupontLine,
  ].join('\n');

  const reconcileResult = section.reconcile.available
    ? [
        `## Reconcile R1-R8 (shadow${section.reconcile.enforceMode ? '' : ' — obserwacyjny, nie blokuje readiness'})`,
        '',
        `Werdykt: ${ragEmoji(ratioRagFromStatus(section.reconcile.overallStatus))} ${section.reconcile.overallStatus.toUpperCase()}` +
          (section.reconcile.summary
            ? ` — ${section.reconcile.summary.passed} pass, ${section.reconcile.summary.warnings} warn, ${section.reconcile.summary.failed} fail, ${section.reconcile.summary.skipped} skipped`
            : ''),
        '',
        ...section.reconcile.checks
          .filter((c) => c.status !== 'pass')
          .map(
            (c) =>
              `- ${c.status === 'fail' ? '🔴' : '🟡'} **${c.checkCode}** (${c.checkName}) — ${c.message}`
          ),
      ]
        .filter(Boolean)
        .join('\n')
    : [
        '## Reconcile R1-R8 (shadow)',
        '',
        '_Pakiet nie przeszedł jeszcze przeliczenia — brak wyniku._',
      ].join('\n');

  const evFootballField = section.valuation.basket
    ? [
        '## Koszyk EV — football field',
        '',
        '| Metoda | Niska | Środek | Wysoka | Waga |\n|---|---:|---:|---:|---:|',
        ...section.valuation.basket.methods.map(
          (m) => `| ${m.label} | ${m.low} | ${m.mid} | ${m.high} | ${Math.round(m.weight * 100)}% |`
        ),
        '',
        section.valuation.basket.intersection
          ? `**Strefa przecięcia (rekomendacja):** ${section.valuation.basket.intersection.low} – ${section.valuation.basket.intersection.high}`
          : `**Rekomendacja (bez części wspólnej):** ${section.valuation.basket.recommended.low} – ${section.valuation.basket.recommended.high} (mid ${section.valuation.basket.recommended.mid})`,
        section.valuation.basket.consistencyFlag.triggered
          ? `\n⚠️ ${section.valuation.basket.consistencyFlag.message}`
          : '',
      ]
        .filter(Boolean)
        .join('\n')
    : ['## Koszyk EV — football field', '', '_Brak wyceny powiązanej z tym pakietem._'].join('\n');

  const narrative = [
    '## Narracja',
    '',
    '_TODO F6/Teresa — narracja generowana WYŁĄCZNIE nad policzonymi liczbami powyżej,',
    'zero liczb generowanych przez model (wzorzec `threeAxisReportService.renderThreeAxisMarkdown`)._',
  ].join('\n');

  return {
    header,
    ratio_table: ratioTable,
    reconcile_result: reconcileResult,
    ev_football_field: evFootballField,
    narrative,
  };
}

function ratioRagFromStatus(status: FinanceReconcileSummary['overallStatus']): RagLabel {
  return ratioRag(status);
}

/* ────────────────────────────────────────────────────────────────────────────
   WPIĘCIE W F5 — report_definitions 'finance-section' (migracja 916, NIE aplikowana)
   ──────────────────────────────────────────────────────────────────────────── */

const FINANCE_SECTION_DEFINITION_ID = 'finance-section';

/** TRYB 2 (patrzeć) — podgląd live, waliduje rejestrację przez `reportContract.readLive`. */
export async function getFinanceReportSectionLiveView(
  scope: ReportScope & { packId?: string; valuationId?: string }
): Promise<{
  live: Awaited<ReturnType<typeof ReportContract.readLive>>;
  section: FinanceReportSection;
}> {
  const live = await ReportContract.readLive(FINANCE_SECTION_DEFINITION_ID, scope);
  const section = await loadFinanceReportSectionData({
    organizationId: scope.organizationId,
    packId: scope.packId,
    valuationId: scope.valuationId,
    asOf: scope.periodTo ? new Date(scope.periodTo).getTime() : undefined,
  });
  return { live, section };
}

export interface PublishFinanceReportSectionParams {
  organizationId: string;
  createdBy: string;
  packId: string;
  valuationId?: string;
  title?: string;
  periodFrom?: string;
  periodTo?: string;
}

export interface PublishFinanceReportSectionResult {
  reportId: string;
  snapshotId: string;
  section: FinanceReportSection;
  envelope: EvidenceEnvelope;
  /** = section.lineage — wygodny alias, żeby caller (route) nie musiał schodzić do section.lineage. */
  lineage: FinanceReportLineage;
}

/**
 * Enforce gate (RECONCILE_ENFORCE=false today → NEVER thrown, zero behavior change).
 * Thrown by `publishFinanceReportSectionSnapshot` BEFORE any write (createReport/snapshot/
 * envelope) when `RECONCILE_ENFORCE=true` and the pack's persisted reconcile R1-R8 result
 * `blocksReady` (error-severity + fail-status check present). Route layer maps this to
 * HTTP 409 with the violating checks — see `finance-statements.routes.ts` POST
 * `/packs/:id/report-section`.
 */
export class FinanceReportReconcileBlockedError extends Error {
  code = 'RECONCILE_ENFORCE_BLOCKED';
  statusCode = 409;
  packId: string;
  violations: FinanceReconcileCheckRow[];

  constructor(packId: string, violations: FinanceReconcileCheckRow[]) {
    super(
      `Reconcile R1-R8 blocks publikację raportu dla pakietu ${packId} ` +
        `(RECONCILE_ENFORCE=true): ${violations.length} naruszenie(a) blokujące (error+fail).`
    );
    this.name = 'FinanceReportReconcileBlockedError';
    this.packId = packId;
    this.violations = violations;
  }
}

/**
 * PURE decision function behind the enforce gate — extracted so it is unit-testable with an
 * explicit `enforce` flag, without having to flip the real `RECONCILE_ENFORCE` module constant
 * (which stays a hardcoded `false` until DBR77 calibration signs off, per reconciliationService
 * docblock). `publishFinanceReportSectionSnapshot` calls this with no third argument, so it
 * always uses the real switch — defaulting the parameter is what keeps prod behavior identical
 * to before this function existed.
 *   - enforce=false (today, always in prod) → always returns null, regardless of violations.
 *   - enforce=true + reconcile unavailable/clean → null (nothing to block on).
 *   - enforce=true + reconcile.blocksReady → the error to throw, with the violating checks.
 */
export function evaluateReconcileEnforcement(
  packId: string,
  reconcile: FinanceReconcileSummary,
  enforce: boolean = RECONCILE_ENFORCE
): FinanceReportReconcileBlockedError | null {
  if (!enforce || !reconcile.available || !reconcile.blocksReady) return null;
  const violations = reconcile.checks.filter((c) => c.severity === 'error' && c.status === 'fail');
  return new FinanceReportReconcileBlockedError(packId, violations);
}

/**
 * TRYB 1 (publikować) — freeze snapshot immutable + Evidence Envelope. Ścieżka identyczna
 * z `threeAxisReportService.publishThreeAxisSnapshot`:
 *   0. ENFORCE GATE — gdy `RECONCILE_ENFORCE=true` i persystowany reconcile R1-R8 pakietu
 *      `blocksReady` → rzuca `FinanceReportReconcileBlockedError` PRZED jakimkolwiek zapisem
 *      (report/snapshot/envelope). Gdy `RECONCILE_ENFORCE=false` (dziś, domyślnie) — ta gałąź
 *      nigdy się nie wykonuje, zero zmiany zachowania (shadow, patrz reconciliationService).
 *   1. loadFinanceReportSectionData (read-model) → renderFinanceReportMarkdown (sekcje)
 *   2. ReportBuilderService.createReport({sourceType:'FINANCE_SECTION', ...}) — wymaga seeda
 *      `report_builder_templates` (id='tpl-finance-section', migracja 916, NIE aplikowana).
 *   3. ReportContract.createSnapshot(defId, {..., reportId}) → wersja immutable.
 *   4. evidenceEnvelopeService.upsertEnvelope — koperta dowodowa (formuły + progi + benchmark
 *      źródła; computed_by = ten serwis, liczby z silnika TS, nie z LLM).
 */
export async function publishFinanceReportSectionSnapshot(
  params: PublishFinanceReportSectionParams
): Promise<PublishFinanceReportSectionResult> {
  const section = await loadFinanceReportSectionData({
    organizationId: params.organizationId,
    packId: params.packId,
    valuationId: params.valuationId,
  });

  const blocked = evaluateReconcileEnforcement(params.packId, section.reconcile);
  if (blocked) throw blocked;

  const markdown = renderFinanceReportMarkdown(section);

  const title =
    params.title ||
    `Sekcja finansowa — ${section.periodLabel || params.packId} (${section.asOf.slice(0, 10)})`;

  const rb = await ReportBuilderService.createReport({
    organizationId: params.organizationId,
    sourceType: 'FINANCE_SECTION',
    sourceId: params.packId,
    sourceName: title,
    title,
    description: `Sekcja finansowa (wskaźniki Z111 + reconcile R1-R8 + koszyk EV) — wygenerowana z financeReportSectionService, pakiet ${params.packId}.`,
    createdBy: params.createdBy,
    periodFrom: params.periodFrom,
    periodTo: params.periodTo,
    config: {
      packId: params.packId,
      valuationId: params.valuationId ?? null,
      generatedBy: 'financeReportSectionService',
    },
  });

  for (const [sectionKey, content] of Object.entries(markdown)) {
    try {
      await ReportBuilderService.updateSectionContent(
        rb.report.id,
        sectionKey,
        content,
        params.createdBy
      );
    } catch (err) {
      logger.warn(
        `[financeReportSectionService] updateSectionContent(${sectionKey}) failed (non-fatal): ${(err as Error)?.message || err}`
      );
    }
  }

  const snapshot = await ReportContract.createSnapshot(FINANCE_SECTION_DEFINITION_ID, {
    organizationId: params.organizationId,
    createdBy: params.createdBy,
    periodFrom: params.periodFrom,
    periodTo: params.periodTo,
    reportId: rb.report.id,
    title,
  });

  // #82g — jawny LINEAGE: REUŻYWA `section.lineage` (już zbudowany w `composeFinanceReportSection`,
  // czyli identyczny z tym, co widać w live-view PRZED publikacją) jako JEDYNE źródło sources/
  // assumptions envelope — nie ma już drugiego, niezależnie utrzymywanego zbioru "co jest źródłem".
  const { sources: lineageSources, assumptions: lineageAssumptions } = lineageToEvidenceInputs(
    section.lineage
  );

  const envelope = await upsertEvidenceEnvelope({
    organizationId: params.organizationId,
    artifactType: 'report',
    artifactId: snapshot.snapshotId,
    sources: lineageSources,
    assumptions: lineageAssumptions,
    confidence: section.ratios.total > 0 ? section.ratios.computed / section.ratios.total : null,
    toVerify:
      section.ratios.skipped > 0
        ? [
            {
              claim: `${section.ratios.skipped} z ${section.ratios.total} wskaźników pominiętych (brak linii kanonicznej)`,
              why: 'Pakiet nie ma wszystkich wymaganych linii kanonicznych dla tych formuł.',
              suggested_check:
                'Uzupełnić mapowanie linii w pakiecie sprawozdań przed kolejną publikacją.',
            },
          ]
        : [],
    computedBy: {
      service: 'financeReportSectionService',
      version: '1',
      at: new Date().toISOString(),
    },
    createdBy: params.createdBy,
  });

  try {
    await attachEvidenceSource({
      organizationId: params.organizationId,
      artifactType: 'finance_number',
      artifactId: params.packId,
      source: { type: 'snapshot', ref: snapshot.snapshotId, snippet: title },
      createdBy: params.createdBy,
    });
  } catch {
    // best-effort — nie blokuje publikacji (wzorzec threeAxisReportService).
  }

  return {
    reportId: rb.report.id,
    snapshotId: snapshot.snapshotId,
    section,
    envelope,
    lineage: section.lineage,
  };
}

export default {
  composeFinanceReportSection,
  summarizeReconcileValidations,
  mapPackValidationsToReconcileRows,
  loadFinanceReportSectionData,
  loadReconcileSummaryForPack,
  buildFinanceReportLineage,
  lineageToEvidenceInputs,
  loadFinanceReportLineageForPack,
  renderFinanceReportMarkdown,
  getFinanceReportSectionLiveView,
  publishFinanceReportSectionSnapshot,
  evaluateReconcileEnforcement,
  FinanceReportReconcileBlockedError,
};

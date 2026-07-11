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

import logger from '../utils/Logger.js';
import { all as dbAll } from '../utils/DbPromise.js';
import {
  attachSource as attachEvidenceSource,
  upsertEnvelope as upsertEvidenceEnvelope,
  type EvidenceEnvelope,
} from './evidence/evidenceEnvelopeService.js';
import {
  computeDupontFromLines,
  computeFinanceRatioFamilyCatalog,
  groupByFamily,
  type ComputedFamilyRatio,
  type DupontFromLines,
  type LineValueMap,
  type RatioFamily,
} from './financeRatioFamilyCatalog.js';
import { getStatementPackDetail, loadPackValueMaps } from './financialStatementPackService.js';
import {
  buildRatioBenchmark,
  loadOrganizationIndustry,
  type ComputedRatio,
} from './ratioAnalysisService.js';
import { RECONCILE_ENFORCE } from './reconciliationService.js';
import ReportContract, { type ReportScope } from './report/reportContract.js';
import ReportBuilderService from './reportBuilderService.js';
import {
  buildBasketFromResults,
  type BasketConfig,
  type BasketResult,
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
}

export interface FinanceValuationSummary {
  available: boolean;
  valuationId: string | null;
  valuationTitle: string | null;
  basket: BasketResult | null;
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
  reconcileValidations: Array<{
    check_code: string;
    check_name: string;
    severity: string;
    status: string;
    message: string;
    difference: number | null;
    tolerance: number | null;
    details_json: unknown;
    computed_at: string;
  }> | null;
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

/** Emptied section — kontrakt "brak packa→pusty stan" (żadnych zgadywanych liczb). */
function emptyFinanceReportSection(organizationId: string, asOf: string): FinanceReportSection {
  const byFamily = groupByFamily([]);
  return {
    organizationId,
    packId: null,
    entityName: null,
    periodLabel: null,
    currency: 'PLN',
    asOf,
    verdict: 'NA',
    headline: 'Brak gotowego pakietu sprawozdań — sekcja finansowa raportu jest pusta.',
    ratios: { total: 0, computed: 0, skipped: 0, byFamily, dupont: computeDupontFromLines({}) },
    reconcile: {
      available: false,
      enforceMode: RECONCILE_ENFORCE,
      overallStatus: 'na',
      summary: null,
      checks: [],
      computedAt: null,
    },
    valuation: { available: false, valuationId: null, valuationTitle: null, basket: null },
    dataQuality: { statementTypesPresent: [], missingStatementTypes: ['P&L', 'BS', 'CF'], resolvedLineCount: 0 },
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
  let reconcile: FinanceReconcileSummary;
  if (input.reconcileValidations === null) {
    reconcile = {
      available: false,
      enforceMode: RECONCILE_ENFORCE,
      overallStatus: 'na',
      summary: null,
      checks: [],
      computedAt: null,
    };
  } else {
    const summaryRow = input.reconcileValidations.find((v) => v.check_code === 'RECONCILE_SUMMARY') || null;
    const summaryDetails = summaryRow ? safeParseDetails(summaryRow.details_json) : {};
    const checks: FinanceReconcileCheckRow[] = input.reconcileValidations
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
    const overallStatus = (summaryDetails.overallStatus as FinanceReconcileSummary['overallStatus']) || 'na';
    reconcile = {
      available: Boolean(summaryRow) || checks.length > 0,
      enforceMode: RECONCILE_ENFORCE,
      overallStatus,
      summary: (summaryDetails.summary as FinanceReconcileSummary['summary']) || null,
      checks,
      computedAt: summaryRow?.computed_at ?? null,
    };
  }

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
    valuation.basket
      ? valuation.basket.consistencyFlag.triggered
        ? 'AMBER'
        : 'GREEN'
      : 'NA',
  ]);

  const headline =
    `Pakiet ${input.pack.periodLabel || input.pack.packId}: ` +
    `${computedCount}/${ratios.length} wskaźników policzonych (Z111) · ` +
    `reconcile R1-R8 ${reconcile.available ? reconcile.overallStatus : 'niedostępny'} (shadow${RECONCILE_ENFORCE ? '' : ', nie blokuje'}) · ` +
    `EV koszyk ${valuation.basket ? `${valuation.basket.methods.length} metod${valuation.basket.consistencyFlag.triggered ? ', ROZBIEŻNOŚĆ >20%' : ''}` : 'niedostępny'}.`;

  return {
    organizationId: input.organizationId,
    packId: input.pack.packId,
    entityName: input.pack.entityName,
    periodLabel: input.pack.periodLabel,
    currency: input.pack.currency,
    asOf,
    verdict,
    headline,
    ratios: { total: ratios.length, computed: computedCount, skipped: ratios.length - computedCount, byFamily, dupont },
    reconcile,
    valuation,
    dataQuality: {
      statementTypesPresent: input.pack.statementTypesPresent,
      missingStatementTypes: input.pack.missingStatementTypes,
      resolvedLineCount: Object.keys(input.lineValues).length,
    },
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
    logger.warn(`[financeReportSectionService] loadOrgBenchmarkRows failed (degrading to empty): ${(err as Error)?.message || err}`);
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

    const results = (val.results && typeof val.results === 'object' ? val.results : {}) as Record<string, any>;
    // Reuse an already-computed basket verbatim (no recompute) when present; otherwise
    // synthesize purely from whatever DCF/comps results already exist (no I/O, no side
    // effect on the valuation row — a report read must not mutate valuation state).
    let basket: BasketResult | null = (results.basket as BasketResult) || null;
    if (!basket && (results.dcf || results.comps)) {
      const config: BasketConfig =
        results?.assumptions?.basket && typeof results.assumptions.basket === 'object' ? results.assumptions.basket : {};
      basket = buildBasketFromResults(results, config);
    }
    return { id, title: val.title || null, basket };
  } catch (err) {
    logger.warn(`[financeReportSectionService] resolveValuation failed (degrading to unavailable): ${(err as Error)?.message || err}`);
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

  const packValidations: Array<Record<string, any>> = Array.isArray(detail.validations) ? detail.validations : [];
  const reconcileValidations =
    packValidations.length > 0
      ? packValidations.map((v) => ({
          check_code: String(v.check_code),
          check_name: String(v.check_name),
          severity: String(v.severity),
          status: String(v.status),
          message: String(v.message || ''),
          difference: v.difference == null ? null : Number(v.difference),
          tolerance: v.tolerance == null ? null : Number(v.tolerance),
          details_json: v.details_json,
          computed_at: String(v.computed_at || ''),
        }))
      : null; // pakiet nigdy nie przeszedł recompute → brak wpisów, NIE puste tablice = "0 checków"

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
  const dupontLine = section.ratios.dupont.status === 'computed'
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
          .map((c) => `- ${c.status === 'fail' ? '🔴' : '🟡'} **${c.checkCode}** (${c.checkName}) — ${c.message}`),
      ]
        .filter(Boolean)
        .join('\n')
    : ['## Reconcile R1-R8 (shadow)', '', '_Pakiet nie przeszedł jeszcze przeliczenia — brak wyniku._'].join('\n');

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
): Promise<{ live: Awaited<ReturnType<typeof ReportContract.readLive>>; section: FinanceReportSection }> {
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
}

/**
 * TRYB 1 (publikować) — freeze snapshot immutable + Evidence Envelope. Ścieżka identyczna
 * z `threeAxisReportService.publishThreeAxisSnapshot`:
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
  const markdown = renderFinanceReportMarkdown(section);

  const title = params.title || `Sekcja finansowa — ${section.periodLabel || params.packId} (${section.asOf.slice(0, 10)})`;

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
    config: { packId: params.packId, valuationId: params.valuationId ?? null, generatedBy: 'financeReportSectionService' },
  });

  for (const [sectionKey, content] of Object.entries(markdown)) {
    try {
      await ReportBuilderService.updateSectionContent(rb.report.id, sectionKey, content, params.createdBy);
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

  const ratioSources = (Object.keys(section.ratios.byFamily) as RatioFamily[])
    .flatMap((f) => section.ratios.byFamily[f])
    .filter((r) => r.status === 'computed')
    .slice(0, 30)
    .map((r) => ({ type: 'statement_pack' as const, ref: r.code, snippet: `${r.labelPl} = ${r.value}${r.unit}` }));
  const reconcileSources = section.reconcile.checks.slice(0, 20).map((c) => ({
    type: 'statement_pack' as const,
    ref: c.checkCode,
    snippet: `${c.checkName}: ${c.status}${c.difference != null ? ` (Δ${c.difference})` : ''}`,
  }));
  const valuationSources = (section.valuation.basket?.methods || []).map((m) => ({
    type: 'kpi_series' as const,
    ref: m.key,
    snippet: `${m.label}: ${m.low}–${m.high} (mid ${m.mid})`,
  }));

  const envelope = await upsertEvidenceEnvelope({
    organizationId: params.organizationId,
    artifactType: 'report',
    artifactId: snapshot.snapshotId,
    sources: [...ratioSources, ...reconcileSources, ...valuationSources],
    assumptions: [
      {
        key: 'ratio_engine',
        value: 'financeRatioFamilyCatalog.computeFinanceRatioFamilyCatalog (Z111, 24 wskaźników / 5 rodzin)',
        source_type: 'imported',
        rationale: 'Brak wartości linii kanonicznej = skipped (null), nigdy 0 (doktryna "no guessing").',
      },
      {
        key: 'reconcile_engine',
        value: 'reconciliationService.reconcileStatements (R1-R8) — CZYTANE z persystowanego shadow-wyniku, nie przeliczane',
        source_type: 'imported',
        rationale: `RECONCILE_ENFORCE=${RECONCILE_ENFORCE} — obserwacyjny, nie blokuje readiness pakietu.`,
      },
      {
        key: 'valuation_engine',
        value: 'valuationBasketService.buildBasketFromResults (M1 DCF, M2 comps, M3 precedent, M4 asset/income)',
        source_type: 'imported',
      },
    ],
    confidence: section.ratios.total > 0 ? section.ratios.computed / section.ratios.total : null,
    toVerify: section.ratios.skipped > 0
      ? [
          {
            claim: `${section.ratios.skipped} z ${section.ratios.total} wskaźników pominiętych (brak linii kanonicznej)`,
            why: 'Pakiet nie ma wszystkich wymaganych linii kanonicznych dla tych formuł.',
            suggested_check: 'Uzupełnić mapowanie linii w pakiecie sprawozdań przed kolejną publikacją.',
          },
        ]
      : [],
    computedBy: { service: 'financeReportSectionService', version: '1', at: new Date().toISOString() },
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

  return { reportId: rb.report.id, snapshotId: snapshot.snapshotId, section, envelope };
}

export default {
  composeFinanceReportSection,
  loadFinanceReportSectionData,
  renderFinanceReportMarkdown,
  getFinanceReportSectionLiveView,
  publishFinanceReportSectionSnapshot,
};

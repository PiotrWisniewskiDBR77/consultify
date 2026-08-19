/**
 * Three-Axis Executive Report — read-model + F5 wiring (Program Management flagship).
 * =====================================================================================
 * SSOT: `Harvard/wdrozenie-100/_KONCEPT_PROGRAM_MANAGEMENT_2026-07-10.md` §6
 * (wzorzec „3 osie" — McKinsey Wave) + `_KONCEPT_RDZEN_2026-07-10.md` §4 (kontrakt F5)
 * §3 (Evidence Layer). Decyzje przyjęte jako fakt (patrz pigułka robotnika):
 *   - oś WARTOŚĆ (W) = `value_ledger` (banked, D-G) — NIE `initiative_benefits`
 *     (ten rejestr ma znany defekt rozłączenia G1, patrz `_KONCEPT_RDZEN` §6.1;
 *     naprawa G1 = osobny workstream, właściciel Results/M15).
 *   - kadencja Wave wymuszona (wyłączalna) — POZA zakresem tego serwisu (kadencja
 *     żyje w `reportCadenceService`; ten plik dostarcza TYLKO read-model + kontrakt).
 *   - capacity = estymaty (D-F) — nie dotyczy tego raportu (workload = PM4, osobno).
 *
 * TRZY OSIE (0-100%, per inicjatywa i per zakres — projekt/program/organizacja):
 *   T — CZAS      (dziś − baseline_start) / (baseline_end − baseline_start)
 *                 = dokładnie ułamek PV liczony przez `evmService` (pv/bac) — ZERO
 *                 duplikacji matematyki: PV jest już "czas × BAC" (time-phasing).
 *   Z — ZADANIA    EV/BAC — `evmService.deriveInitiativeEvm(...).percentComplete`
 *                 (wagi milestone'ów już liczone w evmService, gdy dostępne).
 *   W — WARTOŚĆ    Σ(value_baselines.frozen_value aktywnych KPI + Σ ledger delta)
 *                 / Σ(initiative_kpis.target_value tych samych KPI) — dokładnie
 *                 wzorzec `projectFinanceRollupService.getValueRollup` (Delta B),
 *                 rozszerzony o target z `initiative_kpis` (kanon PM §4.4).
 *
 * POCHODNE (sedno raportu — §6 koncept):
 *   scheduleHealth (Z-vs-T) = SPI = EV/PV — MATEMATYCZNIE identyczne z evmService.spi
 *                             (bo (EV/BAC)/(PV/BAC) = EV/PV), więc czytamy je wprost
 *                             z EvmResult zamiast przeliczać drugi raz.
 *   impactGap      (W-vs-Z) = "czy praca przekłada się na wartość" — NAJCENNIEJSZY
 *                             sygnał wg doktryny Piotra (realization lag).
 *   deliveryPromise(W-vs-T) = "czy obietnica programu jest dowożona w czasie".
 *
 * Ten plik jest CZYSTYM read-modelem (żadnych nowych tabel wartości — zero nowej
 * księgi, zgodnie z rdzeniem §4.4). Wpięcie w F5 (tryb live/snapshot) i Evidence
 * Envelope są w dolnej połowie pliku (sekcja „WPIĘCIE W F5").
 */

import logger from '../../utils/Logger.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import { computeCanonicalExecutionHealth } from './canonicalExecutionHealthService.js';
import {
  attachSource as attachEvidenceSource,
  type EvidenceEnvelope,
  upsertEnvelope as upsertEvidenceEnvelope,
} from '../evidence/evidenceEnvelopeService.js';
import { deriveInitiativeEvm, derivePortfolioEvm, type EvmResult } from '../evmService.js';
import { getActualCostByInitiative } from '../executionBudgetService.js';
import ReportContract, { type ReportScope } from '../report/reportContract.js';
import ReportBuilderService from '../reportBuilderService.js';

/* ────────────────────────────────────────────────────────────────────────────
   Typy
   ──────────────────────────────────────────────────────────────────────────── */

export type RagLabel = 'GREEN' | 'AMBER' | 'RED' | 'NA';

export interface AxisReading {
  /** 0..100 (W może przekroczyć 100 — nadwykonanie targetu). null = brak danych. */
  pct: number | null;
  dataQuality: 'ok' | 'missing';
  flags: string[];
}

export interface AxisRatio {
  ratio: number | null;
  rag: RagLabel;
}

export interface ThreeAxisRow {
  initiativeId: string;
  name: string;
  status: string;
  projectId: string | null;
  programId: string | null;
  T: AxisReading;
  Z: AxisReading;
  W: AxisReading;
  /** Z-vs-T — zdrowie harmonogramu (= SPI). */
  scheduleHealth: AxisRatio;
  /** W-vs-Z — luka wpływu: praca nie przynosi wartości (sedno raportu). */
  impactGap: AxisRatio;
  /** W-vs-T — czy obietnica programu jest dowożona w czasie. */
  deliveryPromise: AxisRatio;
  /** Worst-of-three — RAG wiersza. */
  rag: RagLabel;
  raw: {
    bac: number;
    evm: EvmResult | null;
    valueCurrent: number | null;
    valueTarget: number | null;
  };
}

export interface ThreeAxisAggregate {
  initiativeCount: number;
  T: AxisReading;
  Z: AxisReading;
  W: AxisReading;
  scheduleHealth: AxisRatio;
  impactGap: AxisRatio;
  deliveryPromise: AxisRatio;
  rag: RagLabel;
}

export interface ThreeAxisScope {
  organizationId: string;
  projectId?: string;
  programId?: string;
  /** Epoch ms. Domyślnie: teraz. */
  asOf?: number;
}

export interface ThreeAxisReport {
  organizationId: string;
  scope: { projectId?: string; programId?: string; level: 'project' | 'program' | 'organization' };
  asOf: string;
  /** Agregat całego zakresu (wiersz "program" w grafice §6 pkt 2). */
  program: ThreeAxisAggregate;
  rows: ThreeAxisRow[];
  /** Sekcja "wyjątki TYLKO" (BCG) — top 5 najgorszych odchyleń per para. */
  exceptions: {
    scheduleGap: ThreeAxisRow[];
    impactGap: ThreeAxisRow[];
  };
  dataQuality: {
    initiativesTotal: number;
    withCostBaseline: number;
    withValueBaseline: number;
    withScheduleDates: number;
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   Pure math (bez DB — testowalne w izolacji, wzorzec evmService.ts)
   ──────────────────────────────────────────────────────────────────────────── */

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * T — ułamek czasu, który upłynął między baseline_start i baseline_end (§6 formuła
 * dosłowna: (dziś − start)/(end − start), clamp 0..1). Identyczna matematyka jak
 * PV time-phasing w `evmService.deriveInitiativeEvm` — pisana tu osobno TYLKO po to,
 * by T-oś działała nawet gdy inicjatywa nie ma kosztorysu (BAC=0), bo evmService
 * zwraca `null` w całości, gdy `bac <= 0`.
 */
export function timeElapsedFraction(
  plannedStart: string | null | undefined,
  plannedEnd: string | null | undefined,
  asOf: number
): number | null {
  const start = plannedStart ? new Date(plannedStart).getTime() : NaN;
  const end = plannedEnd ? new Date(plannedEnd).getTime() : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return clamp01((asOf - start) / (end - start));
}

/** RAG z indeksu wydajności — PROGI IDENTYCZNE z evmService.indexRag (spójność doktryny). */
function ratioRag(ratio: number | null): RagLabel {
  if (ratio === null || !Number.isFinite(ratio)) return 'NA';
  if (ratio >= 0.95) return 'GREEN';
  if (ratio >= 0.85) return 'AMBER';
  return 'RED';
}

/** Worst-of — ta sama konwencja co evmService.worse, uogólniona na N wartości. */
function worstRag(rags: RagLabel[]): RagLabel {
  const order: RagLabel[] = ['RED', 'AMBER', 'GREEN', 'NA'];
  let best = order.length - 1;
  for (const r of rags) {
    const idx = order.indexOf(r);
    if (idx >= 0 && idx < best) best = idx;
  }
  return order[best];
}

export function computeAxisT(
  plannedStart: string | null | undefined,
  plannedEnd: string | null | undefined,
  asOf: number
): AxisReading {
  const frac = timeElapsedFraction(plannedStart, plannedEnd, asOf);
  if (frac === null) return { pct: null, dataQuality: 'missing', flags: ['no-schedule-dates'] };
  return { pct: round1(frac * 100), dataQuality: 'ok', flags: [] };
}

export function computeAxisZ(evm: EvmResult | null): AxisReading {
  if (!evm || evm.percentComplete === null) {
    return { pct: null, dataQuality: 'missing', flags: ['no-cost-baseline'] };
  }
  return { pct: round1(evm.percentComplete * 100), dataQuality: 'ok', flags: [] };
}

export function computeAxisW(
  value: { current: number; target: number } | undefined | null
): AxisReading {
  if (!value || !(value.target > 0)) {
    return { pct: null, dataQuality: 'missing', flags: ['no-value-baseline'] };
  }
  return { pct: round1((value.current / value.target) * 100), dataQuality: 'ok', flags: [] };
}

export function computeScheduleHealth(evm: EvmResult | null): AxisRatio {
  if (!evm || evm.spi === null) return { ratio: null, rag: 'NA' };
  return { ratio: evm.spi, rag: computeCanonicalExecutionHealth({ spi: evm.spi }).rag };
}

/** W-vs-Z — impact gap. Ratio, nie delta: Z=10%/W=8% ≠ Z=90%/W=88% jako sygnał. */
export function computeImpactGap(W: AxisReading, Z: AxisReading): AxisRatio {
  if (W.pct === null || Z.pct === null || Z.pct <= 0) return { ratio: null, rag: 'NA' };
  const ratio = W.pct / Z.pct;
  return { ratio, rag: ratioRag(ratio) };
}

export function computeDeliveryPromise(W: AxisReading, T: AxisReading): AxisRatio {
  if (W.pct === null || T.pct === null || T.pct <= 0) return { ratio: null, rag: 'NA' };
  const ratio = W.pct / T.pct;
  return { ratio, rag: ratioRag(ratio) };
}

/* ────────────────────────────────────────────────────────────────────────────
   DB — fetchers (batched, fail-soft — wzorzec projectFinanceRollupService.ts)
   ──────────────────────────────────────────────────────────────────────────── */

interface InitiativeRow {
  id: string;
  name: string | null;
  status: string;
  project_id: string | null;
  program_id: string | null;
  cost_capex: number | null;
  cost_opex: number | null;
  planned_start_date: string | null;
  planned_end_date: string | null;
  progress: number | null;
}

async function fetchInitiatives(scope: ThreeAxisScope): Promise<InitiativeRow[]> {
  const params: unknown[] = [scope.organizationId];
  let where = 'organization_id = ?';
  if (scope.projectId) {
    where += ' AND project_id = ?';
    params.push(scope.projectId);
  } else if (scope.programId) {
    where += ' AND program_id = ?';
    params.push(scope.programId);
  }
  // Konsystentne z executionBudgetService.getPortfolioBudgetSummary — DRAFT/CANCELLED/
  // ARCHIVED nie są "w realizacji", raport 3 osi liczy portfel wykonawczy.
  where += " AND status NOT IN ('DRAFT', 'CANCELLED', 'ARCHIVED')";
  try {
    return await queryHelpers.queryAll<InitiativeRow>(
      `SELECT id, name, status, project_id, program_id, cost_capex, cost_opex,
              planned_start_date, planned_end_date, progress
         FROM initiatives WHERE ${where} ORDER BY name ASC`,
      params
    );
  } catch (err) {
    logger.warn(
      `[threeAxisReportService] fetchInitiatives failed (degrading to empty): ${(err as Error)?.message || err}`
    );
    return [];
  }
}

interface ValueAxisRow {
  current: number;
  target: number;
  kpiCount: number;
}

/**
 * Oś W batched: Σ frozen_value (aktywne baseline'y) + Σ ledger delta (raz per
 * inicjatywa, KANON Delta B) / Σ target_value tych samych KPI (join na kpi_id —
 * numerator i denominator nad TYM SAMYM zbiorem KPI, żeby ratio było sensowne).
 */
async function fetchValueAxis(
  organizationId: string,
  initiativeIds: string[]
): Promise<Map<string, ValueAxisRow>> {
  const map = new Map<string, ValueAxisRow>();
  if (initiativeIds.length === 0) return map;
  try {
    const placeholders = queryHelpers.buildInPlaceholders(initiativeIds);
    const [baselineRows, ledgerRows] = await Promise.all([
      queryHelpers.queryAll<{
        initiative_id: string;
        baseline_total: number;
        target_total: number;
        kpi_count: number;
      }>(
        `SELECT vb.initiative_id AS initiative_id,
                SUM(vb.frozen_value) AS baseline_total,
                SUM(COALESCE(ik.target_value, 0)) AS target_total,
                COUNT(*) AS kpi_count
           FROM value_baselines vb
           JOIN initiative_kpis ik ON ik.id = vb.kpi_id
          WHERE vb.organization_id = ? AND vb.is_active = 1 AND vb.initiative_id IN (${placeholders})
          GROUP BY vb.initiative_id`,
        [organizationId, ...initiativeIds]
      ),
      queryHelpers.queryAll<{ initiative_id: string; delta_total: number }>(
        `SELECT initiative_id, SUM(value_delta) AS delta_total
           FROM value_ledger_entries
          WHERE organization_id = ? AND initiative_id IN (${placeholders})
          GROUP BY initiative_id`,
        [organizationId, ...initiativeIds]
      ),
    ]);

    const deltaByIni = new Map<string, number>();
    for (const row of ledgerRows || [])
      deltaByIni.set(String(row.initiative_id), Number(row.delta_total) || 0);

    for (const row of baselineRows || []) {
      const id = String(row.initiative_id);
      const baseline = Number(row.baseline_total) || 0;
      const delta = deltaByIni.get(id) ?? 0;
      map.set(id, {
        current: baseline + delta,
        target: Number(row.target_total) || 0,
        kpiCount: Number(row.kpi_count) || 0,
      });
    }
    return map;
  } catch (err) {
    logger.warn(
      `[threeAxisReportService] fetchValueAxis failed (degrading to empty): ${(err as Error)?.message || err}`
    );
    return map;
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   Read-model — buildThreeAxisReport (główny eksport)
   ──────────────────────────────────────────────────────────────────────────── */

export async function buildThreeAxisReport(scope: ThreeAxisScope): Promise<ThreeAxisReport> {
  const asOf = scope.asOf ?? Date.now();
  const initiatives = await fetchInitiatives(scope);
  const initiativeIds = initiatives.map((i) => String(i.id));

  const [actualCostByIni, valueByIni] = await Promise.all([
    getActualCostByInitiative(scope.organizationId, initiativeIds).catch(
      () => new Map<string, number>()
    ),
    fetchValueAxis(scope.organizationId, initiativeIds),
  ]);

  const evmSources = initiatives.map((ini) => ({
    bac: (Number(ini.cost_capex) || 0) + (Number(ini.cost_opex) || 0),
    plannedStart: ini.planned_start_date,
    plannedEnd: ini.planned_end_date,
    progressPct: Number(ini.progress) || 0,
    actualCost: actualCostByIni.get(String(ini.id)) ?? null,
  }));

  const rows: ThreeAxisRow[] = initiatives.map((ini, idx) => {
    const bac = evmSources[idx].bac;
    const evm = deriveInitiativeEvm(evmSources[idx], asOf);
    const T = computeAxisT(ini.planned_start_date, ini.planned_end_date, asOf);
    const Z = computeAxisZ(evm);
    const value = valueByIni.get(String(ini.id));
    const W = computeAxisW(value);
    const scheduleHealth = computeScheduleHealth(evm);
    const impactGap = computeImpactGap(W, Z);
    const deliveryPromise = computeDeliveryPromise(W, T);
    return {
      initiativeId: String(ini.id),
      name: ini.name || String(ini.id),
      status: ini.status,
      projectId: ini.project_id,
      programId: ini.program_id,
      T,
      Z,
      W,
      scheduleHealth,
      impactGap,
      deliveryPromise,
      rag: worstRag([scheduleHealth.rag, impactGap.rag, deliveryPromise.rag]),
      raw: {
        bac,
        evm,
        valueCurrent: value?.current ?? null,
        valueTarget: value?.target ?? null,
      },
    };
  });

  // Agregat zakresu — reużywa `derivePortfolioEvm` (kanon EVM) 1:1 dla T/Z, żeby
  // agregacja portfelowa T/Z była DOKŁADNIE tą samą matematyką co portfolio-health.
  const portfolioEvm = derivePortfolioEvm(evmSources, asOf);

  let aggValueCurrent = 0;
  let aggValueTarget = 0;
  let valueContributing = 0;
  for (const ini of initiatives) {
    const v = valueByIni.get(String(ini.id));
    if (v && v.target > 0) {
      aggValueCurrent += v.current;
      aggValueTarget += v.target;
      valueContributing += 1;
    }
  }

  const aggT: AxisReading =
    portfolioEvm && portfolioEvm.bac > 0
      ? { pct: round1((portfolioEvm.pv / portfolioEvm.bac) * 100), dataQuality: 'ok', flags: [] }
      : { pct: null, dataQuality: 'missing', flags: ['no-cost-baseline'] };
  const aggZ: AxisReading =
    portfolioEvm && portfolioEvm.percentComplete !== null
      ? { pct: round1(portfolioEvm.percentComplete * 100), dataQuality: 'ok', flags: [] }
      : { pct: null, dataQuality: 'missing', flags: ['no-cost-baseline'] };
  const aggW: AxisReading =
    aggValueTarget > 0
      ? { pct: round1((aggValueCurrent / aggValueTarget) * 100), dataQuality: 'ok', flags: [] }
      : { pct: null, dataQuality: 'missing', flags: ['no-value-baseline'] };
  const aggScheduleHealth: AxisRatio =
    portfolioEvm && portfolioEvm.spi !== null
      ? {
          ratio: portfolioEvm.spi,
          rag: computeCanonicalExecutionHealth({ spi: portfolioEvm.spi }).rag,
        }
      : { ratio: null, rag: 'NA' };
  const aggImpactGap = computeImpactGap(aggW, aggZ);
  const aggDeliveryPromise = computeDeliveryPromise(aggW, aggT);

  const program: ThreeAxisAggregate = {
    initiativeCount: initiatives.length,
    T: aggT,
    Z: aggZ,
    W: aggW,
    scheduleHealth: aggScheduleHealth,
    impactGap: aggImpactGap,
    deliveryPromise: aggDeliveryPromise,
    rag: worstRag([aggScheduleHealth.rag, aggImpactGap.rag, aggDeliveryPromise.rag]),
  };

  // §6 „wyjątki TYLKO" (BCG minimum-sufficiency) — top 5 najgorszych per para.
  const scheduleGap = rows
    .filter((r) => r.scheduleHealth.ratio !== null)
    .sort((a, b) => (a.scheduleHealth.ratio as number) - (b.scheduleHealth.ratio as number))
    .slice(0, 5);
  const impactGapTop = rows
    .filter((r) => r.impactGap.ratio !== null)
    .sort((a, b) => (a.impactGap.ratio as number) - (b.impactGap.ratio as number))
    .slice(0, 5);

  return {
    organizationId: scope.organizationId,
    scope: {
      projectId: scope.projectId,
      programId: scope.programId,
      level: scope.projectId ? 'project' : scope.programId ? 'program' : 'organization',
    },
    asOf: new Date(asOf).toISOString(),
    program,
    rows,
    exceptions: { scheduleGap, impactGap: impactGapTop },
    dataQuality: {
      initiativesTotal: initiatives.length,
      withCostBaseline: rows.filter((r) => r.Z.dataQuality === 'ok').length,
      withValueBaseline: rows.filter((r) => r.W.dataQuality === 'ok').length,
      withScheduleDates: rows.filter((r) => r.T.dataQuality === 'ok').length,
    },
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   WPIĘCIE W F5 — report_definitions 'sponsor-3axis' (migracja 913)
   ──────────────────────────────────────────────────────────────────────────── */

const SPONSOR_3AXIS_DEFINITION_ID = 'sponsor-3axis';

/** Skala 0-100 → pasek ASCII (7 kratek), do markdown/appendixu — czytelne bez frontu. */
function bar(pct: number | null): string {
  if (pct === null) return '░░░░░░░ n/d';
  const filled = Math.max(0, Math.min(7, Math.round(clamp01(pct / 100) * 7)));
  return '▓'.repeat(filled) + '░'.repeat(7 - filled) + ` ${round1(pct)}%`;
}

function ragEmoji(rag: RagLabel): string {
  return rag === 'GREEN' ? '🟢' : rag === 'AMBER' ? '🟡' : rag === 'RED' ? '🔴' : '⚪';
}

/**
 * TRYB 2 (patrzeć) — podgląd na żywo. Waliduje rejestrację definicji przez
 * `reportContract.readLive` (kontrakt F5), potem liczy realne osie z read-modelu.
 * Definicja MUSI istnieć w `report_definitions` (migracja 913) zanim to zawoła.
 */
export async function getThreeAxisLiveView(
  scope: ReportScope & { programId?: string }
): Promise<{ live: Awaited<ReturnType<typeof ReportContract.readLive>>; report: ThreeAxisReport }> {
  const live = await ReportContract.readLive(SPONSOR_3AXIS_DEFINITION_ID, scope);
  const report = await buildThreeAxisReport({
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    programId: scope.programId,
    asOf: scope.periodTo ? new Date(scope.periodTo).getTime() : undefined,
  });
  return { live, report };
}

/** Markdown per sekcja — anatomia §6: nagłówek+RAG / 3 osie / wyjątki / alerty / narracja / aneks. */
export function renderThreeAxisMarkdown(report: ThreeAxisReport): Record<string, string> {
  const header = [
    `# Raport wykonawczy — 3 osie (${report.scope.level})`,
    ``,
    `**Zakres:** ${report.scope.projectId ? `projekt ${report.scope.projectId}` : report.scope.programId ? `program ${report.scope.programId}` : 'cała organizacja'}`,
    `**Stan na:** ${report.asOf}`,
    `**Werdykt programu:** ${ragEmoji(report.program.rag)} ${report.program.rag}`,
    ``,
    `Pokrycie danych: ${report.dataQuality.withCostBaseline}/${report.dataQuality.initiativesTotal} inicjatyw z kosztorysem · ` +
      `${report.dataQuality.withValueBaseline}/${report.dataQuality.initiativesTotal} z targetem wartości · ` +
      `${report.dataQuality.withScheduleDates}/${report.dataQuality.initiativesTotal} z datami harmonogramu.`,
  ].join('\n');

  const overviewHeader =
    '| Inicjatywa | T (czas) | Z (zadania) | W (wartość) | RAG |\n|---|---|---|---|---|';
  const overviewProgramRow = `| **PROGRAM (agregat)** | ${bar(report.program.T.pct)} | ${bar(report.program.Z.pct)} | ${bar(report.program.W.pct)} | ${ragEmoji(report.program.rag)} |`;
  const overviewRows = report.rows
    .map(
      (r) =>
        `| ${r.name} | ${bar(r.T.pct)} | ${bar(r.Z.pct)} | ${bar(r.W.pct)} | ${ragEmoji(r.rag)} |`
    )
    .join('\n');
  const overview = [
    '## Trzy osie — program i inicjatywy',
    '',
    overviewHeader,
    overviewProgramRow,
    overviewRows || '| — | — | — | — | — |',
  ].join('\n');

  const excScheduleRows = report.exceptions.scheduleGap.length
    ? report.exceptions.scheduleGap
        .map(
          (r) =>
            `- ${ragEmoji(r.scheduleHealth.rag)} **${r.name}** — SPI (Z-vs-T) = ${r.scheduleHealth.ratio?.toFixed(2)}`
        )
        .join('\n')
    : '_Brak odchyleń harmonogramu powyżej progu._';
  const excImpactRows = report.exceptions.impactGap.length
    ? report.exceptions.impactGap
        .map(
          (r) =>
            `- ${ragEmoji(r.impactGap.rag)} **${r.name}** — W/Z (luka wpływu) = ${r.impactGap.ratio?.toFixed(2)} — praca wykonana, wartość NIE nadąża`
        )
        .join('\n')
    : '_Brak luki wpływu powyżej progu._';
  const exceptions = [
    '## Wyjątki (tylko odchylenia — BCG minimum-sufficiency)',
    '',
    '### Zdrowie harmonogramu (Z-vs-T = SPI)',
    excScheduleRows,
    '',
    '### Luka wpływu (W-vs-Z) — praca nie przynosi wartości',
    excImpactRows,
  ].join('\n');

  const alerts = [
    '## Alerty i decyzje wymagane',
    '',
    '_TODO PM3 (Alerty §3.2 koncept PM) — ten raport dziś tylko CZYTA read-model;',
    'wpięcie triage/eskalacji z warstwy Alertów jest osobnym krokiem (adapter na',
    'ManagerProblemRow), nie duplikujemy tu logiki triage._',
  ].join('\n');

  const narrative = [
    '## Narracja',
    '',
    '_TODO F6/Teresa — narracja generowana WYŁĄCZNIE nad policzonymi liczbami',
    '(`generateAiNarrative`), zero liczb generowanych przez model. Ten serwis',
    'dostarcza liczby; komentarz doklejany jest w kroku publikacji._',
  ].join('\n');

  const appendixHeader =
    '| Inicjatywa | Status | BAC | PV | EV | AC | SPI | CPI | Wartość aktualna | Wartość target |\n|---|---|---:|---:|---:|---:|---:|---:|---:|---:|';
  const appendixRows = report.rows
    .map(
      (r) =>
        `| ${r.name} | ${r.status} | ${r.raw.evm?.bac ?? '—'} | ${r.raw.evm?.pv ?? '—'} | ${r.raw.evm?.ev ?? '—'} | ${r.raw.evm?.ac ?? '—'} | ${r.raw.evm?.spi ?? '—'} | ${r.raw.evm?.cpi ?? '—'} | ${r.raw.valueCurrent ?? '—'} | ${r.raw.valueTarget ?? '—'} |`
    )
    .join('\n');
  const appendix = [
    '## Aneks — pełna tabela',
    '',
    appendixHeader,
    appendixRows || '| — | — | — | — | — | — | — | — | — | — |',
  ].join('\n');

  return {
    header,
    three_axis_overview: overview,
    exceptions,
    alerts_decisions: alerts,
    narrative,
    appendix,
  };
}

export interface PublishThreeAxisSnapshotParams {
  organizationId: string;
  createdBy: string;
  projectId?: string;
  programId?: string;
  title?: string;
  periodFrom?: string;
  periodTo?: string;
}

export interface PublishThreeAxisSnapshotResult {
  reportId: string;
  snapshotId: string;
  report: ThreeAxisReport;
  envelope: EvidenceEnvelope;
}

/**
 * TRYB 1 (publikować) — freeze snapshot immutable + Evidence Envelope (kontrakt
 * §3.2 punkt 2 rdzenia: "Snapshot F5 (ogniwo 6) — createSnapshot zapisuje lineage
 * + envelope w JSON snapshotu"). Ścieżka:
 *   1. buildThreeAxisReport (read-model) → renderThreeAxisMarkdown (sekcje)
 *   2. ReportBuilderService.createReport({sourceType:'PROGRAM_3AXIS', ...}) — realny
 *      raport-artefakt (kanon F5), tworzony przez zaseedowany szablon (migracja 913)
 *      — dokładnie wzorzec `results-kpi-reports.routes.ts` (RESULTS_KPI_REPORT).
 *   3. ReportContract.createSnapshot(defId, {..., reportId}) → wersja immutable
 *      (`report_builder_versions`, append-only) — TO JEST snapshotId.
 *   4. evidenceEnvelopeService.upsertEnvelope — koperta dowodowa na snapshocie:
 *      sources = referencje do EVM/CPM/value_ledger per inicjatywa; assumptions =
 *      progi RAG + formuły osi; computed_by = ten serwis (liczby z silnika TS,
 *      nie z LLM — F6 grounding).
 */
export async function publishThreeAxisSnapshot(
  params: PublishThreeAxisSnapshotParams
): Promise<PublishThreeAxisSnapshotResult> {
  const report = await buildThreeAxisReport({
    organizationId: params.organizationId,
    projectId: params.projectId,
    programId: params.programId,
  });
  const markdown = renderThreeAxisMarkdown(report);

  const scopeLabel = params.projectId
    ? `projekt ${params.projectId}`
    : params.programId
      ? `program ${params.programId}`
      : 'organizacja';
  const title =
    params.title || `Raport wykonawczy 3 osi — ${scopeLabel} (${report.asOf.slice(0, 10)})`;

  const rb = await ReportBuilderService.createReport({
    organizationId: params.organizationId,
    sourceType: 'PROGRAM_3AXIS',
    sourceId: params.projectId || params.programId || params.organizationId,
    sourceName: title,
    title,
    description: `Raport 3 osi (czas × zadania × wartość) — wygenerowany z threeAxisReportService, zakres: ${scopeLabel}.`,
    createdBy: params.createdBy,
    periodFrom: params.periodFrom,
    periodTo: params.periodTo,
    config: {
      scope: { projectId: params.projectId ?? null, programId: params.programId ?? null },
      generatedBy: 'threeAxisReportService',
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
        `[threeAxisReportService] updateSectionContent(${sectionKey}) failed (non-fatal): ${(err as Error)?.message || err}`
      );
    }
  }

  const snapshot = await ReportContract.createSnapshot(SPONSOR_3AXIS_DEFINITION_ID, {
    organizationId: params.organizationId,
    createdBy: params.createdBy,
    projectId: params.projectId,
    periodFrom: params.periodFrom,
    periodTo: params.periodTo,
    reportId: rb.report.id,
    title,
  });

  // Evidence Envelope na snapshocie (kontrakt §3.1/§3.2 rdzenia) — sources = per-
  // inicjatywa referencje do EVM/value_ledger, assumptions = formuły osi + progi RAG.
  const sources = report.rows.slice(0, 20).map((r) => ({
    type: 'kpi_series' as const,
    ref: r.initiativeId,
    snippet: `T=${r.T.pct ?? 'n/d'}% Z=${r.Z.pct ?? 'n/d'}% W=${r.W.pct ?? 'n/d'}% (SPI=${r.scheduleHealth.ratio ?? 'n/d'})`,
  }));
  const envelope = await upsertEvidenceEnvelope({
    organizationId: params.organizationId,
    artifactType: 'report',
    artifactId: snapshot.snapshotId,
    sources,
    assumptions: [
      {
        key: 'axis_T_formula',
        value: '(dziś − baseline_start) / (baseline_end − baseline_start), clamp 0..1',
        source_type: 'imported',
        rationale:
          'evmService PV time-phasing (identyczna matematyka, patrz docblock threeAxisReportService.ts)',
      },
      {
        key: 'axis_Z_formula',
        value: 'EV/BAC (evmService.deriveInitiativeEvm.percentComplete)',
        source_type: 'imported',
      },
      {
        key: 'axis_W_formula',
        value:
          'Σ(value_baselines.frozen_value aktywnych KPI + Σ ledger.value_delta) / Σ(initiative_kpis.target_value)',
        source_type: 'imported',
        rationale:
          'Decyzja D-G: oś WARTOŚĆ = value_ledger (banked), NIE initiative_benefits (G1 defekt).',
      },
      {
        key: 'rag_thresholds',
        value: '>=0.95 GREEN, >=0.85 AMBER, else RED (identyczne z evmService.indexRag)',
        source_type: 'imported',
      },
    ],
    confidence:
      report.dataQuality.initiativesTotal > 0
        ? Math.min(
            1,
            (report.dataQuality.withCostBaseline + report.dataQuality.withValueBaseline) /
              (2 * report.dataQuality.initiativesTotal)
          )
        : null,
    toVerify:
      report.dataQuality.withValueBaseline < report.dataQuality.initiativesTotal
        ? [
            {
              claim: `${report.dataQuality.initiativesTotal - report.dataQuality.withValueBaseline} inicjatyw bez aktywnego baseline'u wartości`,
              why: 'Oś W pokazuje "n/d" dla tych inicjatyw — brak `value_baselines` z `is_active=1` sprzężonego z `initiative_kpis.target_value`.',
              suggested_check:
                'Zamrozić baseline KPI (valueLedgerService.freezeBaseline) dla brakujących inicjatyw przed kolejną publikacją.',
            },
          ]
        : [],
    computedBy: { service: 'threeAxisReportService', version: '1', at: new Date().toISOString() },
    createdBy: params.createdBy,
  });

  // Best-effort: krawędzie graf dowodowy report→initiative (nawigacja "Used in").
  for (const row of report.rows.slice(0, 20)) {
    try {
      await attachEvidenceSource({
        organizationId: params.organizationId,
        artifactType: 'initiative',
        artifactId: row.initiativeId,
        source: { type: 'snapshot', ref: snapshot.snapshotId, snippet: title },
        createdBy: params.createdBy,
      });
    } catch {
      // best-effort — nie blokuje publikacji (patrz evidenceEnvelopeService.tryLinkGraphEdge).
    }
  }

  return { reportId: rb.report.id, snapshotId: snapshot.snapshotId, report, envelope };
}

export default {
  buildThreeAxisReport,
  getThreeAxisLiveView,
  publishThreeAxisSnapshot,
  renderThreeAxisMarkdown,
  computeAxisT,
  computeAxisZ,
  computeAxisW,
  computeScheduleHealth,
  computeImpactGap,
  computeDeliveryPromise,
  timeElapsedFraction,
};

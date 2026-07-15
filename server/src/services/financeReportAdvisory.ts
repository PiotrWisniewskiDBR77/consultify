/**
 * financeReportAdvisory — O4.2/O4.3 wiring for the finance report section
 * (OXFORD O4 "Finanse jako doradztwo").
 * =============================================================================================
 * `financeScenarioLevers.ts` (O4.2, named business levers) and `financeValueTree.ts` (O4.3,
 * benefit decomposition) are fully built and unit-tested engines with ZERO callers anywhere in
 * the app before this file — this is their first real caller, wired into
 * `financeReportSectionService.composeFinanceReportSection` (see that file for O4.4/portfolio
 * wiring, which needs DB access this pure module deliberately avoids).
 *
 * HARD RULE (matches `financeReportConclusion.ts` sibling): every number produced here is
 * arithmetic over lines ALREADY present in `LineValueMap` (`REVENUE`, `NET_INCOME` — the same
 * canonical lines `financeRatioFamilyCatalog` reads). No LLM, no I/O, no invented magnitude.
 * Missing lines → honestly unavailable (`available: false`), never a guessed number.
 *
 * SCENARIO METRIC (O4.2): the existing `scenarioComputeService` multiplier convention
 * (`growthMult` on revenue-style fields, `costMult` on cost-style fields) is applied directly to
 * the two lines this composer already has: `metric = REVENUE × growthMult − impliedCost ×
 * costMult`, where `impliedCost = REVENUE − NET_INCOME` (the bottom-line's implied total cost,
 * itself pure arithmetic over two already-computed lines, not a new estimate). `recommendLever`
 * (risk-adjusted ranking) then picks the best lever exactly as the engine's own docblock intends.
 *
 * VALUE TREE (O4.3): decomposes the RECOMMENDED lever's projected swing into the two additive
 * pieces that produced it — the growth-multiplier slice (`REVENUE × (growthMult − 1)`, bucket
 * 'growth') and the cost-multiplier slice (`impliedCost × (1 − costMult)`, bucket 'savings',
 * only when it is a real reduction). A lever with no swing on a side (e.g. `growthMult === 1`)
 * contributes no component for that side — never a fabricated zero-benefit line item. There is
 * no 'risk' (avoided-loss) component: this call site has no risk-mitigation figure to decompose,
 * so that bucket is honestly omitted rather than invented (R5).
 */

import type { FinanceLanguage } from './financeConclusionService.js';
import type { LineValueMap } from './financeRatioFamilyCatalog.js';
import {
  type BusinessLever,
  type LeverOutcome,
  type LeverRecommendation,
  type LeverRisk,
  leversFor,
  recommendLever,
} from './financeScenarioLevers.js';
import {
  type BenefitValueTree,
  type ComponentRisk,
  buildBenefitValueTree,
  narrateValueTree,
  type ValueComponentInput,
} from './financeValueTree.js';

/* ────────────────────────────────────────────────────────────────────────────
   O4.2 — scenario levers section
   ──────────────────────────────────────────────────────────────────────────── */

export interface FinanceScenarioOutcomeRow {
  leverId: string;
  leverName: string;
  hypothesis: string;
  driverRationale: string;
  risk: LeverRisk;
  /** Projected NET_INCOME under this lever (rounded). */
  metric: number;
  deltaVsStatusQuo: number;
}

export interface FinanceScenarioSection {
  /** false when REVENUE/NET_INCOME lines are missing — honestly empty, no guessing. */
  available: boolean;
  baseMetricLabel: 'NET_INCOME';
  outcomes: FinanceScenarioOutcomeRow[];
  recommendation: LeverRecommendation | null;
}

function emptyScenarioSection(): FinanceScenarioSection {
  return { available: false, baseMetricLabel: 'NET_INCOME', outcomes: [], recommendation: null };
}

function finiteNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Build the O4.2 scenario-lever section from lines the caller (`composeFinanceReportSection`)
 * has already resolved. Pure — no I/O.
 */
export function buildFinanceScenarioSection(
  lineValues: LineValueMap,
  language: FinanceLanguage
): FinanceScenarioSection {
  const revenue = finiteNum(lineValues.REVENUE);
  const netIncome = finiteNum(lineValues.NET_INCOME);
  if (!Number.isFinite(revenue) || !Number.isFinite(netIncome)) return emptyScenarioSection();

  const impliedCost = revenue - netIncome;
  const levers: BusinessLever[] = leversFor(language);

  const rawOutcomes: LeverOutcome[] = levers.map((lever) => ({
    lever,
    metric: revenue * lever.multiplier.growthMult - impliedCost * lever.multiplier.costMult,
    deltaVsStatusQuo: 0,
  }));
  const statusQuo = rawOutcomes.find((o) => o.lever.id === 'status_quo') ?? null;
  const outcomes: LeverOutcome[] = rawOutcomes.map((o) => ({
    ...o,
    deltaVsStatusQuo: statusQuo ? o.metric - statusQuo.metric : 0,
  }));

  const recommendation = recommendLever(outcomes, language, true);

  return {
    available: true,
    baseMetricLabel: 'NET_INCOME',
    outcomes: outcomes.map((o) => ({
      leverId: o.lever.id,
      leverName: o.lever.name,
      hypothesis: o.lever.hypothesis,
      driverRationale: o.lever.driverRationale,
      risk: o.lever.risk,
      metric: Math.round(o.metric),
      deltaVsStatusQuo: Math.round(o.deltaVsStatusQuo),
    })),
    recommendation,
  };
}

/** Render the O4.2 section as markdown. Degrades honestly when unavailable. */
export function renderFinanceScenarioMarkdown(
  section: FinanceScenarioSection,
  isPolish = true
): string {
  if (!section.available) {
    return [
      '## Scenariusze-dźwignie',
      '',
      isPolish
        ? '_Brak linii REVENUE/NET_INCOME w pakiecie — scenariusze nie policzone (no guessing)._'
        : '_REVENUE/NET_INCOME lines missing from the package — scenarios not computed (no guessing)._',
    ].join('\n');
  }
  const fmt = (n: number): string =>
    new Intl.NumberFormat(isPolish ? 'pl-PL' : 'en-US', { maximumFractionDigits: 0 }).format(n);
  const rows = section.outcomes
    .map(
      (o) =>
        `| ${o.leverName} | ${fmt(o.metric)} | ${o.deltaVsStatusQuo >= 0 ? '+' : ''}${fmt(o.deltaVsStatusQuo)} | ${o.risk} |`
    )
    .join('\n');
  const header = `## Scenariusze-dźwignie (${section.baseMetricLabel})`;
  const table =
    '| Dźwignia | Projekcja | Δ vs status quo | Ryzyko |\n|---|---:|---:|---|\n' + rows;
  const rec = section.recommendation
    ? ['', `**${section.recommendation.verdict}**`, section.recommendation.rationale, section.recommendation.tradeoff].join(
        '\n\n'
      )
    : '';
  return [header, '', table, rec].filter(Boolean).join('\n');
}

/* ────────────────────────────────────────────────────────────────────────────
   O4.3 — benefit value tree section (decomposes the recommended lever)
   ──────────────────────────────────────────────────────────────────────────── */

export interface FinanceValueTreeSection {
  /** false when there is no recommended lever to decompose, or it has no real swing. */
  available: boolean;
  forLeverId: string | null;
  tree: BenefitValueTree | null;
  narrative: string | null;
}

function emptyValueTreeSection(): FinanceValueTreeSection {
  return { available: false, forLeverId: null, tree: null, narrative: null };
}

/**
 * Confidence-grade mapping from `LeverRisk` (how likely the lever's assumed swing is to
 * materialise) to `ComponentRisk` (how bankable the resulting value is). Deliberately never
 * maps to 'hard' (contracted/already-realised) — every figure here is a PROJECTION under a
 * lever, never a booked number, so 'hard' would overstate confidence. `low` risk levers get the
 * more credible 'firm' grade (0.75 weight); `medium`/`high` risk levers are graded 'soft' (0.4)
 * — a bet, not a given.
 */
function leverRiskToComponentRisk(risk: LeverRisk): ComponentRisk {
  return risk === 'low' ? 'firm' : 'soft';
}

/**
 * Build the O4.3 value-tree section by decomposing the O4.2 recommended lever's projected swing
 * into its growth/savings components. Pure — no I/O, no new magnitudes (see module docblock).
 */
export function buildFinanceValueTreeSection(
  scenario: FinanceScenarioSection,
  lineValues: LineValueMap,
  language: FinanceLanguage
): FinanceValueTreeSection {
  if (!scenario.available || !scenario.recommendation) return emptyValueTreeSection();

  const chosenId = scenario.recommendation.chosenId;
  const levers = leversFor(language);
  const lever = levers.find((l) => l.id === chosenId);
  if (!lever) return emptyValueTreeSection();

  const revenue = finiteNum(lineValues.REVENUE);
  const netIncome = finiteNum(lineValues.NET_INCOME);
  if (!Number.isFinite(revenue) || !Number.isFinite(netIncome)) return emptyValueTreeSection();
  const impliedCost = revenue - netIncome;

  const isPL = language === 'pl';
  const compRisk = leverRiskToComponentRisk(lever.risk);
  const components: ValueComponentInput[] = [];

  const growthAmount = revenue * (lever.multiplier.growthMult - 1);
  if (lever.multiplier.growthMult > 1 && growthAmount > 0) {
    components.push({
      label: isPL ? 'Wzrost przychodu (dźwignia)' : 'Revenue growth (lever)',
      bucket: 'growth',
      amount: growthAmount,
      risk: compRisk,
      basis: `${lever.name}: REVENUE × (${lever.multiplier.growthMult} − 1)`,
    });
  }

  const savingsAmount = impliedCost * (1 - lever.multiplier.costMult);
  if (lever.multiplier.costMult < 1 && savingsAmount > 0) {
    components.push({
      label: isPL ? 'Redukcja kosztu (dźwignia)' : 'Cost reduction (lever)',
      bucket: 'savings',
      amount: savingsAmount,
      risk: compRisk,
      basis: `${lever.name}: (REVENUE − NET_INCOME) × (1 − ${lever.multiplier.costMult})`,
    });
  }

  if (components.length === 0) return emptyValueTreeSection();

  const tree = buildBenefitValueTree(components);
  const narrative = narrateValueTree(tree, language);
  return { available: true, forLeverId: chosenId, tree, narrative };
}

/** Render the O4.3 section as markdown. Degrades honestly when unavailable. */
export function renderFinanceValueTreeMarkdown(
  section: FinanceValueTreeSection,
  isPolish = true
): string {
  if (!section.available || !section.tree) {
    return [
      '## Drzewo wartości korzyści',
      '',
      isPolish
        ? '_Brak rekomendowanej dźwigni z realną korzyścią do rozłożenia._'
        : '_No recommended lever with a real benefit to decompose._',
    ].join('\n');
  }
  return ['## Drzewo wartości korzyści', '', section.narrative || ''].join('\n');
}

export default {
  buildFinanceScenarioSection,
  renderFinanceScenarioMarkdown,
  buildFinanceValueTreeSection,
  renderFinanceValueTreeMarkdown,
};

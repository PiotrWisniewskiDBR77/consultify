/**
 * financeReportConclusion — CONCLUSION LAYER wiring for the finance report
 * section (OXFORD O2.4, `docs/standards/CONCLUSION_LAYER_STANDARD.md` W3).
 *
 * WHY THIS EXISTS (the gap this closes)
 * -------------------------------------
 * `financeReportSectionService.composeFinanceReportSection` is the REAL, wired
 * finance report composer (routes: report-builder.routes.ts,
 * finance-statements.routes.ts) — but its `verdict` is a bare RAG label
 * (GREEN/AMBER/RED/NA) and its `headline` is a count sentence ("X/Y wskaźników
 * policzonych"). `renderFinanceReportMarkdown`'s `narrative` block was a
 * literal TODO placeholder. This is exactly the "semaforek" anti-pattern the
 * standard forbids (§6 P1: "wskaźnik w normie" is not a conclusion).
 *
 * `financeConclusionService.ts` (the W3 deterministic narrator: indicator →
 * trend → driver → forecast → recommendation) already existed but had NO
 * caller anywhere in the app — a fully-built, orphaned engine. This module is
 * its FIRST real caller: it maps the already-computed ratio rows (Z111) +
 * their benchmarks into `IndicatorFacts`, ranks them deterministically by
 * decision-relevance (threshold breach > benchmark deviation > in-range), and
 * narrates the worst few with the existing narrator — then gates the result
 * through the 12 §4.4 validators before it is allowed into the report.
 *
 * HARD RULE: every number narrated here is read off `FinanceReportRatioRow`
 * (already computed by `financeRatioFamilyCatalog`/`ratioAnalysisService`).
 * This module invents nothing — it ranks and narrates, never computes.
 *
 * LIMITATION (honest, not hidden): this call site has no multi-period history
 * for the ratios (`composeFinanceReportSection` operates on a single pack), so
 * `trend`/`driver` narrate as "brak serii — trend nieoznaczony" /
 * "do ustalenia" whenever the engine has not supplied them — exactly the
 * standard's R5 behavior for a missing fact (never invented). A future O2.4b
 * that threads pack-over-pack history into `IndicatorFacts.history` would
 * upgrade these to real trend/driver prose with no change to this module's
 * contract.
 */

import {
  type ConclusionValidationReport,
  type ValidatableConclusion,
  validateConclusion,
} from './conclusionValidators.js';
import {
  deterministicIndicatorNarrator,
  type FinanceConclusion,
  type FinanceLanguage,
  type IndicatorFacts,
  type OrgContext,
  weakestConfidence,
} from './financeConclusionService.js';
import type { ComputedFamilyRatio, RatioFamily } from './financeRatioFamilyCatalog.js';

/** Minimal shape this module needs from `FinanceReportRatioRow` (avoids a
 * circular import with financeReportSectionService.ts, which imports FROM
 * here). */
export interface RatioForConclusion extends ComputedFamilyRatio {
  benchmark?: {
    p25?: number;
    median?: number;
    p75?: number;
    targetMin?: number;
    targetMax?: number;
    source?: string;
    origin?: 'org' | 'industry';
    industryLabelPl?: string;
    industryLabelEn?: string;
    asOf?: string;
    confidence?: 'sourced' | 'expert-estimate';
  };
}

export interface FinanceConclusionWithValidation {
  conclusion: FinanceConclusion;
  ratioCode: string;
  family: RatioFamily;
  validation: ConclusionValidationReport;
}

const UNIT_LABEL: Record<string, string> = {
  x: 'x',
  '%': '%',
  days: 'dni',
  currency: '',
  pp: 'p.p.',
};

/** Deterministic severity score — how far the ratio sits outside its
 * acceptable range, normalized so ratios of different units are comparable.
 * 0 = fully within target/benchmark. Higher = worse. Ties broken by ratio
 * code for determinism (never random). */
function severityScore(r: RatioForConclusion): number {
  if (r.status !== 'computed' || r.value == null) return -1; // not eligible
  const v = r.value;
  const higherIsBetter = r.direction === 'higher_better';

  const target =
    r.benchmark?.targetMin != null && higherIsBetter
      ? r.benchmark.targetMin
      : r.benchmark?.targetMax != null && !higherIsBetter
        ? r.benchmark.targetMax
        : undefined;

  if (target != null && target !== 0) {
    const shortfall = higherIsBetter ? target - v : v - target;
    if (shortfall > 0) return 2 + shortfall / Math.abs(target); // breaches its own target
  }

  const p25 = r.benchmark?.p25;
  const p75 = r.benchmark?.p75;
  if (p25 != null && p75 != null) {
    const low = Math.min(p25, p75);
    const high = Math.max(p25, p75);
    if (v < low) return 1 + (low - v) / (Math.abs(low) || 1);
    if (v > high && !higherIsBetter) return 1 + (v - high) / (Math.abs(high) || 1);
  }

  return 0; // computed, in range (or no benchmark to judge against)
}

/** Rank computed ratios by decision-relevance (worst first), deterministic
 * tie-break by ratio code. Pure — no I/O, no randomness. */
export function rankRatiosForConclusion(ratios: RatioForConclusion[]): RatioForConclusion[] {
  return ratios
    .filter((r) => r.status === 'computed' && r.value != null)
    .map((r) => ({ r, score: severityScore(r) }))
    .sort((a, b) => b.score - a.score || a.r.code.localeCompare(b.r.code))
    .map((x) => x.r);
}

/** Map a computed ratio row → `IndicatorFacts` (numbers ONLY from the row —
 * R5 hard rule). Returns null when the ratio has no value to narrate. */
export function ratioToIndicatorFacts(r: RatioForConclusion): IndicatorFacts | null {
  if (r.status !== 'computed' || r.value == null) return null;
  const higherIsBetter = r.direction === 'higher_better';
  const threshold =
    higherIsBetter && r.benchmark?.targetMin != null
      ? r.benchmark.targetMin
      : !higherIsBetter && r.benchmark?.targetMax != null
        ? r.benchmark.targetMax
        : undefined;
  const benchmark: [number, number] | undefined =
    r.benchmark?.p25 != null && r.benchmark?.p75 != null
      ? [Math.min(r.benchmark.p25, r.benchmark.p75), Math.max(r.benchmark.p25, r.benchmark.p75)]
      : undefined;
  const benchmarkMeta =
    r.benchmark?.origin === 'industry' &&
    (r.benchmark.industryLabelPl || r.benchmark.industryLabelEn)
      ? {
          industryLabel: r.benchmark.industryLabelPl || r.benchmark.industryLabelEn || '',
          source: r.benchmark.source || 'DBR77',
          asOf: r.benchmark.asOf || '',
          confidence: r.benchmark.confidence || 'expert-estimate',
        }
      : undefined;

  return {
    code: r.code,
    name: r.labelPl,
    value: r.value,
    unit: UNIT_LABEL[r.unit] ?? r.unit,
    threshold,
    benchmark,
    benchmarkMeta,
    // No pack-over-pack history at this call site (see module docblock) — the
    // narrator honestly renders "brak serii — trend nieoznaczony" (R5).
    history: undefined,
    higherIsBetter,
    // No driver decomposition available from financeRatioFamilyCatalog at this
    // call site — narrator honestly renders "do ustalenia" (R5), never invented.
    drivers: undefined,
    confidence: 'confirmed', // engine-computed value, not a declared/estimated figure
  };
}

function toValidatable(
  fc: FinanceConclusion,
  facts: Record<string, unknown>
): ValidatableConclusion {
  return {
    headline: fc.headline,
    k1Text: fc.k1Fact.text,
    k1FactRefs: fc.k1Fact.factRefs,
    k2Text: fc.k2Meaning.text,
    k2FactRefs: fc.k2Meaning.factRefs,
    k3Actions: fc.k3Actions.map((a) => ({
      action: a.action,
      whyFirst: a.whyFirst,
      ownerRole: a.ownerRole,
    })),
    k4Text: fc.k4Effect.text,
    k4Horizon: fc.k4Effect.horizon,
    confidence: fc.confidence,
    language: 'pl',
    facts,
    chain: fc.chain,
  };
}

/**
 * Build validated W3 conclusions for the top N most decision-relevant
 * computed ratios. Ratios that fail the hard §4.4 gate are DROPPED (never
 * published half-broken) — the caller sees fewer conclusions, never a bad one.
 */
export function buildFinanceReportConclusions(
  ratios: RatioForConclusion[],
  org: OrgContext,
  options: { language?: FinanceLanguage; topN?: number } = {}
): FinanceConclusionWithValidation[] {
  const language = options.language ?? 'pl';
  const topN = options.topN ?? 3;
  const ranked = rankRatiosForConclusion(ratios).slice(0, topN);

  const out: FinanceConclusionWithValidation[] = [];
  for (const r of ranked) {
    const indicator = ratioToIndicatorFacts(r);
    if (!indicator) continue;
    const fc = deterministicIndicatorNarrator({ language, org, indicator });
    const factsPool = {
      indicator,
      value: indicator.value,
      threshold: indicator.threshold,
      benchmark: indicator.benchmark,
    };
    const validation = validateConclusion(toValidatable(fc, factsPool));
    if (!validation.allHardPass) continue; // never publish a broken conclusion
    out.push({ conclusion: fc, ratioCode: r.code, family: r.family, validation });
  }
  return out;
}

/** Overall confidence across a set of published conclusions (weakest link). */
export function overallConclusionConfidence(
  items: FinanceConclusionWithValidation[]
): 'confirmed' | 'mixed' | 'declared' {
  return weakestConfidence(
    items.map((i) => (i.conclusion.confidence === 'confirmed' ? 'confirmed' : 'declared'))
  );
}

/** Render the validated conclusions as markdown (used by
 * `renderFinanceReportMarkdown`'s `narrative` block instead of the old TODO
 * placeholder). Degrades honestly when there is nothing to narrate. */
export function renderFinanceConclusionsMarkdown(
  items: FinanceConclusionWithValidation[],
  isPolish = true
): string {
  if (items.length === 0) {
    return [
      '## Narracja',
      '',
      isPolish
        ? '_Brak policzonych wskaźników do wniosku — pakiet nie ma jeszcze wystarczających danych._'
        : '_No computed ratios to conclude from yet — the package lacks sufficient data._',
    ].join('\n');
  }
  const blocks = items.map(({ conclusion: c }) => {
    const actions = c.k3Actions
      .map(
        (a) =>
          `  - ${a.action} — ${a.ownerRole} (${isPolish ? 'dlaczego pierwsze' : 'why first'}: ${a.whyFirst})`
      )
      .join('\n');
    return [
      `### ${c.headline}`,
      '',
      c.k1Fact.text,
      '',
      c.k2Meaning.text,
      '',
      isPolish ? '**Najpierw:**' : '**First:**',
      actions,
      '',
      `${isPolish ? '**Efekt** (' + c.k4Effect.horizon + '):' : '**Effect** (' + c.k4Effect.horizon + '):'} ${c.k4Effect.text}`,
    ].join('\n');
  });
  return ['## Narracja', '', ...blocks].join('\n\n');
}

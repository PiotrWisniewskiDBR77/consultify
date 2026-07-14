/**
 * financeScenarioLevers — Business-named scenario LEVERS (W3)
 * ============================================================================
 * CONCLUSION_LAYER_STANDARD demands scenarios named as BUSINESS DECISIONS
 * ("Agresywna automatyzacja", "Ostrożna modernizacja") — NOT the anonymous
 * "±15%" of `scenarioComputeService` (`optimistic: 1.15 / conservative: 0.85`).
 * A ±15% band tells the board nothing about WHAT they would do; a named lever
 * ties the number swing to a decision and its driver rationale.
 *
 * This layer is a THIN advisory wrapper over the existing multiplier engine:
 *  - It does NOT recompute financials. It maps each business lever to the
 *    (growthMult, costMult) the engine already understands, then attaches the
 *    hypothesis + driver rationale + risk grade the conclusion layer needs.
 *  - The multipliers stay the deterministic transform; the NARRATIVE (why this
 *    scenario, what decision it encodes, what risk it carries) is the value add.
 *  - A recommendation across levers is derived deterministically from the
 *    engine metric each lever produces (best risk-adjusted outcome), with an
 *    explicit rationale and the trade-off it accepts (§3 W2/W3, R2 causality).
 *
 * Pure functions only. No I/O, no LLM.
 */

import type { FinanceLanguage } from './financeConclusionService.js';

/** The multiplier pair the existing `scenarioComputeService` engine consumes. */
export interface ScenarioMultiplier {
  /** Applied to growth/revenue-style assumption fields. */
  growthMult: number;
  /** Applied to cost/opex/cogs-style assumption fields. */
  costMult: number;
}

/** Confidence that the lever's assumed swing actually materialises. */
export type LeverRisk = 'low' | 'medium' | 'high';

/**
 * A business lever = a named DECISION the org could take, with the assumption
 * swing it implies and why. This is what replaces "optimistic/conservative".
 */
export interface BusinessLever {
  /** Stable id, e.g. 'aggressive_automation'. */
  id: string;
  /** Business name shown to the board (localised). */
  name: string;
  /** The decision/hypothesis this scenario encodes (K2 grounding). */
  hypothesis: string;
  /** What DRIVES the swing — the causal chain behind the multipliers (R2). */
  driverRationale: string;
  /** Multipliers handed to the existing engine (the deterministic transform). */
  multiplier: ScenarioMultiplier;
  /** How likely the assumed swing is to hold — grades the scenario, not hides it. */
  risk: LeverRisk;
}

/**
 * Canonical library of business levers. Multipliers are intentionally the
 * SAME magnitude the engine already uses (so results are comparable), but each
 * is now a named decision with a rationale instead of an anonymous band.
 *
 * `baseline` (1.0/1.0) is kept as the "no decision / status quo" anchor so the
 * recommendation always has a do-nothing reference to beat.
 */
export const BUSINESS_LEVERS: Record<'pl' | 'en', BusinessLever[]> = {
  pl: [
    {
      id: 'status_quo',
      name: 'Status quo (bez decyzji)',
      hypothesis: 'Organizacja nie podejmuje żadnej inicjatywy — punkt odniesienia.',
      driverRationale: 'Brak zmiany dźwigni: przychody i koszty podążają dotychczasowym trendem.',
      multiplier: { growthMult: 1, costMult: 1 },
      risk: 'low',
    },
    {
      id: 'aggressive_automation',
      name: 'Agresywna automatyzacja',
      hypothesis: 'Pełne wdrożenie automatyzacji procesów operacyjnych w 12 miesięcy.',
      driverRationale:
        'Automatyzacja ścina koszt jednostkowy (mniej roboczogodzin na zlecenie) i podnosi przepustowość — koszty w dół, wolumen w górę.',
      multiplier: { growthMult: 1.15, costMult: 0.85 },
      risk: 'high',
    },
    {
      id: 'cautious_modernization',
      name: 'Ostrożna modernizacja',
      hypothesis: 'Modernizacja pilotażowa 2 procesów krytycznych, reszta bez zmian.',
      driverRationale:
        'Ograniczony zakres: umiarkowana redukcja kosztu przy niskim ryzyku wykonawczym — dźwignia mała, ale pewna.',
      multiplier: { growthMult: 1.05, costMult: 0.95 },
      risk: 'low',
    },
    {
      id: 'growth_bet',
      name: 'Zakład na wzrost',
      hypothesis: 'Inwestycja w ekspansję rynkową kosztem krótkoterminowej marży.',
      driverRationale:
        'Wzrost przychodu napędzany akwizycją nowych klientów; koszt rośnie (sprzedaż, wdrożenia) zanim przychód dogoni.',
      multiplier: { growthMult: 1.25, costMult: 1.1 },
      risk: 'high',
    },
    {
      id: 'defensive_cost',
      name: 'Obrona marży',
      hypothesis: 'Program redukcji kosztów bez inwestycji we wzrost.',
      driverRationale:
        'Cięcie kosztów stałych chroni marżę przy płaskim przychodzie — bezpieczne, ale nie buduje przyszłej dźwigni.',
      multiplier: { growthMult: 1, costMult: 0.9 },
      risk: 'medium',
    },
  ],
  en: [
    {
      id: 'status_quo',
      name: 'Status quo (no decision)',
      hypothesis: 'The organization takes no initiative — the reference point.',
      driverRationale: 'No lever change: revenue and cost follow the existing trend.',
      multiplier: { growthMult: 1, costMult: 1 },
      risk: 'low',
    },
    {
      id: 'aggressive_automation',
      name: 'Aggressive automation',
      hypothesis: 'Full operational-process automation rolled out within 12 months.',
      driverRationale:
        'Automation cuts unit cost (fewer labour-hours per order) and lifts throughput — cost down, volume up.',
      multiplier: { growthMult: 1.15, costMult: 0.85 },
      risk: 'high',
    },
    {
      id: 'cautious_modernization',
      name: 'Cautious modernization',
      hypothesis: 'Pilot modernization of 2 critical processes, the rest unchanged.',
      driverRationale:
        'Limited scope: moderate cost reduction at low execution risk — a small but reliable lever.',
      multiplier: { growthMult: 1.05, costMult: 0.95 },
      risk: 'low',
    },
    {
      id: 'growth_bet',
      name: 'Growth bet',
      hypothesis: 'Invest in market expansion at the cost of short-term margin.',
      driverRationale:
        'Revenue growth driven by new-customer acquisition; cost rises (sales, onboarding) before revenue catches up.',
      multiplier: { growthMult: 1.25, costMult: 1.1 },
      risk: 'high',
    },
    {
      id: 'defensive_cost',
      name: 'Margin defense',
      hypothesis: 'A cost-reduction program with no growth investment.',
      driverRationale:
        'Cutting fixed costs protects margin against flat revenue — safe, but builds no future lever.',
      multiplier: { growthMult: 1, costMult: 0.9 },
      risk: 'medium',
    },
  ],
};

/** Look up the lever set for a language (defaults to PL). */
export function leversFor(language: FinanceLanguage): BusinessLever[] {
  return BUSINESS_LEVERS[language] ?? BUSINESS_LEVERS.pl;
}

/** One lever's engine-computed outcome, paired back with its business meaning. */
export interface LeverOutcome {
  lever: BusinessLever;
  /** The single metric the caller optimises (e.g. NPV, EBITDA). From the engine. */
  metric: number;
  /** Metric delta vs. the status-quo anchor (from the engine metrics). */
  deltaVsStatusQuo: number;
}

/** A named-lever recommendation with rationale + accepted trade-off (§3 W2). */
export interface LeverRecommendation {
  /** The recommended lever's id. */
  chosenId: string;
  /** The lever rejected in its favour (for the trade-off). */
  rejectedId: string | null;
  /** answer-first verdict, ≤ ~25 words. */
  verdict: string;
  /** Why this lever — grounded in the engine metric + its risk grade (R2). */
  rationale: string;
  /** What we accept by choosing it (trade-off, obligatory §3 W2). */
  tradeoff: string;
  /** The per-lever outcomes the recommendation ranked over. */
  ranked: LeverOutcome[];
}

/** Risk multiplier used to risk-adjust the raw metric (deterministic, transparent). */
const RISK_DISCOUNT: Record<LeverRisk, number> = { low: 1, medium: 0.85, high: 0.7 };

/**
 * Recommend a lever from the engine outcomes, risk-adjusted and grounded.
 *
 * `outcomes` MUST carry engine-computed metrics — this function never computes
 * a financial figure, only ranks and narrates. Ranking is by RISK-ADJUSTED
 * metric (raw metric × RISK_DISCOUNT[risk]) so a high-risk headline number
 * never silently wins over a solid, lower-variance decision. The chosen and
 * the runner-up become the trade-off pair.
 *
 * `higherIsBetter` = does a larger metric mean a better outcome (NPV yes;
 * payback-months no). Defaults to true.
 */
export function recommendLever(
  outcomes: LeverOutcome[],
  language: FinanceLanguage,
  higherIsBetter = true
): LeverRecommendation | null {
  const real = (outcomes || []).filter((o) => o && o.lever && Number.isFinite(o.metric));
  if (real.length === 0) return null;
  const isPL = language === 'pl';

  const score = (o: LeverOutcome): number => {
    const adj = o.metric * RISK_DISCOUNT[o.lever.risk];
    return higherIsBetter ? adj : -adj;
  };

  const ranked = [...real].sort((a, b) => score(b) - score(a));
  const chosen = ranked[0];
  const runnerUp = ranked.find((o) => o.lever.id !== chosen.lever.id) ?? null;

  const fmt = (n: number): string =>
    new Intl.NumberFormat(isPL ? 'pl-PL' : 'en-US', { maximumFractionDigits: 0 }).format(
      Math.round(n)
    );

  const riskWord = (r: LeverRisk): string =>
    isPL ? (r === 'low' ? 'niskie' : r === 'medium' ? 'umiarkowane' : 'wysokie') : r;

  const verdict = isPL
    ? `Rekomendacja: „${chosen.lever.name}" — najlepszy wynik po korekcie o ryzyko, nie najwyższa surowa liczba.`
    : `Recommendation: "${chosen.lever.name}" — best risk-adjusted outcome, not the highest raw number.`;

  const rationale = isPL
    ? `${chosen.lever.driverRationale} Efekt vs. status quo: ${chosen.deltaVsStatusQuo >= 0 ? '+' : ''}${fmt(chosen.deltaVsStatusQuo)} przy ryzyku ${riskWord(chosen.lever.risk)}.`
    : `${chosen.lever.driverRationale} Effect vs. status quo: ${chosen.deltaVsStatusQuo >= 0 ? '+' : ''}${fmt(chosen.deltaVsStatusQuo)} at ${riskWord(chosen.lever.risk)} risk.`;

  const tradeoff = runnerUp
    ? isPL
      ? `Wybieramy „${chosen.lever.name}" KOSZTEM „${runnerUp.lever.name}": rezygnujemy z ${fmt(Math.abs(runnerUp.metric - chosen.metric))} potencjału surowego w zamian za niższą zmienność wyniku.`
      : `We choose "${chosen.lever.name}" AT THE COST of "${runnerUp.lever.name}": we give up ${fmt(Math.abs(runnerUp.metric - chosen.metric))} of raw upside for lower outcome variance.`
    : isPL
      ? 'Brak alternatywy do porównania — trade-off do uzupełnienia po dodaniu drugiego wariantu.'
      : 'No alternative to compare — trade-off pending a second lever.';

  return {
    chosenId: chosen.lever.id,
    rejectedId: runnerUp ? runnerUp.lever.id : null,
    verdict,
    rationale,
    tradeoff,
    ranked,
  };
}

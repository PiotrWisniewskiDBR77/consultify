/**
 * financePostMortemService — O4.7 Realized-vs-projected post-mortem
 * ============================================================================
 * WHY THIS EXISTS (the gap this closes)
 * -------------------------------------
 * `realizedValueReconciliationService` already CONFRONTS a declared realized
 * value with the actual P&L line and flags a variance ("statement exceeds
 * declared", etc.). But flagging the gap is not the WNIOSEK the board pays for.
 * The board's question after a miss is: *why didn't it work — was the market
 * different than we assumed, or did WE not execute?* A -30% miss because the
 * whole market shrank 35% is a WIN on execution; the same miss with a flat
 * market is an execution failure. Same number, opposite management action.
 *
 * This service decomposes a realized-vs-projected variance into:
 *   - a MARKET component: how much of the gap is explained by the environment
 *     moving away from the plan's assumption (demand, price, FX, volume);
 *   - an EXECUTION component: the residual — what WE did or failed to do,
 *     independent of the market.
 *
 * Method (per CONCLUSION_LAYER §W3, K1 numbers → K2 driver):
 *   projected = the plan's committed value at plan assumptions.
 *   marketBaseline = what the SAME plan would have delivered under the ACTUAL
 *                    market (projected re-based by the observed market shift).
 *   marketEffect    = marketBaseline − projected   (env moved the number)
 *   executionEffect = realized       − marketBaseline (we moved the residual)
 *   check: marketEffect + executionEffect === realized − projected (exact).
 *
 * The verdict names the dominant driver honestly and never claims more than the
 * inputs support (missing market data → 'undetermined', not a guess).
 *
 * Pure functions only (no I/O). Consumes the same variance vocabulary as the
 * reconciliation service so the two compose.
 */

export type PostMortemLanguage = 'pl' | 'en';

/** How the market moved vs the plan's assumption, as a fraction (−0.35 = −35%). */
export interface MarketShift {
  /** e.g. 'demand' | 'price' | 'fx' | 'volume' — what shifted. */
  factor: string;
  /**
   * Realized market level relative to the ASSUMED level, as a fraction delta.
   * 0 = market exactly as assumed; −0.2 = market 20% worse than assumed;
   * +0.1 = 10% better. Signed so it plugs straight into re-basing.
   */
  deltaFraction: number;
  /** Provenance of this shift figure. */
  confidence: 'confirmed' | 'declared' | 'missing';
}

export type PostMortemVerdict =
  | 'market-driven'
  | 'execution-driven'
  | 'mixed'
  | 'on-plan'
  | 'undetermined';

export interface VarianceDecomposition {
  projected: number;
  realized: number;
  /** realized − projected. */
  totalVariance: number;
  /** Portion of the gap attributable to the market moving vs assumption. */
  marketEffect: number;
  /** Residual portion attributable to execution. */
  executionEffect: number;
  /** |marketEffect| / (|marketEffect| + |executionEffect|), [0..1]. */
  marketShare: number;
  /** |executionEffect| / (…), [0..1]. */
  executionShare: number;
  verdict: PostMortemVerdict;
  /** Honest overall confidence = weakest link of the inputs used. */
  confidence: 'confirmed' | 'mixed' | 'declared' | 'undetermined';
  explanation: { pl: string; en: string };
}

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Weakest-link confidence across the market shifts used. */
function weakestConfidence(
  shifts: MarketShift[]
): 'confirmed' | 'mixed' | 'declared' | 'undetermined' {
  if (!shifts.length) return 'undetermined';
  if (shifts.some((s) => s.confidence === 'missing')) return 'undetermined';
  if (shifts.some((s) => s.confidence === 'declared')) return 'declared';
  return 'confirmed';
}

/**
 * Decompose a realized-vs-projected variance into market vs execution.
 *
 * The plan's projected value is re-based by the NET market shift to obtain the
 * "market baseline" (what the plan would have delivered under the actual
 * market). Anything left is execution.
 *
 * When no market shift is supplied, the whole gap is EXECUTION but the verdict
 * is 'undetermined' (we cannot rule out an unobserved market move) — honest,
 * never asserting execution failure without market evidence.
 */
export function decomposeVariance(params: {
  projected: number;
  realized: number;
  marketShifts?: MarketShift[];
  language?: PostMortemLanguage;
}): VarianceDecomposition {
  const projected = isNum(params.projected) ? params.projected : 0;
  const realized = isNum(params.realized) ? params.realized : 0;
  const shifts = (params.marketShifts ?? []).filter((s) => s && isNum(s.deltaFraction));
  const totalVariance = round2(realized - projected);

  // Net market shift = sum of factor deltas (each already a fraction vs assumption).
  const netShift = shifts.reduce((sum, s) => sum + s.deltaFraction, 0);
  const marketBaseline = projected * (1 + netShift);
  const marketEffect = round2(marketBaseline - projected);
  const executionEffect = round2(realized - marketBaseline);

  const absMkt = Math.abs(marketEffect);
  const absExe = Math.abs(executionEffect);
  const denom = absMkt + absExe;
  const marketShare = denom === 0 ? 0 : round2(absMkt / denom);
  const executionShare = denom === 0 ? 0 : round2(absExe / denom);

  const confidence = weakestConfidence(shifts);

  // Verdict.
  let verdict: PostMortemVerdict;
  const onPlanTol = Math.abs(projected) * 0.05; // within 5% of plan = on-plan
  if (Math.abs(totalVariance) <= onPlanTol) {
    verdict = 'on-plan';
  } else if (!shifts.length) {
    // No market evidence — cannot attribute; residual is nominally execution.
    verdict = 'undetermined';
  } else if (marketShare >= 0.66) {
    verdict = 'market-driven';
  } else if (executionShare >= 0.66) {
    verdict = 'execution-driven';
  } else {
    verdict = 'mixed';
  }

  const lang: PostMortemLanguage = params.language ?? 'pl';
  const explanation = buildExplanation({
    verdict,
    totalVariance,
    marketEffect,
    executionEffect,
    marketShare,
    executionShare,
    hasShifts: shifts.length > 0,
    lang,
  });

  return {
    projected: round2(projected),
    realized: round2(realized),
    totalVariance,
    marketEffect,
    executionEffect,
    marketShare,
    executionShare,
    verdict,
    confidence,
    explanation,
  };
}

function buildExplanation(p: {
  verdict: PostMortemVerdict;
  totalVariance: number;
  marketEffect: number;
  executionEffect: number;
  marketShare: number;
  executionShare: number;
  hasShifts: boolean;
  lang: PostMortemLanguage;
}): { pl: string; en: string } {
  const mkPct = Math.round(p.marketShare * 100);
  const exPct = Math.round(p.executionShare * 100);
  const pl = (() => {
    switch (p.verdict) {
      case 'on-plan':
        return `Rezultat w granicach ±5% planu — bez istotnego odchylenia do rozłożenia.`;
      case 'undetermined':
        return `Odchylenie ${p.totalVariance} bez danych o ruchu rynku — nie można rozdzielić rynku od egzekucji; przypisanie do egzekucji byłoby zgadywaniem. Uzupełnij założenie rynkowe (popyt/cena/wolumen), zanim postawisz tezę.`;
      case 'market-driven':
        return `Odchylenie ${p.totalVariance} napędza głównie RYNEK (${mkPct}% luki): środowisko odeszło od założeń planu (efekt rynkowy ${p.marketEffect}). Część egzekucyjna ${p.executionEffect} (${exPct}%) jest wtórna — oceniaj egzekucję po residuum, nie po nominalnej liczbie.`;
      case 'execution-driven':
        return `Odchylenie ${p.totalVariance} napędza głównie EGZEKUCJA (${exPct}% luki): rynek zachował się blisko założeń (efekt rynkowy ${p.marketEffect}), a residuum ${p.executionEffect} to nasze działanie/zaniechanie. Tu leży dźwignia naprawcza.`;
      case 'mixed':
      default:
        return `Odchylenie ${p.totalVariance} rozkłada się mniej więcej po połowie: rynek ${p.marketEffect} (${mkPct}%) i egzekucja ${p.executionEffect} (${exPct}%). Zaadresuj oba — sam ruch rynku nie tłumaczy całości.`;
    }
  })();
  const en = (() => {
    switch (p.verdict) {
      case 'on-plan':
        return `Result within ±5% of plan — no material variance to decompose.`;
      case 'undetermined':
        return `Variance ${p.totalVariance} with no market-movement data — market and execution cannot be separated; attributing it to execution would be a guess. Supply the market assumption (demand/price/volume) before asserting a cause.`;
      case 'market-driven':
        return `Variance ${p.totalVariance} is mostly MARKET-driven (${mkPct}% of the gap): the environment departed from the plan's assumptions (market effect ${p.marketEffect}). The execution part ${p.executionEffect} (${exPct}%) is secondary — judge execution by the residual, not the headline number.`;
      case 'execution-driven':
        return `Variance ${p.totalVariance} is mostly EXECUTION-driven (${exPct}% of the gap): the market behaved close to assumptions (market effect ${p.marketEffect}) and the residual ${p.executionEffect} is our action/inaction. This is where the corrective lever sits.`;
      case 'mixed':
      default:
        return `Variance ${p.totalVariance} splits roughly evenly: market ${p.marketEffect} (${mkPct}%) and execution ${p.executionEffect} (${exPct}%). Address both — market movement alone does not explain the gap.`;
    }
  })();
  return { pl, en };
}

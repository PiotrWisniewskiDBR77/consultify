/**
 * financeConclusionService — Finance CONCLUSION LAYER (W3)
 * ============================================================================
 * Turns the deterministic finance ENGINE outputs (numbers = K1) into an
 * ADVISORY conclusion (K2 co-znaczy → K3 co-robić najpierw → K4 jaki efekt)
 * per `docs/standards/CONCLUSION_LAYER_STANDARD.md`, variant **W3**
 * (łańcuch: wskaźnik → trend → driver → prognoza → rekomendacja).
 *
 * WHY THIS EXISTS (the gap this closes)
 * -------------------------------------
 * Today the finance layer STOPS at numbers. `businessCaseGeneratorService`
 * emits NPV/IRR/payback/PI + a one-line "verdict"; `scenarioComputeService`
 * fans ±15% multipliers labelled "optimistic/conservative"; the value/driver
 * services emit charts. None answers the question the client is paying for:
 * *what does this mean and what do we do first?* The client has the numbers
 * in Excel for free — they pay for the WNIOSEK.
 *
 * This service is the finance analog of `report/drdConclusionContract.ts`
 * (per the survey it is the FIRST full K1→K2→K3→K4 implementation in the
 * finance domain — the 8 numeric finance services are pure K1 inputs):
 *  - **Numbers ONLY from the engine.** Every figure quoted in prose is a
 *    field of the facts passed in (already computed upstream). This module
 *    never re-derives NPV/IRR and never invents a number
 *    (CONCLUSION_LAYER_STANDARD §2 R5 + §4.4 `numbers_from_engine`).
 *  - **Deterministic stub narrator** (no LLM) so the layer is renderable and
 *    testable offline; a live LLM narrator can be injected later behind the
 *    same `FinanceNarrator` contract and validated with the same §4.4 checks.
 *  - Business-named scenario LEVERS instead of "±15%": each scenario carries
 *    a business hypothesis ("Agresywna automatyzacja") and a driver rationale
 *    (see `financeScenarioLevers.ts`).
 *  - Benefit VALUE-TREE: benefit split into savings / growth / risk with a
 *    per-component risk grade (see `financeValueTree.ts`).
 *  - Portfolio INTERDEPENDENCIES: sequences, synergies, budget envelope
 *    (see `financePortfolioAdvisory.ts`).
 *
 * Everything here is a PURE function. No DbPromise, no I/O, no LLM by default.
 */

// ---------------------------------------------------------------------------
// Shared conclusion contract (aligned with CONCLUSION_LAYER_STANDARD §4.3
// and the DRD ConclusionOutput / ConclusionService.EvidenceRef vocabulary).
// ---------------------------------------------------------------------------

export type FinanceLanguage = 'pl' | 'en';

/** Provenance of a number, mirrors §4.1 facts[].confidence. */
export type FactConfidence = 'confirmed' | 'declared' | 'missing';

/** Overall confidence = weakest link of the evidence used (§4.3). */
export type ConclusionConfidence = 'confirmed' | 'mixed' | 'declared';

/** Evidence pointer — same shape as ConclusionService.EvidenceRef. */
export interface FinanceEvidenceRef {
  type: string; // e.g. 'ratio', 'business_case', 'scenario', 'portfolio'
  ref: string; // e.g. 'current_ratio' | initiative id
  excerpt?: string | null;
}

/** A single K3 action — verb + artefact + owner role, ranked impact×effort. */
export interface ConclusionAction {
  /** Czasownik + artefakt/przedmiot (e.g. "renegocjuj terminy u 3 dostawców"). */
  action: string;
  /** Dlaczego ta kolejność (impact×effort / prerequisite). */
  whyFirst: string;
  /** Rola odpowiedzialna — nie "organizacja". */
  ownerRole: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
}

/**
 * FinanceConclusion — the W3 §4.3 shape. The renderer composes the document;
 * the narrator only fills these fields. `chain` is the W3-specific extra
 * (§3 W3): indicator → trend → driver → forecast → recommendation.
 */
export interface FinanceConclusion {
  /** answer-first, ≤20 słów, teza nie temat. */
  headline: string;
  /** K1 — the fact(s), with the engine field(s) each number came from. */
  k1Fact: { text: string; factRefs: string[] };
  /** K2 — co to znaczy; ≥1 factRef (przyczynowość / R2). */
  k2Meaning: { text: string; factRefs: string[] };
  /** K3 — 1..3 akcje wg impact×effort. */
  k3Actions: ConclusionAction[];
  /** K4 — efekt z horyzontem. */
  k4Effect: { text: string; horizon: string; observableOrMetric: string };
  /** Weakest link of the evidence used. */
  confidence: ConclusionConfidence;
  /** W3 chain, surfaced for the `chain_complete` validator (§4.4). */
  chain: {
    indicator: string;
    trend: string;
    driver: string;
    /** null when the engine has no projection AND no explicit assumption. */
    forecast: string | null;
    recommendation: string;
  };
  evidence: FinanceEvidenceRef[];
  /** false = deterministic stub, true = validated LLM. */
  aiGenerated: boolean;
  narrative: 'llm' | 'deterministic';
}

// ---------------------------------------------------------------------------
// W3 input — indicator conclusion facts (numbers ONLY from the engine)
// ---------------------------------------------------------------------------

/** One financial indicator's engine facts, ready for interpretation. */
export interface IndicatorFacts {
  /** Canonical code, e.g. 'current_ratio'. */
  code: string;
  /** Display name, localised by the caller or defaulted from a map. */
  name: string;
  /** Current value (from engine). */
  value: number;
  unit?: string;
  /** Hard threshold / warning line, if the metric has one. */
  threshold?: number;
  /** Industry / peer benchmark band [low, high]. */
  benchmark?: [number, number];
  /**
   * Historical series oldest→newest (incl. current), from engine.
   * Trend (K1) is derived deterministically from this — never guessed.
   */
  history?: number[];
  /** Period label for the series, e.g. 'kwartał' | 'rok'. */
  periodLabel?: string;
  /** Higher value = better? (current ratio yes; DSO no). Default true. */
  higherIsBetter?: boolean;
  /**
   * Named driver decomposition (from engine): what moves this indicator.
   * e.g. [{ name: 'zobowiązania krótkoterminowe', changePct: 38 }, …].
   * This is the K2 "driver" — supplied by the engine, not invented.
   */
  drivers?: Array<{ name: string; changePct: number }>;
  /** Provenance of `value`. */
  confidence?: FactConfidence;
}

export interface OrgContext {
  name: string;
  industrySegment?: string;
  sizeBand?: string;
}

// ---------------------------------------------------------------------------
// Narrator contract (LLM-injectable, deterministic by default)
// ---------------------------------------------------------------------------

export interface IndicatorConclusionInput {
  language: FinanceLanguage;
  org: OrgContext;
  indicator: IndicatorFacts;
}

export type FinanceNarrator = (
  input: IndicatorConclusionInput
) => FinanceConclusion | Promise<FinanceConclusion>;

// ---------------------------------------------------------------------------
// Helpers — deterministic derivations (never from an LLM)
// ---------------------------------------------------------------------------

const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const fmt = (n: number, lang: FinanceLanguage): string =>
  new Intl.NumberFormat(lang === 'pl' ? 'pl-PL' : 'en-US', {
    maximumFractionDigits: 2,
  }).format(n);

const pct = (n: number, lang: FinanceLanguage): string => `${fmt(n, lang)}%`;

/** Weakest-link confidence over a set of fact provenances (§4.3). */
export function weakestConfidence(levels: FactConfidence[]): ConclusionConfidence {
  if (levels.length === 0) return 'confirmed';
  const anyWeak = levels.some((l) => l === 'missing' || l === 'declared');
  if (!anyWeak) return 'confirmed';
  return levels.some((l) => l === 'confirmed') ? 'mixed' : 'declared';
}

export type TrendDirection = 'up' | 'down' | 'flat';

export interface TrendFact {
  direction: TrendDirection;
  /** Absolute change over the observed window (newest − oldest). */
  delta: number;
  /** Number of periods observed (history.length). */
  periods: number;
  /** Is the trend improving vs. the metric's "good" direction? */
  improving: boolean;
}

/**
 * Derive the trend deterministically from the engine history.
 * Trend is part of the FACT (K1), not interpretation (W3 §3).
 */
export function deriveTrend(indicator: IndicatorFacts): TrendFact | null {
  const h = (indicator.history || []).map((x) => num(x)).filter((x) => Number.isFinite(x));
  if (h.length < 2) return null;
  const oldest = h[0];
  const newest = h[h.length - 1];
  const delta = newest - oldest;
  const higherIsBetter = indicator.higherIsBetter !== false;
  let direction: TrendDirection = 'flat';
  const eps = Math.abs(oldest) * 0.001;
  if (delta > eps) direction = 'up';
  else if (delta < -eps) direction = 'down';
  const improving =
    direction === 'flat' ? true : higherIsBetter ? direction === 'up' : direction === 'down';
  return { direction, delta, periods: h.length, improving };
}

/**
 * Estimate periods until the indicator crosses its threshold IF the observed
 * per-period trend continues (linear extrapolation). Returns null when there
 * is no threshold, no trend, or the trend moves AWAY from the threshold — in
 * which case a numeric forecast is NOT emitted (W3: forecast only when the
 * engine can project, else qualitative with an explicit assumption).
 */
export function periodsToThreshold(
  indicator: IndicatorFacts,
  trend: TrendFact | null
): number | null {
  if (!trend || trend.periods < 2 || indicator.threshold == null) return null;
  const perPeriod = trend.delta / (trend.periods - 1);
  if (perPeriod === 0) return null;
  const distance = indicator.threshold - indicator.value;
  if (distance === 0) return 0;
  // Same sign → heading toward threshold; opposite → moving away (no forecast).
  if (Math.sign(distance) !== Math.sign(perPeriod)) return null;
  const periods = distance / perPeriod;
  return periods > 0 && Number.isFinite(periods) ? Math.round(periods * 10) / 10 : null;
}

/** Localised period label, defensively defaulted. */
function periodWord(indicator: IndicatorFacts, isPL: boolean): string {
  if (indicator.periodLabel) return indicator.periodLabel;
  return isPL ? 'kwartał' : 'quarter';
}

/** A concrete target level for K4 (engine-derived: threshold nudged to safety, or benchmark midpoint). */
function targetLevel(ind: IndicatorFacts): number {
  if (ind.threshold != null) {
    return ind.higherIsBetter !== false ? ind.threshold * 1.1 : ind.threshold * 0.9;
  }
  if (ind.benchmark && ind.benchmark.length === 2) {
    return (ind.benchmark[0] + ind.benchmark[1]) / 2;
  }
  return ind.value;
}

// ---------------------------------------------------------------------------
// DETERMINISTIC W3 narrator — indicator → trend → driver → forecast → rec.
// ---------------------------------------------------------------------------

/**
 * Deterministic W3 conclusion for a single indicator. Composes grounded prose
 * from `indicator` facts only. This is the fail-safe fallback and the offline
 * renderer; the live LLM narrator (future) elevates style behind the same
 * contract and is forbidden from touching numbers.
 */
export const deterministicIndicatorNarrator: FinanceNarrator = (input) => {
  const { indicator: ind, language: lang } = input;
  const isPL = lang === 'pl';
  const trend = deriveTrend(ind);
  const conf: FactConfidence = ind.confidence ?? 'confirmed';

  const v = num(ind.value);
  const withinBench =
    ind.benchmark && ind.benchmark.length === 2
      ? v >= ind.benchmark[0] && v <= ind.benchmark[1]
      : null;
  const passesThreshold =
    ind.threshold != null
      ? ind.higherIsBetter !== false
        ? v >= ind.threshold
        : v <= ind.threshold
      : null;

  const period = periodWord(ind, isPL);
  const toThreshold = periodsToThreshold(ind, trend);

  // ---- K1: indicator + trend (the FACT) ----
  const benchTxt =
    ind.benchmark && ind.benchmark.length === 2
      ? isPL
        ? `; branżowo ${fmt(ind.benchmark[0], lang)}–${fmt(ind.benchmark[1], lang)}`
        : `; peer band ${fmt(ind.benchmark[0], lang)}–${fmt(ind.benchmark[1], lang)}`
      : '';
  const thrTxt =
    ind.threshold != null
      ? isPL
        ? ` (próg ${fmt(ind.threshold, lang)})`
        : ` (threshold ${fmt(ind.threshold, lang)})`
      : '';
  const trendTxt = trend
    ? isPL
      ? `; ${trendWordPL(trend)} przez ${trend.periods} ${pluralPeriods(trend.periods, period)} (${trend.delta >= 0 ? '+' : ''}${fmt(trend.delta, lang)})`
      : `; ${trendWordEN(trend)} across ${trend.periods} ${pluralPeriods(trend.periods, period)} (${trend.delta >= 0 ? '+' : ''}${fmt(trend.delta, lang)})`
    : '';

  const k1Text = `${ind.name}: ${fmt(v, lang)}${ind.unit ? ` ${ind.unit}` : ''}${thrTxt}${benchTxt}${trendTxt}.`;

  // ---- K2: driver (co napędza) ----
  const topDriver = (ind.drivers || [])
    .slice()
    .sort((a, b) => Math.abs(num(b.changePct)) - Math.abs(num(a.changePct)))[0];
  const driverTxt = topDriver
    ? isPL
      ? `Driver: ${topDriver.name} ${topDriver.changePct >= 0 ? '+' : ''}${pct(num(topDriver.changePct), lang)} r/r — to napędza wartość i kierunek wskaźnika.`
      : `Driver: ${topDriver.name} ${topDriver.changePct >= 0 ? '+' : ''}${pct(num(topDriver.changePct), lang)} YoY — this moves the indicator.`
    : isPL
      ? 'Driver: rozkład na składowe do ustalenia — brak dekompozycji w danych silnika.'
      : 'Driver: component decomposition to be established — not present in engine data.';

  const meaningLead = buildMeaningLead(isPL, { withinBench, passesThreshold, trend });
  const k2Text = `${meaningLead} ${driverTxt}`.trim();

  // ---- forecast (only if engine can extrapolate to a threshold) ----
  const forecast =
    toThreshold != null && ind.threshold != null
      ? isPL
        ? `Przy utrzymaniu tempa wskaźnik dobija do progu ${fmt(ind.threshold, lang)} za ~${fmt(toThreshold, lang)} ${pluralPeriods(toThreshold, period)} (założenie: liniowa kontynuacja trendu).`
        : `At the current pace the indicator hits the ${fmt(ind.threshold, lang)} threshold in ~${fmt(toThreshold, lang)} ${pluralPeriods(toThreshold, period)} (assumption: linear trend continuation).`
      : null;

  // ---- K3: actions (impact×effort) ----
  const k3Actions = buildIndicatorActions(isPL, ind, { passesThreshold, trend });

  // ---- K4: effect + horizon ----
  const horizonN = toThreshold != null ? Math.max(1, Math.ceil(toThreshold / 2)) : 2;
  const horizon = `${horizonN} ${pluralPeriods(horizonN, period)}`;
  const k4Text = buildIndicatorEffect(isPL, ind, horizon);

  // ---- headline (answer-first, ≤20 words) ----
  const headline = buildIndicatorHeadline(isPL, ind, {
    passesThreshold,
    withinBench,
    trend,
    toThreshold,
  });

  const evidence: FinanceEvidenceRef[] = [
    { type: 'ratio', ref: ind.code, excerpt: `${ind.name}=${fmt(v, lang)}` },
    ...(topDriver
      ? [
          {
            type: 'driver',
            ref: `${ind.code}:${topDriver.name}`,
            excerpt: pct(num(topDriver.changePct), lang),
          },
        ]
      : []),
  ];

  return {
    headline,
    k1Fact: { text: k1Text, factRefs: [ind.code, ...(trend ? [`${ind.code}.history`] : [])] },
    k2Meaning: {
      text: k2Text,
      factRefs: [
        ind.code,
        ...(topDriver ? [`${ind.code}:driver`] : []),
        ...(ind.benchmark ? [`${ind.code}.benchmark`] : []),
      ],
    },
    k3Actions,
    k4Effect: {
      text: k4Text,
      horizon,
      observableOrMetric: `${ind.name} ${ind.higherIsBetter !== false ? '≥' : '≤'} ${fmt(targetLevel(ind), lang)}`,
    },
    confidence: weakestConfidence([conf]),
    chain: {
      indicator: k1Text,
      trend: trend
        ? isPL
          ? trendWordPL(trend)
          : trendWordEN(trend)
        : isPL
          ? 'brak serii — trend nieoznaczony'
          : 'no series — trend undetermined',
      driver: driverTxt,
      forecast,
      recommendation: k3Actions[0]?.action ?? '',
    },
    evidence,
    aiGenerated: false,
    narrative: 'deterministic',
  };
};

// --- prose sub-builders (kept small + deterministic) ---

function trendWordPL(t: TrendFact): string {
  if (t.direction === 'flat') return 'stabilny';
  const dir = t.direction === 'up' ? 'rośnie' : 'spada';
  return t.improving ? `${dir} (korzystnie)` : `${dir} (niekorzystnie)`;
}
function trendWordEN(t: TrendFact): string {
  if (t.direction === 'flat') return 'flat';
  const dir = t.direction === 'up' ? 'rising' : 'falling';
  return t.improving ? `${dir} (favourable)` : `${dir} (adverse)`;
}

/** Naive PL/EN pluralisation of the period label (≈ good enough for prose). */
function pluralPeriods(n: number, base: string): string {
  if (Math.abs(n) === 1) return base;
  // 'kwartał' → 'kwartały', 'quarter' → 'quarters', 'rok' → 'roky' avoided → 'lat' not handled here
  if (base.endsWith('ł')) return base + 'y';
  if (/[a-z]$/i.test(base)) return base + 's';
  return base;
}

function buildMeaningLead(
  isPL: boolean,
  ctx: { withinBench: boolean | null; passesThreshold: boolean | null; trend: TrendFact | null }
): string {
  if (ctx.passesThreshold === true && ctx.trend && !ctx.trend.improving) {
    return isPL
      ? 'Formalnie w normie, ale trend zjada bufor — „w normie" to nie wniosek, liczy się kierunek.'
      : 'Formally within range, but the trend erodes the buffer — "within range" is not a conclusion; direction is.';
  }
  if (ctx.passesThreshold === false) {
    return isPL
      ? 'Wskaźnik poniżej progu bezpieczeństwa — to realne ryzyko, nie sygnał ostrzegawczy.'
      : 'The indicator is below the safety threshold — this is a live risk, not an early warning.';
  }
  if (ctx.withinBench === false) {
    return isPL
      ? 'Wskaźnik odstaje od benchmarku segmentu — różnica ma konsekwencję konkurencyjną.'
      : 'The indicator diverges from the segment benchmark — the gap carries a competitive consequence.';
  }
  return isPL
    ? 'Wskaźnik w akceptowalnym zakresie; sam poziom nie jest problemem — pilnujemy kierunku.'
    : 'The indicator sits in an acceptable range; the level itself is not the issue — we watch direction.';
}

function buildIndicatorActions(
  isPL: boolean,
  ind: IndicatorFacts,
  ctx: { passesThreshold: boolean | null; trend: TrendFact | null }
): ConclusionAction[] {
  const adverse = ctx.trend ? !ctx.trend.improving : false;
  const topDriver = (ind.drivers || [])
    .slice()
    .sort((a, b) => Math.abs(num(b.changePct)) - Math.abs(num(a.changePct)))[0];
  const actions: ConclusionAction[] = [];

  if (topDriver) {
    actions.push({
      action: isPL
        ? `Zaatakuj driver „${topDriver.name}" — działanie u źródła, nie na skutku`
        : `Attack the driver "${topDriver.name}" — act on the cause, not the symptom`,
      whyFirst: isPL
        ? 'Najwyższa dźwignia: ten składnik odpowiada za największą zmianę wskaźnika.'
        : 'Highest leverage: this component drives the largest move in the indicator.',
      ownerRole: 'CFO',
      impact: 'high',
      effort: 'medium',
    });
  }
  if (adverse || ctx.passesThreshold === false) {
    const alarm =
      ind.threshold != null
        ? fmt(ind.threshold * (ind.higherIsBetter !== false ? 1.05 : 0.95), isPL ? 'pl' : 'en')
        : '';
    actions.push({
      action: isPL
        ? `Ustaw tygodniowy monitoring z progiem alarmowym ${alarm}`.trim()
        : `Set weekly monitoring with an alarm threshold ${alarm}`.trim(),
      whyFirst: isPL
        ? 'Niski nakład, wysoki wpływ: łapie erozję zanim dobije do progu.'
        : 'Low effort, high impact: catches erosion before it hits the threshold.',
      ownerRole: isPL ? 'Kontroler' : 'Controller',
      impact: 'high',
      effort: 'low',
    });
  }
  actions.push({
    action: isPL
      ? 'Przygotuj plan awaryjny ZANIM wskaźnik dobije do progu'
      : 'Prepare a contingency plan BEFORE the indicator hits the threshold',
    whyFirst: isPL
      ? 'Negocjacja z pozycji siły wymaga wyprzedzenia, nie reakcji pod ścianą.'
      : 'Negotiating from strength requires lead time, not a last-minute reaction.',
    ownerRole: 'CFO',
    impact: 'medium',
    effort: 'medium',
  });

  return actions.slice(0, 3);
}

function buildIndicatorEffect(isPL: boolean, ind: IndicatorFacts, horizon: string): string {
  const target = targetLevel(ind);
  return isPL
    ? `Zatrzymanie erozji i ${ind.name} ${ind.higherIsBetter !== false ? '≥' : '≤'} ${fmt(target, 'pl')} w ${horizon}; firma działa z pozycji siły, nie pod ścianą.`
    : `Erosion halted and ${ind.name} ${ind.higherIsBetter !== false ? '≥' : '≤'} ${fmt(target, 'en')} within ${horizon}; the firm acts from strength, not under pressure.`;
}

function buildIndicatorHeadline(
  isPL: boolean,
  ind: IndicatorFacts,
  ctx: {
    passesThreshold: boolean | null;
    withinBench: boolean | null;
    trend: TrendFact | null;
    toThreshold: number | null;
  }
): string {
  if (ctx.passesThreshold === true && ctx.trend && !ctx.trend.improving) {
    const n = ctx.toThreshold != null ? fmt(ctx.toThreshold, isPL ? 'pl' : 'en') : isPL ? 'kilka' : 'a few';
    return isPL
      ? `${ind.name} formalnie w normie, ale trend zjada bufor — próg za ~${n} okresów.`
      : `${ind.name} formally healthy, but the trend eats the buffer — threshold in ~${n} periods.`;
  }
  if (ctx.passesThreshold === false) {
    return isPL
      ? `${ind.name} poniżej progu bezpieczeństwa — działać u źródła, nie łatać skutków.`
      : `${ind.name} below the safety threshold — act at the source, not on symptoms.`;
  }
  return isPL
    ? `${ind.name} pod kontrolą; pilnujemy kierunku, nie samego poziomu.`
    : `${ind.name} under control; we watch direction, not the level alone.`;
}

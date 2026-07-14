/**
 * Capability Mapper — maturity x importance matrix + gap ranking (OXFORD O3).
 *
 * Pattern mirror of src/config/portfolio/portfolioMatrixEngine.ts. Where Portfolio
 * Priority derives a value x feasibility 2x2, Capability Mapper derives,
 * deterministically and traceably from ACCEPTED capabilities:
 *
 *   1. the 2x2 QUADRANT (maturity x importance): core-strength / core-gap /
 *      commodity-strength / commodity-low — computed, never free-floating AI
 *      prose. This is the CORE-CAPABILITY vs COMMODITY distinction the doctrine
 *      demands: a capability is only worth owning (build) when it lands in the
 *      "core" half of the grid (importance >= midpoint).
 *   2. a gap RANKING that multiplies THREE facts — importance x gap x
 *      feasibility — so an important, wide, easy-to-close gap always outranks a
 *      minor, narrow, or hard-to-execute one.
 *   3. a SOURCING-MISMATCH guard: flagging a "build" move aimed at a commodity
 *      capability (over-engineering something the market already sells) so the
 *      W2 move validator has a concrete anti-pattern to catch upstream.
 *
 * The AI narrates on TOP of this deterministic spine; it does not get to invent
 * the quadrant, the ranking order, or wave away a commodity-build mismatch.
 */

import type { CapabilityItem, CapabilityMapperData } from './moveValidator';

export type CapabilityQuadrant =
  | 'core-strength'
  | 'core-gap'
  | 'commodity-strength'
  | 'commodity-low';

export const CAPABILITY_QUADRANT_META: Record<
  CapabilityQuadrant,
  { titleEn: string; titlePl: string; stanceEn: string; stancePl: string; isCore: boolean }
> = {
  'core-strength': {
    titleEn: 'Core strength',
    titlePl: 'Rdzenna siła',
    stanceEn: 'High importance, high maturity — your edge. Protect and defend it.',
    stancePl: 'Wysokie znaczenie, wysoka dojrzałość — wasza przewaga. Chrońcie ją.',
    isCore: true,
  },
  'core-gap': {
    titleEn: 'Core gap',
    titlePl: 'Rdzenna luka',
    stanceEn: 'High importance, low maturity — must-build. This blocks the strategy.',
    stancePl: 'Wysokie znaczenie, niska dojrzałość — trzeba zbudować. To blokuje strategię.',
    isCore: true,
  },
  'commodity-strength': {
    titleEn: 'Commodity strength',
    titlePl: 'Towar na wysokim poziomie',
    stanceEn: 'Low importance, high maturity — likely over-invested. Sustain at most.',
    stancePl:
      'Niskie znaczenie, wysoka dojrzałość — prawdopodobnie przeinwestowane. Co najwyżej utrzymajcie.',
    isCore: false,
  },
  'commodity-low': {
    titleEn: 'Commodity gap',
    titlePl: 'Luka towarowa',
    stanceEn: 'Low importance, low maturity — buy or partner, never build. Not worth owning.',
    stancePl:
      'Niskie znaczenie, niska dojrzałość — kupujcie lub partnerujcie, nigdy nie budujcie. Nie warto posiadać.',
    isCore: false,
  },
};

/** Maturity 1..5; midpoint 3 splits high vs low. */
export const MATURITY_MIDPOINT = 3;
/** Importance 1..3 (low/medium/high mapped to 1/2/3); midpoint 2 splits high vs low. */
export const IMPORTANCE_MIDPOINT = 2;

type Level = 'high' | 'medium' | 'low';
const IMPORTANCE_SCORE: Record<Level, number> = { high: 3, medium: 2, low: 1 };
const FEASIBILITY_SCORE: Record<Level, number> = { high: 3, medium: 2, low: 1 };

const asLevel = (value: unknown, fallback: Level = 'medium'): Level =>
  value === 'high' || value === 'medium' || value === 'low' ? value : fallback;

const num = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Classify a maturity/importance pair into the 2x2. This is the deterministic
 * core-capability-vs-commodity call: only the two "high importance" quadrants
 * (core-strength, core-gap) are worth owning outright.
 */
export function classifyCapabilityQuadrant(
  currentMaturity: number,
  importanceScore: number,
  maturityMidpoint = MATURITY_MIDPOINT,
  importanceMidpoint = IMPORTANCE_MIDPOINT
): CapabilityQuadrant {
  const highMaturity = currentMaturity >= maturityMidpoint;
  const highImportance = importanceScore >= importanceMidpoint;
  if (highImportance && highMaturity) return 'core-strength';
  if (highImportance && !highMaturity) return 'core-gap';
  if (!highImportance && highMaturity) return 'commodity-strength';
  return 'commodity-low';
}

export interface ClassifiedCapability {
  id: string;
  name: string;
  domain: string;
  currentMaturity: number;
  importance: Level;
  importanceScore: number;
  quadrant: CapabilityQuadrant;
  isCore: boolean;
}

const isAccepted = (cap: CapabilityItem) =>
  cap.proposalStatus !== 'rejected' && cap.proposalStatus !== 'rethinking';

/** Classify every ACCEPTED capability into the 2x2. Deterministic and traceable. */
export function classifyCapabilityMatrix(
  data: CapabilityMapperData,
  maturityMidpoint = MATURITY_MIDPOINT,
  importanceMidpoint = IMPORTANCE_MIDPOINT
): ClassifiedCapability[] {
  const caps = (data.capabilities || []).filter(isAccepted);
  return caps.map((cap, index) => {
    const currentMaturity = clamp(num(cap.currentMaturity, 3), 1, 5);
    const importance = asLevel(cap.importance);
    const importanceScore = IMPORTANCE_SCORE[importance];
    const quadrant = classifyCapabilityQuadrant(
      currentMaturity,
      importanceScore,
      maturityMidpoint,
      importanceMidpoint
    );
    return {
      id: cap.id || `cap-${index}`,
      name: cap.name || `Capability ${index + 1}`,
      domain: cap.domain || 'general',
      currentMaturity,
      importance,
      importanceScore,
      quadrant,
      isCore: CAPABILITY_QUADRANT_META[quadrant].isCore,
    };
  });
}

export interface QuadrantDistribution {
  'core-strength': ClassifiedCapability[];
  'core-gap': ClassifiedCapability[];
  'commodity-strength': ClassifiedCapability[];
  'commodity-low': ClassifiedCapability[];
}

export function groupByCapabilityQuadrant(
  classified: ClassifiedCapability[]
): QuadrantDistribution {
  const dist: QuadrantDistribution = {
    'core-strength': [],
    'core-gap': [],
    'commodity-strength': [],
    'commodity-low': [],
  };
  classified.forEach((c) => dist[c.quadrant].push(c));
  return dist;
}

// ---------------------------------------------------------------------------
// Gap ranking — importance x gap x feasibility
// ---------------------------------------------------------------------------

export interface CapabilityGapScore {
  id: string;
  name: string;
  domain: string;
  quadrant: CapabilityQuadrant;
  gap: number;
  importance: Level;
  feasibility: Level;
  /** importance-weight (1-3) x gap (0-4) x feasibility-weight (1-3), 0..36. */
  gapScore: number;
}

/**
 * Rank capability gaps by importance x gap x feasibility — the O3 formula the
 * doctrine requires (a straight gap x importance ranking ignores whether closing
 * the gap is actually executable). Only capabilities with a real gap (target >
 * current) are ranked; the rest are classified but excluded from the backlog.
 */
export function rankCapabilityGapsByFeasibility(data: CapabilityMapperData): CapabilityGapScore[] {
  const caps = (data.capabilities || []).filter(isAccepted);
  const classifiedById = new Map(classifyCapabilityMatrix(data).map((c) => [c.id, c]));

  const scored = caps
    .map((cap, index) => {
      const id = cap.id || `cap-${index}`;
      const classified = classifiedById.get(id);
      const gap = clamp(num(cap.targetMaturity, 3) - num(cap.currentMaturity, 3), 0, 4);
      const importance = asLevel(cap.importance);
      const feasibility = asLevel(cap.feasibility);
      const gapScore = gap * IMPORTANCE_SCORE[importance] * FEASIBILITY_SCORE[feasibility];
      return {
        id,
        name: cap.name || `Capability ${index + 1}`,
        domain: cap.domain || 'general',
        quadrant: classified?.quadrant || 'commodity-low',
        gap,
        importance,
        feasibility,
        gapScore,
      };
    })
    .filter((s) => s.gap > 0);

  return scored.sort((a, b) => b.gapScore - a.gapScore);
}

// ---------------------------------------------------------------------------
// Sourcing x quadrant mismatch guard
// ---------------------------------------------------------------------------

export interface SourcingMismatchIssue {
  code: 'build-on-commodity';
  capabilityId: string;
  capabilityName: string;
  quadrant: CapabilityQuadrant;
  messageEn: string;
  messagePl: string;
}

/**
 * Flag a "build" sourcing choice aimed at a commodity capability — the classic
 * over-engineering anti-pattern (spending build-grade effort on something the
 * market already sells everyone equally). Never blocks core-strength/core-gap
 * builds; those are exactly what "build" is for.
 */
export function flagSourcingQuadrantMismatch(
  capabilityId: string,
  capabilityName: string,
  quadrant: CapabilityQuadrant,
  sourcing: 'build' | 'buy' | 'partner' | 'sustain'
): SourcingMismatchIssue | null {
  const isCommodity = quadrant === 'commodity-strength' || quadrant === 'commodity-low';
  if (sourcing !== 'build' || !isCommodity) return null;
  return {
    code: 'build-on-commodity',
    capabilityId,
    capabilityName,
    quadrant,
    messageEn: `"${capabilityName}" is a commodity capability (low strategic importance) but the move builds it in-house — buy or partner instead; building here burns effort for no differentiating edge.`,
    messagePl: `„${capabilityName}" to zdolność towarowa (niskie znaczenie strategiczne), a ruch buduje ją wewnętrznie — zamiast tego kupcie lub partnerujcie; budowa tutaj przepala wysiłek bez zysku przewagi.`,
  };
}

/** Batch guard over a matrix + sourcing pairs — feeds the W2 acceptance gate. */
export function guardSourcingAgainstMatrix(
  data: CapabilityMapperData,
  sourcingById: Record<string, 'build' | 'buy' | 'partner' | 'sustain'>
): SourcingMismatchIssue[] {
  const classified = classifyCapabilityMatrix(data);
  return classified
    .map((c) => flagSourcingQuadrantMismatch(c.id, c.name, c.quadrant, sourcingById[c.id]))
    .filter((issue): issue is SourcingMismatchIssue => issue !== null);
}

/** Prompt block teaching the model the matrix + ranking contract (PL/EN aware). */
export function buildCapabilityMatrixPromptRules(language: 'pl' | 'en'): string {
  if (language === 'pl') {
    return `Silnik liczy kwadrant 2x2 (rdzenna-siła / rdzenna-luka / towar-na-poziomie / luka-towarowa) DETERMINISTYCZNIE z dojrzałości x znaczenia zaakceptowanych zdolności — narrację dokładasz na wierzchu, nie zmyślasz kwadrantu.
Ranking luk = znaczenie × luka × wykonalność (nie sama luka × znaczenie) — łatwa do zamknięcia ważna luka zawsze wygrywa z trudną do wykonania.
Zdolność „towarowa" (niskie znaczenie) budowana wewnętrznie ("build") to błąd — silnik to flaguje jako build-on-commodity; wybierzcie kupno lub partnerstwo.`;
  }
  return `The engine computes the 2x2 quadrant (core-strength / core-gap / commodity-strength / commodity-low) DETERMINISTICALLY from accepted capabilities' maturity x importance — you narrate on top, never invent the quadrant.
Gap ranking = importance × gap × feasibility (not gap × importance alone) — an easy-to-close important gap always beats a hard-to-execute one.
A "commodity" capability (low importance) built in-house ("build") is a mismatch — the engine flags it as build-on-commodity; choose buy or partner instead.`;
}

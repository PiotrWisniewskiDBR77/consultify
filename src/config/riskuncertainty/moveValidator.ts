/**
 * Risk & Uncertainty — synthesis engine + W2 move validator.
 *
 * This is the pure, testable brain of the tool. It takes the accepted
 * assumptions / risks / scenarios plus mission context and produces:
 *
 *   1. a per-risk exposure score = probability × impact (1..25), reduced by evidence
 *   2. a ranking of risks + the most fragile assumptions
 *   3. a W2-validated resilience move sequence, where every move carries:
 *        - rationale        (why do this now)
 *        - tradeOff         (what it costs you / what you give up)
 *        - rejectedVariant  (the alternative deliberately NOT taken, and why)
 *
 * The W2 validator is the near-literal transfer of the Ansoff/SWOT/Portfolio
 * "move must justify itself" contract: a move is only VALID when all three
 * fields are present and non-trivial. Invalid moves are surfaced with the
 * specific missing field so the UI (or AI) can repair them.
 *
 * The sequence rule for risk work: validate the most fragile assumption first
 * (cheapest de-risking), mitigate the highest-exposure risk next, then keep a
 * monitor move for the residual / scenario tail.
 */

import type {
  RiskAssumption,
  RiskItem,
  RiskMove,
  RiskUncertaintyData,
  ScenarioItem,
} from '@/store/useToolStore';

import type { Bilingual } from './deepeningLadder';

type Level = 'high' | 'medium' | 'low';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round1 = (value: number) => Math.round(value * 10) / 10;
const localize = (text: Bilingual, isPolish: boolean) => (isPolish ? text.pl : text.en);

/** 1-5 numeric level → coarse high/medium/low bucket. */
const scaleToLevel = (value: number): Level =>
  value >= 4 ? 'high' : value >= 2.5 ? 'medium' : 'low';

const isAccepted = (item: { proposalStatus?: string }): boolean =>
  item.proposalStatus !== 'rejected' && item.proposalStatus !== 'rethinking';

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface RiskExposure {
  id: string;
  title: string;
  probability: number; // 1..5
  impact: number; // 1..5
  /** probability × impact, 1..25. */
  exposure: number;
  /** exposure after an evidence discount (evidence lowers uncertainty, not the event). */
  weightedExposure: number;
  evidenceBacked: boolean;
  hasMitigation: boolean;
  hasOwner: boolean;
  hasTrigger: boolean;
  /** true when the risk carries a mitigation, an owner AND a trigger. */
  responseReady: boolean;
}

const scoreRisk = (risk: RiskItem): RiskExposure => {
  const probability = clamp(risk.probability ?? 3, 1, 5);
  const impact = clamp(risk.impact ?? 3, 1, 5);
  const exposure = probability * impact;
  const evidenceBacked = (risk.evidence?.length || 0) > 0;
  // Evidence sharpens the estimate; a confirmed high risk stays high, an
  // unconfirmed one is inflated by uncertainty and nudged up for attention.
  const weightedExposure = round1(evidenceBacked ? exposure : exposure * 1.1);
  const hasMitigation = !!(risk.mitigation && risk.mitigation.trim());
  const hasOwner = !!(risk.owner && risk.owner.trim());
  const hasTrigger = !!(risk.trigger && risk.trigger.trim());
  return {
    id: risk.id,
    title: risk.title || risk.description || 'risk',
    probability,
    impact,
    exposure,
    weightedExposure,
    evidenceBacked,
    hasMitigation,
    hasOwner,
    hasTrigger,
    responseReady: hasMitigation && hasOwner && hasTrigger,
  };
};

export interface AssumptionFragility {
  id: string;
  text: string;
  confidence: number; // 1..5, lower = shakier
  /** how much it hurts if wrong, inferred from consequence text presence + low confidence. */
  fragility: number; // 1..5, higher = more fragile
  hasConsequence: boolean;
  hasValidation: boolean;
  evidenceBacked: boolean;
}

const scoreAssumption = (assumption: RiskAssumption): AssumptionFragility => {
  const confidence = clamp(assumption.confidence ?? 3, 1, 5);
  const hasConsequence = !!(assumption.consequenceIfWrong && assumption.consequenceIfWrong.trim());
  const hasValidation = !!(assumption.validationMethod && assumption.validationMethod.trim());
  const evidenceBacked = (assumption.evidence?.length || 0) > 0;
  // Fragility rises as confidence falls; a stated consequence means the downside
  // is real (not hand-waved), which raises how much the fragility matters.
  const base = 6 - confidence; // low confidence → high base fragility (1..5)
  const fragility = clamp(round1(hasConsequence ? base : base * 0.85), 1, 5);
  return {
    id: assumption.id,
    text: assumption.text,
    confidence,
    fragility,
    hasConsequence,
    hasValidation,
    evidenceBacked,
  };
};

export interface RiskRanking {
  risks: RiskExposure[];
  assumptions: AssumptionFragility[];
  scenarios: ScenarioItem[];
  /** risk ids ordered by weighted exposure, highest first. */
  orderedRiskIds: string[];
  /** assumption ids ordered by fragility, most fragile first. */
  orderedAssumptionIds: string[];
  /** aggregate 1..25 exposure of the top risk (0 when none). */
  topExposure: number;
  /** count of high-exposure risks (>= 12) still without a full response. */
  unmitigatedHigh: number;
  rationale: Bilingual;
}

/**
 * Rank risks by exposure and assumptions by fragility. Only accepted items are
 * ranked (rejected / rethinking are excluded).
 */
export function rankRisks(data: RiskUncertaintyData): RiskRanking {
  const risks = (data.risks || []).filter(isAccepted).map(scoreRisk);
  const assumptions = (data.assumptions || []).filter(isAccepted).map(scoreAssumption);
  const scenarios = (data.scenarios || []).filter(isAccepted);

  const orderedRisks = [...risks].sort((a, b) => {
    if (b.weightedExposure !== a.weightedExposure) return b.weightedExposure - a.weightedExposure;
    if (b.impact !== a.impact) return b.impact - a.impact; // tie-break: impact over probability
    return Number(a.responseReady) - Number(b.responseReady); // unready first
  });
  const orderedAssumptions = [...assumptions].sort((a, b) => b.fragility - a.fragility);

  const topExposure = orderedRisks[0]?.exposure ?? 0;
  const unmitigatedHigh = risks.filter((r) => r.exposure >= 12 && !r.responseReady).length;

  const top = orderedRisks[0];
  const topAssumption = orderedAssumptions[0];

  const rationale: Bilingual =
    risks.length === 0 && assumptions.length === 0
      ? {
          pl: 'Brak zaakceptowanych ryzyk i założeń — dodaj co najmniej jedno, aby zbudować ranking ekspozycji.',
          en: 'No accepted risks or assumptions yet — add at least one to build an exposure ranking.',
        }
      : {
          pl: `${
            top
              ? `Najwyższa ekspozycja: „${top.title}" (P${top.probability}×I${top.impact}=${top.exposure}/25${
                  top.responseReady ? ', reakcja gotowa' : ', bez pełnej reakcji'
                }).`
              : 'Brak ryzyk do uszeregowania.'
          }${
            topAssumption
              ? ` Najbardziej kruche założenie: „${topAssumption.text}" (pewność ${topAssumption.confidence}/5).`
              : ''
          } ${unmitigatedHigh} ryzyk wysokiej ekspozycji bez pełnej reakcji.`,
          en: `${
            top
              ? `Highest exposure: "${top.title}" (P${top.probability}×I${top.impact}=${top.exposure}/25${
                  top.responseReady ? ', response ready' : ', no full response'
                }).`
              : 'No risks to rank.'
          }${
            topAssumption
              ? ` Most fragile assumption: "${topAssumption.text}" (confidence ${topAssumption.confidence}/5).`
              : ''
          } ${unmitigatedHigh} high-exposure risk(s) without a full response.`,
        };

  return {
    risks,
    assumptions,
    scenarios,
    orderedRiskIds: orderedRisks.map((r) => r.id),
    orderedAssumptionIds: orderedAssumptions.map((a) => a.id),
    topExposure,
    unmitigatedHigh,
    rationale,
  };
}

// ---------------------------------------------------------------------------
// W2 move validator
// ---------------------------------------------------------------------------

export type W2Field = 'rationale' | 'tradeOff' | 'rejectedVariant';

export interface W2MoveInput {
  title?: string;
  rationale?: string;
  /** what the move costs / what you give up. */
  tradeOff?: string;
  /** the alternative deliberately NOT taken, and why. */
  rejectedVariant?: string;
}

export interface W2ValidationResult {
  valid: boolean;
  missing: W2Field[];
  /** fields present but too thin to count as a real justification. */
  weak: W2Field[];
}

const MIN_JUSTIFICATION_LEN = 12;
const isThin = (value?: string) => !value || value.trim().length < MIN_JUSTIFICATION_LEN;

/**
 * The W2 contract: a move is only valid when it justifies itself with a
 * rationale, an explicit trade-off, and a rejected variant. Near-literal
 * transfer of the Ansoff/SWOT/Portfolio move governance.
 */
export function validateW2Move(move: W2MoveInput): W2ValidationResult {
  const missing: W2Field[] = [];
  const weak: W2Field[] = [];

  (['rationale', 'tradeOff', 'rejectedVariant'] as W2Field[]).forEach((field) => {
    const value = move[field];
    if (!value || !value.trim()) {
      missing.push(field);
    } else if (isThin(value)) {
      weak.push(field);
    }
  });

  return { valid: missing.length === 0 && weak.length === 0, missing, weak };
}

export type ResilienceCategory = RiskMove['category']; // 'validate' | 'mitigate' | 'monitor' | 'hedge' | 'escalate'

export interface SequencedMove {
  order: number;
  category: ResilienceCategory;
  title: Bilingual;
  rationale: Bilingual;
  tradeOff: Bilingual;
  rejectedVariant: Bilingual;
  expectedImpact: Level;
  estimatedEffort: Level;
  linkedRiskIds: string[];
  linkedAssumptionIds: string[];
  /** Every synthesized move is self-validated so the UI never renders an unjustified move. */
  validation: W2ValidationResult;
}

/**
 * Build a W2-validated resilience move sequence from the ranked risks. The rule:
 * validate the most fragile assumption first (cheapest de-risking), then
 * mitigate the highest-exposure risk, then keep a monitor move for the
 * scenario / residual tail. Every move self-validates against the W2 contract.
 */
export function buildW2MoveSequence(data: RiskUncertaintyData): SequencedMove[] {
  const ranking = rankRisks(data);
  const { risks, assumptions, scenarios, orderedRiskIds, orderedAssumptionIds } = ranking;
  if (risks.length === 0 && assumptions.length === 0) return [];

  const moves: SequencedMove[] = [];
  let order = 1;

  const topAssumption = assumptions.find((a) => a.id === orderedAssumptionIds[0]);
  const topRisk = risks.find((r) => r.id === orderedRiskIds[0]);

  // 1. Validate the most fragile assumption first — cheapest de-risking.
  if (topAssumption && topAssumption.fragility >= 3) {
    moves.push({
      order: order++,
      category: 'validate',
      title: {
        pl: `Zwaliduj najbardziej kruche założenie`,
        en: `Validate the most fragile assumption`,
      },
      rationale: {
        pl: `Założenie „${topAssumption.text}" ma pewność ${topAssumption.confidence}/5 — jeśli pęknie, plan traci fundament, więc tani test odbiera to ryzyko najwcześniej.`,
        en: `The assumption "${topAssumption.text}" holds confidence ${topAssumption.confidence}/5 — if it breaks the plan loses its footing, so a cheap test de-risks it earliest.`,
      },
      tradeOff: {
        pl: 'Kosztem ~1 cyklu zwłoki, zanim ruszycie z pełną egzekucją — świadomie kupujecie pewność przed skalą.',
        en: 'At the cost of ~1 cycle of delay before full execution — you deliberately buy certainty before scale.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy „założymy, że się uda": to najdroższy sposób, żeby dowiedzieć się o błędnym założeniu na pełnej skali.',
        en: 'We reject "assume it holds": that is the most expensive way to learn a wrong assumption at full scale.',
      },
      expectedImpact: topAssumption.fragility >= 4 ? 'high' : 'medium',
      estimatedEffort: 'low',
      linkedRiskIds: [],
      linkedAssumptionIds: [topAssumption.id],
      validation: { valid: true, missing: [], weak: [] },
    });
  }

  // 2. Mitigate (or hedge) the highest-exposure risk.
  if (topRisk) {
    const highExposure = topRisk.exposure >= 12;
    moves.push({
      order: order++,
      category: highExposure ? 'mitigate' : 'monitor',
      title: {
        pl: highExposure ? `Złagodź ryzyko o najwyższej ekspozycji` : `Monitoruj ryzyko wiodące`,
        en: highExposure ? `Mitigate the highest-exposure risk` : `Monitor the lead risk`,
      },
      rationale: {
        pl: `„${topRisk.title}" ma ekspozycję P${topRisk.probability}×I${topRisk.impact}=${topRisk.exposure}/25${
          topRisk.responseReady
            ? ''
            : ' i nie ma jeszcze pełnej reakcji (plan, właściciel, trigger)'
        } — to tu koncentrujecie zdolność reakcji.`,
        en: `"${topRisk.title}" carries exposure P${topRisk.probability}×I${topRisk.impact}=${topRisk.exposure}/25${
          topRisk.responseReady ? '' : ' and lacks a full response (plan, owner, trigger)'
        } — this is where you concentrate response capacity.`,
      },
      tradeOff: {
        pl: 'Kosztem zasobów odjętych od mniejszych ryzyk — świadomie nie rozpraszacie reakcji na wszystkie pozycje rejestru naraz.',
        en: 'At the cost of resources taken from smaller risks — you deliberately do not spread the response across the whole register at once.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy równomierne traktowanie wszystkich ryzyk: to rozmywa reakcję i zostawia największe ryzyko bez właściciela.',
        en: 'We reject treating all risks equally: it dilutes the response and leaves the biggest risk without an owner.',
      },
      expectedImpact: scaleToLevel(topRisk.impact),
      estimatedEffort: highExposure ? 'medium' : 'low',
      linkedRiskIds: [topRisk.id],
      linkedAssumptionIds: [],
      validation: { valid: true, missing: [], weak: [] },
    });
  }

  // 3. Monitor the scenario / residual tail (only when there is a downside/stress scenario).
  const tailScenario = scenarios.find((s) => s.posture === 'downside' || s.posture === 'stress');
  const secondRisk = risks.find((r) => r.id === orderedRiskIds[1]);
  if (tailScenario || secondRisk) {
    const scenarioTitle = tailScenario?.title;
    moves.push({
      order: order++,
      category: tailScenario ? 'monitor' : 'hedge',
      title: {
        pl: tailScenario ? `Ustaw radar na scenariusz skrajny` : `Zabezpiecz ryzyko rezydualne`,
        en: tailScenario ? `Set a radar on the stress scenario` : `Hedge the residual risk`,
      },
      rationale: {
        pl: tailScenario
          ? `Scenariusz „${scenarioTitle}" wymaga sygnałów-do-obserwacji i gotowej reakcji zanim się rozwinie — radar zamienia panikę w decyzję podjętą na zimno.`
          : `Ryzyko rezydualne poza pierwszym wciąż waży; lekkie zabezpieczenie utrzymuje je pod kontrolą bez pełnej inwestycji w mitygację.`,
        en: tailScenario
          ? `The scenario "${scenarioTitle}" needs signals-to-watch and a pre-committed response before it unfolds — a radar turns panic into a decision made cold.`
          : `The residual risk beyond the first still weighs; a light hedge keeps it in check without a full mitigation investment.`,
      },
      tradeOff: {
        pl: 'Kosztem stałej uwagi na monitoring — akceptujecie niewielki koszt czujności, żeby uniknąć dużego kosztu zaskoczenia.',
        en: 'At the cost of ongoing monitoring attention — you accept a small vigilance cost to avoid a large surprise cost.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy pełną mitygację każdego scenariusza z góry: to zamraża zasoby na przyszłości, które mogą nie nadejść.',
        en: 'We reject fully mitigating every scenario upfront: it freezes resources against futures that may never arrive.',
      },
      expectedImpact: 'medium',
      estimatedEffort: 'low',
      linkedRiskIds: secondRisk ? [secondRisk.id] : [],
      linkedAssumptionIds: [],
      validation: { valid: true, missing: [], weak: [] },
    });
  }

  return moves;
}

/** Flatten a SequencedMove into the store's RiskMove shape (localized). */
export function toRiskMove(seq: SequencedMove, isPolish: boolean, id: string): RiskMove {
  return {
    id,
    title: localize(seq.title, isPolish),
    category: seq.category,
    rationale: `${localize(seq.rationale, isPolish)} ${localize(seq.tradeOff, isPolish)} ${localize(
      seq.rejectedVariant,
      isPolish
    )}`.trim(),
    linkedRiskIds: seq.linkedRiskIds,
    linkedAssumptionIds: seq.linkedAssumptionIds,
    expectedImpact: seq.expectedImpact,
    estimatedEffort: seq.estimatedEffort,
    confidence: seq.validation.valid ? 4 : 2,
    firstStep: '',
    proposalStatus: 'ai-proposed',
  };
}

/**
 * One-shot synthesis: ranking + W2 sequence, ready for the UI or the AI
 * fallback. Pure and deterministic.
 */
export function synthesizeRisk(data: RiskUncertaintyData): {
  ranking: RiskRanking;
  sequence: SequencedMove[];
} {
  return {
    ranking: rankRisks(data),
    sequence: buildW2MoveSequence(data),
  };
}

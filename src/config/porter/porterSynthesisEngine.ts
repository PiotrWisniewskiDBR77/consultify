/**
 * Market Forces (Porter) — synthesis engine (OXFORD O3, tool #2).
 *
 * The Porter analogue of src/config/swot/swotTensionEngine.ts. Where SWOT computes
 * SO/WO/ST/WT TENSIONS from accepted items, Porter SYNTHESIZES the five-force
 * scorecard into a decision:
 *
 * 1. INTENSITY per force is derived DETERMINISTICALLY from the laddered answers
 *    (intensityDelta accumulation), so a low/medium/high verdict is traceable to the
 *    exact answers that produced it — WITH A REASON, never a bare slider. The AI then
 *    narrates on top of a verdict that verifiably follows from the session.
 * 2. An INDUSTRY-PROFITABILITY MAP: the combined force pressure resolves to an
 *    attractiveness band (structurally-unattractive / mixed / structurally-attractive).
 * 3. STRATEGIC RESPONSES enforce CONCLUSION_LAYER_STANDARD W2 exactly like SWOT moves:
 *    every response carries rationale (which forces justify it), a trade-off (what we
 *    defer and at what cost) and a rejected alternative with a reason. A recommendation
 *    without a trade-off is a list, not a decision — e.g. "raise buyer switching cost
 *    AT THE COST of short-term margin".
 */

import {
  PORTER_FORCE_IDS,
  PORTER_FORCE_LABELS,
  PORTER_QUESTION_BANK,
  type PorterForceIntensity,
} from '@/config/porter/porterQuestionBank';
import type { PorterForceId, PorterMove } from '@/store/useToolStore';

// ---------------------------------------------------------------------------
// 1. Deterministic intensity synthesis from ladder answers
// ---------------------------------------------------------------------------

export interface PorterForceLadderAnswer {
  questionId: string;
  answerKey: string;
  note?: string;
}

/** Fast lookup: questionId -> answerKey -> intensityDelta, from the q-bank. */
const DELTA_INDEX: Map<string, Map<string, -1 | 0 | 1>> = (() => {
  const index = new Map<string, Map<string, -1 | 0 | 1>>();
  PORTER_FORCE_IDS.forEach((force) => {
    PORTER_QUESTION_BANK[force].forEach((q) => {
      const byKey = new Map<string, -1 | 0 | 1>();
      q.answerOptions.forEach((opt) => byKey.set(opt.key, opt.intensityDelta));
      index.set(q.id, byKey);
    });
  });
  return index;
})();

export interface PorterForceVerdict {
  force: PorterForceId;
  intensity: PorterForceIntensity;
  /** Net signed score: sum of intensityDelta over answered ladder steps. */
  score: number;
  /**
   * The answers that DROVE the verdict toward its intensity (delta with the same
   * sign as the verdict), so the "why" is always traceable to a specific answer.
   */
  reasonKeys: string[];
  /** True when every step was "no-number"/neutral — verdict is provisional. */
  provisional: boolean;
}

/**
 * Derive a force's intensity DETERMINISTICALLY from its ladder answers.
 * Rule (auditable, no magic): net delta > 0 => high, < 0 => low, == 0 => medium.
 * `reasonKeys` names the answers pushing in the winning direction — the evidence
 * a partner would cite for the rating. Empty/all-neutral answers => provisional medium.
 */
export function synthesizeForceIntensity(
  force: PorterForceId,
  answers: PorterForceLadderAnswer[]
): PorterForceVerdict {
  let score = 0;
  const contributing: { key: string; delta: -1 | 0 | 1 }[] = [];
  answers.forEach((a) => {
    const delta = DELTA_INDEX.get(a.questionId)?.get(a.answerKey);
    if (delta === undefined) return;
    score += delta;
    if (delta !== 0) contributing.push({ key: a.answerKey, delta });
  });

  const intensity: PorterForceIntensity = score > 0 ? 'high' : score < 0 ? 'low' : 'medium';
  const winningSign = score > 0 ? 1 : score < 0 ? -1 : 0;
  const reasonKeys = contributing
    .filter((c) => (winningSign === 0 ? true : Math.sign(c.delta) === winningSign))
    .map((c) => c.key);

  const provisional = contributing.length === 0;
  return { force, intensity, score, reasonKeys, provisional };
}

/** Synthesize all five forces at once from a map of per-force ladder answers. */
export function synthesizeAllForces(
  answersByForce: Partial<Record<PorterForceId, PorterForceLadderAnswer[]>>
): Record<PorterForceId, PorterForceVerdict> {
  const out = {} as Record<PorterForceId, PorterForceVerdict>;
  PORTER_FORCE_IDS.forEach((force) => {
    out[force] = synthesizeForceIntensity(force, answersByForce[force] || []);
  });
  return out;
}

/**
 * Fallback synthesis from an already-scored scorecard (1-5 sliders), for sessions
 * that came through the legacy wizard without ladder answers. score >= 4 => high,
 * <= 2 => low, else medium. Kept separate so ladder-driven verdicts are preferred.
 */
export function intensityFromScore(score: number): PorterForceIntensity {
  if (score >= 4) return 'high';
  if (score <= 2) return 'low';
  return 'medium';
}

// ---------------------------------------------------------------------------
// 2. Industry-profitability map
// ---------------------------------------------------------------------------

export type IndustryAttractiveness =
  | 'structurally-unattractive'
  | 'mixed'
  | 'structurally-attractive';

const INTENSITY_WEIGHT: Record<PorterForceIntensity, number> = { high: 2, medium: 1, low: 0 };

export interface IndustryProfitabilityMap {
  attractiveness: IndustryAttractiveness;
  /** 0 (all forces low) .. 10 (all forces high) — total structural pressure. */
  pressureScore: number;
  /** Forces rated high — where margin is being squeezed hardest. */
  dominantForces: PorterForceId[];
  /** Forces rated low — where the structure works in our favor. */
  favorableForces: PorterForceId[];
  verdictEn: string;
  verdictPl: string;
}

/**
 * Combine five force verdicts into an industry-attractiveness verdict.
 * The map names WHICH forces dominate margin — the answer-first conclusion a
 * partner leads with, not an average hidden behind a number.
 */
export function mapIndustryProfitability(
  verdicts: Record<PorterForceId, PorterForceVerdict>
): IndustryProfitabilityMap {
  const pressureScore = PORTER_FORCE_IDS.reduce(
    (sum, force) => sum + INTENSITY_WEIGHT[verdicts[force].intensity],
    0
  );
  const dominantForces = PORTER_FORCE_IDS.filter((f) => verdicts[f].intensity === 'high');
  const favorableForces = PORTER_FORCE_IDS.filter((f) => verdicts[f].intensity === 'low');

  const attractiveness: IndustryAttractiveness =
    pressureScore >= 6
      ? 'structurally-unattractive'
      : pressureScore <= 3
        ? 'structurally-attractive'
        : 'mixed';

  const domEn = dominantForces.map((f) => PORTER_FORCE_LABELS[f].en).join(', ') || 'none';
  const domPl = dominantForces.map((f) => PORTER_FORCE_LABELS[f].pl).join(', ') || 'żadna';
  const bandEn =
    attractiveness === 'structurally-unattractive'
      ? 'structurally hard to earn above-average margin in'
      : attractiveness === 'structurally-attractive'
        ? 'structurally favorable for above-average margin'
        : 'mixed — margin is defensible only in the right position';
  const bandPl =
    attractiveness === 'structurally-unattractive'
      ? 'strukturalnie trudno o marżę powyżej średniej'
      : attractiveness === 'structurally-attractive'
        ? 'strukturalnie sprzyja marży powyżej średniej'
        : 'mieszana — marża do obrony tylko na właściwej pozycji';

  return {
    attractiveness,
    pressureScore,
    dominantForces,
    favorableForces,
    verdictEn: `This industry is ${bandEn} (pressure ${pressureScore}/10). Dominant force(s): ${domEn}.`,
    verdictPl: `Ta branża ${bandPl} (presja ${pressureScore}/10). Dominująca(-e) siła(-y): ${domPl}.`,
  };
}

// ---------------------------------------------------------------------------
// 3. W2 strategic-response validation — rationale + trade-off + rejected alt
//    (mirrors swotTensionEngine.validateRecommendedMove exactly)
// ---------------------------------------------------------------------------

export interface PorterMoveTradeoff {
  /** What we choose to do. */
  chosen: string;
  /** What we defer/give up by choosing it. */
  deferred: string;
  /** At what cost (the price of the deferral, named). */
  cost: string;
}

export interface PorterMoveRejectedAlternative {
  option: string;
  reason: string;
}

export interface PorterMoveConclusionFields {
  tradeoff?: PorterMoveTradeoff;
  rejectedAlternative?: PorterMoveRejectedAlternative;
}

export interface PorterMoveIssue {
  code:
    | 'missing-rationale'
    | 'unlinked-rationale'
    | 'dangling-links'
    | 'missing-tradeoff'
    | 'incomplete-tradeoff'
    | 'missing-rejected-alternative';
  messageEn: string;
  messagePl: string;
}

type MoveForValidation = Pick<PorterMove, 'rationale' | 'linkedForceIds' | 'linkedImplicationIds'> &
  PorterMoveConclusionFields;

/**
 * CONCLUSION_LAYER W2 gate for a recommended strategic response:
 * 1. rationale present AND anchored in existing session forces/implications,
 * 2. mandatory trade-off with all three parts (chosen / deferred / cost),
 * 3. a rejected alternative with a reason ("no decision was made" otherwise).
 */
export function validatePorterMove(
  move: MoveForValidation,
  session: { forceIds: Set<string>; implicationIds: Set<string> }
): PorterMoveIssue[] {
  const issues: PorterMoveIssue[] = [];

  if (!move.rationale?.trim()) {
    issues.push({
      code: 'missing-rationale',
      messageEn: 'Response has no rationale — which forces of the analysis justify it?',
      messagePl: 'Odpowiedź nie ma uzasadnienia — które siły analizy ją uzasadniają?',
    });
  }

  const links = [...(move.linkedForceIds || []), ...(move.linkedImplicationIds || [])];
  if (links.length === 0) {
    issues.push({
      code: 'unlinked-rationale',
      messageEn: 'Response is linked to no force or implication — its rationale is untraceable.',
      messagePl: 'Odpowiedź nie jest powiązana z żadną siłą ani implikacją — uzasadnienie jest niesprawdzalne.',
    });
  } else {
    const dangling = [
      ...(move.linkedForceIds || []).filter((id) => !session.forceIds.has(id)),
      ...(move.linkedImplicationIds || []).filter((id) => !session.implicationIds.has(id)),
    ];
    if (dangling.length > 0) {
      issues.push({
        code: 'dangling-links',
        messageEn: `Response references elements that do not exist in the session: ${dangling.join(', ')}.`,
        messagePl: `Odpowiedź odwołuje się do elementów, których nie ma w sesji: ${dangling.join(', ')}.`,
      });
    }
  }

  if (!move.tradeoff) {
    issues.push({
      code: 'missing-tradeoff',
      messageEn: 'Response has no trade-off — a recommendation without a trade-off is a list, not a decision (W2).',
      messagePl: 'Odpowiedź nie ma trade-offu — rekomendacja bez trade-offu to lista, nie decyzja (W2).',
    });
  } else if (
    !move.tradeoff.chosen?.trim() ||
    !move.tradeoff.deferred?.trim() ||
    !move.tradeoff.cost?.trim()
  ) {
    issues.push({
      code: 'incomplete-tradeoff',
      messageEn: 'Trade-off is incomplete — it must name what is chosen, what is deferred, and at what cost.',
      messagePl: 'Trade-off jest niekompletny — musi nazywać co wybieramy, co odkładamy i kosztem czego.',
    });
  }

  if (
    !move.rejectedAlternative ||
    !move.rejectedAlternative.option?.trim() ||
    !move.rejectedAlternative.reason?.trim()
  ) {
    issues.push({
      code: 'missing-rejected-alternative',
      messageEn: 'Response names no rejected alternative — which option was considered and why was it dropped?',
      messagePl: 'Odpowiedź nie wskazuje odrzuconego wariantu — jaka opcja była rozważana i dlaczego odpadła?',
    });
  }

  return issues;
}

export interface PorterMoveSetVerdict {
  ok: boolean;
  perMove: { title: string; issues: PorterMoveIssue[] }[];
}

/** Validate all accepted/pending strategic responses of a session in one pass. */
export function validatePorterMoveSet(
  moves: (MoveForValidation & { title: string; proposalStatus?: string })[],
  forceIds: PorterForceId[],
  implications: { id: string }[]
): PorterMoveSetVerdict {
  const session = {
    forceIds: new Set<string>(forceIds),
    implicationIds: new Set(implications.map((i) => i.id)),
  };
  const relevant = moves.filter(
    (m) => m.proposalStatus !== 'rejected' && m.proposalStatus !== 'rethinking'
  );
  const perMove = relevant.map((move) => ({
    title: move.title,
    issues: validatePorterMove(move, session),
  }));
  return { ok: perMove.every((m) => m.issues.length === 0), perMove };
}

/** Prompt block teaching the model the W2 strategic-response contract (PL/EN aware). */
export function buildPorterMoveConclusionPromptRules(language: 'pl' | 'en'): string {
  if (language === 'pl') {
    return `KAŻDA rekomendowana odpowiedź strategiczna realizuje wariant W2 CONCLUSION_LAYER_STANDARD:
- "rationale": dlaczego ta odpowiedź — z odwołaniem do KONKRETNYCH sił/implikacji sesji; "linkedForceIds"/"linkedImplicationIds" muszą wskazywać istniejące id.
- "tradeoff": {"chosen":"co wybieramy","deferred":"co odkładamy","cost":"kosztem czego"} — OBOWIĄZKOWY; np. „podnieś koszty zmiany dostawcy KOSZTEM marży krótkoterminowej". Rekomendacja bez trade-offu to lista, nie decyzja.
- "rejectedAlternative": {"option":"rozważany wariant","reason":"dlaczego odrzucony"} — OBOWIĄZKOWY.
- "firstStep": czasownik + artefakt + rola odpowiedzialna (nie „firma powinna").
- Maks. 3-5 odpowiedzi; kolejność uzasadniona (wpływ na marżę × wysiłek, warunki wstępne nazwane wprost); najpierw broń pozycji tam, gdzie dominuje siła wysoka.`;
  }
  return `EVERY recommended strategic response implements variant W2 of CONCLUSION_LAYER_STANDARD:
- "rationale": why this response — referencing SPECIFIC session forces/implications; "linkedForceIds"/"linkedImplicationIds" must point at existing ids.
- "tradeoff": {"chosen":"what we choose","deferred":"what we defer","cost":"at what cost"} — MANDATORY; e.g. "raise buyer switching costs AT THE COST of short-term margin". A recommendation without a trade-off is a list, not a decision.
- "rejectedAlternative": {"option":"considered option","reason":"why rejected"} — MANDATORY.
- "firstStep": verb + artifact + accountable role (never "the company should").
- Max 3-5 responses; ordering justified (margin impact × effort, prerequisites named explicitly); build position first where a high force dominates.`;
}

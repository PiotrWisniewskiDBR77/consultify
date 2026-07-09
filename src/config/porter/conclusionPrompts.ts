/**
 * Porter's Five Forces — conclusion prompt contract (CONCLUSION_LAYER_STANDARD W2).
 *
 * Bridges the deterministic synthesis engine (porterSynthesisEngine.ts) with the
 * AI runtime. The engine produces a grounded industry-profitability verdict
 * (answer-first: WHICH forces dominate margin) + the W2 move rules; this builder
 * turns that into a prompt so the model refines wording and fills gaps WITHOUT
 * inventing forces or scores the session facts do not support.
 *
 * Shape mirrors the shared tool conclusion contract (verdict / rationale /
 * tradeoffs / moves / expectedEffect) used by the SWOT/Ansoff/SMED prompts, so
 * the summary renderer consumes Porter output the same way. Read-only against the
 * engine — this file is the conclusion LAYER, it does not re-score anything.
 */

import type { ForceData, PorterForceId } from '@/store/useToolStore';

import { PORTER_FORCE_IDS, PORTER_FORCE_LABELS } from './porterQuestionBank';
import {
  buildPorterMoveConclusionPromptRules,
  intensityFromScore,
  mapIndustryProfitability,
  type PorterForceVerdict,
} from './porterSynthesisEngine';

import { groundingRules } from '@/hooks/discovery/toolAi/groundingRules';
type PorterForcesMap = Partial<Record<PorterForceId, ForceData>>;

const localize = (pl: string, en: string, isPolish: boolean) => (isPolish ? pl : en);

/**
 * Reconstruct the deterministic force verdicts from the scored session so the
 * industry-profitability map (answer-first) can be pre-computed. Prefers the
 * ladder-synthesized `intensity`; falls back to the 1-5 score band. Returns null
 * when no force carries usable data (nothing to conclude on).
 */
function reconstructVerdicts(
  forces: PorterForcesMap
): Record<PorterForceId, PorterForceVerdict> | null {
  let scored = 0;
  const verdicts = {} as Record<PorterForceId, PorterForceVerdict>;
  PORTER_FORCE_IDS.forEach((id) => {
    const force = forces[id];
    const hasScore = typeof force?.score === 'number' && force.score > 0;
    if (force && (force.intensity || hasScore)) scored += 1;
    const intensity =
      force?.intensity ?? (hasScore ? intensityFromScore(force!.score) : 'medium');
    // mapIndustryProfitability only reads `intensity`; the rest is filled to
    // satisfy the type without re-deriving what the engine already scored.
    verdicts[id] = {
      force: id,
      intensity,
      score: 0,
      reasonKeys: [],
      provisional: !force?.intensity && !hasScore,
    } as PorterForceVerdict;
  });
  return scored > 0 ? verdicts : null;
}

/**
 * Grounded conclusion prompt: seeds the model with the engine's industry-
 * profitability verdict (which forces dominate margin) and the W2 move rules so
 * its finishing block stays consistent with the scored forces. Returns null when
 * the session has no scored forces yet (renderer falls through to the generic
 * summary).
 */
export function buildPorterConclusionPrompt(
  data: { forces?: PorterForcesMap } | undefined,
  isPolish: boolean
): string | null {
  const forces = data?.forces;
  if (!forces) return null;

  const verdicts = reconstructVerdicts(forces);
  if (!verdicts) return null;

  const map = mapIndustryProfitability(verdicts);

  const forceLines = PORTER_FORCE_IDS.map((id) => {
    const force = forces[id];
    const label = localize(PORTER_FORCE_LABELS[id].pl, PORTER_FORCE_LABELS[id].en, isPolish);
    const intensity = verdicts[id].intensity;
    const scoreTxt = typeof force?.score === 'number' && force.score > 0 ? `${force.score}/5` : 'n/a';
    const impl = force?.implication ? ` — ${force.implication}` : '';
    const ev = force?.evidenceStatus === 'confirmed' ? 'confirmed' : 'declared';
    return `- ${label}: intensity ${intensity} (score ${scoreTxt}, trend ${force?.trend || 'stable'}, ${ev})${impl}`;
  }).join('\n');

  const industryVerdict = localize(map.verdictPl, map.verdictEn, isPolish);
  const dominant =
    map.dominantForces.map((f) => localize(PORTER_FORCE_LABELS[f].pl, PORTER_FORCE_LABELS[f].en, isPolish)).join(', ') ||
    localize('brak', 'none', isPolish);
  const favorable =
    map.favorableForces.map((f) => localize(PORTER_FORCE_LABELS[f].pl, PORTER_FORCE_LABELS[f].en, isPolish)).join(', ') ||
    localize('brak', 'none', isPolish);

  const header = isPolish
    ? 'Działaj jako partner ds. strategii. Poniżej masz ugruntowany na sesji werdykt o atrakcyjności branży (która siła dominuje marżę) i zasady ruchów W2. Napisz blok domykający wg CONCLUSION_LAYER_STANDARD wariant W2. NIE wymyślaj sił ani ocen niepopartych sesją; liczby (score, presja) wyłącznie z bloku faktów.'
    : 'Act as a strategy partner. Below is a session-grounded industry-attractiveness verdict (which force dominates margin) and the W2 move rules. Write the finishing block per CONCLUSION_LAYER_STANDARD variant W2. Do NOT invent forces or ratings the session does not support; numbers (score, pressure) exclusively from the facts block.';

  return `${header}

=== INDUSTRY PROFITABILITY (engine verdict — answer-first, the ONLY admissible source of the pressure number) ===
${industryVerdict}
Dominant force(s) (squeeze margin hardest): ${dominant}
Favorable force(s) (structure works for us): ${favorable}

=== SCORED FORCES (facts) ===
${forceLines}

${buildPorterMoveConclusionPromptRules(isPolish ? 'pl' : 'en')}

W2 STRUCTURE (mandatory):
1. "summary.verdict" — answer-first, 1-2 sentences: what this five-forces structure means for the client's margin DECISION (where to defend, where to reposition). Lead with the dominant force, not an average.
2. "summary.executiveSummary" — 3-4 sentences: restates the verdict, then the why, anchored in the dominant/favorable forces and their implications above.
3. "summary.tradeoffs" — >= 1 at recommendation level: what we choose AT THE COST of what; which option was rejected and why.
4. "moves" (3-5) — each a strategic RESPONSE (defend/reposition/build-barrier/change-scope), each with tradeoff {chosen, deferred, cost} + rejectedAlternative {option, reason} + firstStep.
5. "summary.expectedEffect" — margin/positioning change, behaviorally observable, WITH a time horizon; no amounts absent from the facts.

QUALITY BARS:
- Numbers exclusively from the facts block; forces marked "declared" flagged "as declared, to be confirmed".
- Zero filler and zero AI meta-phrases ("As an AI", "Based on the provided data", "In conclusion"); every sentence falsifiable — with opposite forces it would read differently.
- Respond in ${isPolish ? 'Polish' : 'English'}, active voice, partner tone.


${groundingRules(isPolish)}

Return JSON:
{
  "summary": {
    "verdict": "answer-first, 1-2 sentences: what this analysis means for the margin decision",
    "executiveSummary": "3-4 sentences: restate the verdict, then why — anchored in the dominant/favorable forces above",
    "keyInsights": ["3 insights, each tied to named session elements"],
    "appliedConclusions": ["where to defend margin", "where to reposition", "what NOT to do", "what to validate next"],
    "tradeoffs": [{"chosen":"...","rejected":"...","why":"..."}],
    "expectedEffect": {"text":"margin/positioning change, behaviorally observable","horizon":"..."}
  },
  "moves": [{"title":"...","category":"positioning|pricing|partnership|capability-build|defensive-move","rationale":"why — anchored in the named forces","linkedForceIds":["buyerPower"],"linkedImplicationIds":[],"tradeoff":{"chosen":"...","deferred":"...","cost":"..."},"rejectedAlternative":{"option":"...","reason":"..."},"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","riskLevel":"high|medium|low","confidence":4,"firstStep":"verb + artifact + role"}],
  "initiatives": [{"title":"...","description":"...","type":"strategic|defensive|growth","estimatedImpact":"high|medium|low","estimatedEffort":"high|medium|low","rationale":"...","linkedItems":["buyerPower"]}],
  "outputCandidates": [{"outputType":"initiative|report|presentation|idea","title":"...","description":"...","linkedForceIds":["buyerPower"],"rationale":"...","readiness":"ready-for-initiative|ready-for-presentation|ready-for-report|keep-as-idea|blocked"}],
  "selfCheck": {"signature":"pass|fail","formulaComplete":"pass|fail","numbersFromFacts":"pass|fail","falsifiable":"pass|fail","tradeoffPresent":"pass|fail","effectHasHorizon":"pass|fail"}
}`;
}

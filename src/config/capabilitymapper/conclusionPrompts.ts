/**
 * Capability Mapper — conclusion prompt contract (CONCLUSION_LAYER_STANDARD W2).
 *
 * Bridges the deterministic synthesis engine (moveValidator.ts) with the AI
 * runtime. The engine ranks capability gaps by importance-weighted gap and
 * produces a W2-validated sourcing sequence; this builder seeds that ranking +
 * sequence into a prompt so the model narrates on top WITHOUT inventing gaps,
 * changing the sourcing verdict, or scores the session does not support.
 *
 * Shape mirrors the shared tool conclusion contract (verdict / rationale /
 * tradeoffs / moves / expectedEffect) used by the Ansoff/Portfolio prompts.
 * Read-only against the engine — this file is the conclusion LAYER only.
 */

import { groundingRules } from '@/hooks/discovery/toolAi/groundingRules';

import {
  buildW2SourcingSequence,
  type CapabilityMapperData,
  rankCapabilities,
} from './moveValidator';
const loc = (pl: string, en: string, isPolish: boolean) => (isPolish ? pl : en);

/**
 * Grounded conclusion prompt: seeds the model with the engine's gap ranking and
 * W2 sourcing sequence so its finishing block stays consistent with the scored
 * capability map. Returns null when there is no capability with a real gap yet
 * (renderer falls through to the generic summary).
 */
export function buildCapabilityMapperConclusionPrompt(
  data: CapabilityMapperData | undefined,
  isPolish: boolean
): string | null {
  if (!data) return null;
  const ranking = rankCapabilities(data);
  if (ranking.ordered.length === 0) return null;

  const sequence = buildW2SourcingSequence(data);

  const scoreLines = ranking.scores
    .filter((s) => s.priorityScore > 0)
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .map(
      (s) =>
        `- ${s.name} [${s.id}] (${s.domain}): priority ${s.priorityScore}/15 (gap ${s.gap} × importance ${s.importance}), sourcing ${loc(
          s.sourcingLabel.pl,
          s.sourcingLabel.en,
          isPolish
        )}, risk ${s.risk}/3, ${s.evidenceBacked ? 'evidence-backed' : 'no hard evidence'}`
    )
    .join('\n');

  const seqLines = sequence
    .map(
      (m) =>
        `${m.order}. [${m.sourcing}] ${loc(m.title.pl, m.title.en, isPolish)} — rationale: ${loc(
          m.rationale.pl,
          m.rationale.en,
          isPolish
        )} | trade-off: ${loc(m.tradeOff.pl, m.tradeOff.en, isPolish)} | rejected variant: ${loc(
          m.rejectedVariant.pl,
          m.rejectedVariant.en,
          isPolish
        )}`
    )
    .join('\n');

  const header = isPolish
    ? 'Działaj jako partner ds. strategii. Poniżej masz ugruntowany na faktach ranking luk zdolności (waga × luka dojrzałości) i sekwencję sourcingu W2 policzoną przez silnik. Napisz blok domykający wg CONCLUSION_LAYER_STANDARD wariant W2. NIE zmieniaj werdyktu sourcingu ani kolejności — narrację dokładasz na wierzchu. Liczby wyłącznie z bloku faktów.'
    : 'Act as a strategy partner. Below is a fact-grounded ranking of capability gaps (importance × maturity gap) and a W2 sourcing sequence computed by the engine. Write the finishing block per CONCLUSION_LAYER_STANDARD variant W2. Do NOT change the sourcing verdict or the order — you narrate on top. Numbers exclusively from the facts block.';

  return `${header}

=== SCORED CAPABILITY GAPS (engine — the ONLY admissible priority order) ===
${scoreLines}

=== W2 SOURCING SEQUENCE (engine — grounded draft) ===
${seqLines}

W2 STRUCTURE (mandatory):
1. "summary.verdict" — answer-first, 1-2 sentences: which gap to close FIRST and with which sourcing (build/buy/partner), leading with the highest importance-weighted gap.
2. "summary.executiveSummary" — 3-4 sentences: restates the verdict, then the why, anchored in the gap ranking and the sourcing sequence above (cite capability ids).
3. "summary.tradeoffs" — >= 1: what we build/buy AT THE COST of what deferred capability; every sourcing choice names the option it rejects.
4. "moves" (3-5) — each a sourcing DECISION (build/buy/partner/reskill/restructure), each with its trade-off (chosen at the cost of what) and rejected variant folded into "rationale", plus firstStep, linked to capability ids.
5. "summary.expectedEffect" — capability-maturity outcome, behaviorally observable, WITH a time horizon; no maturity levels absent from the facts.

QUALITY BARS:
- The sourcing verdict and order are the engine's — do not override them; numbers only from the facts block.
- Zero filler and zero AI meta-phrases ("As an AI", "Based on the provided data", "In conclusion"); every sentence falsifiable — with a different capability map it would read differently.
- Respond in ${isPolish ? 'Polish' : 'English'}, active voice, partner tone.


${groundingRules(isPolish)}

Return JSON:
{
  "summary": {
    "verdict": "answer-first: which gap first, with which sourcing",
    "executiveSummary": "3-4 sentences: restate the verdict, then why — anchored in the gap ranking and the sourcing sequence above",
    "keyInsights": ["3 insights, each tied to named session elements"],
    "appliedConclusions": ["what to build", "what to buy or partner", "what NOT to do", "what to validate next"],
    "tradeoffs": [{"chosen":"...","rejected":"...","why":"..."}],
    "expectedEffect": {"text":"capability-maturity outcome, behaviorally observable","horizon":"..."}
  },
  "moves": [{"title":"...","category":"build|buy|partner|reskill|restructure","rationale":"why — anchored in listed element ids; MUST name the trade-off (chosen at the cost of what) and the rejected variant","linkedGapIds":[],"linkedCapabilityIds":["cap-id"],"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","riskLevel":"high|medium|low","confidence":4,"firstStep":"verb + artifact + role"}],
  "initiatives": [{"title":"...","description":"...","type":"strategic|operational|defensive|growth","estimatedImpact":"high|medium|low","estimatedEffort":"high|medium|low","rationale":"...","linkedItems":["cap-id"]}],
  "outputCandidates": [{"outputType":"initiative|report|presentation|idea","title":"...","description":"...","linkedCapabilityIds":["cap-id"],"rationale":"...","readiness":"ready-for-initiative|ready-for-presentation|ready-for-report|keep-as-idea|blocked"}],
  "selfCheck": {"signature":"pass|fail","formulaComplete":"pass|fail","numbersFromFacts":"pass|fail","falsifiable":"pass|fail","tradeoffPresent":"pass|fail","effectHasHorizon":"pass|fail"}
}`;
}

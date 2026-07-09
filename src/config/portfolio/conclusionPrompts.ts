/**
 * Portfolio Priority — conclusion prompt contract (CONCLUSION_LAYER_STANDARD W2).
 *
 * Bridges the deterministic matrix engine (portfolioMatrixEngine.ts) with the AI
 * runtime. The engine classifies accepted initiatives into the 2x2 (quick-win /
 * big-bet / fill-in / money-pit) and computes a dependency- and budget-aware
 * funding SEQUENCE; this builder seeds that classification + sequence into a
 * prompt so the model narrates on top WITHOUT inventing the quadrant, the order,
 * or scores the session does not support.
 *
 * Shape mirrors the shared tool conclusion contract (verdict / rationale /
 * tradeoffs / moves / expectedEffect) used by the SWOT/Ansoff/SMED prompts.
 * Read-only against the engine — this file is the conclusion LAYER only.
 */

import type { PortfolioItem, PortfolioPriorityData } from '@/store/useToolStore';

import {
  buildPortfolioMovePromptRules,
  classifyPortfolio,
  sequencePortfolio,
  QUADRANT_META,
  type PortfolioElement,
} from './portfolioMatrixEngine';

import { groundingRules } from '@/hooks/discovery/toolAi/groundingRules';
const localize = (pl: string, en: string, isPolish: boolean) => (isPolish ? pl : en);

const isAccepted = (item: PortfolioItem) =>
  item.proposalStatus !== 'rejected' && item.proposalStatus !== 'rethinking';

/**
 * Map a BCG-style portfolio item onto the engine's value/feasibility element.
 * value    = market growth (upside pull), feasibility = inverse of required
 * investment (higher investment => harder to deliver). Deterministic, so the
 * quadrant the engine assigns is reproducible from the visible item scores.
 */
function toElement(item: PortfolioItem): PortfolioElement {
  return {
    id: item.id,
    title: item.title,
    valueScore: item.marketGrowth,
    feasibilityScore: Math.max(1, Math.min(5, 6 - item.investmentLevel)),
    cost: item.investmentLevel,
    proposalStatus: item.proposalStatus,
  };
}

/**
 * Grounded conclusion prompt: seeds the model with the engine's 2x2
 * classification and funding sequence so its finishing block stays consistent
 * with the scored, dependency-ordered portfolio. Returns null when there are no
 * accepted, scored items yet (renderer falls through to the generic summary).
 */
export function buildPortfolioConclusionPrompt(
  data: PortfolioPriorityData | undefined,
  isPolish: boolean
): string | null {
  const items = (data?.initiatives || []).filter(isAccepted);
  if (items.length === 0) return null;

  const elements = items.map(toElement);
  const classified = classifyPortfolio(elements);
  if (classified.length === 0) return null;

  const sequence = sequencePortfolio(elements);

  const byQuadrant = classified.reduce<Record<string, string[]>>((acc, el) => {
    (acc[el.quadrant] ||= []).push(`${el.title} [${el.id}]`);
    return acc;
  }, {});

  const quadrantLines = (Object.keys(QUADRANT_META) as (keyof typeof QUADRANT_META)[])
    .map((q) => {
      const meta = QUADRANT_META[q];
      const label = localize(meta.titlePl, meta.titleEn, isPolish);
      const stance = localize(meta.stancePl, meta.stanceEn, isPolish);
      const members = byQuadrant[q] || [];
      return `- ${label} (${members.length}): ${members.join('; ') || localize('brak', 'none', isPolish)} — ${stance}`;
    })
    .join('\n');

  const fundedLine =
    sequence.funded
      .map((e, i) => `${i + 1}. ${e.title} [${e.elementId}] (${e.quadrant})`)
      .join('\n') || localize('- (brak sfinansowanych)', '- (none funded)', isPolish);

  const deferredLine =
    sequence.deferred.length > 0
      ? sequence.deferred.map((d) => `- ${d.title} [${d.elementId}]: ${d.reason}`).join('\n')
      : localize('- (nic nie odłożono)', '- (nothing deferred)', isPolish);

  const blockedLine =
    sequence.blocked.length > 0
      ? sequence.blocked.map((b) => `- ${b.title} [${b.elementId}]: ${b.reason}`).join('\n')
      : localize('- (nic nie zablokowane)', '- (nothing blocked)', isPolish);

  const header = isPolish
    ? 'Działaj jako partner ds. portfela. Poniżej masz DETERMINISTYCZNĄ klasyfikację 2x2 i kolejność finansowania (z zależności i budżetu) policzoną przez silnik. Napisz blok domykający wg CONCLUSION_LAYER_STANDARD wariant W2. NIE zmieniaj kwadrantu ani kolejności — narrację dokładasz na wierzchu. Liczby wyłącznie z bloku faktów.'
    : 'Act as a portfolio partner. Below is the DETERMINISTIC 2x2 classification and funding order (from dependencies and budget) computed by the engine. Write the finishing block per CONCLUSION_LAYER_STANDARD variant W2. Do NOT change the quadrant or the order — you narrate on top. Numbers exclusively from the facts block.';

  return `${header}

=== 2x2 CLASSIFICATION (engine — the ONLY admissible quadrant assignment) ===
${quadrantLines}

=== FUNDING SEQUENCE (engine — dependency- and budget-ordered) ===
${fundedLine}

Deferred (the honest "we can't do it all"):
${deferredLine}

Blocked (a hard dependency is missing/deferred):
${blockedLine}

${buildPortfolioMovePromptRules(isPolish ? 'pl' : 'en')}

W2 STRUCTURE (mandatory):
1. "summary.verdict" — answer-first, 1-2 sentences: what to fund FIRST and what to stop/defer, leading with the quick-wins that self-fund the rest.
2. "summary.executiveSummary" — 3-4 sentences: restates the verdict, then the why, anchored in the quadrant classification and the funding sequence above.
3. "summary.tradeoffs" — >= 1 at portfolio level: what we fund AT THE COST of what deferred item; the canonical rejected alternative is "everything at once -> resource dilution".
4. "moves" (3-5) — each a funding DECISION (invest/maintain/test/harvest/stop), each with its trade-off (chosen at the cost of what) and rejected variant folded into "rationale", plus firstStep, linked to element ids.
5. "summary.expectedEffect" — portfolio outcome, behaviorally observable, WITH a time horizon; no amounts absent from the facts.

QUALITY BARS:
- The quadrant and order are the engine's — do not override them; numbers only from the facts block.
- Zero filler and zero AI meta-phrases ("As an AI", "Based on the provided data", "In conclusion"); every sentence falsifiable — with a different portfolio it would read differently.
- Respond in ${isPolish ? 'Polish' : 'English'}, active voice, partner tone.


${groundingRules(isPolish)}

Return JSON:
{
  "summary": {
    "verdict": "answer-first: what to fund first, what to stop/defer",
    "executiveSummary": "3-4 sentences: restate the verdict, then why — anchored in the quadrants and the funding sequence above",
    "keyInsights": ["3 insights, each tied to named session elements"],
    "appliedConclusions": ["what to fund first", "what to stop or defer", "what NOT to do", "what to validate next"],
    "tradeoffs": [{"chosen":"...","rejected":"...","why":"..."}],
    "expectedEffect": {"text":"portfolio outcome, behaviorally observable","horizon":"..."}
  },
  "moves": [{"title":"...","category":"invest|maintain|test|harvest|stop","rationale":"why — anchored in listed element ids; MUST name the trade-off (chosen at the cost of what) and the rejected variant","linkedItemIds":["element-id"],"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","riskLevel":"high|medium|low","confidence":4,"firstStep":"verb + artifact + role"}],
  "initiatives": [{"title":"...","description":"...","type":"strategic|growth|operational","estimatedImpact":"high|medium|low","estimatedEffort":"high|medium|low","rationale":"...","linkedItems":["element-id"]}],
  "outputCandidates": [{"outputType":"initiative|report|presentation|idea","title":"...","description":"...","linkedItemIds":["element-id"],"rationale":"...","readiness":"ready-for-initiative|ready-for-presentation|ready-for-report|keep-as-idea|blocked"}],
  "selfCheck": {"signature":"pass|fail","formulaComplete":"pass|fail","numbersFromFacts":"pass|fail","falsifiable":"pass|fail","tradeoffPresent":"pass|fail","effectHasHorizon":"pass|fail"}
}`;
}

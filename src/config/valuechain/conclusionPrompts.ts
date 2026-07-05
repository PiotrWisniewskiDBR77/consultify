/**
 * Value Chain — conclusion prompt contract (CONCLUSION_LAYER_STANDARD W2).
 *
 * Bridges the deterministic margin engine (valueChainMarginEngine.ts) with the
 * AI runtime. The engine computes a margin map (creators vs drains), the 2-3
 * highest-leverage activities, and the W2 move rules; this builder seeds those
 * into a prompt so the model narrates on top WITHOUT inventing activities,
 * scores, or levers the session does not support.
 *
 * Shape mirrors the shared tool conclusion contract (verdict / rationale /
 * tradeoffs / moves / expectedEffect) used by the SWOT/Ansoff/SMED prompts.
 * Read-only against the engine — this file is the conclusion LAYER only.
 */

import type { ValueChainData } from '@/store/useToolStore';

import {
  buildValueChainMovePromptRules,
  computeMarginMap,
  deriveLeverCandidates,
} from './valueChainMarginEngine';

const localize = (pl: string, en: string, isPolish: boolean) => (isPolish ? pl : en);

/**
 * Grounded conclusion prompt: seeds the model with the engine's margin map and
 * lever candidates so its finishing block stays consistent with the scored
 * activities. Returns null when no activity is scored yet (renderer falls
 * through to the generic summary).
 */
export function buildValueChainConclusionPrompt(
  data: ValueChainData | undefined,
  isPolish: boolean
): string | null {
  const activities = data?.activities;
  if (!activities) return null;

  const marginMap = computeMarginMap(activities);
  if (marginMap.entries.length === 0) return null;

  const leverCandidates = deriveLeverCandidates(activities, 3);
  if (leverCandidates.length === 0) return null;

  const mapLines = marginMap.entries
    .map(
      (e) =>
        `- [${e.activityId}] pole=${e.pole}, cost=${e.cost}, value=${e.value}, maturityGap=${e.maturityGap}, leverScore=${e.leverScore}`
    )
    .join('\n');

  const leverLines = leverCandidates
    .map(
      (c) =>
        `- [${c.activityId}] leverScore=${c.leverScore}, suggested=${c.suggestedLeverType} — ${localize(
          c.rationalePl,
          c.rationaleEn,
          isPolish
        )}`
    )
    .join('\n');

  const gradientLine = isPolish
    ? `Twórcy marży: ${marginMap.creators.join(', ') || 'brak'} | Drenaż marży: ${marginMap.drains.join(', ') || 'brak'} (koszt w drenażu ${marginMap.costInDrains}, w twórcach ${marginMap.costInCreators}).`
    : `Margin creators: ${marginMap.creators.join(', ') || 'none'} | Margin drains: ${marginMap.drains.join(', ') || 'none'} (cost in drains ${marginMap.costInDrains}, in creators ${marginMap.costInCreators}).`;

  const positioning = data?.positioningVerdict
    ? `${data.positioningVerdict.positioning} — ${data.positioningVerdict.summary}`
    : localize('(brak werdyktu pozycjonowania)', '(no positioning verdict)', isPolish);

  const header = isPolish
    ? 'Działaj jako partner ds. strategii kosztowej. Poniżej masz mapę marży policzoną przez silnik (twórcy vs drenaż) oraz 2-3 ogniwa o najwyższej dźwigni. Napisz blok domykający wg CONCLUSION_LAYER_STANDARD wariant W2. NIE wymyślaj ogniw ani ocen — narrację dokładasz na wierzchu. Liczby wyłącznie z bloku faktów.'
    : 'Act as a cost-strategy partner. Below is the engine-computed margin map (creators vs drains) and the 2-3 highest-leverage activities. Write the finishing block per CONCLUSION_LAYER_STANDARD variant W2. Do NOT invent activities or ratings — you narrate on top. Numbers exclusively from the facts block.';

  return `${header}

=== POSITIONING VERDICT (engine, answer-first) ===
${positioning}

=== MARGIN MAP (engine — the ONLY admissible source of cost/value/lever numbers) ===
${gradientLine}
${mapLines}

=== LEVER CANDIDATES (top 2-3, high cost x low maturity x value impact — anchor moves here) ===
${leverLines}

${buildValueChainMovePromptRules(isPolish ? 'pl' : 'en')}

W2 STRUCTURE (mandatory):
1. "summary.verdict" — answer-first, 1-2 sentences: where margin is being made vs leaked and which lever to pull FIRST. Lead with the dominant drain/creator, not an average.
2. "summary.executiveSummary" — 3-4 sentences: restates the verdict, then the why, anchored in the margin map and lever candidates above.
3. "summary.tradeoffs" — >= 1 at recommendation level: what we improve/cut AT THE COST of what; which option (e.g. outsource vs automate) was rejected and why.
4. "moves" (3-5) — each a decision (IMPROVE/AUTOMATE/OUTSOURCE/INTEGRATE) on a lever activity, each with tradeoff {chosen, deferred, cost} + rejectedAlternative {option, reason} + firstStep.
5. "summary.expectedEffect" — cost fall or value/differentiation rise, behaviorally observable, WITH a time horizon; no amounts absent from the facts.

QUALITY BARS:
- Numbers exclusively from the margin map; do not re-score activities.
- Zero filler and zero AI meta-phrases ("As an AI", "Based on the provided data", "In conclusion"); every sentence falsifiable — with a different margin map it would read differently.
- Respond in ${isPolish ? 'Polish' : 'English'}, active voice, partner tone.

Return JSON:
{
  "summary": {
    "verdict": "answer-first: where margin leaks vs is made, which lever first",
    "executiveSummary": "3-4 sentences: restate the verdict, then why — anchored in the margin map and lever candidates above",
    "keyInsights": ["3 insights, each tied to named session elements"],
    "appliedConclusions": ["where to cut cost", "where to invest for differentiation", "what NOT to do", "what to validate next"],
    "tradeoffs": [{"chosen":"...","rejected":"...","why":"..."}],
    "expectedEffect": {"text":"cost fall / value rise, behaviorally observable","horizon":"..."}
  },
  "moves": [{"title":"...","category":"cost-advantage|differentiation|linkage-optimization|capability-build|restructure","rationale":"why — anchored in the named activities","linkedLeverIds":[],"linkedActivityIds":["operations"],"tradeoff":{"chosen":"...","deferred":"...","cost":"..."},"rejectedAlternative":{"option":"...","reason":"..."},"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","riskLevel":"high|medium|low","confidence":4,"firstStep":"verb + artifact + role"}],
  "initiatives": [{"title":"...","description":"...","type":"strategic|operational|defensive|growth","estimatedImpact":"high|medium|low","estimatedEffort":"high|medium|low","rationale":"...","linkedItems":["operations"]}],
  "outputCandidates": [{"outputType":"initiative|report|presentation|idea","title":"...","description":"...","linkedActivityIds":["operations"],"rationale":"...","readiness":"ready-for-initiative|ready-for-presentation|ready-for-report|keep-as-idea|blocked"}],
  "selfCheck": {"signature":"pass|fail","formulaComplete":"pass|fail","numbersFromFacts":"pass|fail","falsifiable":"pass|fail","tradeoffPresent":"pass|fail","effectHasHorizon":"pass|fail"}
}`;
}

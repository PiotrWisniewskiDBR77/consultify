/**
 * Focus & Trade-offs — conclusion prompt contract.
 *
 * Bridges the deterministic synthesis engine (moveValidator.ts) with the
 * AI runtime. The engine produces a grounded priority ranking + W2 move
 * sequence; these builders turn that into a prompt so the model refines
 * wording and fills gaps WITHOUT inventing priorities the facts do not support.
 *
 * Shape intentionally matches the CONCLUSION_LAYER_STANDARD variant W2:
 *   input  -> scored priorities + decision context
 *   output -> { summary{verdict,tradeoffs,expectedEffect}, tradeoffs[], moves[], initiatives[], outputCandidates[] } (W2)
 */

import { groundingRules } from '@/hooks/discovery/toolAi/groundingRules';
import type { FocusTradeoffData } from '@/store/useToolStore';

import { buildFocusStaircasePromptRules } from './focusInsightStaircase';
import {
  buildAntiFocusPromptRules,
  buildOpportunityCostPromptBlock,
  detectAntiFocus,
} from './focusOpportunityCostMatrix';
import { localizeLadder } from './index';
import { buildW2MoveSequence, rankPriorities } from './moveValidator';
const localize = (pl: string, en: string, isPolish: boolean) => (isPolish ? pl : en);

/**
 * Grounded synthesis prompt: seeds the model with the engine's ranking and
 * W2 sequence so its output stays consistent with the scored facts.
 */
export function buildFocusConclusionPrompt(
  data: FocusTradeoffData,
  isPolish: boolean
): string | null {
  const ranking = rankPriorities(data);
  if (ranking.ordered.length === 0) return null;

  const sequence = buildW2MoveSequence(data);

  const scoreLines = ranking.scores
    .map(
      (s) =>
        `- "${s.title}": focus ${s.score}/9 (value ${s.value} × fit ${s.fit} / effort ${s.effort}), lane ${s.lane}, ${s.evidenceBacked > 0 ? 'evidence-backed' : 'no evidence'}`
    )
    .join('\n');

  const seqLines = sequence
    .map(
      (m) =>
        `${m.order}. [${m.category}] ${localize(m.title.pl, m.title.en, isPolish)} — rationale: ${localize(
          m.rationale.pl,
          m.rationale.en,
          isPolish
        )} | trade-off: ${localize(m.tradeOff.pl, m.tradeOff.en, isPolish)} | rejected variant: ${localize(
          m.rejectedVariant.pl,
          m.rejectedVariant.en,
          isPolish
        )}`
    )
    .join('\n');

  const opportunityCostBlock = buildOpportunityCostPromptBlock(data, isPolish);
  const antiFocus = detectAntiFocus(data);

  const header = isPolish
    ? 'Działaj jako partner ds. strategii. Poniżej masz ugruntowany na faktach ranking konkurujących priorytetów i sekwencję ruchów W2 (zatwierdź / odłóż / utnij). Dopracuj sformułowania i uzupełnij luki, ale NIE wymyślaj priorytetów niepopartych danymi.'
    : 'Act as a strategy partner. Below is a fact-grounded ranking of competing priorities and a W2 move sequence (commit / defer / cut). Refine the wording and fill gaps, but do NOT invent priorities the data does not support.';

  const rules = isPolish
    ? [
        'Każdy ruch MUSI mieć: rationale, trade-off (co to kosztuje), wariant odrzucony (czego świadomie NIE robicie i dlaczego).',
        'Rekomenduj sekwencję fokusu (zatwierdź jeden, odłóż z warunkiem powrotu, utnij i przesuń zasób), nie listę życzeń.',
        'Jeśli dowód priorytetu jest słaby, zostaw ruch experiment przed pełnym zaangażowaniem.',
        'Każdy wybór "tak" musi nazwać, wobec KTÓREGO konkretnego priorytetu z macierzy koszt-alternatywny poniżej jest to "nie" — bramka silniejsza niż standardowy W2.',
      ]
    : [
        'Every move MUST carry: rationale, trade-off (what it costs), rejected variant (what you deliberately do NOT do and why).',
        'Recommend a focus sequence (commit one, defer with a re-entry trigger, cut and shift resource), not a wishlist.',
        'If a priority is weakly evidenced, keep an experiment move before full commitment.',
        'Every "yes" must name WHICH specific priority from the opportunity-cost matrix below it says "no" to — a gate stronger than the standard W2.',
      ];

  return `${header}

=== SCORED PRIORITIES ===
${scoreLines}

=== OPPORTUNITY-COST MATRIX (choice x what it costs) ===
${opportunityCostBlock}

=== ANTI-FOCUS CHECK (${antiFocus.flagged ? 'FLAGGED' : 'clear'}) ===
${localize(antiFocus.message.pl, antiFocus.message.en, isPolish)}

=== W2 MOVE SEQUENCE (grounded draft) ===
${seqLines}

Rules:
${rules.map((r) => `- ${r}`).join('\n')}

${buildAntiFocusPromptRules(isPolish ? 'pl' : 'en')}

${buildFocusStaircasePromptRules(isPolish ? 'pl' : 'en')}

W2 STRUCTURE (mandatory):
1. "summary.verdict" — answer-first, 1-2 sentences: what to commit to FIRST, what to sequence, what to cut — a decision, not a scoring recap.
2. "summary.executiveSummary" — 3-4 sentences: restates the verdict, then the why, anchored in the scored priorities and the commit/defer/cut sequence above (cite ids).
3. "summary.tradeoffs" — >= 1 at recommendation level: what we commit to AT THE COST of what; the canonical rejected alternative is "do everything -> nothing ships".
4. "tradeoffs" (2-4 cards) — the hardest tensions between competing priorities, each with an answer-first "insight" and a "recommendation" that takes a side.
5. "moves" (3-5) — each a focus DECISION (commit/sequence/cut/rebalance/experiment) with its trade-off and rejected variant folded into "rationale", plus firstStep, linked to priority ids.
6. "summary.expectedEffect" — focus outcome, behaviorally observable, WITH a time horizon.

QUALITY BARS:
- The ranking and lanes are the engine's — do not override them.
- Zero filler and zero AI meta-phrases ("As an AI", "Based on the provided data", "In conclusion") — write like a partner signing the work with their name.
- Numbers exclusively from the facts above; do not compute or invent new ones.
- Every sentence falsifiable: with opposite facts it would read differently.
- Respond in ${isPolish ? 'Polish' : 'English'}, active voice, partner tone.


${groundingRules(isPolish)}

Return JSON:
{
  "summary": {
    "verdict": "answer-first: what to commit to first, what to sequence, what to cut",
    "executiveSummary": "3-4 sentences: restate the verdict, then why — anchored in the scored priorities and the commit/defer/cut sequence above",
    "keyInsights": ["3 insights, each tied to named session elements"],
    "appliedConclusions": ["what to commit to", "what to sequence later", "what to cut", "what to validate next"],
    "tradeoffs": [{"chosen":"...","rejected":"...","why":"..."}],
    "expectedEffect": {"text":"focus outcome, behaviorally observable","horizon":"..."}
  },
  "tradeoffs": [{"title":"...","priorityIds":["priority-id"],"insight":"answer-first: the tension and which side wins","priority":"high|medium|low","urgency":"high|medium|low","recommendation":"...","confidence":4}],
  "moves": [{"title":"...","category":"commit|sequence|cut|rebalance|experiment","rationale":"why — anchored in listed element ids; MUST name the trade-off (chosen at the cost of what) and the rejected variant","linkedTradeoffIds":[],"linkedPriorityIds":["priority-id"],"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","riskLevel":"high|medium|low","confidence":4,"firstStep":"verb + artifact + role"}],
  "initiatives": [{"title":"...","description":"...","type":"strategic|operational|defensive|growth","estimatedImpact":"high|medium|low","estimatedEffort":"high|medium|low","rationale":"...","linkedItems":["priority-id"]}],
  "outputCandidates": [{"outputType":"initiative|report|presentation|idea","title":"...","description":"...","linkedMoveIds":[],"linkedPriorityIds":["priority-id"],"rationale":"...","readiness":"ready-for-initiative|ready-for-presentation|ready-for-report|keep-as-idea|blocked"}]
}`;
}

/**
 * Builds the deepening prompt for a single lane rung — used when the user
 * asks AI to "think deeper" on a specific focus decision (pursue / defer / drop).
 */
export function buildFocusDeepenPrompt(
  lane: Parameters<typeof localizeLadder>[0],
  rungId: 'surface' | 'evidence' | 'quantification' | 'risk-capability',
  isPolish: boolean
): string | null {
  const rungs = localizeLadder(lane, isPolish);
  const rung = rungs.find((r) => r.id === rungId);
  if (!rung) return null;

  return `${rung.question}\n\n${
    isPolish ? 'Kontekst konsultanta' : 'Consultant framing'
  }: ${rung.rationale}`;
}

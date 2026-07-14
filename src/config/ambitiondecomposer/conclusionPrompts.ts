/**
 * Ambition Decomposer — conclusion prompt contract (CONCLUSION_LAYER_STANDARD W2).
 *
 * Bridges the deterministic synthesis engine (moveValidator.ts) with the AI
 * runtime. The engine sequences the ambition's themes prerequisite-first
 * (foundations before what they gate) and produces a W2-validated move sequence;
 * this builder seeds that sequence into a prompt so the model narrates on top
 * WITHOUT reordering the themes, inventing archetypes, or scores the session
 * does not support.
 *
 * Shape mirrors the shared tool conclusion contract (verdict / rationale /
 * tradeoffs / moves / expectedEffect) used by the Ansoff/Portfolio prompts.
 * Read-only against the engine — this file is the conclusion LAYER only.
 */

import { groundingRules } from '@/hooks/discovery/toolAi/groundingRules';

import { localizeLadder } from './index';
import { type AmbitionDecomposerData, buildW2ThemeSequence, rankThemes } from './moveValidator';
const loc = (pl: string, en: string, isPolish: boolean) => (isPolish ? pl : en);

/**
 * Grounded conclusion prompt: seeds the model with the engine's prerequisite-
 * aware theme sequence and W2 moves so its finishing block stays consistent with
 * the scored decomposition. Returns null when there are no themes yet (renderer
 * falls through to the generic summary).
 */
export function buildAmbitionDecomposerConclusionPrompt(
  data: AmbitionDecomposerData | undefined,
  isPolish: boolean
): string | null {
  if (!data) return null;
  const ranking = rankThemes(data);
  if (ranking.ordered.length === 0) return null;

  const sequence = buildW2ThemeSequence(data);

  const orderedScores = ranking.ordered
    .map((id) => ranking.scores.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  const scoreLines = orderedScores
    .map(
      (s, i) =>
        `${i + 1}. ${s.title} [${s.id}] — ${loc(s.archetypeLabel.pl, s.archetypeLabel.en, isPolish)}, priority ${s.priorityScore}/9 (importance ${s.importance} × ${s.horizon} horizon), risk ${s.risk}/3, ${s.evidenceBacked ? 'evidence-backed' : 'no hard evidence'}`
    )
    .join('\n');

  const seqLines = sequence
    .map(
      (m) =>
        `${m.order}. [${m.archetype}] ${loc(m.title.pl, m.title.en, isPolish)} — rationale: ${loc(
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

  const ambition = data.context?.ambitionStatement || (isPolish ? 'nie podano' : 'not stated');

  const header = isPolish
    ? 'Działaj jako partner ds. strategii. Poniżej masz ambicję rozłożoną na wątki i ich SEKWENCJĘ policzoną przez silnik (fundamenty przed tym, co warunkują). Napisz blok domykający wg CONCLUSION_LAYER_STANDARD wariant W2. NIE zmieniaj kolejności ani archetypów — narrację dokładasz na wierzchu. Liczby wyłącznie z bloku faktów.'
    : 'Act as a strategy partner. Below is the ambition decomposed into themes and their SEQUENCE computed by the engine (foundations before what they gate). Write the finishing block per CONCLUSION_LAYER_STANDARD variant W2. Do NOT reorder the themes or change the archetypes — you narrate on top. Numbers exclusively from the facts block.';

  return `${header}

Ambition: ${ambition}

=== THEME SEQUENCE (engine — the ONLY admissible order, prerequisite-aware) ===
${scoreLines}

=== W2 MOVE SEQUENCE (engine — grounded draft) ===
${seqLines}

W2 STRUCTURE (mandatory):
1. "summary.verdict" — answer-first, 1-2 sentences: which theme to start FIRST and why the prerequisite gates the rest.
2. "summary.executiveSummary" — 3-4 sentences: restates the verdict, then the why, anchored in the theme sequence and archetypes above (cite theme ids).
3. "summary.tradeoffs" — >= 1: what we start AT THE COST of what deferred theme; the canonical rejected alternative is "start the flashiest theme first -> it stalls on a missing prerequisite".
4. "moves" (3-5) — each a sequencing DECISION (foundation/accelerator/bet/enabler/quick-win), each with its trade-off (chosen at the cost of what) and rejected variant folded into "rationale", plus firstStep, linked to theme ids.
5. "summary.expectedEffect" — ambition-progress outcome, behaviorally observable, WITH a time horizon; no target values absent from the facts.

QUALITY BARS:
- The order and archetypes are the engine's — do not override them; numbers only from the facts block.
- Zero filler and zero AI meta-phrases ("As an AI", "Based on the provided data", "In conclusion"); every sentence falsifiable — with a different decomposition it would read differently.
- Respond in ${isPolish ? 'Polish' : 'English'}, active voice, partner tone.


${groundingRules(isPolish)}

Return JSON:
{
  "summary": {
    "verdict": "answer-first: which theme first and why it gates the rest",
    "executiveSummary": "3-4 sentences: restate the verdict, then why — anchored in the theme sequence and archetypes above",
    "keyInsights": ["3 insights, each tied to named session elements"],
    "appliedConclusions": ["where to start", "what to enable next", "what NOT to do", "what to validate next"],
    "tradeoffs": [{"chosen":"...","rejected":"...","why":"..."}],
    "expectedEffect": {"text":"ambition-progress outcome, behaviorally observable","horizon":"..."}
  },
  "moves": [{"title":"...","category":"foundation|accelerator|bet|enabler|quick-win","rationale":"why — anchored in listed element ids; MUST name the trade-off (chosen at the cost of what) and the rejected variant","linkedPriorityIds":[],"linkedThemeIds":["theme-id"],"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","riskLevel":"high|medium|low","confidence":4,"firstStep":"verb + artifact + role"}],
  "initiatives": [{"title":"...","description":"...","type":"strategic|operational|defensive|growth","estimatedImpact":"high|medium|low","estimatedEffort":"high|medium|low","rationale":"...","linkedItems":["theme-id"]}],
  "outputCandidates": [{"outputType":"initiative|report|presentation|idea","title":"...","description":"...","linkedThemeIds":["theme-id"],"rationale":"...","readiness":"ready-for-initiative|ready-for-presentation|ready-for-report|keep-as-idea|blocked"}],
  "selfCheck": {"signature":"pass|fail","formulaComplete":"pass|fail","numbersFromFacts":"pass|fail","falsifiable":"pass|fail","tradeoffPresent":"pass|fail","effectHasHorizon":"pass|fail"}
}`;
}

/**
 * Builds the deepening prompt for a single theme-archetype rung — used when the
 * user asks AI to "think deeper" on a specific theme's role in the ambition.
 */
export function buildAmbitionDecomposerDeepenPrompt(
  archetype: Parameters<typeof localizeLadder>[0],
  rungId: 'surface' | 'evidence' | 'quantification' | 'risk-capability',
  isPolish: boolean
): string | null {
  const rungs = localizeLadder(archetype, isPolish);
  const rung = rungs.find((r) => r.id === rungId);
  if (!rung) return null;

  return `${rung.question}\n\n${
    isPolish ? 'Kontekst konsultanta' : 'Consultant framing'
  }: ${rung.rationale}`;
}

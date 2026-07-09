/**
 * Ansoff Growth Paths — conclusion prompt contract.
 *
 * Bridges the deterministic synthesis engine (moveValidator.ts) with the
 * AI runtime. The engine produces a grounded ranking + W2 move sequence;
 * these builders turn that into a prompt so the model refines wording and
 * fills gaps WITHOUT inventing paths the facts do not support.
 *
 * Shape intentionally matches the ConclusionInput/Output contract used by
 * the existing GrowthPaths synthesis prompt
 * (see src/hooks/discovery/toolAi/growthPaths.ts):
 *   input  -> quadrant options + mission context
 *   output -> { comparisons[], moves[] } with rationale/tradeOff/rejectedVariant
 */

import type { GrowthPathsData } from '@/store/useToolStore';

import { localizeLadder } from './index';
import { rankGrowthPaths, buildW2MoveSequence } from './moveValidator';

import { groundingRules } from '@/hooks/discovery/toolAi/groundingRules';
const localize = (pl: string, en: string, isPolish: boolean) => (isPolish ? pl : en);

/**
 * Grounded synthesis prompt: seeds the model with the engine's ranking and
 * W2 sequence so its output stays consistent with the scored facts.
 */
export function buildAnsoffConclusionPrompt(
  data: GrowthPathsData,
  isPolish: boolean
): string | null {
  const ranking = rankGrowthPaths(data);
  if (ranking.ordered.length === 0) return null;

  const sequence = buildW2MoveSequence(data);

  const scoreLines = ranking.scores
    .filter((s) => s.optionCount > 0)
    .map(
      (s) =>
        `- ${localize(s.label.pl, s.label.en, isPolish)}: fit ${s.score}/9 (attractiveness ${s.attractiveness} × feasibility ${s.feasibility}), risk ${s.risk}/3, ${s.evidenceBacked}/${s.optionCount} evidence-backed`
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

  const header = isPolish
    ? 'Działaj jako partner ds. strategii wzrostu. Poniżej masz ugruntowany na faktach ranking ścieżek Ansoffa i sekwencję ruchów W2. Dopracuj sformułowania i uzupełnij luki, ale NIE wymyślaj ścieżek niepopartych opcjami.'
    : 'Act as a growth strategy partner. Below is a fact-grounded Ansoff path ranking and a W2 move sequence. Refine the wording and fill gaps, but do NOT invent paths the options do not support.';

  const rules = isPolish
    ? [
        'Każdy ruch MUSI mieć: rationale, trade-off (co to kosztuje), wariant odrzucony (czego świadomie NIE robicie i dlaczego).',
        'Rekomenduj sekwencję, nie listę życzeń.',
        'Jeśli dowód jest słaby, zostaw ruch validate-first przed pełnym skalowaniem.',
      ]
    : [
        'Every move MUST carry: rationale, trade-off (what it costs), rejected variant (what you deliberately do NOT do and why).',
        'Recommend a sequence, not a wishlist.',
        'If evidence is weak, keep a validate-first move before full scaling.',
      ];

  return `${header}

=== SCORED PATHS ===
${scoreLines}

=== W2 MOVE SEQUENCE (grounded draft) ===
${seqLines}

Rules:
${rules.map((r) => `- ${r}`).join('\n')}

QUALITY BARS:
- Each comparison "insight" is answer-first — a thesis about the growth decision, not a description of a quadrant.
- Zero filler and zero AI meta-phrases ("As an AI", "Based on the provided data", "In conclusion") — write like a partner signing the work with their name.
- Numbers exclusively from the facts above; do not compute or invent new ones.
- Every sentence falsifiable: with opposite facts it would read differently.
- Respond in ${isPolish ? 'Polish' : 'English'}, active voice, partner tone.


${groundingRules(isPolish)}

Return JSON:
{
  "comparisons": [{"title":"...","insight":"...","linkedQuadrants":["marketPenetration"],"recommendation":"...","priority":"high|medium|low","confidence":4}],
  "moves": [{"title":"...","category":"scale-core|enter-market|build-product|diversify|validate-first","rationale":"...","tradeOff":"...","rejectedVariant":"...","linkedOptionIds":[],"linkedQuadrants":["marketPenetration"],"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","riskLevel":"high|medium|low","confidence":4,"firstStep":"..."}]
}`;
}

/**
 * Builds the deepening prompt for a single quadrant rung — used when the user
 * asks AI to "think deeper" on a specific Ansoff direction.
 */
export function buildAnsoffDeepenPrompt(
  quadrant: Parameters<typeof localizeLadder>[0],
  rungId: 'surface' | 'evidence' | 'quantification' | 'risk-capability',
  isPolish: boolean
): string | null {
  const rungs = localizeLadder(quadrant, isPolish);
  const rung = rungs.find((r) => r.id === rungId);
  if (!rung) return null;

  return `${rung.question}\n\n${
    isPolish ? 'Kontekst konsultanta' : 'Consultant framing'
  }: ${rung.rationale}`;
}

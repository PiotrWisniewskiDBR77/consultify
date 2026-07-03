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
 *   output -> { comparisons[], moves[] } with rationale/tradeOff/rejectedVariant
 */

import type { FocusTradeoffData } from '@/store/useToolStore';

import { localizeLadder } from './index';
import { rankPriorities, buildW2MoveSequence } from './moveValidator';

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

  const header = isPolish
    ? 'Działaj jako partner ds. strategii. Poniżej masz ugruntowany na faktach ranking konkurujących priorytetów i sekwencję ruchów W2 (zatwierdź / odłóż / utnij). Dopracuj sformułowania i uzupełnij luki, ale NIE wymyślaj priorytetów niepopartych danymi.'
    : 'Act as a strategy partner. Below is a fact-grounded ranking of competing priorities and a W2 move sequence (commit / defer / cut). Refine the wording and fill gaps, but do NOT invent priorities the data does not support.';

  const rules = isPolish
    ? [
        'Każdy ruch MUSI mieć: rationale, trade-off (co to kosztuje), wariant odrzucony (czego świadomie NIE robicie i dlaczego).',
        'Rekomenduj sekwencję fokusu (zatwierdź jeden, odłóż z warunkiem powrotu, utnij i przesuń zasób), nie listę życzeń.',
        'Jeśli dowód priorytetu jest słaby, zostaw ruch experiment przed pełnym zaangażowaniem.',
      ]
    : [
        'Every move MUST carry: rationale, trade-off (what it costs), rejected variant (what you deliberately do NOT do and why).',
        'Recommend a focus sequence (commit one, defer with a re-entry trigger, cut and shift resource), not a wishlist.',
        'If a priority is weakly evidenced, keep an experiment move before full commitment.',
      ];

  return `${header}

=== SCORED PRIORITIES ===
${scoreLines}

=== W2 MOVE SEQUENCE (grounded draft) ===
${seqLines}

Rules:
${rules.map((r) => `- ${r}`).join('\n')}

Return JSON:
{
  "comparisons": [{"title":"...","insight":"...","linkedPriorityIds":["priority-id"],"recommendation":"...","priority":"high|medium|low","confidence":4}],
  "moves": [{"title":"...","category":"commit|sequence|cut|rebalance|experiment","rationale":"...","tradeOff":"...","rejectedVariant":"...","linkedTradeoffIds":[],"linkedPriorityIds":["priority-id"],"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","riskLevel":"high|medium|low","confidence":4,"firstStep":"..."}]
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

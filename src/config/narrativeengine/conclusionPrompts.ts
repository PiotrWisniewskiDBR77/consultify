/**
 * Narrative Engine — conclusion prompt contract.
 *
 * Bridges the deterministic synthesis engine (moveValidator.ts) with the
 * AI runtime. The engine produces a grounded pillar ranking + W2 delivery-move
 * sequence; these builders turn that into a prompt so the model refines
 * wording and fills gaps WITHOUT inventing pillars the facts do not support.
 *
 * Shape intentionally matches the CONCLUSION_LAYER_STANDARD variant W2:
 *   input  -> scored pillars + audience/core-message context
 *   output -> { comparisons[], moves[] } with rationale/tradeOff/rejectedVariant
 */

import type { NarrativeEngineData } from '@/store/useToolStore';

import { localizeLadder } from './index';
import { rankPillars, buildW2MoveSequence } from './moveValidator';

const localize = (pl: string, en: string, isPolish: boolean) => (isPolish ? pl : en);

/**
 * Grounded synthesis prompt: seeds the model with the engine's ranking and
 * W2 sequence so its output stays consistent with the scored facts.
 */
export function buildNarrativeConclusionPrompt(
  data: NarrativeEngineData,
  isPolish: boolean
): string | null {
  const ranking = rankPillars(data);
  if (ranking.ordered.length === 0) return null;

  const sequence = buildW2MoveSequence(data);

  const scoreLines = ranking.scores
    .map(
      (s) =>
        `- "${s.title}": strength ${s.score}/9 (resonance ${s.resonance} × proof ${s.proofStrength}), band ${s.band}, ${s.proofCount} proof point(s)`
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
    ? 'Działaj jako partner ds. komunikacji strategicznej. Poniżej masz ugruntowany na faktach ranking filarów przekazu i sekwencję ruchów dostarczenia W2 (otwórz / dowieść / przeramuj / utnij). Dopracuj sformułowania i uzupełnij luki, ale NIE wymyślaj filarów niepopartych proof pointami.'
    : 'Act as a strategic communications partner. Below is a fact-grounded ranking of message pillars and a W2 delivery-move sequence (open / prove / reframe / cut). Refine the wording and fill gaps, but do NOT invent pillars the proof points do not support.';

  const rules = isPolish
    ? [
        'Każdy ruch MUSI mieć: rationale, trade-off (co to kosztuje), wariant odrzucony (czego świadomie NIE robicie i dlaczego).',
        'Rekomenduj łuk narracji (czym otwieracie, co dowodzicie, co przeramowujecie, co tniecie), nie listę tez.',
        'Jeśli najsilniejszy filar nie ma proof pointa, zostaw ruch prove przed dostarczeniem.',
      ]
    : [
        'Every move MUST carry: rationale, trade-off (what it costs), rejected variant (what you deliberately do NOT do and why).',
        'Recommend a narrative arc (what you open with, what you prove, what you reframe, what you cut), not a list of claims.',
        'If the strongest pillar lacks a proof point, keep a prove move before delivery.',
      ];

  return `${header}

=== SCORED PILLARS ===
${scoreLines}

=== W2 MOVE SEQUENCE (grounded draft) ===
${seqLines}

Rules:
${rules.map((r) => `- ${r}`).join('\n')}

Return JSON:
{
  "comparisons": [{"title":"...","insight":"...","linkedPillarIds":["pillar-id"],"recommendation":"...","priority":"high|medium|low","confidence":4}],
  "moves": [{"title":"...","category":"open|build|prove|cta|reframe","rationale":"...","tradeOff":"...","rejectedVariant":"...","linkedThreadIds":[],"linkedPillarIds":["pillar-id"],"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","riskLevel":"high|medium|low","confidence":4,"firstStep":"..."}]
}`;
}

/**
 * Builds the deepening prompt for a single resonance-band rung — used when the
 * user asks AI to "think deeper" on a specific pillar (high / medium / low).
 */
export function buildNarrativeDeepenPrompt(
  band: Parameters<typeof localizeLadder>[0],
  rungId: 'surface' | 'evidence' | 'quantification' | 'risk-capability',
  isPolish: boolean
): string | null {
  const rungs = localizeLadder(band, isPolish);
  const rung = rungs.find((r) => r.id === rungId);
  if (!rung) return null;

  return `${rung.question}\n\n${
    isPolish ? 'Kontekst konsultanta' : 'Consultant framing'
  }: ${rung.rationale}`;
}

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
 *   output -> { summary{verdict,tradeoffs,expectedEffect}, threads[], moves[], initiatives[], outputCandidates[] } (W2)
 */

import { groundingRules } from '@/hooks/discovery/toolAi/groundingRules';
import type { NarrativeEngineData } from '@/store/useToolStore';

import { localizeLadder } from './index';
import { buildW2MoveSequence, rankPillars } from './moveValidator';
import {
  buildPyramidPromptRules,
  buildPyramidValidationPromptBlock,
  validateNarrativePyramid,
} from './pyramidValidator';
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

  // OXFORD O3 — SCQA + MECE pyramid discipline (additive; does not change the JSON contract below).
  const scqa = data.context || {};
  const scqaBlock =
    scqa.situation || scqa.complication || scqa.question
      ? `\n=== SCQA (McKinsey opening) ===\nSituation: ${scqa.situation || '(missing)'}\nComplication: ${
          scqa.complication || '(missing)'
        }\nQuestion: ${scqa.question || '(missing)'}\nAnswer (governing thought): ${
          scqa.coreMessage || '(missing)'
        }\n`
      : '';

  const pyramidReport = validateNarrativePyramid(data);
  const validationBlock = buildPyramidValidationPromptBlock(pyramidReport, isPolish);

  return `${header}
${scqaBlock}
=== SCORED PILLARS ===
${scoreLines}

=== W2 MOVE SEQUENCE (grounded draft) ===
${seqLines}
${validationBlock ? `\n${validationBlock}\n` : ''}
${buildPyramidPromptRules(isPolish ? 'pl' : 'en')}

Rules:
${rules.map((r) => `- ${r}`).join('\n')}

W2 STRUCTURE (mandatory):
1. "summary.verdict" — answer-first, 1-2 sentences: which storyline carries the core message and what must be proven first.
2. "summary.executiveSummary" — 3-4 sentences: restates the verdict, then the why, anchored in the scored pillars and the delivery sequence above (cite ids).
3. "summary.tradeoffs" — >= 1 at recommendation level: which pillar leads AT THE COST of which; the canonical rejected alternative is "say everything -> the audience remembers nothing".
4. "threads" (2-4) — how the pillars connect into a persuasive arc, each with an answer-first "insight" and a "recommendation" that takes a side.
5. "moves" (3-5) — each a delivery DECISION (open/build/prove/cta/reframe) with its trade-off and rejected variant folded into "rationale", plus firstStep, linked to pillar ids.
6. "summary.expectedEffect" — audience-behavior change, behaviorally observable, WITH a time horizon.

QUALITY BARS:
- Proof points exclusively from the pillars above — do not invent evidence.
- Zero filler and zero AI meta-phrases ("As an AI", "Based on the provided data", "In conclusion") — write like a partner signing the work with their name.
- Numbers exclusively from the facts above; do not compute or invent new ones.
- Every sentence falsifiable: with opposite facts it would read differently.
- Respond in ${isPolish ? 'Polish' : 'English'}, active voice, partner tone.


${groundingRules(isPolish)}

Return JSON:
{
  "summary": {
    "verdict": "answer-first: which storyline carries the core message and what to prove first",
    "executiveSummary": "3-4 sentences: restate the verdict, then why — anchored in the scored pillars and the delivery sequence above",
    "keyInsights": ["3 insights, each tied to named session elements"],
    "appliedConclusions": ["how to open", "what to prove", "what call-to-action", "what to validate next"],
    "tradeoffs": [{"chosen":"...","rejected":"...","why":"..."}],
    "expectedEffect": {"text":"audience-behavior change, behaviorally observable","horizon":"..."}
  },
  "threads": [{"title":"...","pillarIds":["pillar-id"],"insight":"answer-first: how these pillars connect into one persuasive claim","priority":"high|medium|low","urgency":"high|medium|low","recommendation":"...","confidence":4}],
  "moves": [{"title":"...","category":"open|build|prove|cta|reframe","rationale":"why — anchored in listed element ids; MUST name the trade-off (chosen at the cost of what) and the rejected variant","linkedThreadIds":[],"linkedPillarIds":["pillar-id"],"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","riskLevel":"high|medium|low","confidence":4,"firstStep":"verb + artifact + role"}],
  "initiatives": [{"title":"...","description":"...","type":"strategic|operational|defensive|growth","estimatedImpact":"high|medium|low","estimatedEffort":"high|medium|low","rationale":"...","linkedItems":["pillar-id"]}],
  "outputCandidates": [{"outputType":"initiative|report|presentation|idea","title":"...","description":"...","linkedMoveIds":[],"linkedPillarIds":["pillar-id"],"rationale":"...","readiness":"ready-for-initiative|ready-for-presentation|ready-for-report|keep-as-idea|blocked"}]
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

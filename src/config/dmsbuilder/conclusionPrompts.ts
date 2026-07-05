/**
 * DMS Builder — conclusion prompt contract (CONCLUSION_LAYER_STANDARD W2).
 *
 * Bridges the deterministic synthesis engine (managementSystemEngine.ts) with
 * the AI runtime. The engine produces a grounded control-loop maturity map +
 * weakest-first ranking + W2 move sequence; these builders turn that into a
 * prompt so the model refines wording and fills gaps WITHOUT inventing maturity
 * the facts do not support.
 *
 * Shape mirrors the shared tool conclusion contract (verdict / rationale /
 * tradeoffs / moves) used by the SWOT/Ansoff/Porter prompts.
 */

import {
  buildW2MoveSequence,
  rankDmsLayers,
  type DmsSession,
} from './managementSystemEngine';
import { localizeLadder } from './index';
import { type DmsLayerId } from './deepeningLadder';

const localize = (pl: string, en: string, isPolish: boolean) => (isPolish ? pl : en);

/**
 * Grounded synthesis prompt: seeds the model with the control-loop maturity map,
 * weakest-first ranking and W2 sequence so its output stays consistent with the
 * scored facts. Returns null when there is nothing to conclude on.
 */
export function buildDmsConclusionPrompt(
  session: DmsSession,
  isPolish: boolean
): string | null {
  const ranking = rankDmsLayers(session);
  // Nothing meaningful unless at least one layer is present.
  if (!ranking.scores.some((s) => s.present)) return null;

  const sequence = buildW2MoveSequence(session);

  const weakest = ranking.scores.find((s) => s.layer === ranking.ordered[0])!;
  const weakestLabel = localize(weakest.label.pl, weakest.label.en, isPolish);
  const loopLine = isPolish
    ? `Pętla kontroli: dojrzałość ${ranking.loopMaturity}/3, ${ranking.loopClosed ? 'domknięta end-to-end' : 'PRZERWANA'} (najsłabsze ogniwo: ${weakestLabel}).`
    : `Control loop: maturity ${ranking.loopMaturity}/3, ${ranking.loopClosed ? 'closed end-to-end' : 'BROKEN'} (weakest link: ${weakestLabel}).`;

  const scoreLines = ranking.scores
    .map(
      (s) =>
        `- ${localize(s.label.pl, s.label.en, isPolish)}: maturity ${s.maturity}/3 — ${localize(s.gap.pl, s.gap.en, isPolish)}`
    )
    .join('\n');

  const seqLines = sequence
    .map(
      (m) =>
        `${m.order}. [${m.layer}] ${localize(m.title.pl, m.title.en, isPolish)} — rationale: ${localize(
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
    ? 'Działaj jako partner ds. operacji (Daily Management System, Lean). Poniżej masz ugruntowaną na faktach mapę dojrzałości pętli kontroli, ranking warstw (najsłabsza-pierwsza) i sekwencję ruchów W2. Dopracuj sformułowania i uzupełnij luki, ale NIE zawyżaj dojrzałości ponad to, co pokazują fakty sesji.'
    : 'Act as an operations partner (Daily Management System, Lean). Below is a fact-grounded control-loop maturity map, a weakest-first layer ranking and a W2 move sequence. Refine the wording and fill gaps, but do NOT inflate maturity beyond what the session facts show.';

  const rules = isPolish
    ? [
        'Każdy ruch MUSI mieć: rationale, trade-off (co to kosztuje), wariant odrzucony (czego świadomie NIE robicie i dlaczego).',
        'Pętla jest tak mocna jak jej najsłabsze ogniwo — naprawiaj od najsłabszej warstwy, ale zachowaj kolejność pętli: nie da się eskalować sygnału, którego nie widać.',
        'Poziomy dojrzałości (0-3) wyłącznie z mapy powyżej — nie zawyżaj.',
        'Widoczność bez eskalacji i reakcji to nie DMS, tylko tablica — nazwij to wprost, jeśli pętla jest przerwana.',
      ]
    : [
        'Every move MUST carry: rationale, trade-off (what it costs), rejected variant (what you deliberately do NOT do and why).',
        'The loop is only as strong as its weakest link — repair from the weakest layer, but keep loop order: you cannot escalate a signal you cannot see.',
        'Maturity levels (0-3) come exclusively from the map above — do not inflate.',
        'Visibility without escalation and response is not a DMS, only a board — say so plainly if the loop is broken.',
      ];

  return `${header}

=== CONTROL-LOOP STATE (facts — the only admissible source of maturity) ===
${loopLine}
${scoreLines}

=== W2 MOVE SEQUENCE (grounded draft, weakest-first in loop order) ===
${seqLines}

Rules:
${rules.map((r) => `- ${r}`).join('\n')}

QUALITY BARS:
- Answer-first: "verdict" is a thesis about the decision, not a recap of the inputs.
- Numbers exclusively from the facts above; do not compute or invent new ones.
- Zero filler and zero AI meta-phrases ("As an AI", "Based on the provided data", "In conclusion") — write like a partner signing the work with their name.
- Every sentence falsifiable: with opposite facts it would read differently.
- Map the grounded W2 sequence above into 3-5 "initiatives", preserving its order (order = priority).
- Respond in ${isPolish ? 'Polish' : 'English'}, active voice, partner tone.

Return JSON:
{
  "summary": {
    "verdict": "answer-first, 1-2 sentences: what this DMS assessment means for the operation's decision",
    "executiveSummary": "3-4 sentences: restate the verdict, then why — anchored in the control-loop maturity map and weakest link above",
    "keyInsights": ["3 insights, each tied to the facts above"],
    "appliedConclusions": ["what to do first", "what NOT to do", "what to validate next"],
    "tradeoffs": [{"chosen":"...","rejected":"...","why":"..."}],
    "expectedEffect": {"text":"behaviorally observable change in daily control","horizon":"..."}
  },
  "initiatives": [{"title":"...","description":"what to do + first step (verb + artifact + role)","type":"operational","estimatedImpact":"high|medium|low","estimatedEffort":"high|medium|low","rationale":"why — names the trade-off (chosen at the cost of what) and the rejected variant"}]
}`;
}

/**
 * Builds the deepening prompt for a single layer rung — used when the user asks
 * AI to "think deeper" on a specific DMS control-loop layer.
 */
export function buildDmsDeepenPrompt(
  layer: DmsLayerId,
  rungId: 'surface' | 'evidence' | 'quantification' | 'risk-capability',
  isPolish: boolean
): string | null {
  const rungs = localizeLadder(layer, isPolish);
  const rung = rungs.find((r) => r.id === rungId);
  if (!rung) return null;
  return `${rung.question}\n\n${isPolish ? 'Kontekst konsultanta' : 'Consultant framing'}: ${rung.rationale}`;
}

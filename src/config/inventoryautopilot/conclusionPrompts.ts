/**
 * Inventory Autopilot — conclusion prompt contract (CONCLUSION_LAYER_STANDARD W2).
 *
 * Bridges the deterministic synthesis engine (inventoryEngine.ts) with the AI
 * runtime. The engine produces a grounded baseline + lever ranking + W2 move
 * sequence; these builders turn that into a prompt so the model refines wording
 * and fills gaps WITHOUT inventing capital or SKU facts the session does not
 * support.
 *
 * Shape mirrors the shared tool conclusion contract (verdict / rationale /
 * tradeoffs / moves / expectedEffect) used by the SMED/DMS prompts, so the
 * operational summary renderer consumes Inventory output the same way.
 */

import {
  buildW2MoveSequence,
  computeBaseline,
  rankLevers,
  type InventorySession,
} from './inventoryEngine';
import { localizeLadder } from './index';
import { type InventoryLeverId } from './deepeningLadder';

const localize = (pl: string, en: string, isPolish: boolean) => (isPolish ? pl : en);

/**
 * Grounded synthesis prompt: seeds the model with the engine's baseline, lever
 * ranking and W2 sequence so its output stays consistent with the scored facts.
 * Returns null when there is nothing to conclude on.
 */
export function buildInventoryConclusionPrompt(
  session: InventorySession,
  isPolish: boolean
): string | null {
  const ranking = rankLevers(session);
  if (ranking.ordered.length === 0) return null;

  const baseline = computeBaseline(session);
  const sequence = buildW2MoveSequence(session);

  const baselineLine = isPolish
    ? `Baza zapasu: ${baseline.totalStockValue} kapitału łącznie; ${baseline.tailStockValue} w ogonie klasy C (${Math.round(baseline.tailShare * 100)}% zapasu); ${baseline.deadStockValue} w martwym zapasie; ${baseline.belowServiceCount} segmentów poniżej celu obsługi; zmierzone ${Math.round(baseline.measuredRatio * 100)}% segmentów.`
    : `Inventory baseline: ${baseline.totalStockValue} total capital; ${baseline.tailStockValue} in the class-C tail (${Math.round(baseline.tailShare * 100)}% of stock); ${baseline.deadStockValue} in dead stock; ${baseline.belowServiceCount} segments below service target; ${Math.round(baseline.measuredRatio * 100)}% of segments measured.`;

  const scoreLines = ranking.scores
    .filter((s) => s.moveCount > 0)
    .map(
      (s) =>
        `- ${localize(s.label.pl, s.label.en, isPolish)}: fit ${s.score}/9 (attractiveness ${s.attractiveness} × feasibility ${s.feasibility}), ${s.capitalInScope} capital in scope, ${s.evidenceBacked}/${s.moveCount} evidence-backed`
    )
    .join('\n');

  const seqLines = sequence
    .map(
      (m) =>
        `${m.order}. [${m.lever}] ${localize(m.title.pl, m.title.en, isPolish)} — rationale: ${localize(
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
    ? 'Działaj jako partner ds. operacji i kapitału obrotowego (zarządzanie zapasami, ABC/XYZ). Poniżej masz ugruntowaną na danych bazę zapasu, ranking dźwigni i sekwencję ruchów W2. Dopracuj sformułowania i uzupełnij luki, ale NIE wymyślaj kwot ani segmentów SKU niepopartych danymi sesji.'
    : 'Act as an operations and working-capital partner (inventory management, ABC/XYZ). Below is a data-grounded inventory baseline, a lever ranking and a W2 move sequence. Refine the wording and fill gaps, but do NOT invent amounts or SKU segments the session facts do not support.';

  const rules = isPolish
    ? [
        'Każdy ruch MUSI mieć: rationale, trade-off (co to kosztuje), wariant odrzucony (czego świadomie NIE robicie i dlaczego).',
        'Trzymaj porządek: klasyfikuj → ustaw poziom obsługi → uzupełniaj (autopilot) → sprzątaj martwy zapas. Nie automatyzuj polityki przed klasyfikacją.',
        'Liczby (kapitał, %, segmenty) wyłącznie z bazy powyżej — nie licz i nie zmyślaj.',
        'Jeśli dane są słabo zmierzone, zostaw ruch classify/measure-first przed inwestycją i przed autopilotem.',
      ]
    : [
        'Every move MUST carry: rationale, trade-off (what it costs), rejected variant (what you deliberately do NOT do and why).',
        'Keep order: classify → set service level → replenish (autopilot) → clear dead stock. Do not automate a policy before classification.',
        'Numbers (capital, %, segments) come exclusively from the baseline above — do not compute or invent them.',
        'If data is weakly measured, keep a classify/measure-first move before any spend and before the autopilot.',
      ];

  return `${header}

=== INVENTORY BASELINE (facts — the only admissible source of amounts) ===
${baselineLine}

=== SCORED INVENTORY LEVERS ===
${scoreLines}

=== W2 MOVE SEQUENCE (grounded draft) ===
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
    "verdict": "answer-first, 1-2 sentences: what this inventory analysis means for the working-capital and service decision",
    "executiveSummary": "3-4 sentences: restate the verdict, then why — anchored in the baseline capital and lever scores above",
    "keyInsights": ["3 insights, each tied to the facts above"],
    "appliedConclusions": ["what to do first", "what NOT to do", "what to validate next"],
    "tradeoffs": [{"chosen":"...","rejected":"...","why":"..."}],
    "expectedEffect": {"text":"working-capital release / service-level change, behaviorally observable","horizon":"..."}
  },
  "initiatives": [{"title":"...","description":"what to do + first step (verb + artifact + role)","type":"operational","estimatedImpact":"high|medium|low","estimatedEffort":"high|medium|low","rationale":"why — names the trade-off (chosen at the cost of what) and the rejected variant"}]
}`;
}

/**
 * Builds the deepening prompt for a single lever rung — used when the user asks
 * AI to "think deeper" on a specific inventory lever.
 */
export function buildInventoryDeepenPrompt(
  lever: InventoryLeverId,
  rungId: 'surface' | 'evidence' | 'quantification' | 'risk-capability',
  isPolish: boolean
): string | null {
  const rungs = localizeLadder(lever, isPolish);
  const rung = rungs.find((r) => r.id === rungId);
  if (!rung) return null;
  return `${rung.question}\n\n${isPolish ? 'Kontekst konsultanta' : 'Consultant framing'}: ${rung.rationale}`;
}

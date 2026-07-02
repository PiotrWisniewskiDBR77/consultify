/**
 * SOP Builder — conclusion prompt contract.
 *
 * Bridges the deterministic synthesis engine (moveValidator.ts) with the AI
 * runtime. The engine produces a grounded enforceability verdict + W2 rollout
 * sequence; these builders turn that into a prompt so the model refines wording
 * and fills gaps WITHOUT inventing standards or checks the facts do not support.
 *
 * Shape mirrors the Ansoff conclusionPrompts contract and CONCLUSION_LAYER
 * variant W2 (docs/standards/CONCLUSION_LAYER_STANDARD.md §3.W2):
 *   verdict -> rationale -> trade-offs (>=1 chosen/rejected/why) -> first steps + effect.
 */

import type { OperationalToolData } from '@/store/useToolStore';

import { assessSop, buildW2MoveSequence } from './moveValidator';
import { localizeLadder } from './index';

const localize = (pl: string, en: string, isPolish: boolean) => (isPolish ? pl : en);

/**
 * Grounded synthesis prompt: seeds the model with the engine's enforceability
 * verdict and W2 sequence so its output stays consistent with the assessed facts.
 * Returns null when there are no standards yet.
 */
export function buildSopConclusionPrompt(
  data: OperationalToolData,
  isPolish: boolean
): string | null {
  const readiness = assessSop(data);
  if (readiness.scores.every((s) => s.itemCount === 0)) return null;

  const sequence = buildW2MoveSequence(data);

  const scoreLines = readiness.scores
    .map(
      (s) =>
        `- ${localize(s.label.pl, s.label.en, isPolish)}: score ${s.score}, criticality ${s.criticality}/3, ${s.measurableCount}/${s.itemCount} measurable`
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
    ? 'Działaj jako partner ds. doskonalenia operacyjnego budujący SOP. Poniżej masz ugruntowaną na faktach ocenę egzekwowalności SOP (standardy mierzalne + pokrycie weryfikacją) i sekwencję wdrożenia W2. Dopracuj sformułowania i uzupełnij luki, ale NIE wymyślaj standardów ani punktów kontroli niepopartych pozycjami sesji.'
    : 'Act as an operational-excellence partner building an SOP. Below is a fact-grounded SOP enforceability assessment (measurable standards + verification coverage) and a W2 rollout sequence. Refine the wording and fill gaps, but do NOT invent standards or checks the session items do not support.';

  const rules = isPolish
    ? [
        'Każdy ruch MUSI mieć: rationale, trade-off (co to kosztuje), wariant odrzucony (czego świadomie NIE robicie i dlaczego).',
        'Rekomenduj sekwencję (skwantyfikuj standard → pokryj checklistą → pilotaż → zamknij pętlę), nie listę życzeń.',
        'Standard bez mierzalnego progu i bez punktu weryfikacji jest fikcją zgodności — nazwij to wprost.',
        'Dla kroku o wysokim ryzyku pominięcia proponuj poka-yoke, nie „większą uwagę".',
      ]
    : [
        'Every move MUST carry: rationale, trade-off (what it costs), rejected variant (what you deliberately do NOT do and why).',
        'Recommend a sequence (quantify standard → cover with checklist → pilot → close the loop), not a wishlist.',
        'A standard with no measurable threshold and no verification point is a compliance fiction — say so plainly.',
        'For a step with high skip risk propose poka-yoke, not "more attention".',
      ];

  return `${header}

=== SOP ENFORCEABILITY (verdict) ===
${localize(readiness.verdict.pl, readiness.verdict.en, isPolish)}

=== SECTION SCORES ===
${scoreLines}

=== W2 ROLLOUT SEQUENCE (grounded draft) ===
${seqLines}

Rules:
${rules.map((r) => `- ${r}`).join('\n')}

Return JSON:
{
  "summary": "answer-first verdict (thesis, not topic), then what it means",
  "insights": ["insight 1", "insight 2"],
  "appliedConclusions": ["what to quantify", "what to cover", "what to pilot", "what to own"],
  "moves": [{"title":"...","category":"quantify-standard|cover-with-checklist|validate-first|poka-yoke|assign-owner","rationale":"...","tradeOff":"...","rejectedVariant":"...","linkedSection":"standards|checklists","expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","riskLevel":"high|medium|low","confidence":4,"firstStep":"..."}]
}`;
}

/**
 * Builds the deepening prompt for a single section rung — used when the user
 * asks AI to "think deeper" on a specific SOP section (standards/checklists).
 */
export function buildSopDeepenPrompt(
  section: Parameters<typeof localizeLadder>[0],
  rungId: 'surface' | 'evidence' | 'quantification' | 'risk-capability',
  isPolish: boolean
): string | null {
  const rungs = localizeLadder(section, isPolish);
  const rung = rungs.find((r) => r.id === rungId);
  if (!rung) return null;

  return `${rung.question}\n\n${
    isPolish ? 'Kontekst konsultanta' : 'Consultant framing'
  }: ${rung.rationale}`;
}

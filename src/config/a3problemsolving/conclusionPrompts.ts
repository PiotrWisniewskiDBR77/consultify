/**
 * A3 Problem Solving — conclusion prompt contract.
 *
 * Bridges the deterministic synthesis engine (moveValidator.ts) with the AI
 * runtime. The engine produces a grounded readiness verdict + W2 countermeasure
 * sequence; these builders turn that into a prompt so the model refines wording
 * and fills gaps WITHOUT inventing causes or countermeasures the facts do not
 * support.
 *
 * Shape mirrors the Ansoff conclusionPrompts contract and CONCLUSION_LAYER
 * variant W2 (docs/standards/CONCLUSION_LAYER_STANDARD.md §3.W2):
 *   verdict -> rationale -> trade-offs (>=1 chosen/rejected/why) -> first steps + effect.
 */

import type { OperationalToolData } from '@/store/useToolStore';

import { assessA3, buildW2MoveSequence } from './moveValidator';
import { localizeLadder } from './index';

const localize = (pl: string, en: string, isPolish: boolean) => (isPolish ? pl : en);

/**
 * Grounded synthesis prompt: seeds the model with the engine's readiness verdict
 * and W2 sequence so its output stays consistent with the assessed facts.
 * Returns null when there is no problem stated yet.
 */
export function buildA3ConclusionPrompt(
  data: OperationalToolData,
  isPolish: boolean
): string | null {
  const readiness = assessA3(data);
  if (readiness.scores.every((s) => s.itemCount === 0)) return null;

  const sequence = buildW2MoveSequence(data);

  const scoreLines = readiness.scores
    .map(
      (s) =>
        `- ${localize(s.label.pl, s.label.en, isPolish)}: score ${s.score}, severity ${s.severity}/3, ${s.evidenceBacked}/${s.itemCount} evidence-backed`
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
    ? 'Działaj jako partner ds. doskonalenia operacyjnego prowadzący A3. Poniżej masz ugruntowaną na faktach ocenę gotowości A3 (drabina problem→przyczyna→środek) i sekwencję środków W2. Dopracuj sformułowania i uzupełnij luki, ale NIE wymyślaj przyczyn ani środków niepopartych pozycjami sesji.'
    : 'Act as an operational-excellence partner running an A3. Below is a fact-grounded A3 readiness assessment (problem→cause→countermeasure staircase) and a W2 countermeasure sequence. Refine the wording and fill gaps, but do NOT invent causes or countermeasures the session items do not support.';

  const rules = isPolish
    ? [
        'Każdy środek MUSI mieć: rationale, trade-off (co to kosztuje), wariant odrzucony (czego świadomie NIE robicie i dlaczego).',
        'Rekomenduj sekwencję (powstrzymaj → usuń korzeń → ustandaryzuj), nie listę życzeń.',
        'Jeśli przyczyna źródłowa jest słabo udowodniona, zostaw ruch validate-first (5×Why na gemba) przed wdrożeniem środka.',
        'Żaden środek bez wskazanej przyczyny źródłowej, którą adresuje. Liczby wyłącznie z pozycji sesji.',
      ]
    : [
        'Every countermeasure MUST carry: rationale, trade-off (what it costs), rejected variant (what you deliberately do NOT do and why).',
        'Recommend a sequence (contain → eliminate root → standardize), not a wishlist.',
        'If the root cause is thinly evidenced, keep a validate-first move (gemba 5-Why) before deploying the fix.',
        'No countermeasure without the named root cause it addresses. Numbers exclusively from session items.',
      ];

  return `${header}

=== A3 READINESS (verdict) ===
${localize(readiness.verdict.pl, readiness.verdict.en, isPolish)}

=== SECTION SCORES ===
${scoreLines}

=== W2 COUNTERMEASURE SEQUENCE (grounded draft) ===
${seqLines}

Rules:
${rules.map((r) => `- ${r}`).join('\n')}

Return JSON:
{
  "summary": "answer-first verdict (thesis, not topic), then what it means",
  "insights": ["insight 1", "insight 2"],
  "appliedConclusions": ["what to contain", "what to eliminate", "what to standardize", "what to validate next"],
  "moves": [{"title":"...","category":"contain|eliminate-root|prevent-recur|validate-first|standardize","rationale":"...","tradeOff":"...","rejectedVariant":"...","linkedSection":"problem|root-cause|countermeasures","expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","riskLevel":"high|medium|low","confidence":4,"firstStep":"..."}]
}`;
}

/**
 * Builds the deepening prompt for a single section rung — used when the user
 * asks AI to "think deeper" on a specific A3 section (problem/root-cause/countermeasures).
 */
export function buildA3DeepenPrompt(
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

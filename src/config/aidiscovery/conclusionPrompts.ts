/**
 * AI Discovery — conclusion prompt contract (CONCLUSION_LAYER_STANDARD W2).
 *
 * Bridges the deterministic synthesis engine (useCaseEngine.ts) with the AI
 * runtime. The engine produces a grounded baseline + phase ranking + W2 move
 * sequence; these builders turn that into a prompt so the model refines wording
 * and fills gaps WITHOUT inventing value or use-case facts the session does not
 * support.
 *
 * Shape mirrors the shared tool conclusion contract (verdict / rationale /
 * tradeoffs / moves / expectedEffect) used by the SMED/DMS prompts, so the
 * operational summary renderer consumes AI-Discovery output the same way.
 */

import { groundingRules } from '@/hooks/discovery/toolAi/groundingRules';

import { buildAiDiscoveryQuestionBankPromptRules } from './aiDiscoveryQuestionBank';
import { type AiPhaseId } from './deepeningLadder';
import { localizeLadder } from './index';
import {
  buildW2MoveSequence,
  computeBaseline,
  detectDiscoveryGaps,
  type DiscoverySession,
  rankPhases,
} from './useCaseEngine';
const localize = (pl: string, en: string, isPolish: boolean) => (isPolish ? pl : en);

/**
 * Grounded synthesis prompt: seeds the model with the engine's baseline, phase
 * ranking and W2 sequence so its output stays consistent with the scored facts.
 * Returns null when there is nothing to conclude on.
 */
export function buildAiDiscoveryConclusionPrompt(
  session: DiscoverySession,
  isPolish: boolean
): string | null {
  const ranking = rankPhases(session);
  if (ranking.ordered.length === 0) return null;

  const baseline = computeBaseline(session);
  const sequence = buildW2MoveSequence(session);

  const baselineLine = isPolish
    ? `Baza odkrywania: ${baseline.useCaseCount} kandydujących przypadków; ${baseline.totalValueAtStake} wartości rocznej łącznie; ${baseline.readyValueAtStake} gotowe do wdrożenia (dane gotowe); ${baseline.ownedCount} z właścicielem biznesowym; gotowość danych ${Math.round(baseline.dataReadinessRatio * 100)}%; zmierzone ${Math.round(baseline.measuredRatio * 100)}% przypadków.`
    : `Discovery baseline: ${baseline.useCaseCount} candidate use cases; ${baseline.totalValueAtStake} total annual value; ${baseline.readyValueAtStake} shippable now (data ready); ${baseline.ownedCount} with a business owner; data readiness ${Math.round(baseline.dataReadinessRatio * 100)}%; ${Math.round(baseline.measuredRatio * 100)}% of use cases measured.`;

  const scoreLines = ranking.scores
    .filter((s) => s.moveCount > 0)
    .map(
      (s) =>
        `- ${localize(s.label.pl, s.label.en, isPolish)}: fit ${s.score}/9 (attractiveness ${s.attractiveness} × feasibility ${s.feasibility}), ${s.valueInScope} value in scope, ${s.evidenceBacked}/${s.moveCount} evidence-backed`
    )
    .join('\n');

  const seqLines = sequence
    .map(
      (m) =>
        `${m.order}. [${m.phase}] ${localize(m.title.pl, m.title.en, isPolish)} — rationale: ${localize(
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

  const gaps = detectDiscoveryGaps(session);
  const gapLines = gaps
    .map((g) => `- ${localize(g.message.pl, g.message.en, isPolish)}`)
    .join('\n');

  const header = isPolish
    ? 'Działaj jako partner ds. AI i transformacji cyfrowej. Poniżej masz ugruntowaną na danych bazę odkrywania przypadków użycia AI, ranking faz i sekwencję ruchów W2. Dopracuj sformułowania i uzupełnij luki, ale NIE wymyślaj wartości ani przypadków niepopartych danymi sesji.'
    : 'Act as an AI and digital-transformation partner. Below is a data-grounded AI use-case discovery baseline, a phase ranking and a W2 move sequence. Refine the wording and fill gaps, but do NOT invent value or use cases the session facts do not support.';

  const rules = isPolish
    ? [
        'Każdy ruch MUSI mieć: rationale, trade-off (co to kosztuje), wariant odrzucony (czego świadomie NIE robicie i dlaczego).',
        'Trzymaj porządek: odkryj → sprawdź wykonalność danych → wyceń wartość → uszereguj. Nie obiecuj wartości przed testem danych, nie startuj od moonshota.',
        'Liczby (wartość, %, przypadki) wyłącznie z bazy powyżej — nie licz i nie zmyślaj.',
        'Jeśli gotowość danych jest słaba, zostaw ruch feasibility-first przed budową modeli.',
      ]
    : [
        'Every move MUST carry: rationale, trade-off (what it costs), rejected variant (what you deliberately do NOT do and why).',
        'Keep order: discover → test data feasibility → quantify value → sequence. Do not promise value before testing data, do not start with a moonshot.',
        'Numbers (value, %, use cases) come exclusively from the baseline above — do not compute or invent them.',
        'If data readiness is weak, keep a feasibility-first move before any model building.',
      ];

  return `${header}

=== DISCOVERY BASELINE (facts — the only admissible source of value figures) ===
${baselineLine}

=== SCORED DISCOVERY PHASES ===
${scoreLines}

=== W2 MOVE SEQUENCE (grounded draft) ===
${seqLines}
${gapLines ? `\n=== COVERAGE GAPS ===\n${gapLines}\n` : ''}
${buildAiDiscoveryQuestionBankPromptRules(isPolish ? 'pl' : 'en')}

Rules:
${rules.map((r) => `- ${r}`).join('\n')}

QUALITY BARS:
- Answer-first: "verdict" is a thesis about the decision, not a recap of the inputs.
- Numbers exclusively from the facts above; do not compute or invent new ones.
- Zero filler and zero AI meta-phrases ("As an AI", "Based on the provided data", "In conclusion") — write like a partner signing the work with their name.
- Every sentence falsifiable: with opposite facts it would read differently.
- Map the grounded W2 sequence above into 3-5 "initiatives", preserving its order (order = priority).
- Respond in ${isPolish ? 'Polish' : 'English'}, active voice, partner tone.


${groundingRules(isPolish)}

Return JSON:
{
  "summary": {
    "verdict": "answer-first, 1-2 sentences: what this AI discovery means for the transformation decision — which use case first and why",
    "executiveSummary": "3-4 sentences: restate the verdict, then why — anchored in the baseline value and phase scores above",
    "keyInsights": ["3 insights, each tied to the facts above"],
    "appliedConclusions": ["what to do first", "what NOT to do", "what to validate next"],
    "tradeoffs": [{"chosen":"...","rejected":"...","why":"..."}],
    "expectedEffect": {"text":"value captured / capability built, behaviorally observable","horizon":"..."}
  },
  "initiatives": [{"title":"...","description":"what to do + first step (verb + artifact + role)","type":"operational","estimatedImpact":"high|medium|low","estimatedEffort":"high|medium|low","rationale":"why — names the trade-off (chosen at the cost of what) and the rejected variant"}]
}`;
}

/**
 * Builds the deepening prompt for a single phase rung — used when the user asks
 * AI to "think deeper" on a specific discovery phase.
 */
export function buildAiDiscoveryDeepenPrompt(
  phase: AiPhaseId,
  rungId: 'surface' | 'evidence' | 'quantification' | 'risk-capability',
  isPolish: boolean
): string | null {
  const rungs = localizeLadder(phase, isPolish);
  const rung = rungs.find((r) => r.id === rungId);
  if (!rung) return null;
  return `${rung.question}\n\n${isPolish ? 'Kontekst konsultanta' : 'Consultant framing'}: ${rung.rationale}`;
}

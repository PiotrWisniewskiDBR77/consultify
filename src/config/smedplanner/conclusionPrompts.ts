/**
 * SMED Planner — conclusion prompt contract (CONCLUSION_LAYER_STANDARD W2).
 *
 * Bridges the deterministic synthesis engine (changeoverEngine.ts) with the AI
 * runtime. The engine produces a grounded baseline + phase ranking + W2 move
 * sequence; these builders turn that into a prompt so the model refines wording
 * and fills gaps WITHOUT inventing minutes the facts do not support.
 *
 * Shape mirrors the shared tool conclusion contract (verdict / rationale /
 * tradeoffs / moves) used by the SWOT/Ansoff/Porter prompts, so the operational
 * summary renderer consumes SMED output the same way.
 */

import {
  buildW2MoveSequence,
  computeBaseline,
  rankSmedPhases,
  type SmedSession,
} from './changeoverEngine';
import { localizeLadder } from './index';
import { type SmedPhaseId } from './deepeningLadder';

import { groundingRules } from '@/hooks/discovery/toolAi/groundingRules';
const localize = (pl: string, en: string, isPolish: boolean) => (isPolish ? pl : en);

/**
 * Grounded synthesis prompt: seeds the model with the engine's baseline, phase
 * ranking and W2 sequence so its output stays consistent with the scored facts.
 * Returns null when there is nothing measured to conclude on.
 */
export function buildSmedConclusionPrompt(
  session: SmedSession,
  isPolish: boolean
): string | null {
  const ranking = rankSmedPhases(session);
  if (ranking.ordered.length === 0) return null;

  const baseline = computeBaseline(session);
  const sequence = buildW2MoveSequence(session);

  const baselineLine = isPolish
    ? `Baza przezbrojenia: ${baseline.internalMinutes} min wewnętrznych + ${baseline.externalMinutes} min zewnętrznych = ${baseline.totalMinutes} min łącznie; ${baseline.convertibleMinutes} min do przeniesienia (internal→external); zmierzone ${Math.round(baseline.measuredRatio * 100)}% czynności wewnętrznych.`
    : `Changeover baseline: ${baseline.internalMinutes} min internal + ${baseline.externalMinutes} min external = ${baseline.totalMinutes} min total; ${baseline.convertibleMinutes} min convertible (internal→external); ${Math.round(baseline.measuredRatio * 100)}% of internal steps measured.`;

  const scoreLines = ranking.scores
    .filter((s) => s.improvementCount > 0)
    .map(
      (s) =>
        `- ${localize(s.label.pl, s.label.en, isPolish)}: fit ${s.score}/9 (attractiveness ${s.attractiveness} × feasibility ${s.feasibility}), ${s.minutesAddressed} min in scope, ${s.evidenceBacked}/${s.improvementCount} evidence-backed`
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

  const header = isPolish
    ? 'Działaj jako partner ds. operacji (Lean, SMED wg Shingo). Poniżej masz ugruntowaną na pomiarach bazę przezbrojenia, ranking faz SMED i sekwencję ruchów W2. Dopracuj sformułowania i uzupełnij luki, ale NIE wymyślaj minut ani czynności niepopartych danymi sesji.'
    : 'Act as an operations partner (Lean, SMED per Shingo). Below is a measurement-grounded changeover baseline, a SMED phase ranking and a W2 move sequence. Refine the wording and fill gaps, but do NOT invent minutes or steps the session facts do not support.';

  const rules = isPolish
    ? [
        'Każdy ruch MUSI mieć: rationale, trade-off (co to kosztuje), wariant odrzucony (czego świadomie NIE robicie i dlaczego).',
        'Trzymaj porządek Shingo: rozdziel → przenieś → skróć → ustandaryzuj. Nie standaryzuj przed potwierdzonym zyskiem.',
        'Liczby (minuty, %) wyłącznie z bazy powyżej — nie licz i nie zmyślaj.',
        'Jeśli pomiar jest słaby, zostaw ruch measure-first przed inwestycją w oprzyrządowanie.',
      ]
    : [
        'Every move MUST carry: rationale, trade-off (what it costs), rejected variant (what you deliberately do NOT do and why).',
        'Keep Shingo order: separate → convert → streamline → standardize. Do not standardize before a confirmed gain.',
        'Numbers (minutes, %) come exclusively from the baseline above — do not compute or invent them.',
        'If measurement is weak, keep a measure-first move before any tooling spend.',
      ];

  return `${header}

=== CHANGEOVER BASELINE (facts — the only admissible source of minutes) ===
${baselineLine}

=== SCORED SMED PHASES ===
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


${groundingRules(isPolish)}

Return JSON:
{
  "summary": {
    "verdict": "answer-first, 1-2 sentences: what this SMED analysis means for the operation's decision",
    "executiveSummary": "3-4 sentences: restate the verdict, then why — anchored in the baseline minutes and phase scores above",
    "keyInsights": ["3 insights, each tied to the facts above"],
    "appliedConclusions": ["what to do first", "what NOT to do", "what to validate next"],
    "tradeoffs": [{"chosen":"...","rejected":"...","why":"..."}],
    "expectedEffect": {"text":"downtime/OEE change, behaviorally observable","horizon":"..."}
  },
  "initiatives": [{"title":"...","description":"what to do + first step (verb + artifact + role)","type":"operational","estimatedImpact":"high|medium|low","estimatedEffort":"high|medium|low","rationale":"why — names the trade-off (chosen at the cost of what) and the rejected variant"}]
}`;
}

/**
 * Builds the deepening prompt for a single phase rung — used when the user asks
 * AI to "think deeper" on a specific SMED phase.
 */
export function buildSmedDeepenPrompt(
  phase: SmedPhaseId,
  rungId: 'surface' | 'evidence' | 'quantification' | 'risk-capability',
  isPolish: boolean
): string | null {
  const rungs = localizeLadder(phase, isPolish);
  const rung = rungs.find((r) => r.id === rungId);
  if (!rung) return null;
  return `${rung.question}\n\n${isPolish ? 'Kontekst konsultanta' : 'Consultant framing'}: ${rung.rationale}`;
}

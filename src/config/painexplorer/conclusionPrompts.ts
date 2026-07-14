/**
 * Pain Explorer — conclusion prompt contract (CONCLUSION_LAYER_STANDARD W2).
 *
 * Bridges the deterministic synthesis engine (painSynthesisEngine.ts) with the
 * AI runtime. The engine produces a grounded pain baseline + stage ranking + W2
 * move sequence; these builders turn that into a prompt so the model refines
 * wording and fills gaps WITHOUT inventing pain costs the facts do not support.
 *
 * Shape mirrors the shared tool conclusion contract (verdict / rationale /
 * tradeoffs / moves) used by the SMED/Ansoff/Porter prompts, so the operational
 * summary renderer consumes Pain Explorer output the same way.
 */

import { groundingRules } from '@/hooks/discovery/toolAi/groundingRules';

import { type PainStageId } from './deepeningLadder';
import { localizeLadder } from './index';
import {
  buildW2MoveSequence,
  computeBaseline,
  type PainSession,
  rankPainStages,
} from './painSynthesisEngine';
const localize = (pl: string, en: string, isPolish: boolean) => (isPolish ? pl : en);

/**
 * Grounded synthesis prompt: seeds the model with the engine's pain baseline,
 * stage ranking and W2 sequence so its output stays consistent with the scored
 * facts. Returns null when there is nothing to conclude on.
 */
export function buildPainConclusionPrompt(session: PainSession, isPolish: boolean): string | null {
  const ranking = rankPainStages(session);
  if (ranking.ordered.length === 0) return null;

  const baseline = computeBaseline(session);
  const sequence = buildW2MoveSequence(session);

  const baselineLine = isPolish
    ? `Portfel bólu: ${baseline.painCount} bólów, z tego ${baseline.rootCount} z nazwaną przyczyną źródłową; ${baseline.annualMinutesLost} min traconych rocznie łącznie (najdroższy ból: ${baseline.topPainMinutes} min/rok); zmierzone ${Math.round(baseline.measuredRatio * 100)}% bólów, poparte dowodem ${Math.round(baseline.evidenceRatio * 100)}%.`
    : `Pain portfolio: ${baseline.painCount} pains, of which ${baseline.rootCount} have a named root cause; ${baseline.annualMinutesLost} min lost per year in total (costliest pain: ${baseline.topPainMinutes} min/yr); ${Math.round(baseline.measuredRatio * 100)}% of pains measured, ${Math.round(baseline.evidenceRatio * 100)}% evidence-backed.`;

  const scoreLines = ranking.scores
    .filter((s) => s.solutionCount > 0)
    .map(
      (s) =>
        `- ${localize(s.label.pl, s.label.en, isPolish)}: fit ${s.score}/9 (attractiveness ${s.attractiveness} × feasibility ${s.feasibility}), ${s.minutesAddressed} min/yr in scope, ${s.evidenceBacked}/${s.solutionCount} evidence-backed`
    )
    .join('\n');

  const seqLines = sequence
    .map(
      (m) =>
        `${m.order}. [${m.stage}] ${localize(m.title.pl, m.title.en, isPolish)} — rationale: ${localize(
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
    ? 'Działaj jako partner ds. doskonałości operacyjnej prowadzący odkrywanie bólu. Poniżej masz ugruntowany na danych portfel bólu, ranking etapów odkrywania i sekwencję ruchów W2. Dopracuj sformułowania i uzupełnij luki, ale NIE wymyślaj minut ani bólów niepopartych danymi sesji.'
    : 'Act as an operational-excellence partner running pain discovery. Below is a data-grounded pain portfolio, a discovery-stage ranking and a W2 move sequence. Refine the wording and fill gaps, but do NOT invent minutes or pains the session facts do not support.';

  const rules = isPolish
    ? [
        'Każdy ruch MUSI mieć: rationale, trade-off (co to kosztuje), wariant odrzucony (czego świadomie NIE robicie i dlaczego).',
        'Trzymaj porządek odkrywania: wykryj → zakwalifikuj → zmierz → zdiagnozuj. Nie rozwiązuj bólu przed dojściem do przyczyny źródłowej.',
        'Liczby (minuty, %, koszt) wyłącznie z portfela powyżej — nie licz i nie zmyślaj.',
        'Jeśli pomiar jest słaby, zostaw ruch measure-first przed inwestycją w rozwiązanie.',
      ]
    : [
        'Every move MUST carry: rationale, trade-off (what it costs), rejected variant (what you deliberately do NOT do and why).',
        'Keep the discovery order: detect → qualify → measure → diagnose. Do not fix a pain before reaching its root cause.',
        'Numbers (minutes, %, cost) come exclusively from the portfolio above — do not compute or invent them.',
        'If measurement is weak, keep a measure-first move before any fix spend.',
      ];

  return `${header}

=== PAIN PORTFOLIO (facts — the only admissible source of minutes and cost) ===
${baselineLine}

=== SCORED DISCOVERY STAGES ===
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
    "verdict": "answer-first, 1-2 sentences: what this pain analysis means for the operation's decision",
    "executiveSummary": "3-4 sentences: restate the verdict, then why — anchored in the pain portfolio minutes and stage scores above",
    "keyInsights": ["3 insights, each tied to the facts above"],
    "appliedConclusions": ["what to do first", "what NOT to do", "what to validate next"],
    "tradeoffs": [{"chosen":"...","rejected":"...","why":"..."}],
    "expectedEffect": {"text":"time/quality recovered, behaviorally observable","horizon":"..."}
  },
  "initiatives": [{"title":"...","description":"what to do + first step (verb + artifact + role)","type":"operational","estimatedImpact":"high|medium|low","estimatedEffort":"high|medium|low","rationale":"why — names the trade-off (chosen at the cost of what) and the rejected variant"}]
}`;
}

/**
 * Builds the deepening prompt for a single stage rung — used when the user asks
 * AI to "think deeper" on a specific pain-discovery stage.
 */
export function buildPainDeepenPrompt(
  stage: PainStageId,
  rungId: 'surface' | 'evidence' | 'quantification' | 'risk-capability',
  isPolish: boolean
): string | null {
  const rungs = localizeLadder(stage, isPolish);
  const rung = rungs.find((r) => r.id === rungId);
  if (!rung) return null;
  return `${rung.question}\n\n${isPolish ? 'Kontekst konsultanta' : 'Consultant framing'}: ${rung.rationale}`;
}

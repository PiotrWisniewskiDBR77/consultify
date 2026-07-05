/**
 * RPA Scanner — conclusion prompt contract (CONCLUSION_LAYER_STANDARD W2).
 *
 * Bridges the deterministic synthesis engine (feasibilityEngine.ts) with the
 * AI runtime. The engine produces a grounded automation baseline + gate ranking
 * + W2 move sequence; these builders turn that into a prompt so the model
 * refines wording and fills gaps WITHOUT inventing volume or ROI the facts do
 * not support.
 *
 * Shape mirrors the shared tool conclusion contract (verdict / rationale /
 * tradeoffs / moves) used by the SMED/Ansoff/Porter prompts, so the operational
 * summary renderer consumes RPA Scanner output the same way.
 */

import {
  buildW2MoveSequence,
  computeBaseline,
  rankRpaGates,
  type RpaSession,
} from './feasibilityEngine';
import { localizeLadder } from './index';
import { type RpaGateId } from './deepeningLadder';

const localize = (pl: string, en: string, isPolish: boolean) => (isPolish ? pl : en);

/**
 * Grounded synthesis prompt: seeds the model with the engine's automation
 * baseline, gate ranking and W2 sequence so its output stays consistent with the
 * scored facts. Returns null when there is nothing to conclude on.
 */
export function buildRpaConclusionPrompt(
  session: RpaSession,
  isPolish: boolean
): string | null {
  const ranking = rankRpaGates(session);
  if (ranking.ordered.length === 0) return null;

  const baseline = computeBaseline(session);
  const sequence = buildW2MoveSequence(session);

  const baselineLine = isPolish
    ? `Portfel automatyzacji: ${baseline.candidateCount} procesów-kandydatów, z tego ${baseline.ruleBasedCount} w pełni regułowych; ${baseline.annualAutomatableMinutes} min automatyzowalnej pracy rocznie łącznie (największy kandydat: ${baseline.topCandidateMinutes} min/rok); zmierzone ${Math.round(baseline.measuredRatio * 100)}% kandydatów, poparte dowodem ${Math.round(baseline.evidenceRatio * 100)}%.`
    : `Automation portfolio: ${baseline.candidateCount} candidate processes, of which ${baseline.ruleBasedCount} are fully rule-based; ${baseline.annualAutomatableMinutes} min of automatable work per year in total (largest candidate: ${baseline.topCandidateMinutes} min/yr); ${Math.round(baseline.measuredRatio * 100)}% of candidates measured, ${Math.round(baseline.evidenceRatio * 100)}% evidence-backed.`;

  const scoreLines = ranking.scores
    .filter((s) => s.ideaCount > 0)
    .map(
      (s) =>
        `- ${localize(s.label.pl, s.label.en, isPolish)}: fit ${s.score}/9 (attractiveness ${s.attractiveness} × feasibility ${s.feasibility}), ${s.minutesAddressed} min/yr in scope, ${s.evidenceBacked}/${s.ideaCount} evidence-backed`
    )
    .join('\n');

  const seqLines = sequence
    .map(
      (m) =>
        `${m.order}. [${m.gate}] ${localize(m.title.pl, m.title.en, isPolish)} — rationale: ${localize(
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
    ? 'Działaj jako partner ds. automatyzacji i doskonałości operacyjnej prowadzący skan RPA. Poniżej masz ugruntowany na danych portfel automatyzacji, ranking bramek oceny i sekwencję ruchów W2. Dopracuj sformułowania i uzupełnij luki, ale NIE wymyślaj wolumenu ani zwrotu niepopartego danymi sesji.'
    : 'Act as an automation and operational-excellence partner running an RPA scan. Below is a data-grounded automation portfolio, an assessment-gate ranking and a W2 move sequence. Refine the wording and fill gaps, but do NOT invent volume or ROI the session facts do not support.';

  const rules = isPolish
    ? [
        'Każdy ruch MUSI mieć: rationale, trade-off (co to kosztuje), wariant odrzucony (czego świadomie NIE robicie i dlaczego).',
        'Trzymaj porządek oceny: zidentyfikuj → ustandaryzuj → skwantyfikuj → oceń wykonalność. Nie zatwierdzaj budowy przed ustandaryzowaniem i pomiarem zwrotu.',
        'Liczby (minuty, wolumen, %, ROI) wyłącznie z portfela powyżej — nie licz i nie zmyślaj.',
        'Jeśli pomiar jest słaby, zostaw ruch measure-first przed inwestycją w budowę bota.',
      ]
    : [
        'Every move MUST carry: rationale, trade-off (what it costs), rejected variant (what you deliberately do NOT do and why).',
        'Keep the assessment order: identify → standardize → quantify → feasibility. Do not green-light a build before standardizing and measuring the return.',
        'Numbers (minutes, volume, %, ROI) come exclusively from the portfolio above — do not compute or invent them.',
        'If measurement is weak, keep a measure-first move before any bot-build spend.',
      ];

  return `${header}

=== AUTOMATION PORTFOLIO (facts — the only admissible source of volume and ROI) ===
${baselineLine}

=== SCORED ASSESSMENT GATES ===
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
    "verdict": "answer-first, 1-2 sentences: what this RPA scan means for the automation decision",
    "executiveSummary": "3-4 sentences: restate the verdict, then why — anchored in the automation portfolio minutes and gate scores above",
    "keyInsights": ["3 insights, each tied to the facts above"],
    "appliedConclusions": ["what to do first", "what NOT to do", "what to validate next"],
    "tradeoffs": [{"chosen":"...","rejected":"...","why":"..."}],
    "expectedEffect": {"text":"hours recovered / error cost avoided, behaviorally observable","horizon":"..."}
  },
  "initiatives": [{"title":"...","description":"what to do + first step (verb + artifact + role)","type":"operational","estimatedImpact":"high|medium|low","estimatedEffort":"high|medium|low","rationale":"why — names the trade-off (chosen at the cost of what) and the rejected variant"}]
}`;
}

/**
 * Builds the deepening prompt for a single gate rung — used when the user asks
 * AI to "think deeper" on a specific RPA assessment gate.
 */
export function buildRpaDeepenPrompt(
  gate: RpaGateId,
  rungId: 'surface' | 'evidence' | 'quantification' | 'risk-capability',
  isPolish: boolean
): string | null {
  const rungs = localizeLadder(gate, isPolish);
  const rung = rungs.find((r) => r.id === rungId);
  if (!rung) return null;
  return `${rung.question}\n\n${isPolish ? 'Kontekst konsultanta' : 'Consultant framing'}: ${rung.rationale}`;
}

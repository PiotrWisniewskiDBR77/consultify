/**
 * Process Automation — conclusion prompt contract (CONCLUSION_LAYER_STANDARD W2).
 *
 * Bridges the deterministic synthesis engine (automationEngine.ts) with the AI
 * runtime. The engine produces a grounded baseline + phase ranking + W2 move
 * sequence; these builders turn that into a prompt so the model refines wording
 * and fills gaps WITHOUT inventing hours the facts do not support.
 *
 * Shape mirrors the shared tool conclusion contract (verdict / rationale /
 * tradeoffs / moves) used by the SMED/Ansoff/SWOT prompts, so the operational
 * summary renderer consumes Process Automation output the same way.
 *
 * See docs/standards/CONCLUSION_LAYER_STANDARD.md §3.W2.
 */

import { groundingRules } from '@/hooks/discovery/toolAi/groundingRules';

import {
  type AutomationSession,
  buildW2MoveSequence,
  computeBaseline,
  rankAutomationPhases,
} from './automationEngine';
import {
  buildAutomationStaircasePromptRules,
  detectAutomationGaps,
} from './automationInsightStaircase';
import { buildAutomationQuestionBankPromptRules } from './automationQuestionBank';
import { type AutomationPhaseId } from './deepeningLadder';
import { localizeLadder } from './index';
const localize = (pl: string, en: string, isPolish: boolean) => (isPolish ? pl : en);

/**
 * Grounded synthesis prompt: seeds the model with the engine's baseline, phase
 * ranking and W2 sequence so its output stays consistent with the scored facts.
 * Returns null when there is nothing to conclude on (no candidates).
 */
export function buildProcessAutomationConclusionPrompt(
  session: AutomationSession,
  isPolish: boolean
): string | null {
  const ranking = rankAutomationPhases(session);
  if (ranking.ordered.length === 0) return null;

  const baseline = computeBaseline(session);
  const sequence = buildW2MoveSequence(session);

  const baselineLine = baseline.quantified
    ? isPolish
      ? `Baza procesu: ${baseline.volumePerWeek} uruchomień/tydzień × ${baseline.baselineMinutesPerCycle} min/cykl = ${baseline.annualBaselineHours} godz./rok; cel ${baseline.targetMinutesPerCycle} min/cykl → oszczędność ${baseline.annualSavedHours} godz./rok; błąd ${baseline.errorRateBaselinePct}% → ${baseline.errorRateTargetPct}% (redukcja o ${baseline.errorPointsRemoved} p.p.).`
      : `Process baseline: ${baseline.volumePerWeek} runs/week × ${baseline.baselineMinutesPerCycle} min/cycle = ${baseline.annualBaselineHours} h/yr; target ${baseline.targetMinutesPerCycle} min/cycle → savings ${baseline.annualSavedHours} h/yr; error ${baseline.errorRateBaselinePct}% → ${baseline.errorRateTargetPct}% (removes ${baseline.errorPointsRemoved} pp).`
    : isPolish
      ? 'Baza procesu NIEPOLICZONA (brak wolumenu lub czasu cyklu) — traktuj payback jako niepewny i nie podawaj godzin, których nie ma w danych.'
      : 'Process baseline NOT QUANTIFIED (missing volume or cycle time) — treat payback as uncertain and do not state hours the data does not contain.';

  const scoreLines = ranking.scores
    .filter((s) => s.candidateCount > 0)
    .map(
      (s) =>
        `- ${localize(s.label.pl, s.label.en, isPolish)}: fit ${s.score}/9 (attractiveness ${s.attractiveness} × feasibility ${s.feasibility}), ${s.minutesAddressed} min/cycle in scope, ${s.evidenceBacked}/${s.candidateCount} evidence-backed`
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
    ? 'Działaj jako partner ds. automatyzacji procesów (Lean + inżynieria procesów). Poniżej masz ugruntowaną na danych bazę procesu, ranking faz automatyzacji i sekwencję ruchów W2. Dopracuj sformułowania i uzupełnij luki, ale NIE wymyślaj godzin ani kroków niepopartych danymi sesji.'
    : 'Act as a process automation partner (Lean + process engineering). Below is a data-grounded process baseline, an automation phase ranking and a W2 move sequence. Refine the wording and fill gaps, but do NOT invent hours or steps the session facts do not support.';

  const rules = isPolish
    ? [
        'Każdy ruch MUSI mieć: rationale, trade-off (co to kosztuje), wariant odrzucony (czego świadomie NIE robicie i dlaczego).',
        'Trzymaj porządek: zmapuj → ustandaryzuj → zautomatyzuj → utrzymaj. Nie automatyzuj procesu przed jego ustandaryzowaniem.',
        'Liczby (godziny, minuty, %) wyłącznie z bazy powyżej — nie licz i nie zmyślaj.',
        'Jeśli baza jest niepoliczona, zostaw ruch map-and-measure przed jakąkolwiek budową automatyzacji.',
      ]
    : [
        'Every move MUST carry: rationale, trade-off (what it costs), rejected variant (what you deliberately do NOT do and why).',
        'Keep the order: map → standardize → automate → sustain. Do not automate a process before it is standardized.',
        'Numbers (hours, minutes, %) come exclusively from the baseline above — do not compute or invent them.',
        'If the baseline is unquantified, keep a map-and-measure move before any automation build.',
      ];

  const gaps = detectAutomationGaps(session);
  const gapLines = gaps.length
    ? gaps.map((g) => `- [${g.code}] ${localize(g.messagePl, g.messageEn, isPolish)}`).join('\n')
    : isPolish
      ? '(brak wykrytych luk strukturalnych)'
      : '(no structural gaps detected)';

  return `${header}

=== PROCESS BASELINE (facts — the only admissible source of hours) ===
${baselineLine}

=== SCORED AUTOMATION PHASES ===
${scoreLines}

=== W2 MOVE SEQUENCE (grounded draft) ===
${seqLines}

=== STRUCTURAL GAPS (engine — surface these, do not paper over them) ===
${gapLines}

Rules:
${rules.map((r) => `- ${r}`).join('\n')}

${buildAutomationQuestionBankPromptRules(isPolish ? 'pl' : 'en')}

${buildAutomationStaircasePromptRules(isPolish ? 'pl' : 'en')}

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
    "verdict": "answer-first, 1-2 sentences: what this process automation analysis means for the operation's decision",
    "executiveSummary": "3-4 sentences: restate the verdict, then why — anchored in the baseline hours and phase scores above",
    "keyInsights": ["3 insights, each tied to the facts above"],
    "appliedConclusions": ["what to do first", "what NOT to do", "what to validate next"],
    "tradeoffs": [{"chosen":"...","rejected":"...","why":"..."}],
    "expectedEffect": {"text":"cycle-time / error-rate change, behaviorally observable","horizon":"..."}
  },
  "initiatives": [{"title":"...","description":"what to do + first step (verb + artifact + role)","type":"operational","estimatedImpact":"high|medium|low","estimatedEffort":"high|medium|low","rationale":"why — names the trade-off (chosen at the cost of what) and the rejected variant"}]
}`;
}

/**
 * Builds the deepening prompt for a single phase rung — used when the user asks
 * AI to "think deeper" on a specific automation phase.
 */
export function buildProcessAutomationDeepenPrompt(
  phase: AutomationPhaseId,
  rungId: 'surface' | 'evidence' | 'quantification' | 'risk-capability',
  isPolish: boolean
): string | null {
  const rungs = localizeLadder(phase, isPolish);
  const rung = rungs.find((r) => r.id === rungId);
  if (!rung) return null;
  return `${rung.question}\n\n${isPolish ? 'Kontekst konsultanta' : 'Consultant framing'}: ${rung.rationale}`;
}

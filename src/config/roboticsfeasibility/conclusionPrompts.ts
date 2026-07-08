/**
 * Robotics Feasibility — conclusion prompt contract (CONCLUSION_LAYER_STANDARD W2).
 *
 * Bridges the deterministic synthesis engine (roboticsEngine.ts) with the AI
 * runtime. The engine produces a grounded portfolio baseline + per-operation
 * verdict (go/no-go/pilot/hybrid) + a W2 move sequence; these builders turn that
 * into a prompt so the model refines wording and fills gaps WITHOUT inventing
 * CAPEX, payback or operation facts the session does not support.
 *
 * INSIGHT-FIRST: the doctrine (§6) says the tool exists FOR the insights, not the
 * ROI table. The prompt therefore demands answer-first, decision-shaped insights
 * of exactly the doctrine's shape:
 *   - "operation X payback Y months at 2 shifts, ~2x at 1 shift"
 *   - "ergonomic risk justifies a PILOT despite payback over threshold"
 *   - "product variability blocks full automation → HYBRID (robot core, human tail)"
 *
 * Shape mirrors the shared tool conclusion contract (verdict / rationale /
 * tradeoffs / initiatives / expectedEffect) used by the SMED/RPA prompts, so the
 * operational summary renderer consumes Robotics output the same way.
 */

import {
  buildW2MoveSequence,
  computeBaseline,
  rankOperations,
  PAYBACK_THRESHOLD_MONTHS,
  type RoboticsSession,
  type OperationFeasibility,
} from './roboticsEngine';
import { localizeLadder } from './index';
import { type RoboticsAxisId } from './deepeningLadder';

const localize = (pl: string, en: string, isPolish: boolean) => (isPolish ? pl : en);
const payback = (f: OperationFeasibility) =>
  Number.isFinite(f.economic.paybackMonths) ? `${f.economic.paybackMonths}` : '∞';
const paybackSingleShift = (f: OperationFeasibility) =>
  Number.isFinite(f.economic.paybackMonthsSingleShift) ? `${f.economic.paybackMonthsSingleShift}` : '∞';

/**
 * Grounded synthesis prompt: seeds the model with the engine's portfolio baseline,
 * per-operation verdicts and W2 sequence so its output stays consistent with the
 * scored facts. Returns null when there is nothing to conclude on.
 */
export function buildRoboticsConclusionPrompt(
  session: RoboticsSession,
  isPolish: boolean
): string | null {
  const ranking = rankOperations(session);
  if (ranking.ordered.length === 0) return null;

  const baseline = computeBaseline(session);
  const sequence = buildW2MoveSequence(session);

  const baselineLine = isPolish
    ? `Portfel robotyzacji: ${baseline.operationCount} operacji; ${baseline.technicallyFeasibleCount} przechodzi bramkę techniczną; ${baseline.withinThresholdCount} w progu payback ${PAYBACK_THRESHOLD_MONTHS} mies; werdykty GO=${baseline.verdicts.go} / PILOT=${baseline.verdicts.pilot} / HYBRYDA=${baseline.verdicts.hybrid} / NO-GO=${baseline.verdicts['no-go']}; CAPEX w zakresie ${baseline.totalCapexInScope}; oszczędność roczna ${baseline.totalAnnualSaving}; zmierzone ${Math.round(baseline.measuredRatio * 100)}% operacji.`
    : `Robotics portfolio: ${baseline.operationCount} operations; ${baseline.technicallyFeasibleCount} pass the technical gate; ${baseline.withinThresholdCount} within the ${PAYBACK_THRESHOLD_MONTHS}-mo payback threshold; verdicts GO=${baseline.verdicts.go} / PILOT=${baseline.verdicts.pilot} / HYBRID=${baseline.verdicts.hybrid} / NO-GO=${baseline.verdicts['no-go']}; CAPEX in scope ${baseline.totalCapexInScope}; annual saving ${baseline.totalAnnualSaving}; ${Math.round(baseline.measuredRatio * 100)}% of operations measured.`;

  const opLines = ranking.ordered
    .map((id) => ranking.feasibilities.find((f) => f.id === id)!)
    .map(
      (f) =>
        `- [${f.verdict.toUpperCase()}] ${f.label}: technical ${f.technical.score}/3 (${f.technical.passes ? 'pass' : 'BLOCKED: ' + f.technical.blockers.join(',')}${f.technical.unmeasured.length ? '; UNMEASURED tech: ' + f.technical.unmeasured.join(',') : ''}); CAPEX ${f.economic.capex} (integration ${f.economic.integrationCost}); annual net saving ${f.economic.annualNetSaving}${f.economic.cycleTimeBased ? ' (from cycle-time×volume)' : f.economic.cycleTimeLabourSaving > 0 ? ` (cycle-time cross-check ${f.economic.cycleTimeLabourSaving})` : ''}; payback ${payback(f)} mo @ ${f.economic.shifts} shift(s), ≈${paybackSingleShift(f)} mo @ 1 shift${f.economic.withinThreshold ? '' : ' (over threshold)'}${f.drivers.measurementUncertain ? '; case UNMEASURED → pilot-gated' : ''}${f.drivers.volumeFalling ? '; volume FALLING' : ''}${f.drivers.highVariability ? '; high variability' : ''}${f.drivers.strategicOverride ? '; strategic pressure' : ''}${f.drivers.cobotChangeRisk ? '; cobot change-risk' : ''}`
    )
    .join('\n');

  const seqLines = sequence
    .map(
      (m) =>
        `${m.order}. [${m.verdict}] ${localize(m.title.pl, m.title.en, isPolish)} — rationale: ${localize(
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
    ? 'Działaj jako partner ds. automatyzacji przemysłowej i inwestycji (feasibility robotów/cobotów/AMR, ISO 10218/TS 15066, business case ROI/payback). Poniżej masz ugruntowaną na danych bazę portfela, per-operacyjne werdykty (technika PRZED ekonomią) i sekwencję ruchów W2. Dopracuj sformułowania i uzupełnij luki, ale NIE wymyślaj kwot CAPEX, payback ani operacji niepopartych danymi sesji.'
    : 'Act as an industrial-automation and investment partner (robot/cobot/AMR feasibility, ISO 10218/TS 15066, ROI/payback business case). Below is a data-grounded portfolio baseline, per-operation verdicts (technical BEFORE economic) and a W2 move sequence. Refine the wording and fill gaps, but do NOT invent CAPEX, payback or operations the session facts do not support.';

  const rules = isPolish
    ? [
        'Kolejność jest święta: NAJPIERW feasibility techniczna (powtarzalność I ustrukturyzowane środowisko I rozwiązywalny chwyt — koniunkcja, nie średnia), DOPIERO potem ekonomiczna. Nie licz ROI operacji, która nie przeszła bramki technicznej.',
        'CAPEX MUSI mieć jawną linię „integracja" (20-40% hardware\'u) i „bezpieczeństwo" — nie agreguj, bo to najczęstsza przyczyna zaniżonego payback.',
        `Próg decyzyjny: payback > ${PAYBACK_THRESHOLD_MONTHS} mies jest trudny do obronienia BEZ argumentu strategicznego (ergonomia, niedobór rąk, compliance).`,
        'Trend wolumenu waży więcej niż wolumen bieżący — malejący trend odradza CAPEX nawet przy dobrym payback.',
        'Wysoka zmienność produktu bez dominującego rdzenia wariantów → HYBRYDA lub NO-GO, nie GO. Hybryda to często optymalny wynik, nie porażka.',
        'Każdy ruch MUSI mieć: rationale, trade-off (co to kosztuje), wariant odrzucony (czego świadomie NIE robicie i dlaczego).',
        'Liczby (CAPEX, payback, oszczędność, %) wyłącznie z bazy powyżej — nie licz i nie zmyślaj.',
      ]
    : [
        'The order is sacred: FIRST technical feasibility (repeatability AND structured environment AND solvable grip — a conjunction, not an average), ONLY THEN economic. Do not price ROI on an operation that failed the technical gate.',
        'CAPEX MUST carry an explicit "integration" line (20-40% of hardware) and a "safety" line — do not aggregate, it is the top cause of understated payback.',
        `Decision threshold: payback > ${PAYBACK_THRESHOLD_MONTHS} months is hard to defend WITHOUT a strategic argument (ergonomics, labour shortage, compliance).`,
        'The volume trend outweighs current volume — a falling trend argues against the CAPEX even with a good payback.',
        'High product variability with no dominant variant core → HYBRID or NO-GO, not GO. A hybrid is often the optimal outcome, not a failure.',
        'Every move MUST carry: rationale, trade-off (what it costs), rejected variant (what you deliberately do NOT do and why).',
        'Numbers (CAPEX, payback, saving, %) come exclusively from the baseline above — do not compute or invent them.',
      ];

  const insightShapes = isPolish
    ? [
        '„Operacja X: payback Y mies przy 2 zmianach, przy 1 zmianie rośnie do ~Z mies" — przesuwa decyzję z „czy robotyzować" na „przy jakim trybie pracy się opłaca".',
        '„Operacja Y: ryzyko ergonomiczne (RSI, chroniczna rotacja) uzasadnia PILOT mimo payback ponad progiem — koszt rotacji nie jest w pełni policzony w P&L".',
        '„Zmienność produktu na operacji Z blokuje pełną automatyzację → HYBRYDA: robot bierze warianty wysokowolumenowe (rdzeń), reszta zostaje manualna".',
        '„Trend wolumenu na operacji W jest malejący — mimo dobrego payback odradzamy CAPEX: amortyzacja robota nie pokrywa się z prognozą wolumenu" (insight PRZECIW pozornie oczywistej rekomendacji).',
      ]
    : [
        '"Operation X: payback Y months at 2 shifts, rising to ~Z months at 1 shift" — moves the decision from "whether to robotize" to "under which work mode it pays off".',
        '"Operation Y: ergonomic risk (RSI, chronic turnover) justifies a PILOT despite payback over threshold — turnover cost is not fully counted in the P&L".',
        '"Product variability on operation Z blocks full automation → HYBRID: the robot takes the high-volume variants (core), the rest stays manual".',
        '"Volume trend on operation W is falling — despite a good payback we advise against the CAPEX: the robot\'s amortization does not match the volume forecast" (an insight AGAINST the seemingly obvious recommendation).',
    ];

  return `${header}

=== ROBOTICS PORTFOLIO BASELINE (facts — the only admissible source of amounts) ===
${baselineLine}

=== PER-OPERATION FEASIBILITY (technical gate BEFORE economic gate) ===
${opLines}

=== W2 MOVE SEQUENCE (grounded draft) ===
${seqLines}

Rules:
${rules.map((r) => `- ${r}`).join('\n')}

INSIGHT SHAPES (the tool exists FOR these — each insight must be answer-first and decision-shaped, in one of these forms):
${insightShapes.map((s) => `- ${s}`).join('\n')}

QUALITY BARS:
- Answer-first: "verdict" is a thesis about the go/no-go/pilot/hybrid decision, not a recap of inputs.
- Numbers exclusively from the facts above; do not compute or invent new ones.
- Zero filler and zero AI meta-phrases ("As an AI", "Based on the provided data", "In conclusion") — write like a partner signing the work with their name.
- Every sentence falsifiable: with opposite facts it would read differently.
- Map the grounded W2 sequence above into 3-5 "initiatives", preserving its order (order = priority).
- At least one insight must go AGAINST an obvious reading (e.g. good payback but falling volume = NO-GO), because that is the most valuable class of conclusion.
- Respond in ${isPolish ? 'Polish' : 'English'}, active voice, partner tone.

Return JSON:
{
  "summary": {
    "verdict": "answer-first, 1-2 sentences: the go/no-go/pilot/hybrid decision for the strongest operation and what makes it so",
    "executiveSummary": "3-4 sentences: restate the verdict, then why — anchored in the technical gate, CAPEX (with integration line) and payback above",
    "keyInsights": ["3 insights, each in an INSIGHT SHAPE above and tied to the facts"],
    "appliedConclusions": ["what to do first", "what NOT to do (name the operation and why)", "what to validate in a pilot next"],
    "tradeoffs": [{"chosen":"...","rejected":"...","why":"..."}],
    "expectedEffect": {"text":"labour/ergonomics/throughput effect, behaviorally observable","horizon":"..."}
  },
  "initiatives": [{"title":"...","description":"what to do + first step (verb + artifact + role)","type":"operational","estimatedImpact":"high|medium|low","estimatedEffort":"high|medium|low","rationale":"why — names the trade-off (chosen at the cost of what) and the rejected variant"}]
}`;
}

/**
 * Builds the deepening prompt for a single axis rung — used when the user asks AI
 * to "think deeper" on a specific robotics-feasibility input axis.
 */
export function buildRoboticsDeepenPrompt(
  axis: RoboticsAxisId,
  rungId: 'surface' | 'evidence' | 'quantification' | 'risk-capability',
  isPolish: boolean
): string | null {
  const rungs = localizeLadder(axis, isPolish);
  const rung = rungs.find((r) => r.id === rungId);
  if (!rung) return null;
  return `${rung.question}\n\n${isPolish ? 'Kontekst konsultanta' : 'Consultant framing'}: ${rung.rationale}`;
}

/**
 * Supply Chain Control Tower — conclusion prompt contract (CONCLUSION_LAYER_STANDARD W2).
 *
 * Bridges the deterministic synthesis engine (controlTowerEngine.ts) with the AI
 * runtime. The engine produces a grounded maturity diagnosis + blind-spot map +
 * detection-lag + risk-concentration + alert-fatigue baseline, a lever ranking
 * and a W2 move sequence; these builders turn that into a prompt so the model
 * refines wording and fills gaps WITHOUT inventing nodes, exceptions or numbers
 * the session does not support.
 *
 * INSIGHT-FIRST (doctrine §6): the product of a control tower is not "we have a
 * dashboard" but WHAT FOLLOWS for operational and strategic decisions — where the
 * chain is blind, by how many days a disruption is detected too late, and which
 * data silo is a recurring, structural delay that must become an initiative.
 *
 * Shape mirrors the shared tool conclusion contract (verdict / rationale /
 * tradeoffs / moves / expectedEffect) used by the Inventory/SMED prompts, so the
 * operational summary renderer consumes Control Tower output the same way.
 */

import {
  buildW2MoveSequence,
  computeBaseline,
  rankLevers,
  MATURITY_LABEL,
  type ControlTowerSession,
} from './controlTowerEngine';
import { localizeLadder } from './index';
import { type ControlTowerLeverId } from './deepeningLadder';

const localize = (pl: string, en: string, isPolish: boolean) => (isPolish ? pl : en);

/**
 * Grounded, INSIGHT-FIRST synthesis prompt: seeds the model with the engine's
 * maturity diagnosis, blind-spot map, detection lag, risk concentration and alert
 * fatigue, plus the scored levers and W2 sequence, so its output stays consistent
 * with the facts. Returns null when there is nothing to conclude on.
 */
export function buildControlTowerConclusionPrompt(
  session: ControlTowerSession,
  isPolish: boolean
): string | null {
  const ranking = rankLevers(session);
  if (ranking.ordered.length === 0) return null;

  const baseline = computeBaseline(session);
  const sequence = buildW2MoveSequence(session);

  const maturityLine = isPolish
    ? `Poziom dojrzałości (z faktów): ${baseline.maturityLevel} — ${MATURITY_LABEL[baseline.maturityLevel].pl}${
        baseline.declaredLevel && baseline.declaredLevel !== baseline.maturityLevel
          ? ` (organizacja deklaruje poziom ${baseline.declaredLevel} — luka rzeczywistości)`
          : ''
      }.`
    : `Maturity level (from facts): ${baseline.maturityLevel} — ${MATURITY_LABEL[baseline.maturityLevel].en}${
        baseline.declaredLevel && baseline.declaredLevel !== baseline.maturityLevel
          ? ` (the organization declares level ${baseline.declaredLevel} — a reality gap)`
          : ''
      }.`;

  const blindLine = isPolish
    ? `Widoczność: ${baseline.blindSpots.length}/${baseline.nodeCount} węzłów ślepych (${Math.round(baseline.blindShare * 100)}%), ekspozycja w martwych polach ${baseline.blindFlowValue} z ${baseline.totalFlowValue}. ${
        baseline.blindSpots.length > 0
          ? `Najdroższe martwe pola: ${baseline.blindSpots
              .slice(0, 3)
              .map((b) => `${b.id} (${b.kind}, ${b.flowValue}, ${b.severity})`)
              .join('; ')}.`
          : 'Brak martwych pól.'
      }`
    : `Visibility: ${baseline.blindSpots.length}/${baseline.nodeCount} blind nodes (${Math.round(baseline.blindShare * 100)}%), blind-spot exposure ${baseline.blindFlowValue} of ${baseline.totalFlowValue}. ${
        baseline.blindSpots.length > 0
          ? `Costliest blind spots: ${baseline.blindSpots
              .slice(0, 3)
              .map((b) => `${b.id} (${b.kind}, ${b.flowValue}, ${b.severity})`)
              .join('; ')}.`
          : 'No blind spots.'
      }`;

  const lagLine = isPolish
    ? `Detection lag: zakłócenie wykrywane średnio o ${baseline.avgDetectionLagHours}h za późno (najgorsze ${baseline.worstDetectionLagHours}h). Wolumen wyjątków: ${baseline.totalExceptionVolume}.`
    : `Detection lag: disruption detected on average ${baseline.avgDetectionLagHours}h too late (worst ${baseline.worstDetectionLagHours}h). Exception volume: ${baseline.totalExceptionVolume}.`;

  const concentrationLine = isPolish
    ? `Koncentracja ryzyka: ${Math.round(baseline.concentrationHeadShare * 100)}% wyjątków z ${Math.round(baseline.concentrationHeadSourceShare * 100)}% źródeł${
        baseline.riskConcentration[0]
          ? ` (czoło: „${baseline.riskConcentration[0].sourceId}" = ${Math.round(baseline.riskConcentration[0].share * 100)}%)`
          : ''
      }.`
    : `Risk concentration: ${Math.round(baseline.concentrationHeadShare * 100)}% of exceptions from ${Math.round(baseline.concentrationHeadSourceShare * 100)}% of sources${
        baseline.riskConcentration[0]
          ? ` (head: "${baseline.riskConcentration[0].sourceId}" = ${Math.round(baseline.riskConcentration[0].share * 100)}%)`
          : ''
      }.`;

  const fatigueLine = isPolish
    ? `Alert fatigue: ${Math.round(baseline.alertFatigueRatio * 100)}% alertów zamykanych bez akcji; ${Math.round(baseline.ungovernedExceptionShare * 100)}% wyjątków bez progu lub właściciela.`
    : `Alert fatigue: ${Math.round(baseline.alertFatigueRatio * 100)}% of alerts closed with no action; ${Math.round(baseline.ungovernedExceptionShare * 100)}% of exceptions without a threshold or owner.`;

  const scoreLines = ranking.scores
    .filter((s) => s.moveCount > 0)
    .map(
      (s) =>
        `- ${localize(s.label.pl, s.label.en, isPolish)}: fit ${s.score}/9 (attractiveness ${s.attractiveness} × feasibility ${s.feasibility}), ${s.exposureInScope} exposure in scope, ${s.evidenceBacked}/${s.moveCount} evidence-backed`
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
    ? 'Działaj jako partner ds. operacji łańcucha dostaw (Supply Chain Control Tower — widoczność end-to-end, model dojrzałości, zarządzanie wyjątkami). Poniżej masz ugruntowaną na danych diagnozę wieży, ranking dźwigni i sekwencję ruchów W2. Dopracuj sformułowania i uzupełnij luki, ale NIE wymyślaj węzłów, wyjątków ani liczb niepopartych danymi sesji. Pisz INSIGHT-FIRST: każdy wniosek kończy się inicjatywą transformacji operacyjnej, nie opisem dashboardu.'
    : 'Act as a supply-chain operations partner (Supply Chain Control Tower — end-to-end visibility, maturity model, exception management). Below is a data-grounded tower diagnosis, a lever ranking and a W2 move sequence. Refine the wording and fill gaps, but do NOT invent nodes, exceptions or numbers the session facts do not support. Write INSIGHT-FIRST: every conclusion ends in an operational-transformation initiative, not a description of a dashboard.';

  const rules = isPolish
    ? [
        'INSIGHT-FIRST: prowadź od wniosku, nie od danych. Wzorce: „łańcuch jest ślepy w segmencie X"; „zakłócenie typu Y wykrywane o Z dni za późno"; „silos danych między A a B = powtarzalne opóźnienie → inicjatywa".',
        'Control Tower NIE jest dashboardem: jeśli po alarmie nikt nie wie, kto reaguje w jakim czasie, to nie jest wieża. Każdy insight ma prowadzić do decyzji, nie do kolejnego ekranu.',
        'Trzymaj porządek: oświetl martwe pole → nadaj wyjątkom próg i właściciela → zaatakuj koncentrację ryzyka i alert fatigue → zaplanuj NAJBLIŻSZY opłacalny skok dojrzałości (zwykle 2→3, NIGDY od razu do 5 na brudnych danych).',
        'Każdy ruch MUSI mieć: rationale, trade-off (co to kosztuje), wariant odrzucony (czego świadomie NIE robicie i dlaczego).',
        'Liczby (martwe pola, detection lag, %, koncentracja) wyłącznie z bazy powyżej — nie licz i nie zmyślaj.',
        'Rozróżniaj przyczynę źródłową od objawu: opóźnienie u klienta (objaw) może mieć źródło 3 węzły wcześniej — nie każ gasić objawu tam, gdzie go widać.',
      ]
    : [
        'INSIGHT-FIRST: lead from the conclusion, not the data. Patterns: "the chain is blind in segment X"; "disruption type Y detected Z days too late"; "data silo between A and B = a recurring delay → initiative".',
        'A control tower is NOT a dashboard: if after an alarm no one knows who responds and in what time, it is not a tower. Every insight must lead to a decision, not to another screen.',
        'Keep order: light the blind spot → give exceptions a threshold and owner → attack risk concentration and alert fatigue → plan the NEAREST payable maturity jump (usually 2→3, NEVER straight to 5 on dirty data).',
        'Every move MUST carry: rationale, trade-off (what it costs), rejected variant (what you deliberately do NOT do and why).',
        'Numbers (blind spots, detection lag, %, concentration) come exclusively from the baseline above — do not compute or invent them.',
        'Separate root cause from symptom: a delay at the customer (symptom) may originate 3 nodes earlier — do not fight the symptom where it shows.',
      ];

  return `${header}

=== CONTROL TOWER DIAGNOSIS (facts — the only admissible source of numbers) ===
${maturityLine}
${blindLine}
${lagLine}
${concentrationLine}
${fatigueLine}

=== SCORED CONTROL-TOWER LEVERS ===
${scoreLines}

=== W2 MOVE SEQUENCE (grounded draft — nearest payable maturity step) ===
${seqLines}

Rules:
${rules.map((r) => `- ${r}`).join('\n')}

QUALITY BARS:
- Insight-first: "verdict" is a thesis about where the chain is blind / how late disruption is caught, not a recap of the inputs.
- Numbers exclusively from the facts above; do not compute or invent new ones.
- Zero filler and zero AI meta-phrases ("As an AI", "Based on the provided data", "In conclusion") — write like a partner signing the work with their name.
- Every sentence falsifiable: with opposite facts it would read differently.
- Map the grounded W2 sequence above into 3-5 "initiatives", preserving its order (order = priority); each initiative is an operational-transformation move (integrate node X, redesign threshold Y, renegotiate SLA with source Z), not a report.
- Respond in ${isPolish ? 'Polish' : 'English'}, active voice, partner tone.

Return JSON:
{
  "summary": {
    "verdict": "insight-first, 1-2 sentences: where the chain is blind / how late disruption is detected and what it means for the operational decision",
    "executiveSummary": "3-4 sentences: restate the verdict, then why — anchored in the maturity level, blind-spot exposure and detection lag above",
    "keyInsights": ["3 insights, each tied to the facts above — blind spot / detection lag / risk concentration / alert fatigue / maturity gap"],
    "appliedConclusions": ["what to do first", "what NOT to do", "what to validate next"],
    "tradeoffs": [{"chosen":"...","rejected":"...","why":"..."}],
    "expectedEffect": {"text":"detection-lag reduction / OTIF or penalty change / maturity-level jump, behaviorally observable","horizon":"..."}
  },
  "initiatives": [{"title":"...","description":"what to do + first step (verb + artifact + role)","type":"operational","estimatedImpact":"high|medium|low","estimatedEffort":"high|medium|low","rationale":"why — names the trade-off (chosen at the cost of what) and the rejected variant"}]
}`;
}

/**
 * Builds the deepening prompt for a single lever rung — used when the user asks
 * AI to "think deeper" on a specific control-tower lever.
 */
export function buildControlTowerDeepenPrompt(
  lever: ControlTowerLeverId,
  rungId: 'surface' | 'evidence' | 'quantification' | 'risk-capability',
  isPolish: boolean
): string | null {
  const rungs = localizeLadder(lever, isPolish);
  const rung = rungs.find((r) => r.id === rungId);
  if (!rung) return null;
  return `${rung.question}\n\n${isPolish ? 'Kontekst konsultanta' : 'Consultant framing'}: ${rung.rationale}`;
}

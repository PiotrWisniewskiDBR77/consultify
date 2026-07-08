/**
 * Integration Diagnostic — conclusion prompt contract (CONCLUSION_LAYER_STANDARD W2).
 *
 * Bridges the deterministic synthesis engine (integrationEngine.ts) with the AI
 * runtime. The engine produces a grounded topology/re-keying baseline + lever
 * ranking + W2 move sequence; these builders turn that into a prompt so the model
 * refines wording and fills gaps WITHOUT inventing systems, integrations or FTE
 * facts the session does not support.
 *
 * INSIGHT-FIRST: the core product of this tool is not a topology diagram, it is
 * the sentences that lead straight to integration initiatives — "N manual
 * bridges = M FTE-hours/mo + error risk", "system X is a hub for 12 integrations
 * = fragility", "no API-first blocks scaling". The prompt's quality bars enforce
 * exactly that shape.
 *
 * Shape mirrors the shared tool conclusion contract (verdict / rationale /
 * tradeoffs / moves / expectedEffect) used by the SMED/Inventory prompts, so the
 * operational summary renderer consumes Integration output the same way.
 */

import {
  buildW2MoveSequence,
  computeBaseline,
  rankLevers,
  MULESOFT_INTEGRATED_BENCHMARK,
  type IntegrationSession,
} from './integrationEngine';
import { localizeLadder } from './index';
import { type IntegrationLeverId } from './deepeningLadder';

const localize = (pl: string, en: string, isPolish: boolean) => (isPolish ? pl : en);

/**
 * Grounded synthesis prompt: seeds the model with the engine's topology/re-keying
 * baseline, lever ranking and W2 sequence so its output stays consistent with the
 * scored facts. Returns null when there is nothing to conclude on.
 */
export function buildIntegrationConclusionPrompt(
  session: IntegrationSession,
  isPolish: boolean
): string | null {
  const ranking = rankLevers(session);
  if (ranking.ordered.length === 0) return null;

  const baseline = computeBaseline(session);
  const sequence = buildW2MoveSequence(session);

  const benchmarkPct = Math.round(MULESOFT_INTEGRATED_BENCHMARK * 100);

  const baselineLine = isPolish
    ? `Baza integracji: ${baseline.systemCount} systemów, ${baseline.integrationCount} realnych integracji, ${baseline.manualBridgeCount} ręcznych mostków. Point-to-point: ${Math.round(baseline.pointToPointShare * 100)}% (${baseline.pointToPointCount} połączeń); pełna siatka n(n-1)/2 = ${baseline.fullMeshPotential}, cel hub (n) = ${baseline.hubTargetConnections}. Realnie zintegrowanych systemów: ${Math.round(baseline.integratedShare * 100)}% (benchmark MuleSoft ~${benchmarkPct}%). Hub: system o ${baseline.hubDegree} integracjach${baseline.hubUnowned ? ' bez formalnego właściciela (SPOF)' : ''}. Rekeying: ${baseline.rekeyingHoursPerYear} h/rok (~${baseline.rekeyingFte} FTE), koszt błędów 1-10-100 = ${baseline.rekeyingErrorCostUnits} jednostek. Udokumentowane ${baseline.documentedCount}/${baseline.integrationCount}, monitorowane ${baseline.monitoredCount}/${baseline.integrationCount}, krytyczne SPOF: ${baseline.criticalSpofCount}, reużycie API: ${baseline.reuseCount}. Dojrzałość: ${baseline.maturityLevel}/5 (Gartner).`
    : `Integration baseline: ${baseline.systemCount} systems, ${baseline.integrationCount} real integrations, ${baseline.manualBridgeCount} manual bridges. Point-to-point: ${Math.round(baseline.pointToPointShare * 100)}% (${baseline.pointToPointCount} links); full mesh n(n-1)/2 = ${baseline.fullMeshPotential}, hub target (n) = ${baseline.hubTargetConnections}. Really-integrated systems: ${Math.round(baseline.integratedShare * 100)}% (MuleSoft benchmark ~${benchmarkPct}%). Hub: system with ${baseline.hubDegree} integrations${baseline.hubUnowned ? ' with no formal owner (SPOF)' : ''}. Re-keying: ${baseline.rekeyingHoursPerYear} h/yr (~${baseline.rekeyingFte} FTE), 1-10-100 error cost = ${baseline.rekeyingErrorCostUnits} units. Documented ${baseline.documentedCount}/${baseline.integrationCount}, monitored ${baseline.monitoredCount}/${baseline.integrationCount}, critical SPOF: ${baseline.criticalSpofCount}, API reuse: ${baseline.reuseCount}. Maturity: ${baseline.maturityLevel}/5 (Gartner).`;

  const scoreLines = ranking.scores
    .filter((s) => s.moveCount > 0)
    .map(
      (s) =>
        `- ${localize(s.label.pl, s.label.en, isPolish)}: fit ${s.score}/9 (attractiveness ${s.attractiveness} × feasibility ${s.feasibility}), scope ${s.scopeSize}, ${s.evidenceBacked}/${s.moveCount} evidence-backed`
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
    ? 'Działaj jako partner ds. architektury integracji i transformacji cyfrowej (dojrzałość integracji wg Gartnera, API-led connectivity MuleSoft, topologia point-to-point vs hub, koszt jakości danych 1-10-100). Poniżej masz ugruntowaną na danych bazę topologii i rekeyingu, ranking dźwigni i sekwencję ruchów W2. Dopracuj sformułowania i uzupełnij luki, ale NIE wymyślaj systemów, integracji ani godzin FTE niepopartych danymi sesji.'
    : 'Act as an integration-architecture and digital-transformation partner (Gartner integration maturity, MuleSoft API-led connectivity, point-to-point vs hub topology, 1-10-100 data-quality cost). Below is a data-grounded topology and re-keying baseline, a lever ranking and a W2 move sequence. Refine the wording and fill gaps, but do NOT invent systems, integrations or FTE-hours the session facts do not support.';

  const rules = isPolish
    ? [
        'Każdy ruch MUSI mieć: rationale, trade-off (co to kosztuje), wariant odrzucony (czego świadomie NIE robicie i dlaczego).',
        'Trzymaj porządek zależności: inwentarz → topologia/hub (SPOF) → automatyzacja mostków (quick win) → warstwa API-first (System→Process→Experience). Nie kupuj platformy przed inwentarzem; nie buduj Process API zanim istnieje System API.',
        'Liczby (systemy, integracje, %, FTE-godziny, n(n-1)/2, jednostki 1-10-100) wyłącznie z bazy powyżej — nie licz i nie zmyślaj.',
        'Nie stawiaj celu „zintegruj wszystko": właściwe pytanie to które 10-15% integracji odblokowuje 80% wartości.',
        'Ręczne przepisywanie danych = brakująca integracja (dowód, nie hipoteza); pojedynczy punkt awarii bez właściciela to cichy najwyższy priorytet nawet bez historii awarii.',
      ]
    : [
        'Every move MUST carry: rationale, trade-off (what it costs), rejected variant (what you deliberately do NOT do and why).',
        'Keep the dependency order: inventory → topology/hub (SPOF) → bridge automation (quick win) → API-first layer (System→Process→Experience). Do not buy a platform before the inventory; do not build a Process API before a System API exists.',
        'Numbers (systems, integrations, %, FTE-hours, n(n-1)/2, 1-10-100 units) come exclusively from the baseline above — do not compute or invent them.',
        'Do not set "integrate everything" as the goal: the right question is which 10-15% of integrations unlocks 80% of the value.',
        'Manual re-keying = a missing integration (proof, not hypothesis); a single point of failure with no owner is the silent top priority even without a failure history.',
      ];

  return `${header}

=== INTEGRATION BASELINE (facts — the only admissible source of numbers) ===
${baselineLine}

=== SCORED INTEGRATION LEVERS ===
${scoreLines}

=== W2 MOVE SEQUENCE (grounded draft) ===
${seqLines}

Rules:
${rules.map((r) => `- ${r}`).join('\n')}

QUALITY BARS:
- Insight-first: every "keyInsight" is a decision-grade sentence with a number, not a description of the topology. E.g. "N manual bridges = M FTE-hours/mo + error risk on order→invoice", "system X is a hub for 12 integrations with no owner = fragility", "no API-first blocks scaling: connecting a new channel takes half a year".
- Answer-first: "verdict" is a thesis about the integration decision, not a recap of the inputs.
- Numbers exclusively from the facts above; do not compute or invent new ones.
- Zero filler and zero AI meta-phrases ("As an AI", "Based on the provided data", "In conclusion") — write like a partner signing the work with their name.
- Every sentence falsifiable: with opposite facts it would read differently.
- Map the grounded W2 sequence above into 3-5 "initiatives", preserving its order (order = priority).
- Respond in ${isPolish ? 'Polish' : 'English'}, active voice, partner tone.

Return JSON:
{
  "summary": {
    "verdict": "answer-first, 1-2 sentences: what this integration diagnosis means for the transformation / scaling decision",
    "executiveSummary": "3-4 sentences: restate the verdict, then why — anchored in the topology, re-keying and maturity facts above",
    "keyInsights": ["3 insight-first sentences, each with a number tied to the facts above (manual bridges = FTE-h + risk / hub = fragility / point-to-point % or integrated % vs benchmark)"],
    "appliedConclusions": ["what to do first", "what NOT to do (do not integrate everything / do not buy a platform first)", "what to validate next"],
    "tradeoffs": [{"chosen":"...","rejected":"...","why":"..."}],
    "expectedEffect": {"text":"FTE-hours released / risk removed / time-to-connect reduced, behaviorally observable","horizon":"..."}
  },
  "initiatives": [{"title":"...","description":"what to do + first step (verb + artifact + role)","type":"operational","estimatedImpact":"high|medium|low","estimatedEffort":"high|medium|low","rationale":"why — names the trade-off (chosen at the cost of what) and the rejected variant"}]
}`;
}

/**
 * Builds the deepening prompt for a single lever rung — used when the user asks
 * AI to "think deeper" on a specific integration lever.
 */
export function buildIntegrationDeepenPrompt(
  lever: IntegrationLeverId,
  rungId: 'surface' | 'evidence' | 'quantification' | 'risk-capability',
  isPolish: boolean
): string | null {
  const rungs = localizeLadder(lever, isPolish);
  const rung = rungs.find((r) => r.id === rungId);
  if (!rung) return null;
  return `${rung.question}\n\n${isPolish ? 'Kontekst konsultanta' : 'Consultant framing'}: ${rung.rationale}`;
}

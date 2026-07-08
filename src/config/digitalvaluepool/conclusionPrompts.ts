/**
 * Digital Value Pool — conclusion prompt contract (CONCLUSION_LAYER_STANDARD W2).
 *
 * Bridges the deterministic synthesis engine (valuePoolEngine.ts) with the AI
 * runtime. The engine produces a grounded baseline (top-down vs bottom-up value-
 * at-stake) + priority matrix + 80/20 concentration + dead fields + a W2 roadmap;
 * these builders turn that into an INSIGHT-FIRST prompt so the model refines
 * wording and fills gaps WITHOUT inventing pools, functions or amounts the
 * session does not support.
 *
 * Shape mirrors the shared tool conclusion contract (verdict / rationale /
 * tradeoffs / initiatives / expectedEffect) used by the SMED/Inventory prompts,
 * so the operational summary renderer consumes value-pool output the same way.
 *
 * Doctrine SSOT: Harvard/wdrozenie-100/_TOOLS_DOKTRYNA/digital-value-pool.md
 */

import {
  buildRoadmap,
  buildPriorityMatrix,
  computeBaseline,
  detectConcentration,
  detectDeadFields,
  type ValuePoolSession,
} from './valuePoolEngine';
import { localizeLadder } from './index';
import { type ValuePoolPhaseId } from './deepeningLadder';

const localize = (pl: string, en: string, isPolish: boolean) => (isPolish ? pl : en);
const pct = (v: number) => `${Math.round(v * 100)}%`;

/**
 * Grounded, INSIGHT-FIRST synthesis prompt: seeds the model with the engine's
 * value-at-stake baseline, the 80/20 concentration, the priority matrix (incl.
 * the "pilot without scale" flags), the dead fields and the W2 roadmap so its
 * output stays consistent with the scored facts and LEADS with the decision
 * insight, not a recap. Returns null when there is nothing to conclude on.
 */
export function buildValuePoolConclusionPrompt(
  session: ValuePoolSession,
  isPolish: boolean
): string | null {
  const baseline = computeBaseline(session);
  const matrix = buildPriorityMatrix(session);
  const concentration = detectConcentration(session);
  const deadFields = detectDeadFields(session);
  const roadmap = buildRoadmap(session);

  if (baseline.pools.every((p) => p.valueAtStake === 0) && matrix.scored.length === 0) {
    return null;
  }

  const baselineLine = isPolish
    ? `Baza puli: top-down value-at-stake ${baseline.topDownTotal} łącznie; bottom-up (suma use-case'ów) ${baseline.bottomUpTotal}; rozbieżność bottom-up/top-down = ${baseline.divergenceRatio} (${pct(baseline.divergenceRatio)}); koncentracja top-2 funkcji = ${pct(baseline.top2Concentration)}; funkcji istotnych: ${baseline.materialFunctionCount}; zmierzone ${pct(baseline.measuredRatio)} funkcji.`
    : `Pool baseline: top-down value-at-stake ${baseline.topDownTotal} total; bottom-up (sum of use-cases) ${baseline.bottomUpTotal}; divergence bottom-up/top-down = ${baseline.divergenceRatio} (${pct(baseline.divergenceRatio)}); top-2 function concentration = ${pct(baseline.top2Concentration)}; material functions: ${baseline.materialFunctionCount}; ${pct(baseline.measuredRatio)} of functions measured.`;

  const poolLines = baseline.pools
    .filter((p) => p.valueAtStake > 0)
    .map(
      (p) =>
        `- ${p.name} [${p.side}]: value-at-stake ${p.valueAtStake} (${pct(p.share)} of pool), base ${p.base} × benchmark ${pct(p.benchmarkShare)}, bottom-up ${p.bottomUp}, ${p.useCaseCount} use-case(s)`
    )
    .join('\n');

  const matrixLines = matrix.scored
    .map(
      (s) =>
        `- ${s.id}${s.functionId ? ` (fn:${s.functionId})` : ''}: impact ${s.impact} × feasibility ${s.feasibility} = ${s.score}/9 → ${s.quadrant}${s.gate.pilotWithoutScale ? ' [PILOT-WITHOUT-SCALE]' : ''}${s.gate.blockers.length ? ` blockers:[${s.gate.blockers.join(',')}]` : ''}`
    )
    .join('\n');

  const concentrationLine = localize(
    concentration.rationale.pl,
    concentration.rationale.en,
    isPolish
  );

  const deadLines =
    deadFields.length > 0
      ? deadFields.map((d) => `- ${localize(d.reason.pl, d.reason.en, isPolish)}`).join('\n')
      : isPolish
        ? '- (brak martwych pól — każda istotna funkcja ma co najmniej jeden use-case)'
        : '- (no dead fields — every material function has at least one use-case)';

  const roadmapLines = roadmap
    .map(
      (m) =>
        `${m.order}. [${m.wave}] ${localize(m.title.pl, m.title.en, isPolish)} — rationale: ${localize(
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
    ? 'Działaj jako partner ds. strategii cyfrowej / AI (McKinsey value-at-stake, BCG digital value gap). Poniżej masz ugruntowaną na danych dekompozycję puli wartości, macierz priorytetów, koncentrację 80/20, martwe pola i sekwencję ruchów W2. Dopracuj sformułowania i uzupełnij luki, ale NIE wymyślaj funkcji, use-case\'ów ani kwot niepopartych danymi sesji. Odpowiadaj konkluzją NAJPIERW (insight), nie streszczeniem inputów.'
    : 'Act as a digital/AI strategy partner (McKinsey value-at-stake, BCG digital value gap). Below is a data-grounded value-pool decomposition, a priority matrix, the 80/20 concentration, dead fields and a W2 move sequence. Refine the wording and fill gaps, but do NOT invent functions, use-cases or amounts the session facts do not support. Answer with the CONCLUSION FIRST (the insight), not a recap of the inputs.';

  const insightExemplars = isPolish
    ? [
        'Koncentracja: „80% wartości leży w funkcji X, a budżet inicjatyw jest rozłożony odwrotnie" → realokacja.',
        'Feasibility-gate: „use-case Y ma wysoki impact, ale niską feasibility skalowania (brak właściciela/danych) = odłóż, zbuduj fundament, nie skaluj pilotu".',
        'Martwe pole: „nikt nie patrzy na funkcję Z, choć benchmark widzi tam pulę = zbadać, bo brakująca pula to najcenniejszy insight".',
        'Rozbieżność: „top-down o rząd wielkości większy niż bottom-up = albo linie biznesowe nie widzą swojego bólu, albo zarząd żyje w niepasującym benchmarku".',
      ]
    : [
        'Concentration: "80% of value sits in function X, while the initiative budget is allocated inversely" → reallocate.',
        'Feasibility-gate: "use-case Y is high impact but low feasibility to scale (no owner/data) = defer, build the foundation, do not scale the pilot".',
        'Dead field: "nobody is looking at function Z, though the benchmark sees a pool there = investigate, a missing pool is the most valuable insight".',
        'Divergence: "top-down is an order of magnitude above bottom-up = either the business lines do not see their pain, or the board lives in a benchmark that does not fit".',
      ];

  const rules = isPolish
    ? [
        'INSIGHT-FIRST: „verdict" to teza o decyzji (gdzie skierować pierwszy dolar i czego NIE robić), nie streszczenie inputów.',
        'Każdy ruch/inicjatywa MUSI mieć: rationale, trade-off (co to kosztuje), wariant odrzucony (czego świadomie NIE robicie i dlaczego).',
        'Trzymaj porządek: dekompozycja → skwantyfikuj (top-down + bottom-up) → priorytetyzuj (impact × feasibility) → sekwencjonuj (quick win → fundament → duże obstawienie → no-go).',
        'Feasibility techniczna wysoka NIE promuje use-case\'u sama — jeśli feasibility SKALOWANIA jest zablokowana (dane/właściciel/mandat/metryka adopcyjna), nazwij go „pilotem bez skali" i zbuduj fundament, nie skaluj.',
        'Liczby (value-at-stake, %, koncentracja, rozbieżność) wyłącznie z bazy powyżej — nie licz i nie zmyślaj.',
        'Jawnie nazwij martwe pola (funkcje z pulą, ale bez use-case\'u) i jawnie odrzuć ćwiartkę no-go, żeby nie wracała co kwartał.',
      ]
    : [
        'INSIGHT-FIRST: "verdict" is a thesis about the decision (where the first dollar goes and what NOT to do), not a recap of the inputs.',
        'Every move/initiative MUST carry: rationale, trade-off (what it costs), rejected variant (what you deliberately do NOT do and why).',
        'Keep order: decompose → size (top-down + bottom-up) → prioritize (impact × feasibility) → sequence (quick win → foundation → big bet → no-go).',
        'High technical feasibility does NOT promote a use-case by itself — if feasibility to SCALE is blocked (data/owner/mandate/adoption-only metric), name it a "pilot without scale" and build the foundation, do not scale.',
        'Numbers (value-at-stake, %, concentration, divergence) come exclusively from the baseline above — do not compute or invent them.',
        'Explicitly name dead fields (functions with a pool but no use-case) and explicitly reject the no-go quadrant so it does not return every quarter.',
      ];

  return `${header}

=== VALUE-POOL BASELINE (facts — the only admissible source of amounts) ===
${baselineLine}

=== VALUE-AT-STAKE PER FUNCTION (top-down vs bottom-up) ===
${poolLines || '(no function pools)'}

=== 80/20 CONCENTRATION ===
${concentrationLine}

=== PRIORITY MATRIX (impact × feasibility, gate flags) ===
${matrixLines || '(no use-cases scored)'}

=== DEAD FIELDS (pool present, zero use-cases) ===
${deadLines}

=== W2 ROADMAP (grounded draft) ===
${roadmapLines || '(no roadmap)'}

Insight exemplars (shape only — use the FACTS above, not these numbers):
${insightExemplars.map((e) => `- ${e}`).join('\n')}

Rules:
${rules.map((r) => `- ${r}`).join('\n')}

QUALITY BARS:
- Answer-first: "verdict" is the decision thesis, not a summary of the inputs.
- Numbers exclusively from the facts above; do not compute or invent new ones.
- Zero filler and zero AI meta-phrases ("As an AI", "Based on the provided data", "In conclusion") — write like a partner signing the work with their name.
- Every sentence falsifiable: with opposite facts it would read differently.
- Map the grounded W2 roadmap above into 3-5 "initiatives", preserving its order (order = priority).
- Respond in ${isPolish ? 'Polish' : 'English'}, active voice, partner tone.

Return JSON:
{
  "summary": {
    "verdict": "answer-first, 1-2 sentences: where the first transformation dollar goes and what NOT to fund, grounded in the concentration + gate above",
    "executiveSummary": "3-4 sentences: restate the verdict, then why — anchored in the value-at-stake, the 80/20 concentration and the priority matrix above",
    "keyInsights": ["3 insights, insight-first, each tied to the facts above (concentration / feasibility-gate / dead field / divergence)"],
    "appliedConclusions": ["what to fund first", "what NOT to fund / what to defer behind a data-or-owner foundation", "which dead field to investigate next"],
    "tradeoffs": [{"chosen":"...","rejected":"...","why":"..."}],
    "expectedEffect": {"text":"P&L-visible value capture / reallocation, behaviorally observable","horizon":"..."}
  },
  "initiatives": [{"title":"...","description":"what to do + first step (verb + artifact + role)","type":"strategic","estimatedImpact":"high|medium|low","estimatedEffort":"high|medium|low","rationale":"why — names the trade-off (chosen at the cost of what) and the rejected variant"}]
}`;
}

/**
 * Builds the deepening prompt for a single phase rung — used when the user asks
 * AI to "think deeper" on a specific value-pool phase.
 */
export function buildValuePoolDeepenPrompt(
  phase: ValuePoolPhaseId,
  rungId: 'surface' | 'evidence' | 'quantification' | 'risk-capability',
  isPolish: boolean
): string | null {
  const rungs = localizeLadder(phase, isPolish);
  const rung = rungs.find((r) => r.id === rungId);
  if (!rung) return null;
  return `${rung.question}\n\n${isPolish ? 'Kontekst konsultanta' : 'Consultant framing'}: ${rung.rationale}`;
}

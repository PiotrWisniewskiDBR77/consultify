/**
 * Legacy Analyzer — conclusion prompt contract (CONCLUSION_LAYER_STANDARD W2).
 *
 * Bridges the deterministic synthesis engine (legacyEngine.ts) with the AI
 * runtime. The engine produces a grounded portfolio score + per-app TIME/6R
 * verdicts + a dependency-sequenced roadmap; these builders turn that into a
 * prompt so the model refines wording and fills gaps WITHOUT inventing systems,
 * TCO figures or dependencies the session does not support.
 *
 * INSIGHT-FIRST: the prompt is seeded with the doctrine's signature insight
 * shapes — "system X: high value + low health = urgent migration before support
 * ends in N months", "30% of the IT budget in apps to eliminate", "a hidden
 * dependency turns ELIMINATE into MIGRATE" — so the model's output leads with a
 * decision, not a classification table.
 *
 * Shape mirrors the shared tool conclusion contract (verdict / rationale /
 * tradeoffs / initiatives / expectedEffect) used across tools, so the
 * operational summary renderer consumes Legacy output the same way.
 */

import {
  buildRoadmap,
  scorePortfolio,
  synthesizeLegacyPlan,
  type AppVerdict,
  type LegacySession,
  type PortfolioScore,
  type RoadmapItem,
} from './legacyEngine';
import { localizeLadder } from './index';
import {
  LEGACY_PROPOSAL_BANK,
  legacyDimensionLabel,
  type LegacyDimensionId,
} from './deepeningLadder';

const localize = (pl: string, en: string, isPolish: boolean) => (isPolish ? pl : en);
const pct = (ratio: number) => `${Math.round(ratio * 100)}%`;

/**
 * Assemble the INSIGHT-FIRST lines the doctrine (§6) treats as the product of
 * the tool — not the classification table but the sentences that lead straight
 * to a decision. Grounded strictly in the engine's numbers.
 */
function buildInsights(
  verdicts: AppVerdict[],
  score: PortfolioScore,
  roadmap: RoadmapItem[],
  isPolish: boolean
): string[] {
  const insights: string[] = [];

  // 1. High value + low health + a hard support deadline = urgent migration.
  const urgentMigrate = verdicts
    .filter((v) => v.decision === 'MIGRATE' && !v.dependencyOverride)
    .sort((a, b) => a.risk.index - b.risk.index)
    .reverse()[0];
  if (urgentMigrate) {
    insights.push(
      localize(
        `${urgentMigrate.name}: wysoka wartość biznesowa + niska kondycja techniczna = pilna migracja (kwadrant MIGRATE, strategia ${urgentMigrate.sixR}); deadline twardy przed końcem wsparcia, nie ogólne „kiedyś".`,
        `${urgentMigrate.name}: high business value + low technical health = urgent migration (MIGRATE quadrant, ${urgentMigrate.sixR} strategy); a hard deadline before support ends, not a general "someday".`,
        isPolish
      )
    );
  }

  // 2. Share of the IT budget trapped in low-value legacy — the reallocation lever.
  if (score.reallocatableShare > 0) {
    insights.push(
      localize(
        `${pct(score.reallocatableShare)} budżetu IT idzie w aplikacje o niskiej wartości sklasyfikowane ELIMINATE/MIGRATE — realokacja tego budżetu do kwadrantu INVEST to największa pojedyncza dźwignia oszczędności w tym roku.`,
        `${pct(score.reallocatableShare)} of the IT budget goes to low-value applications classified ELIMINATE/MIGRATE — reallocating it to the INVEST quadrant is the single largest saving lever this year.`,
        isPolish
      )
    );
  }

  // 3. A hidden dependency turned ELIMINATE into MIGRATE.
  const lifted = verdicts.find((v) => v.dependencyOverride);
  if (lifted) {
    insights.push(
      localize(
        `Ukryta zależność: ${lifted.name} był kandydatem do wygaszenia, ale jest węzłem integracyjnym dla ${lifted.inDegree} innych systemów — bez planu zastąpienia integracji wygaszenie zablokuje te systemy. To podnosi ${lifted.name} z ELIMINATE do MIGRATE (Refactor) z sekwencją: najpierw nowa integracja, potem wygaszenie.`,
        `Hidden dependency: ${lifted.name} was a retirement candidate, but it is the integration node for ${lifted.inDegree} other systems — without a plan to replace the integration, retirement blocks them. This lifts ${lifted.name} from ELIMINATE to MIGRATE (Refactor) with the sequence: new integration first, retirement second.`,
        isPolish
      )
    );
  }

  // 4. Bus factor as a leading indicator, above what TCO shows.
  const busRisk = verdicts.find((v) => v.risk.singlePointOfKnowledge || v.risk.busFactorFalling);
  if (busRisk) {
    insights.push(
      localize(
        `Bus factor w systemie ${busRisk.name}: ${busRisk.risk.singlePointOfKnowledge ? 'jedyna osoba znająca kod' : 'malejąca liczba osób'} — ryzyko operacyjne wyższe, niż wynika z samej kondycji technicznej; podnieś priorytet niezależnie od pozycji w macierzy TIME (bus factor to wskaźnik wyprzedzający, nie opisowy).`,
        `Bus factor in ${busRisk.name}: ${busRisk.risk.singlePointOfKnowledge ? 'a single person knows the code' : 'a falling headcount'} — operational risk higher than technical health alone implies; raise priority regardless of TIME position (bus factor is a leading, not descriptive, indicator).`,
        isPolish
      )
    );
  }

  // 5. Portfolio debt vs the McKinsey benchmark.
  if (score.debtShareOfBudget > 0) {
    insights.push(
      localize(
        `Dług technologiczny portfela = ${pct(score.debtShareOfBudget)} budżetu IT${score.aboveBenchmark ? ', powyżej górnej granicy benchmarku branżowego (McKinsey: 20-40% typowe)' : ' (w paśmie benchmarku McKinsey 20-40%)'} → uzasadnienie dla dedykowanego, wydzielonego budżetu modernizacji, nie finansowania z projektów bieżących.`,
        `Portfolio tech debt = ${pct(score.debtShareOfBudget)} of the IT budget${score.aboveBenchmark ? ', above the upper industry benchmark (McKinsey: 20-40% typical)' : ' (within the McKinsey 20-40% band)'} → justification for a dedicated, ring-fenced modernization budget, not funding from current projects.`,
        isPolish
      )
    );
  }

  // 6. Function duplication → consolidation.
  const dup = verdicts.find((v) => v.decision === 'ELIMINATE' && v.sixR === 'retire');
  if (dup) {
    insights.push(
      localize(
        `Duplikacja funkcji wokół ${dup.name} — konsolidacja do jednego systemu (Repurchase/SaaS lub istniejący system) redukuje TCO i eliminuje rozjazd danych między systemami; kandydat do wygaszenia po planie migracji danych, nie z dnia na dzień.`,
        `Function duplication around ${dup.name} — consolidating to one system (Repurchase/SaaS or an existing system) cuts TCO and eliminates data drift between systems; a retirement candidate after a data-migration plan, not overnight.`,
        isPolish
      )
    );
  }

  return insights;
}

/**
 * Grounded synthesis prompt: seeds the model with the engine's portfolio score,
 * TIME/6R verdicts, dependency-sequenced roadmap and the doctrine's insight
 * shapes so its output stays consistent with the scored facts. Returns null
 * when there is nothing to conclude on (no applications).
 */
export function buildLegacyConclusionPrompt(
  session: LegacySession,
  isPolish: boolean
): string | null {
  if (!session.apps || session.apps.length === 0) return null;

  const { verdicts, score, roadmap } = synthesizeLegacyPlan(session);

  const baselineLine = isPolish
    ? `Portfel: ${score.appCount} aplikacji; TCO łącznie ${score.totalTco}/rok; ${score.legacyTco} uwięzione w ELIMINATE/MIGRATE (${pct(score.debtShareOfBudget)} budżetu IT); ${score.lowValueLegacyTco} w aplikacjach niskowartościowych (${pct(score.reallocatableShare)} budżetu, do realokacji); dług estate ${pct(score.estateDebtRatio)}; ${score.highRiskCount} aplikacji z ≥2 sygnałami ryzyka; ${score.busFactorFallingCount} z malejącym bus factor. Decyzje TIME: INVEST ${score.decisionCounts.INVEST}, MIGRATE ${score.decisionCounts.MIGRATE}, TOLERATE ${score.decisionCounts.TOLERATE}, ELIMINATE ${score.decisionCounts.ELIMINATE}.`
    : `Portfolio: ${score.appCount} applications; total TCO ${score.totalTco}/yr; ${score.legacyTco} trapped in ELIMINATE/MIGRATE (${pct(score.debtShareOfBudget)} of the IT budget); ${score.lowValueLegacyTco} in low-value apps (${pct(score.reallocatableShare)} of budget, reallocatable); estate debt ${pct(score.estateDebtRatio)}; ${score.highRiskCount} apps with ≥2 risk signals; ${score.busFactorFallingCount} with a falling bus factor. TIME decisions: INVEST ${score.decisionCounts.INVEST}, MIGRATE ${score.decisionCounts.MIGRATE}, TOLERATE ${score.decisionCounts.TOLERATE}, ELIMINATE ${score.decisionCounts.ELIMINATE}.`;

  const verdictLines = verdicts
    .map(
      (v) =>
        `- ${v.name}: ${v.decision}${v.dependencyOverride ? ' (podniesione z ELIMINATE przez zależność / lifted from ELIMINATE by dependency)' : ''} / 6R:${v.sixR} — TCO ${v.tcoPerYear}, dług ${pct(v.debt.debtRatio)}, ryzyko ${v.risk.index}, in-degree ${v.inDegree}, bus ${v.risk.singlePointOfKnowledge ? '≤1' : 'ok'}${v.risk.busFactorFalling ? ' (malejący/falling)' : ''}`
    )
    .join('\n');

  const roadmapLines = roadmap
    .map(
      (r) =>
        `${r.order}. [fala/wave ${r.wave}] ${r.name} — ${r.decision}/${r.sixR}; ${localize('warunek wejścia', 'entry condition', isPolish)}: ${localize(r.entryCondition.pl, r.entryCondition.en, isPolish)}`
    )
    .join('\n');

  const insights = buildInsights(verdicts, score, roadmap, isPolish)
    .map((i) => `- ${i}`)
    .join('\n');

  const header = isPolish
    ? 'Działaj jako partner ds. architektury korporacyjnej i racjonalizacji portfela aplikacji (Gartner TIME, AWS 6R, kwantyfikacja długu technologicznego McKinsey). Poniżej masz ugruntowaną na danych ocenę portfela, decyzje TIME/6R per aplikacja, roadmapę sekwencjonowaną grafem zależności i insighty. Dopracuj sformułowania i uzupełnij luki, ale NIE wymyślaj systemów, kwot TCO ani zależności niepopartych danymi sesji.'
    : 'Act as an enterprise-architecture and application-portfolio-rationalization partner (Gartner TIME, AWS 6R, McKinsey tech-debt quantification). Below is a data-grounded portfolio assessment, per-application TIME/6R decisions, a dependency-graph-sequenced roadmap and insights. Refine the wording and fill gaps, but do NOT invent systems, TCO figures or dependencies the session facts do not support.';

  const rules = isPolish
    ? [
        'Każda inicjatywa MUSI mieć: rationale, trade-off (co to kosztuje / czego świadomie nie robicie), i twardy warunek/deadline (koniec wsparcia, zależność, wygasająca licencja).',
        'Mapa zależności wyprzedza decyzję TIME: aplikacja-węzeł oceniona jako ELIMINATE, ale z zależnymi systemami, staje się MIGRATE (Refactor) z sekwencją „najpierw nowa integracja, potem wygaszenie".',
        'Roadmapa to graf zależności na osi czasu, nie lista „co ważniejsze" — zachowaj kolejność fal; system o wysokim priorytecie może iść później, jeśli wymaga wcześniej stabilnej integracji.',
        'ELIMINATE to kierunek decyzji, nie data w kalendarzu jutro — zawsze po planie migracji danych i sprawdzeniu zależności.',
        'Refactor uzasadniony tylko w MIGRATE/INVEST przy realnej barierze skalowania; „przepiszmy, bo kod brzydki" w kwadrancie TOLERATE to najdroższa pułapka.',
        'Liczby (TCO, %, in-degree, bus factor) wyłącznie z bazy powyżej — nie licz i nie zmyślaj.',
      ]
    : [
        'Every initiative MUST carry: rationale, trade-off (what it costs / what you deliberately do NOT do), and a hard condition/deadline (support end, dependency, expiring license).',
        'The dependency map precedes the TIME decision: a node app scored ELIMINATE but with dependents becomes MIGRATE (Refactor) with the sequence "new integration first, retirement second".',
        'The roadmap is the dependency graph on a timeline, not a "what matters more" list — preserve the wave order; a high-priority system can go later if it needs a stable integration first.',
        'ELIMINATE is a direction, not a calendar date tomorrow — always after a data-migration plan and a dependency check.',
        'Refactor is justified only in MIGRATE/INVEST at a real scaling barrier; "rewrite it because the code is ugly" in the TOLERATE quadrant is the costliest trap.',
        'Numbers (TCO, %, in-degree, bus factor) come exclusively from the baseline above — do not compute or invent them.',
      ];

  return `${header}

=== PORTFOLIO BASELINE (facts — the only admissible source of amounts) ===
${baselineLine}

=== PER-APPLICATION TIME / 6R VERDICTS ===
${verdictLines}

=== DEPENDENCY-SEQUENCED ROADMAP (grounded draft — wave order = execution order) ===
${roadmapLines || '(no MIGRATE/ELIMINATE items)'}

=== INSIGHTS (the product of the tool — lead with these, not the table) ===
${insights || '(no insights available)'}

Rules:
${rules.map((r) => `- ${r}`).join('\n')}

QUALITY BARS:
- Answer-first: "verdict" is a thesis about the modernization decision, not a recap of the inventory.
- Numbers exclusively from the facts above; do not compute or invent new ones.
- Zero filler and zero AI meta-phrases ("As an AI", "Based on the provided data", "In conclusion") — write like a partner signing the work with their name.
- Every sentence falsifiable: with opposite facts it would read differently.
- Map the grounded roadmap above into 3-5 "initiatives", preserving its wave order (order = priority) and each item's entry condition.
- Respond in ${isPolish ? 'Polish' : 'English'}, active voice, partner tone.

Return JSON:
{
  "summary": {
    "verdict": "answer-first, 1-2 sentences: what this portfolio analysis means for the modernization / budget-allocation decision",
    "executiveSummary": "3-4 sentences: restate the verdict, then why — anchored in the debt share, TIME counts and the sequencing constraint above",
    "keyInsights": ["3 insights, each tied to the facts above (a named system, a %, a dependency, or a bus factor)"],
    "appliedConclusions": ["what to do first", "what NOT to do", "what to validate next"],
    "tradeoffs": [{"chosen":"...","rejected":"...","why":"..."}],
    "expectedEffect": {"text":"budget reallocation / risk reduction / support-deadline met, behaviorally observable","horizon":"..."}
  },
  "initiatives": [{"title":"...","description":"what to do + first step (verb + artifact + role)","type":"modernization","estimatedImpact":"high|medium|low","estimatedEffort":"high|medium|low","rationale":"why — names the TIME decision, the 6R strategy, the trade-off, and the hard deadline / dependency that sets its slot"}]
}`;
}

/**
 * Builds the deepening prompt for a single dimension rung — used when the user
 * asks AI to "think deeper" on a specific legacy assessment dimension.
 */
export function buildLegacyDeepenPrompt(
  dimension: LegacyDimensionId,
  rungId: 'surface' | 'evidence' | 'quantification' | 'risk-capability',
  isPolish: boolean
): string | null {
  const rungs = localizeLadder(dimension, isPolish);
  const rung = rungs.find((r) => r.id === rungId);
  if (!rung) return null;
  return `${rung.question}\n\n${isPolish ? 'Kontekst konsultanta' : 'Consultant framing'}: ${rung.rationale}`;
}

/**
 * Which deepening-ladder dimensions each wizard STEP covers. The Legacy Analyzer
 * has four steps (context / apps / dependencies / summary), but the doctrine's
 * six assessment dimensions all live inside the per-application scoring — so the
 * `apps` step is disciplined by the five per-app dimensions and `dependencies`
 * by the integration-graph dimension. This is what makes the deepening ladder
 * (buildLegacyDeepenPrompt) AND the proposal bank (LEGACY_PROPOSAL_BANK) LIVE in
 * runtime instead of sitting as dead config.
 */
const STEP_DIMENSIONS: Record<string, LegacyDimensionId[]> = {
  apps: ['inventory', 'businessValue', 'techHealth', 'cost', 'risk'],
  dependencies: ['dependencies'],
};

/**
 * Section-level suggestion prompt for a Legacy Analyzer capture step, disciplined
 * by the deepening ladder (surface → evidence → quantification → risk/capability)
 * and seeded with the partner-grade proposal bank. Returns null for steps with no
 * assessment dimension (context / summary), so the caller falls back to the
 * generic operational prompt.
 */
export function buildLegacyStepSuggestionPrompt(
  stepId: string,
  isPolish: boolean
): string | null {
  const dimensions = STEP_DIMENSIONS[stepId];
  if (!dimensions || dimensions.length === 0) return null;

  const blocks = dimensions.map((dimension) => {
    const label = legacyDimensionLabel(dimension);
    // Quantification rung frames the "turn a feeling into a number" discipline.
    const framing = buildLegacyDeepenPrompt(dimension, 'quantification', isPolish);
    const proposals = LEGACY_PROPOSAL_BANK[dimension]
      .map(
        (p) =>
          `  · [${p.rung}] ${localize(p.title.pl, p.title.en, isPolish)} — ${localize(
            p.explanation.pl,
            p.explanation.en,
            isPolish
          )}`
      )
      .join('\n');
    return `${isPolish ? 'Wymiar' : 'Dimension'}: ${localize(label.pl, label.en, isPolish)}
${framing ? `${framing}\n` : ''}${
      isPolish
        ? 'Bank propozycji (kandydaci do dopracowania i dopasowania, nie do skopiowania w ciemno)'
        : 'Proposal bank (candidates to refine and fit, not copy blind)'
    }:
${proposals}`;
  });

  const isApps = stepId === 'apps';
  const header = isPolish
    ? `Działaj jako partner ds. architektury korporacyjnej i racjonalizacji portfela aplikacji (Gartner TIME, AWS 6R, kwantyfikacja długu McKinsey). Zaproponuj 3-6 pozycji do sekcji „${stepId}", zdyscyplinowanych drabiną pogłębiającą (powierzchnia → dowód → kwantyfikacja → ryzyko/zdolności). Oprzyj je na bankach propozycji poniżej — dopracuj i dopasuj do kontekstu sesji; nie zmyślaj systemów, kwot TCO, wartości/kondycji ani zależności niepopartych sesją.`
    : `Act as an enterprise-architecture and application-portfolio-rationalization partner (Gartner TIME, AWS 6R, McKinsey tech-debt quantification). Propose 3-6 items for the "${stepId}" section, disciplined by the deepening staircase (surface → evidence → quantification → risk/capability). Ground them in the proposal banks below — refine and fit them to the session context; do not invent systems, TCO figures, value/health scores or dependencies the session does not support.`;

  const fields = isApps
    ? '{"items": [{"title": "...", "description": "...", "impact": "high|medium|low", "effort": "high|medium|low", "category": "...", "businessValue": 1, "technicalHealth": 1, "tcoPerYear": 0, "supportStatus": "active|expiring|none", "busFactor": 0, "knownCves": 0}]}'
    : '{"items": [{"title": "...", "description": "...", "impact": "high|medium|low", "effort": "high|medium|low", "from": "<appId>", "to": "<appId>", "documented": true}]}';

  return `${header}

${blocks.join('\n\n')}

${isPolish ? 'Zwróć JSON' : 'Return JSON'}:
${fields}`;
}

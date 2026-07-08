/**
 * VSM Builder — conclusion prompt contract (CONCLUSION_LAYER_STANDARD W2).
 *
 * Bridges the deterministic synthesis engine (vsmEngine.ts) with the AI runtime.
 * The engine produces a grounded baseline (PCE, located constraint, pure-waste
 * share, hidden-factory cost) + lever ranking + W2 kaizen sequence; these
 * builders turn that into a prompt so the model refines wording and fills gaps
 * WITHOUT inventing times, steps or costs the session does not support.
 *
 * The prompt is INSIGHT-FIRST and grounded in the doctrine §6 insight patterns:
 *   - "X% of lead time is waiting, not work" (from PCE)
 *   - "the constraint is [step], not [the step that looks guilty]"
 *   - "the hidden rework factory costs ~Y FTE-days/month" (from %C&A)
 *   - "N% of steps are pure NVA, removable without regulatory risk"
 * Each insight resolves verdict → evidence → what it means for the organization
 * → initiative, so the operational summary renderer consumes VSM output the same
 * way it consumes the SMED/Inventory prompts.
 */

import {
  buildW2MoveSequence,
  computeBaseline,
  rankLevers,
  type VsmSession,
} from './vsmEngine';
import { localizeLadder } from './index';
import { type VsmLeverId } from './deepeningLadder';

const localize = (pl: string, en: string, isPolish: boolean) => (isPolish ? pl : en);
const pct = (fraction: number) => Math.round(fraction * 100);

const PCE_BAND_LABEL: Record<string, { pl: string; en: string }> = {
  untransformed: { pl: 'nietransformowany (<10%)', en: 'untransformed (<10%)' },
  managed: { pl: 'zarządzany tradycyjnie (10-25%)', en: 'traditionally managed (10-25%)' },
  lean: { pl: 'lean (>25%)', en: 'lean (>25%)' },
  'world-class': { pl: 'world-class (>40%)', en: 'world-class (>40%)' },
  unknown: { pl: 'nieznany (brak czasów)', en: 'unknown (no timing)' },
};

/**
 * Grounded synthesis prompt: seeds the model with the engine's baseline (PCE,
 * constraint, waste, hidden factory), lever ranking and W2 sequence so its
 * output stays consistent with the computed facts. Returns null when there is
 * nothing to conclude on.
 */
export function buildVsmConclusionPrompt(
  session: VsmSession,
  isPolish: boolean
): string | null {
  const ranking = rankLevers(session);
  if (ranking.ordered.length === 0) return null;

  const baseline = computeBaseline(session);
  const sequence = buildW2MoveSequence(session);
  const c = baseline.constraint;
  const hf = baseline.hiddenFactory;
  const band = PCE_BAND_LABEL[baseline.pceBand];

  const baselineLine = isPolish
    ? `Baza strumienia: ${baseline.stepCount} kroków; czas wartości dodanej ${baseline.valueAddTime}; całkowity lead time ${baseline.totalLeadTime}; PCE = ${pct(baseline.pce)}% (pasmo: ${band.pl}); ${baseline.pureWasteCount} kroków (${pct(baseline.pureWasteShare)}%) to czyste marnotrawstwo trzymające ${baseline.pureWasteLeadTime} lead time; zmierzone ${pct(baseline.measuredRatio)}% kroków.`
    : `Stream baseline: ${baseline.stepCount} steps; value-add time ${baseline.valueAddTime}; total lead time ${baseline.totalLeadTime}; PCE = ${pct(baseline.pce)}% (band: ${band.en}); ${baseline.pureWasteCount} steps (${pct(baseline.pureWasteShare)}%) are pure waste holding ${baseline.pureWasteLeadTime} of lead time; ${pct(baseline.measuredRatio)}% of steps measured.`;

  const constraintLine = c.stepId
    ? isPolish
      ? `Ograniczenie: krok „${c.stepId}" — WIP przed nim ${c.wipBefore}, ${pct(c.leadTimeShare)}% lead time strumienia${typeof c.uptime === 'number' ? `, uptime ${pct(c.uptime)}%` : ''}. ${c.differsFromIntuition ? `UWAGA: to NIE jest krok „${c.longestCycleStepId}", który wygląda na winowajcę (najdłuższy czas pracy) — realny constraint jest gdzie indziej.` : 'Pokrywa się z krokiem o najdłuższym czasie pracy.'}`
      : `Constraint: step "${c.stepId}" — WIP before it ${c.wipBefore}, ${pct(c.leadTimeShare)}% of stream lead time${typeof c.uptime === 'number' ? `, uptime ${pct(c.uptime)}%` : ''}. ${c.differsFromIntuition ? `NOTE: this is NOT step "${c.longestCycleStepId}", which looks like the culprit (longest work time) — the real constraint is elsewhere.` : 'It coincides with the longest-work-time step.'}`
    : isPolish
      ? 'Ograniczenie: nie ustalone (brak danych o kolejce/uptime).'
      : 'Constraint: not established (no queue/uptime data).';

  const reworkLine = hf.worstStepId
    ? isPolish
      ? `Ukryta fabryka przeróbek: krok „${hf.worstStepId}" zawraca ${pct(hf.worstReturnRate)}% pracy${hf.reworkTimePerMonth > 0 ? ` (~${hf.reworkTimePerMonth} jednostek-czasu/miesiąc, ~${hf.reworkUnitsPerMonth} jednostek/miesiąc)` : ''} — niewidoczne w raportach output.`
      : `Hidden rework factory: step "${hf.worstStepId}" returns ${pct(hf.worstReturnRate)}% of work${hf.reworkTimePerMonth > 0 ? ` (~${hf.reworkTimePerMonth} time-units/month, ~${hf.reworkUnitsPerMonth} units/month)` : ''} — invisible in output reports.`
    : isPolish
      ? 'Ukryta fabryka przeróbek: brak danych %C&A do policzenia.'
      : 'Hidden rework factory: no %C&A data to compute.';

  const scoreLines = ranking.scores
    .filter((s) => s.moveCount > 0)
    .map(
      (s) =>
        `- ${localize(s.label.pl, s.label.en, isPolish)}: fit ${s.score}/9 (attractiveness ${s.attractiveness} × feasibility ${s.feasibility}), ${s.leadTimeInScope} lead time in scope, ${s.evidenceBacked}/${s.moveCount} evidence-backed`
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
    ? 'Działaj jako partner Lean Operations / TPS (Value Stream Mapping). Poniżej masz ugruntowaną na danych bazę strumienia (PCE, zlokalizowane ograniczenie, marnotrawstwo, ukryta fabryka przeróbek), ranking dźwigni i sekwencję ruchów kaizen W2. Dopracuj sformułowania i uzupełnij luki, ale NIE wymyślaj czasów, kroków ani kosztów niepopartych danymi sesji.'
    : 'Act as a Lean Operations / TPS partner (Value Stream Mapping). Below is a data-grounded stream baseline (PCE, located constraint, waste, hidden rework factory), a lever ranking and a W2 kaizen move sequence. Refine the wording and fill gaps, but do NOT invent times, steps or costs the session facts do not support.';

  const insightPatterns = isPolish
    ? [
        `„${pct(1 - baseline.pce)}% lead time to czekanie, nie praca" — to punkt otwarcia dla sponsora, który uważa, że proces działa dobrze (z PCE powyżej).`,
        c.stepId
          ? `„Ograniczenie to krok ${c.stepId}${c.differsFromIntuition ? `, nie krok ${c.longestCycleStepId}, który wygląda na winowajcę` : ''}" — koryguje intuicję organizacji i kieruje budżet w jedno miejsce.`
          : '„Ograniczenie" — wskaż je z kolejki/WIP, jeśli dane pozwolą; nie z najdłuższego kroku.',
        hf.worstStepId
          ? `„Ukryta fabryka przeróbek: ${pct(hf.worstReturnRate)}% pracy w kroku ${hf.worstStepId} wraca do poprawki${hf.reworkTimePerMonth > 0 ? `, ~${hf.reworkTimePerMonth} jednostek-czasu/mies.` : ''}" — koszt niewidoczny w KPI.`
          : '„Ukryta fabryka przeróbek" — ujawnij ją z %C&A, jeśli dane pozwolą.',
        baseline.pureWasteCount > 0
          ? `„${pct(baseline.pureWasteShare)}% kroków to czyste NVA możliwe do eliminacji bez ryzyka regulacyjnego" — obronialna lista kaizen.`
          : '„Czyste NVA do eliminacji" — po sklasyfikowaniu kroków na VA / konieczne NVA / muda.',
      ]
    : [
        `"${pct(1 - baseline.pce)}% of lead time is waiting, not work" — the opener for a sponsor who believes the process runs fine (from the PCE above).`,
        c.stepId
          ? `"The constraint is step ${c.stepId}${c.differsFromIntuition ? `, not step ${c.longestCycleStepId}, which looks like the culprit` : ''}" — corrects the organization's intuition and focuses the budget on one place.`
          : '"The constraint" — name it from queue/WIP if the data allows; not from the longest step.',
        hf.worstStepId
          ? `"Hidden rework factory: ${pct(hf.worstReturnRate)}% of work in step ${hf.worstStepId} returns for correction${hf.reworkTimePerMonth > 0 ? `, ~${hf.reworkTimePerMonth} time-units/month` : ''}" — a cost invisible in the KPIs.`
          : '"Hidden rework factory" — surface it from %C&A if the data allows.',
        baseline.pureWasteCount > 0
          ? `"${pct(baseline.pureWasteShare)}% of steps are pure NVA removable without regulatory risk" — a defensible kaizen list.`
          : '"Pure NVA to eliminate" — once steps are classified into VA / necessary NVA / muda.',
      ];

  const rules = isPolish
    ? [
        'Każdy ruch MUSI mieć: rationale, trade-off (co to kosztuje), wariant odrzucony (czego świadomie NIE robicie i dlaczego).',
        'Trzymaj porządek: zmapuj i zmierz → udrożnij ograniczenie → domknij przeróbki u źródła → wyeliminuj czyste muda. Nie szukaj constraintu przed zmapowaniem strumienia.',
        'Ograniczenie lokalizuj z kolejki/WIP i uptime, NIGDY z najdłuższego czasu pracy — jeśli to różne kroki, powiedz to wprost (to najsilniejszy insight).',
        'Liczby (PCE, %, lead time, koszt przeróbek, kroki) wyłącznie z bazy powyżej — nie licz i nie zmyślaj.',
        'Nie usuwaj kontroli koniecznej (regulacja/ryzyko) — część NVA musi zostać; cięcie muda ma iść w parze z przeniesieniem kontroli do źródła.',
      ]
    : [
        'Every move MUST carry: rationale, trade-off (what it costs), rejected variant (what you deliberately do NOT do and why).',
        'Keep order: map and time → unblock the constraint → close rework at the source → eliminate pure muda. Do not hunt the constraint before mapping the stream.',
        'Locate the constraint from queue/WIP and uptime, NEVER from the longest work time — if these are different steps, say so plainly (the strongest insight).',
        'Numbers (PCE, %, lead time, rework cost, steps) come exclusively from the baseline above — do not compute or invent them.',
        'Do not remove a necessary control (regulation/risk) — some NVA must stay; cutting muda must pair with moving the control to the source.',
      ];

  return `${header}

=== VSM BASELINE (facts — the only admissible source of numbers) ===
${baselineLine}
${constraintLine}
${reworkLine}

=== SCORED VSM LEVERS ===
${scoreLines}

=== W2 KAIZEN MOVE SEQUENCE (grounded draft) ===
${seqLines}

=== INSIGHT PATTERNS TO PRODUCE (doctrine §6 — insight-first) ===
${insightPatterns.map((p) => `- ${p}`).join('\n')}

Rules:
${rules.map((r) => `- ${r}`).join('\n')}

QUALITY BARS:
- Insight-first: "verdict" states what the analysis MEANS for the organization (where and why time/money is lost, what to change first), not a recap of the inputs.
- Every insight resolves: verdict → evidence (a number from the baseline) → what it means for the organization → initiative.
- Numbers exclusively from the facts above; do not compute or invent new ones.
- Zero filler and zero AI meta-phrases ("As an AI", "Based on the provided data", "In conclusion") — write like a partner signing the work with their name.
- Every sentence falsifiable: with opposite facts it would read differently.
- Map the grounded W2 sequence above into 3-5 "initiatives", preserving its order (order = priority).
- Respond in ${isPolish ? 'Polish' : 'English'}, active voice, partner tone.

Return JSON:
{
  "summary": {
    "verdict": "insight-first, 1-2 sentences: what this value stream means — where lead time is lost and what to change first",
    "executiveSummary": "3-4 sentences: restate the verdict, then why — anchored in the PCE, the located constraint and the hidden-factory cost above",
    "keyInsights": ["3 insights from the patterns above, each tied to a number from the baseline"],
    "appliedConclusions": ["what to fix first (the constraint)", "what NOT to do (optimize a non-constraint)", "what to validate next (re-map after the intervention)"],
    "tradeoffs": [{"chosen":"...","rejected":"...","why":"..."}],
    "expectedEffect": {"text":"lead-time reduction / PCE change, behaviorally observable","horizon":"..."}
  },
  "initiatives": [{"title":"...","description":"what to do + first step (verb + artifact + role)","type":"operational","estimatedImpact":"high|medium|low","estimatedEffort":"high|medium|low","rationale":"why — names the trade-off (chosen at the cost of what) and the rejected variant"}]
}`;
}

/**
 * Builds the deepening prompt for a single lever rung — used when the user asks
 * AI to "think deeper" on a specific VSM lever.
 */
export function buildVsmDeepenPrompt(
  lever: VsmLeverId,
  rungId: 'surface' | 'evidence' | 'quantification' | 'risk-capability',
  isPolish: boolean
): string | null {
  const rungs = localizeLadder(lever, isPolish);
  const rung = rungs.find((r) => r.id === rungId);
  if (!rung) return null;
  return `${rung.question}\n\n${isPolish ? 'Kontekst konsultanta' : 'Consultant framing'}: ${rung.rationale}`;
}

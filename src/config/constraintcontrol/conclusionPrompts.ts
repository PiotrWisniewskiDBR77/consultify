/**
 * Constraint Control — conclusion prompt contract (CONCLUSION_LAYER_STANDARD W2).
 *
 * Bridges the deterministic synthesis engine (constraintEngine.ts) with the AI
 * runtime. The engine produces a grounded baseline (constraint location +
 * Throughput Accounting + policy-constraint signal) + a Five-Focusing-Steps
 * ranking + a W2 move sequence; these builders turn that into a prompt so the
 * model refines wording and fills gaps WITHOUT inventing steps, queues or
 * throughput figures the session does not support.
 *
 * Shape mirrors the shared tool conclusion contract (verdict / rationale /
 * tradeoffs / initiatives / expectedEffect) used by the Inventory/SMED prompts,
 * so the operational summary renderer consumes Constraint output the same way.
 *
 * The insight patterns are lifted straight from the doctrine (§6):
 *   - "the constraint is X; an hour lost there is an hour lost for the whole system"
 *   - "an improvement anywhere but the constraint is an illusion"
 *   - "policy Y is the hidden constraint → transformation initiative"
 */

import {
  buildW2MoveSequence,
  computeBaseline,
  rankFocusSteps,
  type ConstraintSession,
} from './constraintEngine';
import { localizeLadder } from './index';
import { type FocusStepId } from './deepeningLadder';

const localize = (pl: string, en: string, isPolish: boolean) => (isPolish ? pl : en);

/**
 * Grounded synthesis prompt: seeds the model with the engine's constraint
 * location, Throughput-Accounting baseline, focusing-step ranking and W2
 * sequence so its output stays consistent with the scored facts. Returns null
 * when there is nothing to conclude on.
 */
export function buildConstraintConclusionPrompt(
  session: ConstraintSession,
  isPolish: boolean
): string | null {
  const baseline = computeBaseline(session);
  const ranking = rankFocusSteps(session);
  const sequence = buildW2MoveSequence(session);

  // Nothing to conclude on if we neither located a constraint nor have any moves.
  if (baseline.location.constraintStepId === null && ranking.ordered.length === 0) return null;

  const loc = baseline.location;
  const acc = baseline.accounting;
  const constraintName = localize(loc.label.pl, loc.label.en, isPolish);

  const locationLine = isPolish
    ? `Constraint: „${constraintName}" (baza: ${loc.basis === 'queue' ? 'kolejka' : loc.basis === 'capacity' ? 'luka capacity–demand' : 'słaby dowód'}); capacity ${loc.capacity} vs demand ${loc.demand} (luka ${loc.capacityGap}); kolejka ${loc.queue}${loc.queueTrend ? ` (${loc.queueTrend})` : ''}. Kroków z rosnącą kolejką: ${baseline.growingQueueCount}. Zmierzone ${Math.round(baseline.measuredRatio * 100)}% kroków.${loc.falseBusyStepId ? ` Fałszywie „zajęty" (nie constraint): ${loc.falseBusyStepId}.` : ''}${baseline.policyConstraintLikely ? ' SYGNAŁ: prawdopodobne ograniczenie POLITYKI (kolejka bez fizycznej luki mocy).' : ''}`
    : `Constraint: "${constraintName}" (basis: ${loc.basis === 'queue' ? 'queue' : loc.basis === 'capacity' ? 'capacity–demand gap' : 'weak evidence'}); capacity ${loc.capacity} vs demand ${loc.demand} (gap ${loc.capacityGap}); queue ${loc.queue}${loc.queueTrend ? ` (${loc.queueTrend})` : ''}. Steps with a growing queue: ${baseline.growingQueueCount}. ${Math.round(baseline.measuredRatio * 100)}% of steps measured.${loc.falseBusyStepId ? ` False-busy (not the constraint): ${loc.falseBusyStepId}.` : ''}${baseline.policyConstraintLikely ? ' SIGNAL: likely POLICY constraint (queue with no physical capacity gap).' : ''}`;

  const taLine = acc.hasData
    ? isPolish
      ? `Throughput Accounting: T = ${acc.throughput}; OE = ${acc.operatingExpense}; I = ${acc.investment}; Zysk netto (T − OE) = ${acc.netProfit}${acc.roi !== null ? `; ROI = ${acc.roi}` : ''}${acc.productivity !== null ? `; Produktywność (T/OE) = ${acc.productivity}` : ''}${acc.investmentTurns !== null ? `; Rotacja I (T/I) = ${acc.investmentTurns}` : ''}.`
      : `Throughput Accounting: T = ${acc.throughput}; OE = ${acc.operatingExpense}; I = ${acc.investment}; Net Profit (T − OE) = ${acc.netProfit}${acc.roi !== null ? `; ROI = ${acc.roi}` : ''}${acc.productivity !== null ? `; Productivity (T/OE) = ${acc.productivity}` : ''}${acc.investmentTurns !== null ? `; Investment turns (T/I) = ${acc.investmentTurns}` : ''}.`
    : isPolish
      ? 'Throughput Accounting: brak danych finansowych (sprzedaż/TVC/OE/I) — nie licz T/ROI, oceniaj przez przepustowość i kolejki.'
      : 'Throughput Accounting: no financial data (sales/TVC/OE/I) — do not compute T/ROI, reason from throughput and queues.';

  const proj = baseline.projection;
  const projLine = proj.hasProjection
    ? isPolish
      ? `Projekcja przepustowości: constraint wysyła ~${proj.constraintCapacity} jedn.; luka ~${proj.closeableGap} jedn. niezaspokojonego popytu ≈ +${proj.projectedThroughputUplift} Throughput przy niezmienionym OE (T/jedn. ≈ ${proj.throughputPerUnit}; Zysk netto → ~${proj.projectedNetProfit}). To próg, który musi pobić każdy CAPEX — część odzyskiwalna wcześniej bez wydatku (Exploit/Policy).`
      : `Throughput projection: the constraint ships ~${proj.constraintCapacity} units; the ~${proj.closeableGap}-unit gap of unmet demand ≈ +${proj.projectedThroughputUplift} Throughput at unchanged OE (T/unit ≈ ${proj.throughputPerUnit}; Net Profit → ~${proj.projectedNetProfit}). This is the bar any CAPEX must clear — part recoverable earlier with no spend (Exploit/Policy).`
    : isPolish
      ? 'Projekcja przepustowości: brak (nie ma jednocześnie luki mocy, dodatniej przepustowości constraintu i danych T).'
      : 'Throughput projection: none (missing a capacity gap, a positive constraint capacity, or T data together).';

  const scoreLines = ranking.scores
    .filter((s) => s.moveCount > 0)
    .map(
      (s) =>
        `- ${localize(s.label.pl, s.label.en, isPolish)}: fit ${s.score}/9 (attractiveness ${s.attractiveness} × feasibility ${s.feasibility}), ${s.evidenceBacked}/${s.moveCount} evidence-backed`
    )
    .join('\n');

  const seqLines = sequence
    .map(
      (m) =>
        `${m.order}. [${m.step}] ${localize(m.title.pl, m.title.en, isPolish)} — rationale: ${localize(
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
    ? 'Działaj jako partner ds. operacji i Teorii Ograniczeń (TOC / Goldratt: Pięć Kroków Fokusujących, Drum-Buffer-Rope, Throughput Accounting). Poniżej masz ugruntowaną na danych lokalizację ograniczenia, bazę T/I/OE, ranking kroków fokusujących i sekwencję ruchów W2. Dopracuj sformułowania i uzupełnij luki, ale NIE wymyślaj kroków, kolejek ani kwot niepopartych danymi sesji.'
    : 'Act as an operations and Theory-of-Constraints partner (TOC / Goldratt: Five Focusing Steps, Drum-Buffer-Rope, Throughput Accounting). Below is a data-grounded constraint location, a T/I/OE baseline, a focusing-step ranking and a W2 move sequence. Refine the wording and fill gaps, but do NOT invent steps, queues or amounts the session facts do not support.';

  const rules = isPolish
    ? [
        'Ograniczenie lokalizuj z KOLEJKI, nie z zajętości — zasób „100% zajęty" nie jest constraintem, jeśli kolejka przed nim nie rośnie.',
        'Trzymaj kolejność Pięciu Kroków: Identify → Exploit → Subordinate → (Policy) → Elevate. NIGDY nie proponuj Elevate (inwestycji) przed wyczerpaniem Exploit i Subordinate.',
        'Każdy ruch MUSI mieć: rationale, trade-off (co to kosztuje), wariant odrzucony (czego świadomie NIE robicie i dlaczego).',
        'Test lokalnego optimum: każde usprawnienie POZA constraintem, które nie zmienia T/I/OE całości, nazwij iluzją — nie inicjatywą.',
        'Jeśli kolejka istnieje bez fizycznej luki mocy, domyślną hipotezą jest ograniczenie POLITYKI → materiał na inicjatywę transformacyjną, nie na CAPEX.',
        'Liczby (capacity, demand, kolejka, T/I/OE) wyłącznie z bazy powyżej — nie licz i nie zmyślaj.',
      ]
    : [
        'Locate the constraint from the QUEUE, not busyness — a "100% busy" resource is not the constraint if the queue in front of it is not growing.',
        'Keep the Five Focusing Steps order: Identify → Exploit → Subordinate → (Policy) → Elevate. NEVER propose Elevate (investment) before Exploit and Subordinate are exhausted.',
        'Every move MUST carry: rationale, trade-off (what it costs), rejected variant (what you deliberately do NOT do and why).',
        'Local-optimum test: any improvement OFF the constraint that does not change system T/I/OE, call it an illusion — not an initiative.',
        'If a queue exists with no physical capacity gap, the default hypothesis is a POLICY constraint → material for a transformation initiative, not CAPEX.',
        'Numbers (capacity, demand, queue, T/I/OE) come exclusively from the baseline above — do not compute or invent them.',
      ];

  return `${header}

=== CONSTRAINT LOCATION (facts — the only admissible source of the bottleneck) ===
${locationLine}

=== THROUGHPUT ACCOUNTING (facts — the only admissible source of money figures) ===
${taLine}
${projLine}

=== SCORED FOCUSING STEPS ===
${scoreLines || '- (no scored moves; reason from the located constraint and the sequence below)'}

=== W2 MOVE SEQUENCE (grounded draft — order = priority = Five Focusing Steps) ===
${seqLines}

Rules:
${rules.map((r) => `- ${r}`).join('\n')}

QUALITY BARS:
- Answer-first: "verdict" is a thesis about the bottleneck decision, not a recap of the inputs.
- Numbers exclusively from the facts above; do not compute or invent new ones.
- Zero filler and zero AI meta-phrases ("As an AI", "Based on the provided data", "In conclusion") — write like a partner signing the work with their name.
- Every sentence falsifiable: with opposite facts it would read differently.
- Insight bar (this is why the tool exists): at least one insight must state, in the client's terms, "the constraint is X — an hour lost there is an hour lost for the whole system"; one must expose an improvement-off-the-constraint as an illusion; and where a policy constraint is signalled, one must name the policy as the hidden constraint and route it to a transformation initiative.
- Map the grounded W2 sequence above into 3-5 "initiatives", preserving its order (order = priority = focusing step).
- Respond in ${isPolish ? 'Polish' : 'English'}, active voice, partner tone.

Return JSON:
{
  "summary": {
    "verdict": "answer-first, 1-2 sentences: where the constraint is and what that means for the throughput decision",
    "executiveSummary": "3-4 sentences: restate the verdict, then why — anchored in the located constraint, its queue/capacity gap and the T/I/OE baseline above",
    "keyInsights": ["3 insights, each tied to the facts above; obey the insight bar (constraint = whole-system leverage; off-constraint improvement = illusion; policy = hidden constraint)"],
    "appliedConclusions": ["what to exploit first (no CAPEX)", "what NOT to do (which off-constraint improvement is an illusion)", "what to validate before any Elevate"],
    "tradeoffs": [{"chosen":"...","rejected":"...","why":"..."}],
    "expectedEffect": {"text":"throughput / lead-time / WIP change, behaviorally observable","horizon":"..."}
  },
  "initiatives": [{"title":"...","description":"what to do + first step (verb + artifact + role)","type":"operational","estimatedImpact":"high|medium|low","estimatedEffort":"high|medium|low","rationale":"why — names the trade-off (chosen at the cost of what) and the rejected variant; ties to Exploit/Subordinate/Policy/Elevate"}]
}`;
}

/**
 * Builds the deepening prompt for a single focusing-step rung — used when the
 * user asks AI to "think deeper" on a specific TOC step.
 */
export function buildConstraintDeepenPrompt(
  step: FocusStepId,
  rungId: 'surface' | 'evidence' | 'quantification' | 'risk-capability',
  isPolish: boolean
): string | null {
  const rungs = localizeLadder(step, isPolish);
  const rung = rungs.find((r) => r.id === rungId);
  if (!rung) return null;
  return `${rung.question}\n\n${isPolish ? 'Kontekst konsultanta' : 'Consultant framing'}: ${rung.rationale}`;
}

/**
 * Logistics Automation — conclusion prompt contract (CONCLUSION_LAYER_STANDARD W2).
 *
 * Bridges the deterministic synthesis engine (logisticsEngine.ts) with the AI
 * runtime. The engine produces a grounded baseline + zone ranking + W2 move
 * sequence; these builders turn that into a prompt so the model refines wording
 * and fills gaps WITHOUT inventing FTE, cost or volume facts the session does not
 * support.
 *
 * Shape mirrors the Inventory Autopilot / shared tool conclusion contract
 * (verdict / rationale / tradeoffs / moves / expectedEffect) so the operational
 * summary renderer consumes logistics output the same way.
 *
 * The tool exists to produce INSIGHTS (doctrine §6), not a technology catalogue.
 * The prompt leads with those insight templates and forbids the model from
 * turning the output into a list of buyable machines.
 */

import {
  assessPayback,
  buildW2MoveSequence,
  computeBaseline,
  rankZones,
  techName,
  type LogisticsSession,
} from './logisticsEngine';
import { localizeLadder } from './index';
import { type LogisticsZoneId } from './deepeningLadder';

const localize = (pl: string, en: string, isPolish: boolean) => (isPolish ? pl : en);

/**
 * The doctrine's §6 insight templates — the reason the tool exists. Seeded into
 * the prompt so the model anchors its keyInsights on these shapes rather than
 * drifting into a technology catalogue.
 */
function insightTemplates(isPolish: boolean): string[] {
  return isPolish
    ? [
        '„N% czasu pickerów w [strefa] to chodzenie/szukanie, nie kompletacja." — twardy, policzalny dowód pracochłonności, punkt otwarcia dla sponsora.',
        '„~60% pracy w pickingu = kandydat na AMR/goods-to-person; pozostałe strefy — NIE jeszcze." — lokalizacja, nie ogólnik.',
        '„Automatyzacja bez uporządkowania slottingu = utrwalenie nieefektywności — droższej i szybszej." — wymusza sekwencję proces→technologia.',
        '„Sama reorganizacja procesu (slotting, ścieżki) daje N% poprawy przepustowości — zanim wydamy złotówkę na sprzęt."',
        '„Kandydat w [strefa X] wygląda atrakcyjnie, ale to NIE jest ograniczenie całego przepływu — realne ograniczenie to [strefa Y]."',
        '„Sezonowość x3 → automatyzacja stała pod baseline + elastyczna praca/technologia pod peak — nie jedno rozwiązanie na oba reżimy."',
        '„Dokładność zapasu [X]% poniżej progu 95% — pierwsza inwestycja to dane, nie roboty."',
        '„Payback [technologia] w tym wolumenie to N miesięcy — poniżej/powyżej progu opłacalności rynkowej."',
      ]
    : [
        '"N% of pickers\' time in [zone] is walking/searching, not compilation." — a hard, countable proof of labour intensity; the opening for the sponsor.',
        '"~60% of picking work = an AMR/goods-to-person candidate; the other zones — NOT yet." — location, not a generality.',
        '"Automation without fixing slotting = cementing the inefficiency — pricier and faster." — forces the process→technology sequence.',
        '"Process reorg alone (slotting, routes) yields N% throughput gain — before a zloty is spent on hardware."',
        '"The candidate in [zone X] looks attractive, but it is NOT the flow constraint — the real constraint is [zone Y]."',
        '"Seasonality x3 → fixed automation for baseline + flexible labour/technology for peak — not one answer for both regimes."',
        '"Inventory accuracy [X]% below the 95% gate — the first investment is data, not robots."',
        '"Payback for [technology] at this volume is N months — below/above the market viability threshold."',
      ];
}

/**
 * Grounded synthesis prompt: seeds the model with the engine's baseline, zone
 * ranking and W2 sequence so its output stays consistent with the scored facts.
 * Returns null when there is nothing to conclude on.
 */
export function buildLogisticsConclusionPrompt(
  session: LogisticsSession,
  isPolish: boolean
): string | null {
  const ranking = rankZones(session);
  if (ranking.ordered.length === 0) return null;

  const baseline = computeBaseline(session);
  const sequence = buildW2MoveSequence(session);

  const topZone = baseline.topMotionZone;
  const topScore = ranking.scores.find((s) => s.zone === topZone);
  const payback = topScore ? assessPayback(topScore.candidateTech, null) : null;

  const baselineLine = isPolish
    ? `Baza logistyki: ${baseline.totalNonProductiveCost} rocznego kosztu nieprodukcyjnego ruchu łącznie; najcięższa strefa: ${
        topZone ? localize(ranking.scores.find((s) => s.zone === topZone)!.label.pl, '', true) : 'brak'
      } (${baseline.topMotionCost}); sezonowość peak/baseline x${baseline.seasonalityRatio}${
        baseline.seasonalityIsMaterial ? ' (materialna — osobny test)' : ''
      }; najgorsza dokładność zapasu ${Math.round(baseline.worstInventoryAccuracy * 100)}%${
        baseline.accuracyBelowGate ? ' (PONIŻEJ progu 95% — dane przed robotami)' : ''
      }; potencjał re-slottingu ${Math.round(baseline.reslotGainAvailable * 100)}% bez CAPEX; zmierzone ${Math.round(
        baseline.measuredRatio * 100
      )}% stref.`
    : `Logistics baseline: ${baseline.totalNonProductiveCost} of total annual non-productive-motion cost; heaviest zone: ${
        topZone ? localize('', ranking.scores.find((s) => s.zone === topZone)!.label.en, false) : 'none'
      } (${baseline.topMotionCost}); seasonality peak/baseline x${baseline.seasonalityRatio}${
        baseline.seasonalityIsMaterial ? ' (material — separate test)' : ''
      }; worst inventory accuracy ${Math.round(baseline.worstInventoryAccuracy * 100)}%${
        baseline.accuracyBelowGate ? ' (BELOW the 95% gate — data before robots)' : ''
      }; re-slotting potential ${Math.round(baseline.reslotGainAvailable * 100)}% with no CAPEX; ${Math.round(
        baseline.measuredRatio * 100
      )}% of zones measured.`;

  const scoreLines = ranking.scores
    .filter((s) => s.moveCount > 0 || s.laborWeight > 0)
    .map((s) => {
      const tech = techName(s.candidateTech);
      const pay = assessPayback(s.candidateTech, null);
      const bandTxt = pay.band ? `${pay.band.minMonths}-${pay.band.maxMonths} mo payback band` : 'no benchmark band';
      return `- ${localize(s.label.pl, s.label.en, isPolish)}: fit ${s.score}/9 (urgency ${s.attractiveness} × readiness ${s.feasibility}), motion cost ${s.motionCost}, labour weight ${s.laborWeight}, candidate: ${localize(
        tech.pl,
        tech.en,
        isPolish
      )} (${bandTxt}), process ${s.processOrdered ? 'ORDERED' : 'NOT ordered'}, ${s.evidenceBacked}/${s.moveCount} evidence-backed`;
    })
    .join('\n');

  const seqLines = sequence
    .map(
      (m) =>
        `${m.order}. [${m.zone}${m.processFirst ? ' · process/0-CAPEX' : ' · technology'}] ${localize(
          m.title.pl,
          m.title.en,
          isPolish
        )} — rationale: ${localize(m.rationale.pl, m.rationale.en, isPolish)} | trade-off: ${localize(
          m.tradeOff.pl,
          m.tradeOff.en,
          isPolish
        )} | rejected variant: ${localize(m.rejectedVariant.pl, m.rejectedVariant.en, isPolish)}`
    )
    .join('\n');

  const insightLines = insightTemplates(isPolish)
    .map((t) => `- ${t}`)
    .join('\n');

  const header = isPolish
    ? 'Działaj jako partner ds. operacji magazynowych i automatyzacji logistyki (McKinsey/MHI, ABC-slotting, TOC). Poniżej masz ugruntowaną na danych bazę logistyki, ranking 5 stref i sekwencję ruchów W2. Dopracuj sformułowania i uzupełnij luki, ale NIE wymyślaj FTE, kwot ani wolumenów niepopartych danymi sesji. To narzędzie produkuje INSIGHTY, nie katalog robotów.'
    : 'Act as a warehouse-operations and logistics-automation partner (McKinsey/MHI, ABC-slotting, TOC). Below is a data-grounded logistics baseline, a 5-zone ranking and a W2 move sequence. Refine the wording and fill gaps, but do NOT invent FTE, amounts or volumes the session facts do not support. This tool produces INSIGHTS, not a robot catalogue.';

  const rules = isPolish
    ? [
        'Każdy ruch MUSI mieć: rationale, trade-off (co to kosztuje), wariant odrzucony (czego świadomie NIE robicie i dlaczego).',
        'Trzymaj porządek doktryny: (dokładność zapasu >95% →) proces przed technologią (re-slotting) → automatyzacja punktowa najcięższej strefy → test sezonowości → odroczenie ciężkiej automatyzacji stałej (ASRS).',
        'Automatyzacja obszaru z nadmiarową zdolnością (nie-ograniczenia) to iluzoryczny zysk — najpierw zlokalizuj prawdziwe wąskie gardło.',
        'Payback czytaj względem pasma rynkowego: AMR/punktowa 18-24 mies., ASRS 36-60 mies. (ale życie 15-25 lat).',
        'Liczby (FTE, koszt, %, wolumeny) wyłącznie z bazy powyżej — nie licz i nie zmyślaj.',
      ]
    : [
        'Every move MUST carry: rationale, trade-off (what it costs), rejected variant (what you deliberately do NOT do and why).',
        'Keep the doctrine order: (inventory accuracy >95% →) process before technology (re-slotting) → point-automate the heaviest zone → seasonality test → defer heavy fixed automation (ASRS).',
        'Automating a spare-capacity (non-constraint) zone is an illusory gain — locate the true bottleneck first.',
        'Read payback against the market band: AMR/point 18-24 months, ASRS 36-60 months (but 15-25-year life).',
        'Numbers (FTE, cost, %, volumes) come exclusively from the baseline above — do not compute or invent them.',
      ];

  return `${header}

=== LOGISTICS BASELINE (facts — the only admissible source of amounts) ===
${baselineLine}

=== SCORED WAREHOUSE ZONES (5-zone flow) ===
${scoreLines}

=== W2 MOVE SEQUENCE (grounded draft — order = priority) ===
${seqLines}

=== INSIGHT TEMPLATES (doctrine §6 — anchor keyInsights on these shapes) ===
${insightLines}

Rules:
${rules.map((r) => `- ${r}`).join('\n')}

QUALITY BARS:
- Answer-first: "verdict" is a thesis about the automate/where/what-technology/what-sequence decision, not a recap of the inputs.
- Numbers exclusively from the facts above; do not compute or invent new ones.
- Zero filler and zero AI meta-phrases ("As an AI", "Based on the provided data", "In conclusion") — write like a partner signing the work with their name.
- Every sentence falsifiable: with opposite facts it would read differently.
- Map the grounded W2 sequence above into 3-5 "initiatives", preserving its order (order = priority).
- This is a DECISION artefact, not a technology list: end on a sequence and a defensible number, never on "here are machines you could buy".
- Respond in ${isPolish ? 'Polish' : 'English'}, active voice, partner tone.

Return JSON:
{
  "summary": {
    "verdict": "answer-first, 1-2 sentences: whether and WHERE automation creates value, and in what sequence",
    "executiveSummary": "3-4 sentences: restate the verdict, then why — anchored in the heaviest-motion zone, the process-first lever and the seasonality/accuracy gates above",
    "keyInsights": ["3 insights, each tied to the facts above and shaped like the §6 templates"],
    "appliedConclusions": ["what to do first (usually process, 0 CAPEX)", "what NOT to automate yet and why", "what to validate next"],
    "tradeoffs": [{"chosen":"...","rejected":"...","why":"..."}],
    "expectedEffect": {"text":"labour / throughput / working-capital change, behaviorally observable","horizon":"..."}
  },
  "initiatives": [{"title":"...","description":"what to do + first step (verb + artifact + role)","type":"operational","estimatedImpact":"high|medium|low","estimatedEffort":"high|medium|low","rationale":"why — names the trade-off (chosen at the cost of what) and the rejected variant"}]
}`;
}

/**
 * Builds the deepening prompt for a single zone rung — used when the user asks AI
 * to "think deeper" on a specific warehouse zone.
 */
export function buildLogisticsDeepenPrompt(
  zone: LogisticsZoneId,
  rungId: 'surface' | 'evidence' | 'quantification' | 'risk-capability',
  isPolish: boolean
): string | null {
  const rungs = localizeLadder(zone, isPolish);
  const rung = rungs.find((r) => r.id === rungId);
  if (!rung) return null;
  return `${rung.question}\n\n${isPolish ? 'Kontekst konsultanta' : 'Consultant framing'}: ${rung.rationale}`;
}

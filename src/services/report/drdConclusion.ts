/**
 * DRD Report — Conclusion Layer (deterministic, no LLM)
 *
 * Turns DRD engine output (`DRDAssessmentData` + `drdStructure` helpers) into the
 * WNIOSKOWA (conclusive) presentation layer, mirroring the SIRI conclusion layer
 * (see siriConclusion.ts), per `docs/standards/CONCLUSION_LAYER_STANDARD.md`
 * variant **W1**:
 *   - answer-first executive summary (verdict headline, K1→K2→K3→K4)
 *   - top-3 gap cards ("co jest → co znaczy → co robić → efekt")
 *
 * HARD RULE ("liczby tylko z silnika" / numbers only from the engine): every number
 * here is read from the DRD engine (per-axis current/target/gap, normalized %,
 * levelCount, axis level titles). NOTHING is invented, no LLM is called. This
 * module only INTERPRETS engine facts into consultant-grade prose deterministically.
 *
 * MIXED SCALES: DRD axes use different level scales (5, 6 or 7). Verdicts are
 * expressed in scale-independent normalized % (level / levelCount × 100), while
 * gaps are ranked by the RAW gap (target − current on the axis' own scale), the
 * same rule the DRD report template uses.
 */

import DRD_STRUCTURE, { getAxisById } from '../drdStructure';
import type { DRDAssessmentData, DRDAxisId, DRDAxisScore } from '../../types';

// ============================================
// TYPES (mirror SIRIConclusionModel so renderers stay uniform)
// ============================================

export type DRDLanguage = 'pl' | 'en';

/** Answer-first executive summary — 5 blocks mapping to K1→K2→K3→K4. */
export interface DRDExecutiveSummary {
  headline: string;
  k1_state: string;
  k2_meaning: string;
  k3_threeGaps: string;
  k4_whatFirst: string;
  k5_effect: string;
  facts: {
    overallNormalized: number;
    overallVerdict: string;
    strongestName: string;
    strongestNormalized: number;
    weakestName: string;
    weakestNormalized: number;
    weakestGap: number;
    assessedAxes: number;
    totalAxes: number;
  };
  confidence: 'high' | 'medium' | 'low' | 'insufficient';
}

/** Top-3 gap card following "co jest → co znaczy → co robić → efekt". */
export interface DRDGapCard {
  axisId: number;
  axisName: string;
  current: number;
  target: number;
  gap: number;
  levelCount: number;
  currentLevelTitle: string;
  targetLevelTitle: string;
  whatIs: string;
  whatItMeans: string;
  whatToDo: string;
  effect: string;
}

export interface DRDConclusionModel {
  language: DRDLanguage;
  executiveSummary: DRDExecutiveSummary;
  gapCards: DRDGapCard[];
}

// ============================================
// HELPERS
// ============================================

const round1 = (n: number) => Math.round(n * 10) / 10;

interface AxisRow {
  id: number;
  name: string;
  current: number;
  target: number;
  gap: number;
  levelCount: number;
  normalizedCurrent: number;
  normalizedTarget: number;
}

function axisName(axisId: number, isPL: boolean): string {
  const axis = getAxisById(axisId);
  if (!axis) return `Axis ${axisId}`;
  return isPL ? axis.namePL || axis.name : axis.name;
}

/** Title of the maturity level nearest to `score` on an axis' own scale. */
function levelTitle(axisId: number, score: number, isPL: boolean): string {
  const axis = getAxisById(axisId);
  if (!axis || !axis.areas.length) return isPL ? `Poziom ${Math.round(score)}` : `Level ${Math.round(score)}`;
  // Axes share one level ladder per axis; use the first area's levels as the canon titles.
  const levels = axis.areas[0].levels || [];
  const idx = Math.max(1, Math.min(axis.levelCount, Math.round(score))) - 1;
  return levels[idx]?.title || (isPL ? `Poziom ${idx + 1}` : `Level ${idx + 1}`);
}

/** Coarse maturity verdict from the normalized overall %. */
function verdictFor(normalized: number, isPL: boolean): string {
  if (normalized >= 75) return isPL ? 'wysoka' : 'high';
  if (normalized >= 50) return isPL ? 'średnia' : 'moderate';
  if (normalized >= 25) return isPL ? 'podstawowa' : 'basic';
  return isPL ? 'początkowa' : 'initial';
}

function buildAxisRows(data: DRDAssessmentData): AxisRow[] {
  return DRD_STRUCTURE.map((axis) => {
    const s: DRDAxisScore | undefined = data.axes?.[axis.id as DRDAxisId];
    const current = round1(Number(s?.current ?? 0));
    const target = round1(Number(s?.target ?? 0));
    const levelCount = s?.levelCount || axis.levelCount || 5;
    return {
      id: axis.id,
      name: axis.name,
      current,
      target,
      gap: round1(Math.max(0, target - current)),
      levelCount,
      normalizedCurrent: Number(s?.normalizedCurrent ?? (levelCount > 0 ? Math.round((current / levelCount) * 100) : 0)),
      normalizedTarget: Number(s?.normalizedTarget ?? (levelCount > 0 ? Math.round((target / levelCount) * 100) : 0)),
    };
  });
}

// ============================================
// EXECUTIVE SUMMARY (K1 → K2 → K3 → K4, answer-first)
// ============================================

function confidenceFor(assessed: number, total: number): DRDExecutiveSummary['confidence'] {
  if (total === 0) return 'insufficient';
  const pct = assessed / total;
  if (pct >= 0.9) return 'high';
  if (pct >= 0.6) return 'medium';
  if (pct >= 0.3) return 'low';
  return 'insufficient';
}

function buildExecutiveSummary(data: DRDAssessmentData, language: DRDLanguage): DRDExecutiveSummary {
  const isPL = language === 'pl';
  const rows = buildAxisRows(data);
  const totalAxes = DRD_STRUCTURE.length;

  const overallNormalized =
    Number.isFinite(data.overallNormalized) && data.overallNormalized > 0
      ? Math.round(data.overallNormalized)
      : (() => {
          const assessed = rows.filter((r) => r.current > 0);
          return assessed.length
            ? Math.round(assessed.reduce((a, r) => a + r.normalizedCurrent, 0) / assessed.length)
            : 0;
        })();
  const overallVerdict = verdictFor(overallNormalized, isPL);

  const assessed = rows.filter((r) => r.current > 0);
  const assessedCount = assessed.length;

  // Strongest = highest normalized current (scale-independent); weakest = largest RAW gap.
  const strongest = [...assessed].sort((a, b) => b.normalizedCurrent - a.normalizedCurrent)[0];
  const withGap = rows.filter((r) => r.gap > 0);
  const weakest = [...withGap].sort((a, b) => b.gap - a.gap)[0];
  const topGaps = [...withGap].sort((a, b) => b.gap - a.gap).slice(0, 3);

  const strongName = strongest ? axisName(strongest.id, isPL) : isPL ? 'brak ocenionej osi' : 'no assessed axis';
  const weakName = weakest ? axisName(weakest.id, isPL) : isPL ? 'brak luki' : 'no gap';
  const weakGap = weakest?.gap ?? 0;

  // ---- HEADLINE ----
  let headline: string;
  if (assessedCount === 0) {
    headline = isPL
      ? 'Diagnoza DRD niekompletna — brak danych do jednoznacznego werdyktu.'
      : 'DRD diagnosis incomplete — insufficient data for a firm verdict.';
  } else if (weakest) {
    headline = isPL
      ? `Dojrzałość cyfrowa „${overallVerdict}” (${overallNormalized}%): najmocniejsza oś to „${strongName}”, ale „${weakName}” hamuje przejście na wyższy poziom.`
      : `Digital maturity "${overallVerdict}" (${overallNormalized}%): the strongest axis is "${strongName}", but "${weakName}" blocks the next level.`;
  } else {
    headline = isPL
      ? `Dojrzałość cyfrowa „${overallVerdict}” (${overallNormalized}%) — cele osiągnięte na wszystkich osiach; utrzymać i podnieść poprzeczkę.`
      : `Digital maturity "${overallVerdict}" (${overallNormalized}%) — targets met across all axes; hold and raise the bar.`;
  }

  // ---- K1: STAN ----
  const k1 = isPL
    ? `Znormalizowana dojrzałość cyfrowa wynosi ${overallNormalized}% (poziom „${overallVerdict}”). Najmocniejsza oś to „${strongName}” (${strongest?.normalizedCurrent ?? 0}%); największa luka występuje w „${weakName}” (${round1(weakest?.current ?? 0)} wobec celu ${round1(weakest?.target ?? 0)} w skali ${weakest?.levelCount ?? 0}-poziomowej). Oceniono ${assessedCount} z ${totalAxes} osi.`
    : `Normalized digital maturity is ${overallNormalized}% (level "${overallVerdict}"). The strongest axis is "${strongName}" (${strongest?.normalizedCurrent ?? 0}%); the largest gap is in "${weakName}" (${round1(weakest?.current ?? 0)} vs target ${round1(weakest?.target ?? 0)} on a ${weakest?.levelCount ?? 0}-level scale). ${assessedCount} of ${totalAxes} axes assessed.`;

  // ---- K2: CO TO ZNACZY ----
  const k2 = weakest
    ? isPL
      ? `Profil jest nierównomierny: „${weakName}” odstaje o ${round1(weakGap)} poziomu od celu, co oznacza, że reszta transformacji cyfrowej opiera się na wąskim gardle — inwestycje w mocniejsze osie nie przełożą się na wynik, dopóki ta oś pozostaje na poziomie „${levelTitle(weakest.id, weakest.current, isPL)}”.`
      : `The profile is uneven: "${weakName}" trails the target by ${round1(weakGap)} levels, meaning the rest of the digital transformation rests on a bottleneck — investment in stronger axes will not convert to results while this axis sits at "${levelTitle(weakest.id, weakest.current, isPL)}".`
    : isPL
      ? `Wszystkie ocenione osie osiągnęły lub przekroczyły cel — organizacja nie ma pojedynczego wąskiego gardła; priorytetem staje się utrzymanie poziomu i podniesienie celów.`
      : `All assessed axes met or exceeded target — there is no single bottleneck; the priority shifts to sustaining the level and raising targets.`;

  // ---- K3 (three gaps narrated) ----
  const gapsList = topGaps.map((g) => `${axisName(g.id, isPL)} (${round1(g.current)}→${round1(g.target)})`).join('; ');
  const k3gaps = topGaps.length
    ? isPL
      ? `Trzy największe luki, w kolejności pilności: ${gapsList}. Zaniechanie ich domknięcia utrwala silosy i uniemożliwia realną integrację danych oraz procesów w całej organizacji.`
      : `The three largest gaps, in order of urgency: ${gapsList}. Leaving them open entrenches silos and prevents real integration of data and processes across the organization.`
    : isPL
      ? `Brak istotnych luk — wszystkie osie na poziomie celu.`
      : `No material gaps — all axes at target level.`;

  // ---- K4: CO NAJPIERW ----
  const k4 = weakest
    ? isPL
      ? `Najpierw: podnieść „${weakName}” z poziomu „${levelTitle(weakest.id, weakest.current, isPL)}” do „${levelTitle(weakest.id, weakest.target, isPL)}”, bo to ta oś wyznacza sufit dojrzałości cyfrowej i blokuje zwrot z pozostałych inwestycji. Kolejność wynika z wielkości luki (${round1(weakGap)}), nie z równoległego frontu.`
      : `First: raise "${weakName}" from "${levelTitle(weakest.id, weakest.current, isPL)}" to "${levelTitle(weakest.id, weakest.target, isPL)}", because this axis caps digital maturity and blocks the return on the other investments. The order follows gap size (${round1(weakGap)}), not a parallel front.`
    : isPL
      ? `Najpierw: zweryfikować cele w warsztacie i podnieść poprzeczkę na kolejnych osiach; nie ma luki wymuszającej pojedynczy priorytet.`
      : `First: validate targets in a workshop and raise the bar on the next axes; there is no gap forcing a single priority.`;

  // ---- K5: EFEKT ----
  const k5 = weakest
    ? isPL
      ? `Efekt: w horyzoncie 12 miesięcy domknięcie luki w „${weakName}” podnosi dojrzałość tej osi i odblokowuje integrację w pozostałych obszarach — mierzalnie: wzrost „${weakName}” do ${round1(weakest.target)} (${weakest.normalizedTarget}%) i przejście „${levelTitle(weakest.id, weakest.current, isPL)}” → „${levelTitle(weakest.id, weakest.target, isPL)}”.`
      : `Effect: within 12 months, closing the "${weakName}" gap raises this axis' maturity and unblocks integration across the remaining areas — measurably: "${weakName}" rising to ${round1(weakest.target)} (${weakest.normalizedTarget}%) and the level shift "${levelTitle(weakest.id, weakest.current, isPL)}" → "${levelTitle(weakest.id, weakest.target, isPL)}".`
    : isPL
      ? `Efekt: utrzymanie osiągniętego poziomu „${overallVerdict}” i gotowość do podniesienia celów w kolejnym cyklu diagnozy.`
      : `Effect: sustaining the achieved "${overallVerdict}" level and readiness to raise targets in the next diagnosis cycle.`;

  return {
    headline,
    k1_state: k1,
    k2_meaning: k2,
    k3_threeGaps: k3gaps,
    k4_whatFirst: k4,
    k5_effect: k5,
    facts: {
      overallNormalized,
      overallVerdict,
      strongestName: strongName,
      strongestNormalized: strongest?.normalizedCurrent ?? 0,
      weakestName: weakName,
      weakestNormalized: weakest?.normalizedCurrent ?? 0,
      weakestGap: round1(weakGap),
      assessedAxes: assessedCount,
      totalAxes,
    },
    confidence: confidenceFor(assessedCount, totalAxes),
  };
}

// ============================================
// TOP-3 GAP CARDS ("co jest → co znaczy → co robić → efekt")
// ============================================

function buildGapCards(data: DRDAssessmentData, language: DRDLanguage): DRDGapCard[] {
  const isPL = language === 'pl';
  const rows = buildAxisRows(data);
  const topGaps = rows
    .filter((r) => r.gap > 0)
    .sort((a, b) => b.gap - a.gap || a.id - b.id)
    .slice(0, 3);

  return topGaps.map((g) => {
    const aName = axisName(g.id, isPL);
    const curTitle = levelTitle(g.id, g.current, isPL);
    const tgtTitle = levelTitle(g.id, g.target, isPL);

    const whatIs = isPL
      ? `Oś „${aName}” jest na poziomie ${round1(g.current)}/${g.levelCount} — „${curTitle}” (${g.normalizedCurrent}%). Cel: ${round1(g.target)}/${g.levelCount} — „${tgtTitle}” (${g.normalizedTarget}%). Luka: ${round1(g.gap)} poziomu.`
      : `The "${aName}" axis sits at ${round1(g.current)}/${g.levelCount} — "${curTitle}" (${g.normalizedCurrent}%). Target: ${round1(g.target)}/${g.levelCount} — "${tgtTitle}" (${g.normalizedTarget}%). Gap: ${round1(g.gap)} levels.`;

    const whatItMeans = isPL
      ? `Na poziomie „${curTitle}” organizacja nie korzysta ze zdolności poziomu „${tgtTitle}”. W praktyce oznacza to, że oś „${aName}” pozostaje wąskim gardłem transformacji cyfrowej i ogranicza efekt inwestycji w pozostałe obszary.`
      : `At "${curTitle}", the organization does not use the "${tgtTitle}" capabilities. In practice, the "${aName}" axis remains a digital-transformation bottleneck and limits the payoff of investments in other areas.`;

    const whatToDo = isPL
      ? `Zaplanować i wdrożyć przejście „${aName}” na poziom „${tgtTitle}”, uruchamiając zdolności opisane dla tego poziomu; zacząć od pilotażu w jednym obszarze krytycznym, nie od całej organizacji.`
      : `Plan and deliver the move of "${aName}" to "${tgtTitle}", enabling the capabilities described for that level; start with a pilot in one critical area, not the whole organization.`;

    const effect = isPL
      ? `Domknięcie luki ${round1(g.gap)} poziomu podnosi „${aName}” do ${round1(g.target)}/${g.levelCount} (${g.normalizedTarget}%); w horyzoncie 6–12 miesięcy odblokowuje zależne inicjatywy i integrację danych.`
      : `Closing the ${round1(g.gap)}-level gap raises "${aName}" to ${round1(g.target)}/${g.levelCount} (${g.normalizedTarget}%); within 6–12 months it unblocks dependent initiatives and data integration.`;

    return {
      axisId: g.id,
      axisName: aName,
      current: g.current,
      target: g.target,
      gap: g.gap,
      levelCount: g.levelCount,
      currentLevelTitle: curTitle,
      targetLevelTitle: tgtTitle,
      whatIs,
      whatItMeans,
      whatToDo,
      effect,
    };
  });
}

// ============================================
// PUBLIC ENTRY
// ============================================

/**
 * Build the complete DRD conclusion model from engine output.
 * Deterministic, no LLM, no invented numbers.
 */
export function buildDRDConclusionModel(
  data: DRDAssessmentData,
  language: DRDLanguage = 'pl'
): DRDConclusionModel {
  return {
    language,
    executiveSummary: buildExecutiveSummary(data, language),
    gapCards: buildGapCards(data, language),
  };
}

export default buildDRDConclusionModel;

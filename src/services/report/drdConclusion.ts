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

/**
 * One cross-axis dependency insight — the "so-what" between two related axes
 * (analogous to ADMA's FoF road). Because DRD axes use mixed scales, comparison
 * is done on the scale-independent normalized %.
 */
export interface DRDDependencyInsightItem {
  leadId: number;
  leadName: string;
  lagId: number;
  lagName: string;
  /** Comparable score (normalized %). */
  leadScore: number;
  lagScore: number;
  /** leadScore − lagScore (> 0), in normalized points. */
  imbalance: number;
  insight: string;
}

/** Cross-axis dependency section (mirrors ADMA `FoFRoad`). */
export interface DRDDependencyInsights {
  items: DRDDependencyInsightItem[];
  evaluatedPairs: number;
  summary: string;
}

export interface DRDConclusionModel {
  language: DRDLanguage;
  executiveSummary: DRDExecutiveSummary;
  gapCards: DRDGapCard[];
  dependencyInsights: DRDDependencyInsights;
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

/**
 * Recommended owner role per DRD axis (deterministic mapping — R6 "adresat").
 * Grounded in the semantics of each of the 7 DRD axes, not invented per run.
 * Mirrors ownerForBlock (SIRI) / ownerForPillar (ADMA).
 */
function ownerForAxis(axisId: number, isPL: boolean): string {
  const map: Record<number, [string, string]> = {
    1: [isPL ? 'Dyrektor Operacyjny' : 'Operations Lead', 'Operations Lead'], // Procesy Cyfrowe
    2: [isPL ? 'Dyrektor Produktu' : 'Head of Product', 'Head of Product'], // Produkty Cyfrowe
    3: [isPL ? 'Zarząd / Lider Cyfrowy' : 'Board / Digital Lead', 'Board'], // Cyfrowe Modele Biznesowe
    4: [isPL ? 'Lider Danych / CDO' : 'Data Lead / CDO', 'Data Lead'], // Zarządzanie Danymi
    5: [isPL ? 'HR / Lider Transformacji' : 'HR / Transformation Lead', 'HR Lead'], // Kultura Transformacji
    6: [isPL ? 'CISO / Lider Bezpieczeństwa IT' : 'CISO / IT Security Lead', 'CISO'], // Cyberbezpieczeństwo
    7: [isPL ? 'Lider AI / Danych' : 'AI / Data Lead', 'AI Lead'], // Dojrzałość AI
  };
  const entry = map[axisId];
  if (!entry) return isPL ? 'Lider Transformacji' : 'Transformation Lead';
  return isPL ? entry[0] : entry[1];
}

/**
 * Axis-specific business consequence of being stuck below target (the "so-what").
 * One per DRD axis — this is what turns an identical "bottleneck" sentence into an
 * authentic, org-relevant insight. Grounded in each axis' domain (the same domain
 * documented by `drdKnowledgeOverridesAxis*` at the area/level granularity).
 * Mirrors SIRI's per-block `meansTail`.
 */
function meansTailForAxis(axisId: number, isPL: boolean): string {
  const map: Record<number, [string, string]> = {
    1: [
      'procesy sprzedaży, produkcji i logistyki działają w oderwaniu od systemów — dane wprowadza się ręcznie, a decyzje zapadają bez wglądu w czasie rzeczywistym',
      'sales, production and logistics processes run detached from the systems — data is keyed in by hand and decisions are made without real-time visibility',
    ],
    2: [
      'oferta pozostaje produktem fizycznym bez warstwy cyfrowej — firma nie zbiera danych z użytkowania ani nie buduje przewagi na usługach wokół produktu',
      'the offering stays a physical product with no digital layer — the company collects no usage data and builds no advantage from product-adjacent services',
    ],
    3: [
      'przychód opiera się na jednorazowej sprzedaży — brakuje modeli subskrypcyjnych, platformowych czy opartych na danych, które skalują się bez proporcjonalnego wzrostu kosztów',
      'revenue rests on one-off sales — there are no subscription, platform or data-based models that scale without a proportional rise in cost',
    ],
    4: [
      'dane są rozproszone w silosach i niespójne — bez jednego źródła prawdy analityka i AI opierają się na kruchym fundamencie, a raporty trzeba uzgadniać ręcznie',
      'data sits scattered in silos and inconsistent — without a single source of truth, analytics and AI rest on a fragile foundation and reports must be reconciled by hand',
    ],
    5: [
      'transformacja zależy od pojedynczych liderów, nie od zdolności organizacji — inicjatywy cyfrowe wygasają, gdy zabraknie sponsora, a zespoły nie eksperymentują samodzielnie',
      'transformation depends on a few individuals rather than an organizational capability — digital initiatives fade when the sponsor leaves and teams do not experiment on their own',
    ],
    6: [
      'zabezpieczenia są reaktywne — rosnąca cyfryzacja powiększa powierzchnię ataku szybciej niż zdolność jej obrony, co zagraża ciągłości działania i wiarygodności wobec klientów',
      'security is reactive — growing digitalization widens the attack surface faster than the ability to defend it, threatening business continuity and customer trust',
    ],
    7: [
      'AI pozostaje eksperymentem w pilotażach — bez danych, procesów i kompetencji modele nie przekładają się na powtarzalną wartość operacyjną',
      'AI stays an experiment stuck in pilots — without the data, processes and skills, models do not convert into repeatable operational value',
    ],
  };
  const entry = map[axisId];
  if (!entry) {
    return isPL
      ? 'oś pozostaje wąskim gardłem transformacji cyfrowej i ogranicza efekt inwestycji w pozostałe obszary'
      : 'the axis remains a digital-transformation bottleneck and limits the payoff of investments in other areas';
  }
  return isPL ? entry[0] : entry[1];
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
  const weakOwner = weakest ? ownerForAxis(weakest.id, isPL) : '';
  const k4 = weakest
    ? isPL
      ? `Najpierw: ${weakOwner} — podnieść „${weakName}” z poziomu „${levelTitle(weakest.id, weakest.current, isPL)}” do „${levelTitle(weakest.id, weakest.target, isPL)}”, bo to ta oś wyznacza sufit dojrzałości cyfrowej i blokuje zwrot z pozostałych inwestycji. Kolejność wynika z wielkości luki (${round1(weakGap)}), nie z równoległego frontu.`
      : `First: ${weakOwner} — raise "${weakName}" from "${levelTitle(weakest.id, weakest.current, isPL)}" to "${levelTitle(weakest.id, weakest.target, isPL)}", because this axis caps digital maturity and blocks the return on the other investments. The order follows gap size (${round1(weakGap)}), not a parallel front.`
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

    const owner = ownerForAxis(g.id, isPL);
    const meansTail = meansTailForAxis(g.id, isPL);

    const whatItMeans = isPL
      ? `Na poziomie „${curTitle}” organizacja nie korzysta ze zdolności poziomu „${tgtTitle}”. W praktyce oznacza to, że ${meansTail} — oś „${aName}” pozostaje wąskim gardłem transformacji cyfrowej.`
      : `At "${curTitle}", the organization does not use the "${tgtTitle}" capabilities. In practice this means ${meansTail} — the "${aName}" axis remains a digital-transformation bottleneck.`;

    const whatToDo = isPL
      ? `${owner} — zaplanować i wdrożyć przejście „${aName}” na poziom „${tgtTitle}”, uruchamiając zdolności opisane dla tego poziomu; zacząć od pilotażu w jednym obszarze krytycznym, nie od całej organizacji.`
      : `${owner} — plan and deliver the move of "${aName}" to "${tgtTitle}", enabling the capabilities described for that level; start with a pilot in one critical area, not the whole organization.`;

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
// CROSS-AXIS DEPENDENCY INSIGHTS ("so-what")
// ============================================

/**
 * Related DRD axis pairs — reused from the (dead) `assessmentCoach.ts`
 * `RELATED_DIMENSIONS.DRD` (lines 121–143). Doctrine: when one axis is high, the
 * axis it depends on should not be far behind — a wide gap is a bottleneck.
 * The coach keys pairs by string dim-id; DRD conclusion works in numeric axis ids,
 * so the pairs are expressed as axis ids via the canonical DRD axis order.
 */
const DRD_DIM_KEY_TO_AXIS: Record<string, number> = {
  processes: 1,
  digitalProducts: 2,
  businessModels: 3,
  dataManagement: 4,
  culture: 5,
  cybersecurity: 6,
  aiMaturity: 7,
};

const DRD_RELATED_PAIRS: Array<[number, number]> = [
  [DRD_DIM_KEY_TO_AXIS.aiMaturity, DRD_DIM_KEY_TO_AXIS.dataManagement],
  [DRD_DIM_KEY_TO_AXIS.digitalProducts, DRD_DIM_KEY_TO_AXIS.businessModels],
  [DRD_DIM_KEY_TO_AXIS.processes, DRD_DIM_KEY_TO_AXIS.dataManagement],
  [DRD_DIM_KEY_TO_AXIS.culture, DRD_DIM_KEY_TO_AXIS.cybersecurity],
];

/** Minimum normalized-% imbalance to flag a dependency as rozjechana. */
const DRD_DEPENDENCY_THRESHOLD = 20;

/** Why the two axes are coupled — keyed by the numerically-sorted axis-id pair. */
function drdPairRationale(a: number, b: number, isPL: boolean): string {
  const key = [a, b].sort((x, y) => x - y).join('|');
  const map: Record<string, [string, string]> = {
    // dataManagement(4) | aiMaturity(7)
    '4|7': [
      'AI opiera się na fundamencie danych — modele są tak dobre, jak dane, które je zasilają',
      'AI rests on the data foundation — models are only as good as the data feeding them',
    ],
    // digitalProducts(2) | businessModels(3)
    '2|3': [
      'cyfrowe modele biznesowe wyrastają z cyfrowych produktów i danych, które one generują',
      'digital business models grow out of digital products and the data they generate',
    ],
    // processes(1) | dataManagement(4)
    '1|4': [
      'cyfrowe procesy wymagają uporządkowanych danych, by działać end-to-end',
      'digital processes need well-managed data to run end-to-end',
    ],
    // culture(5) | cybersecurity(6)
    '5|6': [
      'kultura transformacji i bezpieczeństwo rosną razem — świadomość ryzyka jest częścią dojrzałości cyfrowej',
      'transformation culture and security rise together — risk awareness is part of digital maturity',
    ],
  };
  const entry = map[key];
  if (!entry) {
    return isPL
      ? 'te osie są współzależne i powinny dojrzewać równolegle'
      : 'these axes are interdependent and should mature in step';
  }
  return isPL ? entry[0] : entry[1];
}

function buildDependencyInsights(
  data: DRDAssessmentData,
  language: DRDLanguage
): DRDDependencyInsights {
  const isPL = language === 'pl';
  const byId = new Map(buildAxisRows(data).map((r) => [r.id, r]));

  let evaluatedPairs = 0;
  const items: DRDDependencyInsightItem[] = [];

  for (const [x, y] of DRD_RELATED_PAIRS) {
    const rx = byId.get(x);
    const ry = byId.get(y);
    if (!rx || !ry || rx.current <= 0 || ry.current <= 0) continue;
    evaluatedPairs += 1;

    // Mixed scales → compare on normalized %.
    const lead = rx.normalizedCurrent >= ry.normalizedCurrent ? rx : ry;
    const lag = rx.normalizedCurrent >= ry.normalizedCurrent ? ry : rx;
    const imbalance = Math.round(lead.normalizedCurrent - lag.normalizedCurrent);
    if (imbalance < DRD_DEPENDENCY_THRESHOLD) continue;

    const leadName = axisName(lead.id, isPL);
    const lagName = axisName(lag.id, isPL);
    const rationale = drdPairRationale(x, y, isPL);
    const insight = isPL
      ? `„${leadName}” (${lead.normalizedCurrent}%) wyprzedza powiązaną oś „${lagName}” (${lag.normalizedCurrent}%) o ${imbalance} pkt — ${rationale}. Dopóki „${lagName}” nie nadąży, przewaga w „${leadName}” nie przełoży się na wynik.`
      : `"${leadName}" (${lead.normalizedCurrent}%) is ahead of the linked axis "${lagName}" (${lag.normalizedCurrent}%) by ${imbalance} pts — ${rationale}. Until "${lagName}" catches up, the edge in "${leadName}" will not convert to results.`;

    items.push({
      leadId: lead.id,
      leadName,
      lagId: lag.id,
      lagName,
      leadScore: lead.normalizedCurrent,
      lagScore: lag.normalizedCurrent,
      imbalance,
      insight,
    });
  }

  items.sort((a, b) => b.imbalance - a.imbalance);

  let summary: string;
  if (items.length > 0) {
    const top = items[0];
    summary = isPL
      ? `Rozjazd w ${items.length} z ${evaluatedPairs} powiązanych par osi — największy „${top.leadName}” ⟂ „${top.lagName}” (${top.imbalance} pkt). Wyrównanie tych par odblokowuje wartość powiązanych inwestycji, zanim doda się kolejne inicjatywy.`
      : `${items.length} of ${evaluatedPairs} related axis pairs are out of balance — the widest is "${top.leadName}" ⟂ "${top.lagName}" (${top.imbalance} pts). Aligning these pairs unlocks the value of linked investments before adding new initiatives.`;
  } else if (evaluatedPairs > 0) {
    summary = isPL
      ? `Powiązane osie są zrównoważone — żadna para współzależnych obszarów nie rozjeżdża się istotnie.`
      : `Related axes are balanced — no interdependent pair is materially out of step.`;
  } else {
    summary = isPL
      ? `Za mało ocenionych par współzależnych osi, by ocenić zależności.`
      : `Not enough assessed interdependent pairs to judge dependencies.`;
  }

  return { items, evaluatedPairs, summary };
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
    dependencyInsights: buildDependencyInsights(data, language),
  };
}

export default buildDRDConclusionModel;

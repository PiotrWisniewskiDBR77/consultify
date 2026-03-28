/**
 * Assessment Deck Service
 * Generates sponsor-ready PPTX decks for assessment frameworks (DRD, SIRI, ADMA).
 */

const PptxGenJS: any = require('pptxgenjs');
import logger from '../utils/Logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FrameworkType = 'DRD' | 'SIRI' | 'ADMA';

export interface AssessmentDeckData {
  framework: FrameworkType;
  assessmentName: string;
  organizationName: string;
  projectName?: string;
  assessmentDate: string;
  overallScore: number;
  scaleMax: number;
  /**
   * SIRI appendix: prioritisation matrix (16 areas). Optional for legacy payloads.
   */
  prioritisationMatrix?: Record<string, number>;
  categories: Array<{
    id: string;
    name: string;
    score: number;
    dimensions: Array<{
      id: string;
      name: string;
      current: number;
      target: number;
      gap: number;
    }>;
  }>;
  topStrengths: Array<{ name: string; score: number; category: string }>;
  topGaps: Array<{ name: string; current: number; target: number; gap: number; category: string }>;
  dataGaps: Array<{ name: string; reason: string }>;
  language?: 'en' | 'pl';
}

export interface DeckGenerationResult {
  buffer: Buffer;
  slideCount: number;
  filename: string;
}

// ---------------------------------------------------------------------------
// Brand palette
// ---------------------------------------------------------------------------

const BRAND = {
  primary: '6366F1',
  secondary: '1E293B',
  accent: '22C55E',
  warning: 'F59E0B',
  danger: 'EF4444',
  text: '1E293B',
  textLight: '64748B',
  background: 'FFFFFF',
  surface: 'F8FAFC',
};

const FRAMEWORK_COLORS: Record<FrameworkType, string> = {
  DRD: '7C3AED',
  SIRI: '3B82F6',
  ADMA: '22C55E',
};

const FRAMEWORK_SCALE: Record<FrameworkType, { min: number; max: number; label: string }> = {
  DRD: { min: 1, max: 7, label: '1–7' },
  SIRI: { min: 0, max: 5, label: '0–5' },
  ADMA: { min: 1, max: 5, label: '1–5' },
};

const FRAMEWORK_DESCRIPTION: Record<FrameworkType, Record<'en' | 'pl', string>> = {
  DRD: {
    en: 'Digital Readiness Diagnostic — a 7-axis framework evaluating organisational digital maturity across strategy, people, processes, technology, data, governance and culture.',
    pl: 'Diagnostyka Gotowości Cyfrowej — 7-osiowy framework oceniający dojrzałość cyfrową organizacji w obszarach strategii, ludzi, procesów, technologii, danych, zarządzania i kultury.',
  },
  SIRI: {
    en: 'Smart Industry Readiness Index — a structured framework with 3 Building Blocks, 8 Dimensions, and 16 Prioritisation Areas measuring Industry 4.0 readiness.',
    pl: 'Smart Industry Readiness Index — ustrukturyzowany framework z 3 blokami, 8 wymiarami i 16 obszarami priorytetyzacji mierzący gotowość do Przemysłu 4.0.',
  },
  ADMA: {
    en: 'Advanced Digital Maturity Assessment — a 5-pillar framework evaluating smart manufacturing maturity across strategy, products, operations, supply chain and data-driven services.',
    pl: 'Advanced Digital Maturity Assessment — 5-filarowy framework oceniający dojrzałość inteligentnej produkcji w obszarach strategii, produktów, operacji, łańcucha dostaw i usług opartych na danych.',
  },
};

// ---------------------------------------------------------------------------
// i18n helpers
// ---------------------------------------------------------------------------

type LangKey =
  | 'confidential'
  | 'agenda'
  | 'methodology'
  | 'overallScore'
  | 'categoryBreakdown'
  | 'gapAnalysis'
  | 'strengths'
  | 'dataGaps'
  | 'roadmap'
  | 'nextSteps'
  | 'thankYou'
  | 'assessmentApproach'
  | 'scaleExplanation'
  | 'shortTerm'
  | 'mediumTerm'
  | 'longTerm'
  | 'dimension'
  | 'current'
  | 'target'
  | 'gap'
  | 'category'
  | 'score'
  | 'area'
  | 'reason'
  | 'noDataGaps'
  | 'agendaItems'
  | 'nextStepsItems'
  | 'contactLine'
  | 'brandLine';

const LABELS: Record<LangKey, Record<'en' | 'pl', string>> = {
  confidential: { en: 'CONFIDENTIAL', pl: 'POUFNE' },
  agenda: { en: 'Agenda', pl: 'Agenda' },
  methodology: { en: 'Methodology Overview', pl: 'Przegląd Metodologii' },
  overallScore: { en: 'Overall Maturity Score', pl: 'Ogólny Wynik Dojrzałości' },
  categoryBreakdown: { en: 'Category Breakdown', pl: 'Rozkład Kategorii' },
  gapAnalysis: { en: 'Gap Analysis', pl: 'Analiza Luk' },
  strengths: { en: 'Key Strengths', pl: 'Kluczowe Mocne Strony' },
  dataGaps: { en: 'Data Gaps & Unknowns', pl: 'Luki Danych i Niewiadome' },
  roadmap: { en: 'Priorities & Roadmap', pl: 'Priorytety i Roadmapa' },
  nextSteps: { en: 'Next Steps', pl: 'Następne Kroki' },
  thankYou: { en: 'Thank You', pl: 'Dziękujemy' },
  assessmentApproach: { en: 'Assessment Approach', pl: 'Podejście do Oceny' },
  scaleExplanation: { en: 'Maturity scale', pl: 'Skala dojrzałości' },
  shortTerm: { en: 'Short-term (0-3 months)', pl: 'Krótkoterminowe (0-3 mies.)' },
  mediumTerm: { en: 'Medium-term (3-12 months)', pl: 'Średnioterminowe (3-12 mies.)' },
  longTerm: { en: 'Long-term (12+ months)', pl: 'Długoterminowe (12+ mies.)' },
  dimension: { en: 'Dimension', pl: 'Wymiar' },
  current: { en: 'Current', pl: 'Obecny' },
  target: { en: 'Target', pl: 'Docelowy' },
  gap: { en: 'Gap', pl: 'Luka' },
  category: { en: 'Category', pl: 'Kategoria' },
  score: { en: 'Score', pl: 'Wynik' },
  area: { en: 'Area', pl: 'Obszar' },
  reason: { en: 'Reason', pl: 'Powód' },
  noDataGaps: { en: 'No data gaps identified.', pl: 'Nie zidentyfikowano luk w danych.' },
  agendaItems: {
    en: '1. Methodology Overview\n2. Overall Maturity Score\n3. Category Breakdown & Dimensions\n4. Gap Analysis\n5. Key Strengths\n6. Priorities & Roadmap\n7. Next Steps',
    pl: '1. Przegląd Metodologii\n2. Ogólny Wynik Dojrzałości\n3. Rozkład Kategorii i Wymiary\n4. Analiza Luk\n5. Kluczowe Mocne Strony\n6. Priorytety i Roadmapa\n7. Następne Kroki',
  },
  nextStepsItems: {
    en: '1. Review findings with key stakeholders\n2. Validate gap priorities against business objectives\n3. Assign initiative owners and define budgets\n4. Establish governance cadence for progress tracking\n5. Schedule follow-up assessment in 6-12 months',
    pl: '1. Omówienie wyników z kluczowymi interesariuszami\n2. Walidacja priorytetów luk względem celów biznesowych\n3. Przypisanie właścicieli inicjatyw i zdefiniowanie budżetów\n4. Ustalenie kadencji zarządzania do śledzenia postępów\n5. Zaplanowanie ponownej oceny za 6-12 miesięcy',
  },
  contactLine: {
    en: 'For questions or follow-up, please contact your Consultify advisor.',
    pl: 'W razie pytań lub dalszych kroków, prosimy o kontakt z Państwa doradcą Consultify.',
  },
  brandLine: {
    en: 'Powered by Consultify',
    pl: 'Wspierane przez Consultify',
  },
};

function t(key: LangKey, lang: 'en' | 'pl'): string {
  return LABELS[key]?.[lang] ?? LABELS[key]?.en ?? key;
}

// ---------------------------------------------------------------------------
// Slide helpers
// ---------------------------------------------------------------------------

function headerBar(slide: any, fwColor: string): void {
  slide.addShape('rect', {
    x: 0,
    y: 0,
    w: 13.33,
    h: 0.06,
    fill: { color: fwColor },
  });
}

function slideNumber(slide: any, num: number): void {
  slide.addText(String(num), {
    x: 12.4,
    y: 7.1,
    w: 0.7,
    h: 0.3,
    fontSize: 9,
    color: BRAND.textLight,
    align: 'right',
    fontFace: 'Calibri',
  });
}

function sectionTitle(slide: any, text: string, opts?: { y?: number }): void {
  slide.addText(text, {
    x: 0.6,
    y: opts?.y ?? 0.3,
    w: 12.0,
    h: 0.6,
    fontSize: 24,
    bold: true,
    color: BRAND.secondary,
    fontFace: 'Calibri',
  });
}

function bodyText(
  slide: any,
  text: string,
  opts?: { x?: number; y?: number; w?: number; h?: number; fontSize?: number }
): void {
  slide.addText(text, {
    x: opts?.x ?? 0.6,
    y: opts?.y ?? 1.2,
    w: opts?.w ?? 12.0,
    h: opts?.h ?? 5.5,
    fontSize: opts?.fontSize ?? 14,
    color: BRAND.text,
    fontFace: 'Calibri Light',
    valign: 'top',
  });
}

function interpretScore(score: number, max: number): string {
  const pct = score / max;
  if (pct >= 0.8) return 'Advanced';
  if (pct >= 0.6) return 'Established';
  if (pct >= 0.4) return 'Developing';
  if (pct >= 0.2) return 'Emerging';
  return 'Initial';
}

// ---------------------------------------------------------------------------
// ADMA: T1–T7 aggregation (SSOT mapping v1)
// ---------------------------------------------------------------------------

type ADMATransformationId = 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7';

const ADMA_T1T7_MAPPING_V1: Array<{
  id: ADMATransformationId;
  name: string;
  weights: Record<string, number>;
}> = [
  {
    id: 'T1',
    name: 'Advanced Manufacturing Technologies',
    weights: { production_tech: 0.7, digital_investments: 0.3 },
  },
  {
    id: 'T2',
    name: 'Digital Factory',
    weights: { production_it: 0.45, data_collection: 0.35, data_analytics: 0.2 },
  },
  {
    id: 'T3',
    name: 'ECO Factory',
    weights: { data_collection: 0.4, data_analytics: 0.35, production_tech: 0.25 },
  },
  {
    id: 'T4',
    name: 'End-to-end Customer Focused Engineering',
    weights: { product_data: 0.55, product_features: 0.3, digital_strategy: 0.15 },
  },
  {
    id: 'T5',
    name: 'Human Centred Organisation',
    weights: { digital_culture: 0.7, digital_strategy: 0.3 },
  },
  {
    id: 'T6',
    name: 'Smart Manufacturing',
    weights: { data_analytics: 0.45, production_it: 0.3, production_tech: 0.25 },
  },
  {
    id: 'T7',
    name: 'Value Chain Oriented Open Factory',
    weights: { supply_visibility: 0.5, supply_integration: 0.35, digital_strategy: 0.15 },
  },
];

function buildDimensionIndex(
  data: AssessmentDeckData
): Record<string, { current: number; target: number }> {
  const out: Record<string, { current: number; target: number }> = {};
  for (const c of data.categories || []) {
    for (const d of c.dimensions || []) {
      out[String(d.id)] = { current: Number(d.current || 0), target: Number(d.target || 0) };
    }
  }
  return out;
}

function weightedAvg(
  dimIndex: Record<string, { current: number; target: number }>,
  weights: Record<string, number>,
  field: 'current' | 'target'
): number | null {
  let sum = 0;
  let wSum = 0;
  for (const [dimId, w] of Object.entries(weights)) {
    const v = dimIndex?.[dimId]?.[field];
    if (!Number.isFinite(Number(v))) continue;
    sum += Number(v) * w;
    wSum += w;
  }
  if (wSum <= 0) return null;
  return Math.round((sum / wSum) * 10) / 10;
}

function computeAdmaT1T7(data: AssessmentDeckData, fofBenchmark = 4.0) {
  const dimIndex = buildDimensionIndex(data);
  return ADMA_T1T7_MAPPING_V1.map((m) => {
    const current = weightedAvg(dimIndex, m.weights, 'current');
    const target = weightedAvg(dimIndex, m.weights, 'target');
    const gapToFof = current === null ? null : Math.round((fofBenchmark - current) * 10) / 10;
    return { ...m, current, target, fofBenchmark, gapToFof };
  });
}

function addAdmaT1T7Slide(
  pptx: any,
  data: AssessmentDeckData,
  fwColor: string,
  lang: 'en' | 'pl',
  num: number
): void {
  const slide = pptx.addSlide();
  slide.background = { color: BRAND.background };
  headerBar(slide, fwColor);
  sectionTitle(
    slide,
    lang === 'pl'
      ? 'Transformacje (T1–T7) + benchmark FoF'
      : 'Transformations (T1–T7) + FoF benchmark'
  );

  const rows = computeAdmaT1T7(data, 4.0);
  const lines = [
    lang === 'pl'
      ? 'Obszar | Firma | Cel | FoF | Luka do FoF'
      : 'Area | Company | Target | FoF | Gap to FoF',
    ...rows.map((r) => {
      const c = r.current === null ? '—' : r.current.toFixed(1);
      const t = r.target === null ? '—' : r.target.toFixed(1);
      const g = r.gapToFof === null ? '—' : r.gapToFof.toFixed(1);
      return `${r.id} ${r.name} | ${c} | ${t} | ${r.fofBenchmark.toFixed(1)} | ${g}`;
    }),
  ].join('\n');

  bodyText(slide, lines, { y: 1.2, fontSize: 13, h: 5.8 });
  slideNumber(slide, num);
}

function addSiriPrioritisationSlide(
  pptx: any,
  data: AssessmentDeckData,
  fwColor: string,
  lang: 'en' | 'pl',
  num: number
): void {
  const matrix = data.prioritisationMatrix || {};
  const entries = Object.entries(matrix)
    .map(([k, v]) => ({ id: k, score: Number(v || 0) }))
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 12);

  if (!entries.length) return;

  const slide = pptx.addSlide();
  slide.background = { color: BRAND.background };
  headerBar(slide, fwColor);
  sectionTitle(
    slide,
    lang === 'pl'
      ? 'Macierz (16 obszarów) — priorytetyzacja'
      : 'Assessment Matrix (16 areas) — prioritisation'
  );

  const lines = [
    lang === 'pl' ? 'Top priorytety (score):' : 'Top priorities (score):',
    ...entries.map((e) => `- ${String(e.id).replace(/_/g, ' ')}: ${e.score.toFixed(1)}`),
  ].join('\n');

  bodyText(slide, lines, { y: 1.2, fontSize: 14, h: 5.8 });
  slideNumber(slide, num);
}

function gapColor(gap: number, max: number): string {
  const pct = gap / max;
  if (pct >= 0.5) return BRAND.danger;
  if (pct >= 0.25) return BRAND.warning;
  return BRAND.accent;
}

// ---------------------------------------------------------------------------
// Slide builders
// ---------------------------------------------------------------------------

function addCoverSlide(
  pptx: any,
  data: AssessmentDeckData,
  fwColor: string,
  lang: 'en' | 'pl'
): void {
  const slide = pptx.addSlide();
  slide.background = { color: BRAND.secondary };

  slide.addShape('rect', {
    x: 0,
    y: 0,
    w: 13.33,
    h: 0.12,
    fill: { color: fwColor },
  });

  slide.addText(data.framework, {
    x: 0.8,
    y: 1.2,
    w: 11.5,
    h: 0.8,
    fontSize: 18,
    color: fwColor,
    fontFace: 'Calibri',
    bold: true,
  });

  slide.addText(data.assessmentName, {
    x: 0.8,
    y: 2.0,
    w: 11.5,
    h: 1.2,
    fontSize: 36,
    bold: true,
    color: BRAND.background,
    fontFace: 'Calibri',
  });

  slide.addText(data.organizationName + (data.projectName ? `  |  ${data.projectName}` : ''), {
    x: 0.8,
    y: 3.4,
    w: 11.5,
    h: 0.6,
    fontSize: 16,
    color: BRAND.textLight,
    fontFace: 'Calibri Light',
  });

  slide.addText(data.assessmentDate, {
    x: 0.8,
    y: 4.2,
    w: 11.5,
    h: 0.5,
    fontSize: 14,
    color: BRAND.textLight,
    fontFace: 'Calibri Light',
  });

  slide.addShape('rect', {
    x: 10.5,
    y: 0.5,
    w: 2.2,
    h: 0.4,
    fill: { color: BRAND.danger },
  });
  slide.addText(t('confidential', lang), {
    x: 10.5,
    y: 0.5,
    w: 2.2,
    h: 0.4,
    fontSize: 10,
    bold: true,
    color: BRAND.background,
    align: 'center',
    valign: 'middle',
    fontFace: 'Calibri',
  });
}

function addAgendaSlide(pptx: any, fwColor: string, lang: 'en' | 'pl', num: number): void {
  const slide = pptx.addSlide();
  headerBar(slide, fwColor);
  sectionTitle(slide, t('agenda', lang));
  bodyText(slide, t('agendaItems', lang), { y: 1.4, fontSize: 16 });
  slideNumber(slide, num);
}

function addMethodologySlide(
  pptx: any,
  data: AssessmentDeckData,
  fwColor: string,
  lang: 'en' | 'pl',
  num: number
): void {
  const slide = pptx.addSlide();
  headerBar(slide, fwColor);
  sectionTitle(slide, t('methodology', lang));

  const desc =
    FRAMEWORK_DESCRIPTION[data.framework]?.[lang] ||
    FRAMEWORK_DESCRIPTION[data.framework]?.en ||
    '';
  const scale = FRAMEWORK_SCALE[data.framework];

  const content = [
    desc,
    '',
    `${t('scaleExplanation', lang)}: ${scale.label}`,
    '',
    `${t('assessmentApproach', lang)}:`,
    lang === 'pl'
      ? '• Strukturyzowane wywiady i przegląd dowodów\n• Ocena wymiarów względem zdefiniowanych poziomów dojrzałości\n• Walidacja wyników z kluczowymi interesariuszami'
      : '• Structured interviews and evidence review\n• Dimension-level scoring against defined maturity levels\n• Validation of findings with key stakeholders',
  ].join('\n');

  bodyText(slide, content, { y: 1.2, fontSize: 13 });
  slideNumber(slide, num);
}

function addOverallScoreSlide(
  pptx: any,
  data: AssessmentDeckData,
  fwColor: string,
  lang: 'en' | 'pl',
  num: number
): void {
  const slide = pptx.addSlide();
  headerBar(slide, fwColor);
  sectionTitle(slide, t('overallScore', lang));

  const scoreStr = data.overallScore.toFixed(1);
  slide.addText(scoreStr, {
    x: 0.6,
    y: 1.6,
    w: 4.0,
    h: 2.4,
    fontSize: 72,
    bold: true,
    color: fwColor,
    fontFace: 'Calibri',
    align: 'center',
    valign: 'middle',
  });
  slide.addText(`/ ${data.scaleMax}`, {
    x: 4.6,
    y: 2.6,
    w: 1.5,
    h: 0.8,
    fontSize: 28,
    color: BRAND.textLight,
    fontFace: 'Calibri Light',
    valign: 'middle',
  });
  slide.addText(interpretScore(data.overallScore, data.scaleMax), {
    x: 0.6,
    y: 4.1,
    w: 4.0,
    h: 0.5,
    fontSize: 16,
    color: BRAND.textLight,
    fontFace: 'Calibri Light',
    align: 'center',
  });

  if (data.categories.length > 0) {
    const chartData = [
      {
        name: lang === 'pl' ? 'Wynik' : 'Score',
        labels: data.categories.map((c) => c.name),
        values: data.categories.map((c) => c.score),
      },
    ];

    try {
      slide.addChart(pptx.charts.BAR, chartData, {
        x: 6.2,
        y: 1.2,
        w: 6.5,
        h: 5.2,
        barDir: 'bar',
        showValue: true,
        valAxisMaxVal: data.scaleMax,
        chartColors: [fwColor],
        showLegend: false,
        catAxisOrientation: 'minMax',
        valAxisOrientation: 'minMax',
      });
    } catch (chartErr: any) {
      logger.warn('[AssessmentDeck] Chart rendering failed, using text fallback', {
        error: chartErr?.message,
      });
      const fallback = data.categories
        .map((c) => `${c.name}: ${c.score.toFixed(1)} / ${data.scaleMax}`)
        .join('\n');
      bodyText(slide, fallback, { x: 6.2, y: 1.2, w: 6.5, h: 5.2, fontSize: 13 });
    }
  }

  slideNumber(slide, num);
}

function addCategoryBreakdownSlides(
  pptx: any,
  data: AssessmentDeckData,
  fwColor: string,
  lang: 'en' | 'pl',
  startNum: number
): number {
  const perSlide = 4;
  let num = startNum;

  for (let i = 0; i < data.categories.length; i += perSlide) {
    const batch = data.categories.slice(i, i + perSlide);
    const slide = pptx.addSlide();
    headerBar(slide, fwColor);
    sectionTitle(
      slide,
      t('categoryBreakdown', lang) +
        (data.categories.length > perSlide ? ` (${Math.floor(i / perSlide) + 1})` : '')
    );

    let yPos = 1.2;
    for (const cat of batch) {
      slide.addText(cat.name, {
        x: 0.6,
        y: yPos,
        w: 5.0,
        h: 0.35,
        fontSize: 14,
        bold: true,
        color: BRAND.secondary,
        fontFace: 'Calibri',
      });
      slide.addText(`${cat.score.toFixed(1)} / ${data.scaleMax}`, {
        x: 5.6,
        y: yPos,
        w: 1.5,
        h: 0.35,
        fontSize: 14,
        bold: true,
        color: fwColor,
        fontFace: 'Calibri',
        align: 'right',
      });

      yPos += 0.4;
      if (cat.dimensions.length > 0) {
        const dimLines = cat.dimensions
          .map(
            (d) =>
              `  ${d.name}:  ${d.current.toFixed(1)} → ${d.target.toFixed(1)}  (${lang === 'pl' ? 'luka' : 'gap'}: ${d.gap.toFixed(1)})`
          )
          .join('\n');
        const dimH = Math.min(cat.dimensions.length * 0.24 + 0.15, 1.5);
        slide.addText(dimLines, {
          x: 0.8,
          y: yPos,
          w: 11.5,
          h: dimH,
          fontSize: 11,
          color: BRAND.textLight,
          fontFace: 'Calibri Light',
          valign: 'top',
        });
        yPos += dimH + 0.15;
      }
    }

    slideNumber(slide, num);
    num++;
  }

  return num;
}

function addGapAnalysisSlide(
  pptx: any,
  data: AssessmentDeckData,
  fwColor: string,
  lang: 'en' | 'pl',
  num: number
): void {
  const slide = pptx.addSlide();
  headerBar(slide, fwColor);
  sectionTitle(slide, t('gapAnalysis', lang));

  const headerRow = [
    {
      text: t('area', lang),
      options: {
        bold: true,
        fontSize: 11,
        color: BRAND.background,
        fill: { color: BRAND.secondary },
      },
    },
    {
      text: t('category', lang),
      options: {
        bold: true,
        fontSize: 11,
        color: BRAND.background,
        fill: { color: BRAND.secondary },
      },
    },
    {
      text: t('current', lang),
      options: {
        bold: true,
        fontSize: 11,
        color: BRAND.background,
        fill: { color: BRAND.secondary },
        align: 'center',
      },
    },
    {
      text: t('target', lang),
      options: {
        bold: true,
        fontSize: 11,
        color: BRAND.background,
        fill: { color: BRAND.secondary },
        align: 'center',
      },
    },
    {
      text: t('gap', lang),
      options: {
        bold: true,
        fontSize: 11,
        color: BRAND.background,
        fill: { color: BRAND.secondary },
        align: 'center',
      },
    },
  ];

  const rows: any[][] = [headerRow];
  const gaps = data.topGaps.slice(0, 10);

  for (const g of gaps) {
    const gc = gapColor(g.gap, data.scaleMax);
    rows.push([
      { text: g.name, options: { fontSize: 10, color: BRAND.text } },
      { text: g.category, options: { fontSize: 10, color: BRAND.textLight } },
      { text: g.current.toFixed(1), options: { fontSize: 10, align: 'center', color: BRAND.text } },
      { text: g.target.toFixed(1), options: { fontSize: 10, align: 'center', color: BRAND.text } },
      { text: g.gap.toFixed(1), options: { fontSize: 10, align: 'center', bold: true, color: gc } },
    ]);
  }

  slide.addTable(rows, {
    x: 0.6,
    y: 1.2,
    w: 12.0,
    colW: [3.6, 2.8, 1.6, 1.6, 1.6],
    border: { pt: 0.5, color: 'E2E8F0' },
    fontFace: 'Calibri',
    autoPage: false,
  });

  slideNumber(slide, num);
}

function addStrengthsSlide(
  pptx: any,
  data: AssessmentDeckData,
  fwColor: string,
  lang: 'en' | 'pl',
  num: number
): void {
  const slide = pptx.addSlide();
  headerBar(slide, fwColor);
  sectionTitle(slide, t('strengths', lang));

  const items = data.topStrengths.slice(0, 8);
  let yPos = 1.2;

  for (const s of items) {
    slide.addShape('rect', {
      x: 0.6,
      y: yPos,
      w: 0.08,
      h: 0.55,
      fill: { color: BRAND.accent },
    });
    slide.addText(s.name, {
      x: 0.9,
      y: yPos,
      w: 7.0,
      h: 0.3,
      fontSize: 13,
      bold: true,
      color: BRAND.text,
      fontFace: 'Calibri',
    });
    slide.addText(
      `${t('score', lang)}: ${s.score.toFixed(1)} / ${data.scaleMax}  •  ${s.category}`,
      {
        x: 0.9,
        y: yPos + 0.28,
        w: 7.0,
        h: 0.25,
        fontSize: 10,
        color: BRAND.textLight,
        fontFace: 'Calibri Light',
      }
    );
    slide.addText(s.score.toFixed(1), {
      x: 10.5,
      y: yPos,
      w: 2.0,
      h: 0.55,
      fontSize: 22,
      bold: true,
      color: BRAND.accent,
      fontFace: 'Calibri',
      align: 'center',
      valign: 'middle',
    });
    yPos += 0.7;
  }

  slideNumber(slide, num);
}

function addDataGapsSlide(
  pptx: any,
  data: AssessmentDeckData,
  fwColor: string,
  lang: 'en' | 'pl',
  num: number
): void {
  const slide = pptx.addSlide();
  headerBar(slide, fwColor);
  sectionTitle(slide, t('dataGaps', lang));

  if (data.dataGaps.length === 0) {
    bodyText(slide, t('noDataGaps', lang), { y: 2.5, fontSize: 16 });
  } else {
    const headerRow = [
      {
        text: t('area', lang),
        options: {
          bold: true,
          fontSize: 11,
          color: BRAND.background,
          fill: { color: BRAND.secondary },
        },
      },
      {
        text: t('reason', lang),
        options: {
          bold: true,
          fontSize: 11,
          color: BRAND.background,
          fill: { color: BRAND.secondary },
        },
      },
    ];

    const rows: any[][] = [headerRow];
    for (const dg of data.dataGaps.slice(0, 12)) {
      rows.push([
        { text: dg.name, options: { fontSize: 10, color: BRAND.text } },
        { text: dg.reason, options: { fontSize: 10, color: BRAND.textLight } },
      ]);
    }

    slide.addTable(rows, {
      x: 0.6,
      y: 1.2,
      w: 12.0,
      colW: [4.0, 8.0],
      border: { pt: 0.5, color: 'E2E8F0' },
      fontFace: 'Calibri',
      autoPage: false,
    });
  }

  slideNumber(slide, num);
}

function addRoadmapSlide(
  pptx: any,
  data: AssessmentDeckData,
  fwColor: string,
  lang: 'en' | 'pl',
  num: number
): void {
  const slide = pptx.addSlide();
  headerBar(slide, fwColor);
  sectionTitle(slide, t('roadmap', lang));

  const sorted = [...data.topGaps].sort((a, b) => b.gap - a.gap);
  const critical = sorted.filter((g) => g.gap / data.scaleMax >= 0.5);
  const medium = sorted.filter((g) => g.gap / data.scaleMax >= 0.25 && g.gap / data.scaleMax < 0.5);
  const minor = sorted.filter((g) => g.gap / data.scaleMax < 0.25);

  const phases: Array<{ label: string; color: string; items: string[] }> = [
    {
      label: t('shortTerm', lang),
      color: BRAND.danger,
      items: critical.slice(0, 4).map((g) => g.name),
    },
    {
      label: t('mediumTerm', lang),
      color: BRAND.warning,
      items: medium.slice(0, 4).map((g) => g.name),
    },
    {
      label: t('longTerm', lang),
      color: BRAND.accent,
      items: minor.slice(0, 4).map((g) => g.name),
    },
  ];

  let xPos = 0.6;
  const colW = 3.9;

  for (const phase of phases) {
    slide.addShape('rect', {
      x: xPos,
      y: 1.3,
      w: colW,
      h: 0.45,
      fill: { color: phase.color },
    });
    slide.addText(phase.label, {
      x: xPos,
      y: 1.3,
      w: colW,
      h: 0.45,
      fontSize: 12,
      bold: true,
      color: BRAND.background,
      fontFace: 'Calibri',
      align: 'center',
      valign: 'middle',
    });

    const itemsText =
      phase.items.length > 0
        ? phase.items.map((n, i) => `${i + 1}. ${n}`).join('\n')
        : lang === 'pl'
          ? '— Brak elementów —'
          : '— No items —';

    slide.addText(itemsText, {
      x: xPos + 0.15,
      y: 1.9,
      w: colW - 0.3,
      h: 4.5,
      fontSize: 11,
      color: BRAND.text,
      fontFace: 'Calibri Light',
      valign: 'top',
    });

    xPos += colW + 0.25;
  }

  slideNumber(slide, num);
}

function addNextStepsSlide(pptx: any, fwColor: string, lang: 'en' | 'pl', num: number): void {
  const slide = pptx.addSlide();
  headerBar(slide, fwColor);
  sectionTitle(slide, t('nextSteps', lang));
  bodyText(slide, t('nextStepsItems', lang), { y: 1.4, fontSize: 15 });
  slideNumber(slide, num);
}

function addThankYouSlide(pptx: any, fwColor: string, lang: 'en' | 'pl', num: number): void {
  const slide = pptx.addSlide();
  slide.background = { color: BRAND.secondary };

  slide.addShape('rect', {
    x: 0,
    y: 0,
    w: 13.33,
    h: 0.12,
    fill: { color: fwColor },
  });

  slide.addText(t('thankYou', lang), {
    x: 0.6,
    y: 2.2,
    w: 12.0,
    h: 1.2,
    fontSize: 44,
    bold: true,
    color: BRAND.background,
    fontFace: 'Calibri',
    align: 'center',
  });

  slide.addText(t('contactLine', lang), {
    x: 0.6,
    y: 3.8,
    w: 12.0,
    h: 0.6,
    fontSize: 14,
    color: BRAND.textLight,
    fontFace: 'Calibri Light',
    align: 'center',
  });

  slide.addText(t('brandLine', lang), {
    x: 0.6,
    y: 6.5,
    w: 12.0,
    h: 0.4,
    fontSize: 11,
    color: fwColor,
    fontFace: 'Calibri',
    align: 'center',
  });

  slideNumber(slide, num);
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function generateAssessmentDeck(
  data: AssessmentDeckData
): Promise<DeckGenerationResult> {
  const lang = data.language ?? 'en';
  const fwColor = FRAMEWORK_COLORS[data.framework] ?? BRAND.primary;

  logger.info(
    `[AssessmentDeck] Generating ${data.framework} deck for "${data.assessmentName}" (${lang})`
  );

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Consultify';
  pptx.title = `${data.framework} Assessment — ${data.assessmentName}`;
  pptx.subject = `${data.framework} Maturity Assessment Deck`;
  pptx.company = data.organizationName;

  let slideNum = 1;

  addCoverSlide(pptx, data, fwColor, lang);
  slideNum++;

  addAgendaSlide(pptx, fwColor, lang, slideNum);
  slideNum++;

  addMethodologySlide(pptx, data, fwColor, lang, slideNum);
  slideNum++;

  addOverallScoreSlide(pptx, data, fwColor, lang, slideNum);
  slideNum++;

  slideNum = addCategoryBreakdownSlides(pptx, data, fwColor, lang, slideNum);

  if (data.framework === 'SIRI') {
    addSiriPrioritisationSlide(pptx, data, fwColor, lang, slideNum);
    slideNum++;
  }
  if (data.framework === 'ADMA') {
    addAdmaT1T7Slide(pptx, data, fwColor, lang, slideNum);
    slideNum++;
  }

  addGapAnalysisSlide(pptx, data, fwColor, lang, slideNum);
  slideNum++;

  addStrengthsSlide(pptx, data, fwColor, lang, slideNum);
  slideNum++;

  if (data.dataGaps.length > 0) {
    addDataGapsSlide(pptx, data, fwColor, lang, slideNum);
    slideNum++;
  }

  addRoadmapSlide(pptx, data, fwColor, lang, slideNum);
  slideNum++;

  addNextStepsSlide(pptx, fwColor, lang, slideNum);
  slideNum++;

  addThankYouSlide(pptx, fwColor, lang, slideNum);

  const buffer = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;

  const safeOrg = data.organizationName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  const dateStr = data.assessmentDate.replace(/[^0-9-]/g, '').slice(0, 10);
  const filename = `${data.framework}_Assessment_${safeOrg}_${dateStr}.pptx`;

  logger.info(
    `[AssessmentDeck] Generated ${slideNum} slides (${(buffer.length / 1024).toFixed(0)} KB)`
  );

  return { buffer, slideCount: slideNum, filename };
}

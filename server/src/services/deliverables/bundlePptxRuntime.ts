/**
 * bundlePptxRuntime (F4.1) — WIĄZKA deck → realny .pptx (themed).
 *
 * Most: DeckLayoutDirectorResult.plans (z B1: title/keyMessage/layoutIntent per
 * slajd) → bufor .pptx przez pptxgenjs, otematyzowany z themeRegistry (3. renderer
 * dla F3.1). Minimalny, ale REALNY deck: tytułowy + slajdy treści (action-title +
 * key-message) + zamknięcie. Fonty + paleta z motywu.
 *
 * SAFETY: fail-soft — błąd renderu zwraca null (caller pomija PPTX), nigdy nie rzuca.
 */

import { createRequire } from 'node:module';
import logger from '../../utils/Logger.js';
import { resolveTheme, PPT_TYPE_SCALE } from './themeRegistry.js';
import { seriesPalette, readableTextOn } from './paletteLibrary.js';
import { computeMarimekkoLayout, computeHarveyBalls } from './advancedCharts.js';
import { chartAltText, imageAltText } from './deckAltText.js';

const require = createRequire(import.meta.url);

const LOG = '[bundlePptxRuntime]';

/** Minimalny kształt planu slajdu, którego potrzebujemy (z SlideLayoutPlan). */
export interface DeckPlanSlide {
  slideIndex: number;
  layoutIntent: string;
  title?: string | null;
  keyMessage?: string | null;
  /** W1.5 — chart spec dołączony po layout (nie authorizowany przez LLM). */
  chartSpec?: {
    type: 'bar_series';
    labels: string[];
    series: Array<{ name: string; values: number[]; color?: string }>;
  } | {
    type: 'rag';
    items: Array<{ label: string; value: number; status: 'green' | 'amber' | 'red' }>;
  } | {
    // W7.5 — marimekko: kolumny zmiennej szerokości × stos segmentów.
    type: 'marimekko';
    columns: Array<{ label: string; segments: Array<{ name: string; value: number }> }>;
  } | {
    // W7.5 — harvey balls: jakościowa ocena 0..4 (dojrzałość/spełnienie).
    type: 'harvey_balls';
    rows: Array<{ label: string; level: number; note?: string }>;
  } | null;
  /** W1.7 — URL obrazu stockowego (T0 Unsplash/Pexels) dla slajdów z needsProductGraphic. */
  imageUrl?: string | null;
}

export interface DeckPptxOptions {
  themeId?: string;
  /** Tytuł decka (slajd tytułowy). */
  title?: string;
  /** Nazwa firmy / klienta (stopka + slajd tytułowy). */
  company?: string;
  /** 'pl' | 'en' — etykiety. */
  language?: string;
  /** Opcjonalny override brandu klienta (F8.1). Nadpisuje fonty/paletę motywu bazowego. */
  brandOverride?: { fontPair?: Partial<{ heading: string; body: string }>; palette?: Partial<{ dominant: string; supporting: string; accent: string; neutralText: string }> };
}

/** #RRGGBB → RRGGBB (pptxgenjs chce hex bez #). */
function hex(color: string): string {
  return color.replace('#', '').toUpperCase();
}

// W2.3 — sekcja chip: mały kolorowy label w prawym górnym rogu slajdu (beat Gamma).
const SECTION_CHIP: Record<string, { pl: string; en: string }> = {
  executive_summary:       { pl: 'EXEC SUMMARY', en: 'EXEC SUMMARY' },
  root_cause:              { pl: 'PROBLEM',       en: 'PROBLEM' },
  single_insight:          { pl: 'ROZWIĄZANIE',   en: 'SOLUTION' },
  performance_overview:    { pl: 'FINANSE',        en: 'FINANCIALS' },
  key_metrics_overview:    { pl: 'KPI',            en: 'KPIs' },
  comparison:              { pl: 'RYNEK',          en: 'MARKET' },
  process_flow:            { pl: 'GTM',            en: 'GTM' },
  recommendation_single:   { pl: 'ASK',            en: 'ASK' },
  recommendation_portfolio:{ pl: 'UNIT ECONOMICS', en: 'UNIT ECONOMICS' },
  roadmap:                 { pl: 'ROADMAPA',       en: 'ROADMAP' },
  risk_management:         { pl: 'RYZYKO',         en: 'RISK' },
};

function addSectionChip(
  slide: any,
  layoutIntent: string,
  opts: { accent: string; bodyFont: string; isPolish: boolean },
): void {
  const chip = SECTION_CHIP[layoutIntent];
  if (!chip) return;
  const label = opts.isPolish ? chip.pl : chip.en;
  // Tło chipa — accent color, prawy górny róg pod paskiem.
  const w = Math.max(0.9, label.length * 0.082 + 0.2);
  slide.addShape('roundRect', {
    x: 9.6 - w, y: 0.18, w, h: 0.26,
    fill: { color: opts.accent },
    line: { color: opts.accent, width: 0 },
    rectRadius: 0.04,
  });
  slide.addText(label, {
    x: 9.6 - w, y: 0.18, w, h: 0.26,
    fontFace: opts.bodyFont, fontSize: 7, bold: true, color: 'FFFFFF',
    align: 'center', valign: 'middle',
  });
}

type SlideChartSpec = DeckPlanSlide['chartSpec'];

/**
 * W1.5 — renderuje chart spec na slajdzie pptxgenjs. Zwraca true gdy coś narysował.
 * Fail-soft: błąd → false (caller spada na text layout).
 */
function renderChartOnSlide(
  slide: any,
  pptx: any,
  spec: SlideChartSpec,
  ctx: { accent: string; neutral: string; bodyFont: string; isPolish: boolean; themeId?: string | null },
): boolean {
  if (!spec) return false;
  try {
    if (spec.type === 'bar_series') {
      const data = spec.series.map((s) => ({
        name: s.name,
        labels: spec.labels,
        values: s.values,
      }));
      // W7.4 — dystynktywne kolory per seria (zamiast wszystkie=akcent gdy brak s.color).
      const palette = seriesPalette(spec.series.length, { themeId: ctx.themeId });
      slide.addChart('bar', data, {
        x: 0.6, y: 2.1, w: 8.8, h: 2.9,
        barDir: 'col',
        barGrouping: 'clustered',
        altText: chartAltText(spec), // W14.1 — a11y
        chartColors: spec.series.map((s, i) => hex(s.color ?? palette[i] ?? ctx.accent)),
        showLegend: true,
        legendPos: 'b',
        legendFontSize: 9,
        dataLabelFontSize: 9,
        valAxisLabelFontSize: 9,
        catAxisLabelFontSize: 9,
        showValue: false,
      });
      return true;
    }
    if (spec.type === 'rag') {
      const RAG_COLORS: Record<string, string> = { green: '00A651', amber: 'FFC000', red: 'FF0000' };
      spec.items.slice(0, 7).forEach((item, i) => {
        const y = 2.1 + i * 0.48;
        slide.addShape(pptx.ShapeType.rect, {
          x: 0.6, y, w: 0.35, h: 0.35,
          fill: { color: RAG_COLORS[item.status] ?? 'CCCCCC' },
          line: { color: RAG_COLORS[item.status] ?? 'CCCCCC', width: 0 },
        });
        slide.addText(item.label, {
          x: 1.1, y, w: 7.5, h: 0.38,
          fontFace: ctx.bodyFont, fontSize: 11, color: ctx.neutral,
          align: 'left', valign: 'middle',
        });
      });
      return true;
    }
    if (spec.type === 'marimekko') {
      // W7.5 — kolumny zmiennej szerokości × stos segmentów (znormalizowane → kanwa).
      const layout = computeMarimekkoLayout({ columns: spec.columns }, { columnGutter: 0.01 });
      if (layout.rects.length === 0) return false;
      const CX = 0.6, CY = 2.1, CW = 8.8, CH = 2.7; // ramka wykresu (cale)
      // stała kolejność nazw segmentów → spójny kolor serii w kolumnach
      const segNames = [...new Set(layout.rects.map((r) => r.segmentName))];
      const palette = seriesPalette(segNames.length, { themeId: ctx.themeId });
      const colorOf = (name: string) => hex(palette[segNames.indexOf(name)] ?? ctx.accent);
      for (const r of layout.rects) {
        const fillColor = colorOf(r.segmentName);
        slide.addShape(pptx.ShapeType.rect, {
          x: CX + r.x * CW, y: CY + r.y * CH, w: r.w * CW, h: r.h * CH,
          fill: { color: fillColor },
          line: { color: 'FFFFFF', width: 1 },
        });
        // etykieta % gdy segment dość duży (czytelny auto-tekst)
        if (r.w * CW > 0.8 && r.h * CH > 0.3) {
          slide.addText(`${Math.round(r.shareOfTotal * 100)}%`, {
            x: CX + r.x * CW, y: CY + r.y * CH, w: r.w * CW, h: r.h * CH,
            fontFace: ctx.bodyFont, fontSize: 10,
            color: hex(readableTextOn(`#${fillColor}`)),
            align: 'center', valign: 'middle',
          });
        }
      }
      // etykiety kolumn pod wykresem
      for (const cb of layout.columnBounds) {
        slide.addText(cb.label, {
          x: CX + cb.x * CW, y: CY + CH + 0.05, w: cb.w * CW, h: 0.3,
          fontFace: ctx.bodyFont, fontSize: 9, color: ctx.neutral,
          align: 'center', valign: 'top',
        });
      }
      return true;
    }
    if (spec.type === 'harvey_balls') {
      // W7.5 — jakościowa ocena 0..4 jako wycinek koła (pie angleRange).
      const balls = computeHarveyBalls({ rows: spec.rows });
      if (balls.length === 0) return false;
      const accent = hex(ctx.accent);
      balls.slice(0, 8).forEach((ball, i) => {
        const y = 2.1 + i * 0.45;
        const D = 0.34; // średnica
        // tło: pełny okrąg (obrys)
        slide.addShape(pptx.ShapeType.ellipse, {
          x: 0.6, y, w: D, h: D,
          fill: { color: 'FFFFFF' }, line: { color: accent, width: 1 },
        });
        // wypełnienie: wycinek 0..(fraction*360) gdy >0
        if (ball.fillFraction > 0) {
          slide.addShape(pptx.ShapeType.pie, {
            x: 0.6, y, w: D, h: D,
            fill: { color: accent }, line: { color: accent, width: 1 },
            angleRange: [0, Math.round(ball.fillFraction * 360)],
          });
        }
        slide.addText(ball.label, {
          x: 1.05, y, w: 6.5, h: 0.4,
          fontFace: ctx.bodyFont, fontSize: 11, color: ctx.neutral,
          align: 'left', valign: 'middle',
        });
        // poziom tekstowo (dostępność + szybki odczyt)
        slide.addText(ball.fillLabel, {
          x: 7.6, y, w: 1.8, h: 0.4,
          fontFace: ctx.bodyFont, fontSize: 9, color: ctx.neutral, italic: true,
          align: 'right', valign: 'middle',
        });
      });
      return true;
    }
  } catch {
    // fail-soft — renderer nie rzuca, spada na text layout
  }
  return false;
}

/**
 * Zbuduj realny .pptx z planów decka (themed). Zwraca Buffer lub null (fail-soft).
 */
export async function deckPlansToPptxBuffer(
  plans: DeckPlanSlide[],
  opts: DeckPptxOptions = {}
): Promise<Buffer | null> {
  try {
    if (!plans || plans.length === 0) return null;

    const theme = resolveTheme(opts.themeId, opts.brandOverride);
    const isPolish = (opts.language ?? 'pl') !== 'en';
    const headingFont = theme.fontPair.heading;
    const bodyFont = theme.fontPair.body;
    const dominant = hex(theme.palette.dominant);
    const accent = hex(theme.palette.accent);
    const neutral = hex(theme.palette.neutralText);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PptxGenJS: any = require('pptxgenjs');
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9'; // 10 × 5.625 in
    pptx.author = 'Consultify';
    pptx.company = opts.company || 'Organization';
    pptx.title = opts.title || (isPolish ? 'Prezentacja' : 'Presentation');

    // ── Slajd tytułowy: dominant bg, heading font ──
    const title = pptx.addSlide();
    title.background = { color: dominant };
    title.addText(opts.title || (isPolish ? 'Prezentacja' : 'Presentation'), {
      x: 0.6, y: 2.1, w: 8.8, h: 1.3,
      fontFace: headingFont, fontSize: PPT_TYPE_SCALE.coverTitle, bold: true, color: 'FFFFFF',
      align: 'left', valign: 'middle',
    });
    if (opts.company) {
      title.addText(opts.company, {
        x: 0.6, y: 3.5, w: 8.8, h: 0.6,
        fontFace: bodyFont, fontSize: PPT_TYPE_SCALE.body, color: 'FFFFFF', align: 'left',
      });
    }

    // ── Slajdy treści: action-title + key-message ──
    const contentPlans = plans
      .slice()
      .sort((a, b) => a.slideIndex - b.slideIndex);

    let n = 0;
    for (const plan of contentPlans) {
      const heading = (plan.title ?? '').trim();
      const message = (plan.keyMessage ?? '').trim();
      // Pomijamy puste slajdy (brak i tytułu, i message).
      if (!heading && !message) continue;
      n++;

      const slide = pptx.addSlide();
      slide.background = { color: 'FFFFFF' };

      // Akcentowy pasek u góry.
      slide.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: 10, h: 0.12, fill: { color: accent },
      });

      // W2.3 — section chip (prawy górny róg, beat Gamma "punchy chipy sekcji").
      addSectionChip(slide, plan.layoutIntent, { accent, bodyFont, isPolish });

      // Action-title.
      slide.addText(heading || (isPolish ? `Slajd ${n}` : `Slide ${n}`), {
        x: 0.6, y: 0.5, w: 8.8, h: 1.0,
        fontFace: headingFont, fontSize: PPT_TYPE_SCALE.slideTitle, bold: true, color: dominant,
        align: 'left', valign: 'top',
      });

      // W1.7 — image panel (right side, 38% width) gdy slide ma imageUrl.
      const hasImage = !!plan.imageUrl;
      if (hasImage) {
        try {
          // Półprzezroczysty akcentowy panel pod obraz.
          slide.addShape(pptx.ShapeType.rect, {
            x: 6.4, y: 0.5, w: 3.3, h: 4.85,
            fill: { color: accent, transparency: 92 },
            line: { color: accent, transparency: 80, width: 1 },
          });
          slide.addImage({ path: plan.imageUrl, x: 6.4, y: 0.5, w: 3.3, h: 4.85, sizing: { type: 'cover', w: 3.3, h: 4.85 }, altText: imageAltText({ title: plan.title, keyMessage: plan.keyMessage }) });
        } catch {
          // fail-soft — pptxgenjs addImage może nie obsługiwać wszystkich URL-i
        }
      }
      const textW = hasImage ? 5.5 : 8.8;

      // W1.5 — chart rendering: gdy jest chartSpec, chart zastępuje/uzupełnia key-message.
      const chartRendered = renderChartOnSlide(slide, pptx, plan.chartSpec ?? null, { accent, neutral, bodyFont, isPolish, themeId: opts.themeId });
      // Key-message (proza pod tytułem) — skrócone gdy chart zajmuje dolną część.
      if (message && !chartRendered) {
        slide.addText(message, {
          x: 0.6, y: 1.7, w: textW, h: 3.0,
          fontFace: bodyFont, fontSize: PPT_TYPE_SCALE.body, color: neutral,
          align: 'left', valign: 'top',
        });
      } else if (message && chartRendered) {
        // Key-message jako krótka podpis ponad wykresem.
        slide.addText(message, {
          x: 0.6, y: 1.55, w: textW, h: 0.45,
          fontFace: bodyFont, fontSize: PPT_TYPE_SCALE.caption, color: neutral,
          align: 'left', valign: 'top',
        });
      }

      // Stopka: firma + numer.
      slide.addText(`${opts.company || ''}`.trim(), {
        x: 0.6, y: 5.25, w: 6, h: 0.3,
        fontFace: bodyFont, fontSize: PPT_TYPE_SCALE.caption, color: '999999', align: 'left',
      });
      slide.addText(String(n), {
        x: 9.0, y: 5.25, w: 0.6, h: 0.3,
        fontFace: bodyFont, fontSize: PPT_TYPE_SCALE.caption, color: '999999', align: 'right',
      });
    }

    // ── Slajd zamknięcia ──
    const closing = pptx.addSlide();
    closing.background = { color: dominant };
    closing.addText(isPolish ? 'Dziękujemy' : 'Thank you', {
      x: 0.6, y: 2.3, w: 8.8, h: 1.0,
      fontFace: headingFont, fontSize: PPT_TYPE_SCALE.coverTitle, bold: true, color: 'FFFFFF', align: 'left',
    });

    const buffer = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
    logger.info(`${LOG} pptx generated: ${n + 2} slides, theme=${theme.id}`);
    return buffer;
  } catch (err) {
    logger.warn(`${LOG} pptx render failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

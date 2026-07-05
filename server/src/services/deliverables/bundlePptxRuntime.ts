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
import { PPT_TYPE_SCALE } from './themeRegistry.js';
import { seriesPalette, readableTextOn } from './paletteLibrary.js';
import { computeMarimekkoLayout, computeHarveyBalls } from './advancedCharts.js';
import { chartAltText, imageAltText } from './deckAltText.js';
import {
  resolveDeckStyle,
  renderCover,
  renderClosing,
  renderContentChrome,
  renderBullets,
  renderKpiBand,
  renderTwoColumnSplit,
  renderLeadWithSupport,
  fitProse,
  pushNote,
  IMAGE_PANEL,
  DECK_GRID,
  DECK_TOKENS,
  CONTENT_W,
  type PptxSlide,
  type KpiStat,
} from './DeckStyler.js';

/** Hairline grey for chart gridlines/axes (shared token — matches DOCX gridline). */
const DECK_GRID_LINE = DECK_TOKENS.gridline;

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
  /**
   * Fala 6 (DeckStyler) — opcjonalne punkty do dyscypliny bullet (max 5×8 słów;
   * nadmiar → notatki prelegenta). Gdy brak, renderer używa key-message jako prozy.
   */
  bullets?: string[] | null;
  /**
   * R4 §8 (KOMPOZYCJA) — opcjonalne dane do kompozycji zależnej od intencji.
   * Gdy podane, renderer wybiera geometrię (KPI-band / split / lead+support)
   * zamiast płaskiej listy bulletów. Gdy brak, spada na bullety/prozę (kompatybilne wstecz).
   */
  stats?: Array<{ value: string; label: string; caption?: string }> | null;
  split?: {
    left: { heading: string; bullets: string[] };
    right: { heading: string; bullets: string[] };
  } | null;
  lead?: { text: string; support?: string[] } | null;
}

// R4 §8 — intencje, które domyślnie renderujemy jako lead-thesis + support
// (pojedyncza teza duża + kolumna dowodów), gdy nie ma wykresu ani jawnej kompozycji.
const LEAD_INTENTS = new Set([
  'single_insight',
  'recommendation_single',
  'root_cause',
]);
// Intencje, które przy braku jawnej kompozycji renderujemy jako KPI-band,
// jeśli key-message zawiera policzalne liczby do wyciągnięcia.
const METRIC_INTENTS = new Set([
  'key_metrics_overview',
  'performance_overview',
  'recommendation_portfolio',
]);

export interface DeckPptxOptions {
  themeId?: string;
  /** Tytuł decka (slajd tytułowy). */
  title?: string;
  /** Nazwa firmy / klienta (stopka + slajd tytułowy). */
  company?: string;
  /** 'pl' | 'en' — etykiety. */
  language?: string;
  /** Data na slajdzie tytułowym / stopce (domyślnie dziś, format ISO PL). */
  date?: string;
  /** Opcjonalny override brandu klienta (F8.1). Nadpisuje fonty/paletę motywu bazowego. */
  brandOverride?: { fontPair?: Partial<{ heading: string; body: string }>; palette?: Partial<{ dominant: string; supporting: string; accent: string; neutralText: string }> };
  /**
   * CONCLUSION_LAYER §W5 — closing slide is a DECISION bookend, not "Thank you".
   * When omitted, the runtime derives the ask/outcome from the last content
   * slide (which by W5 discipline already carries K3/K4). Override to pin them.
   */
  closingAsk?: string;
  closingOutcome?: string;
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
  const w = Math.max(1.0, label.length * 0.095 + 0.26);
  slide.addShape('roundRect', {
    x: 9.6 - w, y: 0.22, w, h: 0.3,
    fill: { color: opts.accent },
    line: { color: opts.accent, width: 0 },
    rectRadius: 0.05,
  });
  slide.addText(label, {
    x: 9.6 - w, y: 0.22, w, h: 0.3,
    fontFace: opts.bodyFont, fontSize: 9, bold: true, color: 'FFFFFF',
    charSpacing: 1, align: 'center', valign: 'middle',
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
      // W7.4 — dystynktywne kolory per seria (blue-first z seriesPalette; NIGDY
      // red-first). czerwień zarezerwowana dla negatywów, nie dla pierwszej serii.
      const palette = seriesPalette(spec.series.length, { themeId: ctx.themeId });
      const multiSeries = spec.series.length > 1;
      slide.addChart('bar', data, {
        x: 0.6, y: 2.1, w: 8.8, h: 2.9,
        barDir: 'col',
        barGrouping: 'clustered',
        altText: chartAltText(spec), // W14.1 — a11y
        chartColors: spec.series.map((s, i) => hex(s.color ?? palette[i] ?? ctx.accent)),
        // Premium chart chrome: subtelne poziome linie siatki (hairline grey),
        // czyste osie bez ramki, spójna typografia etykiet (parity z DOCX/XLSX).
        showLegend: multiSeries,
        legendPos: 'b',
        legendFontSize: 10,
        legendColor: ctx.neutral,
        showValue: false,
        showValAxisTitle: false,
        catAxisLabelColor: ctx.neutral,
        valAxisLabelColor: ctx.neutral,
        catAxisLabelFontSize: 10,
        valAxisLabelFontSize: 10,
        catAxisLabelFontFace: ctx.bodyFont,
        valAxisLabelFontFace: ctx.bodyFont,
        valGridLine: { color: DECK_GRID_LINE, style: 'solid', size: 1 },
        catGridLine: { style: 'none' },
        valAxisLineColor: DECK_GRID_LINE,
        catAxisLineColor: DECK_GRID_LINE,
        barGapWidthPct: 60,
      });
      return true;
    }
    if (spec.type === 'rag') {
      // Status dots route through the shared semantic palette (softened crimson,
      // not pure FF0000) — consistent with DOCX_TONE_COLOR, easy on the eye.
      const RAG_COLORS: Record<string, string> = {
        green: DECK_TOKENS.statusSuccess,
        amber: DECK_TOKENS.statusWarning,
        red: DECK_TOKENS.statusDanger,
      };
      spec.items.slice(0, 7).forEach((item, i) => {
        const y = 2.1 + i * 0.5;
        const dot = RAG_COLORS[item.status] ?? DECK_TOKENS.muted;
        // Soft zebra row tint for legibility of a status list.
        if (i % 2 === 1) {
          slide.addShape(pptx.ShapeType.rect, {
            x: 0.5, y: y - 0.05, w: 8.9, h: 0.44,
            fill: { color: DECK_TOKENS.panelFill }, line: { color: DECK_TOKENS.panelFill, width: 0 },
          });
        }
        slide.addShape(pptx.ShapeType.ellipse, {
          x: 0.62, y: y + 0.03, w: 0.28, h: 0.28,
          fill: { color: dot }, line: { color: dot, width: 0 },
        });
        slide.addText(item.label, {
          x: 1.12, y, w: 8.1, h: 0.4,
          fontFace: ctx.bodyFont, fontSize: 12, color: ctx.neutral,
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

// R4 §8 — heurystyka wyciągania KPI-statów z bulletów (fallback gdy brak plan.stats).
// Bullet zaczynający się od liczby/waluty/% → {value, label}. Np.
// "88–92% top-quartile renewal" → value "88–92%", label "top-quartile renewal".
const STAT_LEAD =
  /^\s*([€$]?\s?\d[\d.,]*\s?[–-]?\s?\d*[\d.,]*\s?(?:%|M\s?(?:EUR|€|USD|\$|PLN|zł)?|k|bn|mld|mln|pp|x)?)\b[\s:–-]*(.*)$/i;

function extractStats(bullets: string[]): KpiStat[] {
  const out: KpiStat[] = [];
  for (const b of bullets) {
    const m = b.match(STAT_LEAD);
    if (m && m[1] && m[2] && m[2].trim().length >= 3) {
      out.push({ value: m[1].trim(), label: m[2].trim() });
      if (out.length >= 4) break;
    }
  }
  return out;
}

/**
 * R4 §8 — wybiera i rysuje kompozycję zależną od intencji. Zwraca true gdy coś
 * narysował (caller pomija bullety/prozę). Priorytet: jawne plan.stats/split/lead
 * → auto wg intencji. Fail-soft: każdy problem → false (spada na bullety).
 */
function renderComposition(
  slide: PptxSlide,
  style: ReturnType<typeof resolveDeckStyle>,
  plan: DeckPlanSlide,
  bullets: string[],
  message: string,
): boolean {
  try {
    // 1) Jawny split (comparison / us-vs-them).
    if (plan.split && plan.split.left && plan.split.right) {
      renderTwoColumnSplit(slide, style, { left: plan.split.left, right: plan.split.right });
      return true;
    }
    // 2) Jawne staty (metrics).
    if (plan.stats && plan.stats.length > 0) {
      const r = renderKpiBand(slide, style, plan.stats as KpiStat[]);
      if (message) {
        slide.addText(message, {
          x: DECK_GRID.marginX, y: r.bottom + 0.05, w: CONTENT_W, h: 0.9,
          fontFace: style.bodyFont, fontSize: PPT_TYPE_SCALE.caption + 1,
          color: style.neutral, align: 'left', valign: 'top',
        } as Record<string, unknown>);
      }
      return true;
    }
    // 3) Jawny lead (single insight / recommendation).
    if (plan.lead && plan.lead.text) {
      renderLeadWithSupport(slide, style, {
        lead: plan.lead.text,
        support: plan.lead.support ?? bullets,
      });
      return true;
    }

    // ── Auto-kompozycja wg intencji (gdy nie ma jawnych pól) ──
    const intent = plan.layoutIntent;

    // Comparison → split z bulletów (dziel na pół gdy ≥4 bullety).
    if (intent === 'comparison' && bullets.length >= 4) {
      const half = Math.ceil(bullets.length / 2);
      renderTwoColumnSplit(slide, style, {
        left: { heading: 'Dziś / Today', bullets: bullets.slice(0, half) },
        right: { heading: 'Cel / Target', bullets: bullets.slice(half) },
      });
      return true;
    }

    // Metrics → KPI-band gdy da się wyciągnąć ≥2 policzalne staty.
    if (METRIC_INTENTS.has(intent)) {
      const stats = extractStats(bullets);
      if (stats.length >= 2) {
        const r = renderKpiBand(slide, style, stats);
        const rest = bullets.filter((b) => !STAT_LEAD.test(b));
        if (rest.length > 0) {
          renderBullets(slide, style, rest, {
            x: DECK_GRID.marginX, y: r.bottom + 0.1, w: CONTENT_W, h: DECK_GRID.footerY - r.bottom - 0.3,
          });
        } else if (message) {
          pushNote(slide, message);
        }
        return true;
      }
    }

    // Lead-thesis → duża teza + kolumna dowodów (single insight / recommendation / root cause).
    if (LEAD_INTENTS.has(intent) && message && bullets.length >= 2) {
      renderLeadWithSupport(slide, style, { lead: message, support: bullets });
      return true;
    }
  } catch {
    // fail-soft — spada na bullety/prozę
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

    // Fala 6 — DeckStyler: gwarantowana warstwa wizualna (paleta/fonty/siatka/chrome).
    const style = resolveDeckStyle(opts.themeId, opts.brandOverride);
    const theme = style.theme;
    const isPolish = (opts.language ?? 'pl') !== 'en';
    const bodyFont = style.bodyFont;
    const accent = style.accent;
    const neutral = style.neutral;
    const deckTitle = opts.title || (isPolish ? 'Prezentacja' : 'Presentation');
    const deckDate = opts.date || new Date().toISOString().slice(0, 10);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PptxGenJS: any = require('pptxgenjs');
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9'; // 10 × 5.625 in
    pptx.author = 'Consultify';
    pptx.company = opts.company || 'Organization';
    pptx.title = deckTitle;

    // ── Slajd tytułowy (DeckStyler.renderCover — spójna tożsamość talii) ──
    const cover = pptx.addSlide() as PptxSlide;
    renderCover(cover, style, {
      title: deckTitle,
      company: opts.company,
      date: deckDate,
      isPolish,
    });

    // ── Slajdy treści: teza (action-title) + treść wg kompozycji ──
    const contentPlans = plans
      .slice()
      .sort((a, b) => a.slideIndex - b.slideIndex);

    let n = 0;
    for (const plan of contentPlans) {
      const heading = (plan.title ?? '').trim();
      const message = (plan.keyMessage ?? '').trim();
      const bullets = (plan.bullets ?? []).filter((b) => (b ?? '').trim().length > 0);
      // Pomijamy puste slajdy (brak tytułu, message i bulletów).
      if (!heading && !message && bullets.length === 0) continue;
      n++;

      const slide = pptx.addSlide() as PptxSlide;
      // Chrome: pasek akcentowy + teza-tytuł (shrink-fit) + hairline + stopka (nr/branding).
      const { contentTop } = renderContentChrome(slide, style, {
        title: heading || (isPolish ? `Slajd ${n}` : `Slide ${n}`),
        company: opts.company,
        pageNumber: n,
        isPolish,
      });

      // W2.3 — section chip (prawy górny róg, beat Gamma "punchy chipy sekcji").
      addSectionChip(slide, plan.layoutIntent, { accent, bodyFont, isPolish });

      // W1.7 — image panel (prawa strona) — clampowany do siatki (IMAGE_PANEL).
      const hasImage = !!plan.imageUrl;
      if (hasImage) {
        try {
          slide.addShape(pptx.ShapeType.rect, {
            x: IMAGE_PANEL.x, y: IMAGE_PANEL.y, w: IMAGE_PANEL.w, h: IMAGE_PANEL.h,
            fill: { color: accent, transparency: 92 },
            line: { color: accent, transparency: 80, width: 1 },
          });
          (slide as unknown as { addImage: (o: Record<string, unknown>) => void }).addImage({
            path: plan.imageUrl, x: IMAGE_PANEL.x, y: IMAGE_PANEL.y, w: IMAGE_PANEL.w, h: IMAGE_PANEL.h,
            sizing: { type: 'cover', w: IMAGE_PANEL.w, h: IMAGE_PANEL.h },
            altText: imageAltText({ title: plan.title, keyMessage: plan.keyMessage }),
          });
        } catch {
          // fail-soft — pptxgenjs addImage może nie obsługiwać wszystkich URL-i
        }
      }
      const textW = hasImage ? 5.5 : CONTENT_W;

      // W1.5 — chart rendering: gdy jest chartSpec, chart zastępuje/uzupełnia key-message.
      const chartRendered = renderChartOnSlide(slide, pptx, plan.chartSpec ?? null, { accent, neutral, bodyFont, isPolish, themeId: opts.themeId });

      // R4 §8 — KOMPOZYCJA zależna od intencji (tylko gdy nie ma wykresu ani obrazu).
      let composed = false;
      if (!chartRendered && !hasImage) {
        composed = renderComposition(slide, style, plan, bullets, message);
        if (composed && message && bullets.length === 0) pushNote(slide, message);
      }

      if (composed) {
        // kompozycja narysowana — nic więcej
      } else if (bullets.length > 0 && !chartRendered) {
        // Dyscyplina bullet: ≤5×8 słów na slajdzie, nadmiar → notatki prelegenta.
        renderBullets(slide, style, bullets, { x: DECK_GRID.marginX, y: contentTop, w: textW, h: 3.3 });
        if (message) pushNote(slide, message);
      } else if (message && !chartRendered) {
        // Proza pod tytułem — twardy guard: auto-shrink + przelew do notatek.
        const fit = fitProse(message, textW, 3.3, PPT_TYPE_SCALE.body, 14);
        slide.addText(fit.text, {
          x: DECK_GRID.marginX, y: contentTop, w: textW, h: 3.3,
          fontFace: bodyFont, fontSize: fit.fontSize, color: neutral,
          align: 'left', valign: 'top',
        });
        if (fit.overflowNote) pushNote(slide, fit.overflowNote);
      } else if (message && chartRendered) {
        // Key-message jako krótki podpis ponad wykresem.
        slide.addText(message, {
          x: DECK_GRID.marginX, y: 1.6, w: textW, h: 0.45,
          fontFace: bodyFont, fontSize: PPT_TYPE_SCALE.caption, color: neutral,
          align: 'left', valign: 'top',
        });
        if (bullets.length > 0) pushNote(slide, bullets.map((b) => `• ${b}`).join('\n'));
      }
    }

    // ── Slajd zamknięcia (DECISION bookend — CONCLUSION_LAYER §W5, NIE "Dziękujemy") ──
    // Ask/outcome domyślnie z ostatniego slajdu treści (który wg dyscypliny W5
    // niesie K3/K4); override przez opts.closingAsk / opts.closingOutcome.
    const lastPlan = contentPlans[contentPlans.length - 1];
    const derivedAsk =
      (opts.closingAsk ?? '').trim() ||
      (lastPlan?.title ?? '').trim() ||
      (isPolish ? 'Co robić najpierw' : 'What to do first');
    const derivedOutcome =
      (opts.closingOutcome ?? '').trim() ||
      (lastPlan?.keyMessage ?? '').trim() ||
      undefined;
    const closing = pptx.addSlide() as PptxSlide;
    renderClosing(closing, style, {
      ask: derivedAsk,
      outcome: derivedOutcome,
      company: opts.company,
      date: deckDate,
      isPolish,
    });

    const buffer = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
    logger.info(`${LOG} pptx generated: ${n + 2} slides, theme=${theme.id}`);
    return buffer;
  } catch (err) {
    logger.warn(`${LOG} pptx render failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

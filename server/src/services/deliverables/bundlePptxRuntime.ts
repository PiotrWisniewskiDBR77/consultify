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
import { resolveTheme } from './themeRegistry.js';

const require = createRequire(import.meta.url);

const LOG = '[bundlePptxRuntime]';

/** Minimalny kształt planu slajdu, którego potrzebujemy (z SlideLayoutPlan). */
export interface DeckPlanSlide {
  slideIndex: number;
  layoutIntent: string;
  title?: string | null;
  keyMessage?: string | null;
}

export interface DeckPptxOptions {
  themeId?: string;
  /** Tytuł decka (slajd tytułowy). */
  title?: string;
  /** Nazwa firmy / klienta (stopka + slajd tytułowy). */
  company?: string;
  /** 'pl' | 'en' — etykiety. */
  language?: string;
}

/** #RRGGBB → RRGGBB (pptxgenjs chce hex bez #). */
function hex(color: string): string {
  return color.replace('#', '').toUpperCase();
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

    const theme = resolveTheme(opts.themeId);
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
      fontFace: headingFont, fontSize: 40, bold: true, color: 'FFFFFF',
      align: 'left', valign: 'middle',
    });
    if (opts.company) {
      title.addText(opts.company, {
        x: 0.6, y: 3.5, w: 8.8, h: 0.6,
        fontFace: bodyFont, fontSize: 18, color: 'FFFFFF', align: 'left',
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

      // Action-title.
      slide.addText(heading || (isPolish ? `Slajd ${n}` : `Slide ${n}`), {
        x: 0.6, y: 0.5, w: 8.8, h: 1.0,
        fontFace: headingFont, fontSize: 26, bold: true, color: dominant,
        align: 'left', valign: 'top',
      });

      // Key-message (proza pod tytułem).
      if (message) {
        slide.addText(message, {
          x: 0.6, y: 1.7, w: 8.8, h: 3.0,
          fontFace: bodyFont, fontSize: 18, color: neutral,
          align: 'left', valign: 'top',
        });
      }

      // Stopka: firma + numer.
      slide.addText(`${opts.company || ''}`.trim(), {
        x: 0.6, y: 5.25, w: 6, h: 0.3,
        fontFace: bodyFont, fontSize: 9, color: '999999', align: 'left',
      });
      slide.addText(String(n), {
        x: 9.0, y: 5.25, w: 0.6, h: 0.3,
        fontFace: bodyFont, fontSize: 9, color: '999999', align: 'right',
      });
    }

    // ── Slajd zamknięcia ──
    const closing = pptx.addSlide();
    closing.background = { color: dominant };
    closing.addText(isPolish ? 'Dziękujemy' : 'Thank you', {
      x: 0.6, y: 2.3, w: 8.8, h: 1.0,
      fontFace: headingFont, fontSize: 32, bold: true, color: 'FFFFFF', align: 'left',
    });

    const buffer = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
    logger.info(`${LOG} pptx generated: ${n + 2} slides, theme=${theme.id}`);
    return buffer;
  } catch (err) {
    logger.warn(`${LOG} pptx render failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/**
 * Atomic: Slide Title
 * Renders the main title text of a slide inside the header bar.
 */
import type { DesignTokens, ElementPosition, RenderedElement } from '../types.js';

export interface SlideTitleProps {
  text: string;
  position?: Partial<ElementPosition>;
}

/**
 * Widow control (proof 2026-07-14, item L4): `fit:'shrink'` (normAutofit) is
 * NOT honoured reliably by LibreOffice — same root cause as KpiValue's fix.
 * A title that overflows one line sometimes gets a clean LibreOffice shrink,
 * but sometimes wraps at FULL font size instead, which can leave a single
 * short word alone on the 2nd line ("...quoting effort" / "peaks" — a
 * widow) and bleed past the header band. Rather than gamble on which path
 * LibreOffice takes, decide deterministically ourselves (same philosophy as
 * KpiValue's adaptive fontSize):
 *   1. Fits on one line at the base font → render as-is.
 *   2. Doesn't fit, but shrinking down to a readable floor (~72% of base)
 *      makes it fit on one line → shrink and keep it on one line (`wrap:
 *      false`, so LibreOffice can't reintroduce a wrap/widow).
 *   3. Still doesn't fit even at the floor (very long key_message) → the
 *      ONLY case that gets a manual 2-line break: pick the word boundary
 *      that balances the two lines' widths (never leaving a 1-word line
 *      when there are 3+ words), then size the font to fit both the widest
 *      line's width and the header band's height.
 */
function advanceOf(ch: string): number {
  if (ch === ' ') return 0.3;
  if ('mwMW'.includes(ch)) return 0.85;
  if ("iIlj.,:;'|".includes(ch)) return 0.3;
  if (ch >= 'A' && ch <= 'Z') return 0.68;
  if ('%$&@'.includes(ch)) return 0.8;
  return 0.55; // digits + lowercase
}

function widthOf(text: string): number {
  return [...text].reduce((sum, ch) => sum + advanceOf(ch), 0);
}

/** Word boundary that best balances the two resulting lines; avoids a 1-word
 * final line (a widow) whenever there are 3+ words to split. */
function balancedSplitIndex(words: string[]): number {
  let bestK = -1;
  let bestScore = Infinity;
  for (let k = 1; k < words.length; k++) {
    if (words.length >= 3 && k === words.length - 1) continue; // would widow
    const score = Math.abs(
      widthOf(words.slice(0, k).join(' ')) - widthOf(words.slice(k).join(' '))
    );
    if (score < bestScore) {
      bestScore = score;
      bestK = k;
    }
  }
  if (bestK === -1) {
    // Every non-widow split was rejected (e.g. exactly 3 words, all long) —
    // fall back to the most balanced split even if it is technically a widow.
    for (let k = 1; k < words.length; k++) {
      const score = Math.abs(
        widthOf(words.slice(0, k).join(' ')) - widthOf(words.slice(k).join(' '))
      );
      if (score < bestScore) {
        bestScore = score;
        bestK = k;
      }
    }
  }
  return bestK;
}

interface TitleFit {
  text: string;
  fontSize: number;
  wrap: boolean;
}

function fitTitle(rawText: string, widthPt: number, heightPt: number, baseFont: number): TitleFit {
  const text = rawText.trim();
  const words = text.split(/\s+/);
  const auOne = widthOf(text);

  // 1) Fits on one line at full size.
  if (auOne * baseFont <= widthPt || words.length <= 1) {
    return { text, fontSize: baseFont, wrap: false };
  }

  // 2) Shrink to a readable floor and try to keep it on one line — this is
  // the common case (a title a few words over budget) and avoids wrapping
  // (and therefore avoids any risk of a widow) entirely.
  const minSingleLineFont = Math.max(16, Math.floor(baseFont * 0.72));
  const singleLineFont = Math.floor((widthPt / auOne) * 0.92); // 8% safety margin
  if (singleLineFont >= minSingleLineFont) {
    return { text, fontSize: Math.min(baseFont, singleLineFont), wrap: false };
  }

  // 3) Genuinely too long for one line even at the floor — manual balanced
  // 2-line break, sized to fit both the widest line and the box height.
  const bestK = balancedSplitIndex(words);
  const line1 = words.slice(0, bestK).join(' ');
  const line2 = words.slice(bestK).join(' ');
  const maxLineAdvance = Math.max(widthOf(line1), widthOf(line2));
  const fontForWidth = Math.floor((widthPt / maxLineAdvance) * 0.92);
  const lineHeightFactor = 1.2 * 0.9; // matches lineSpacingMultiple below
  const fontForHeight = Math.floor(heightPt / (2 * lineHeightFactor));
  const fontSize = Math.max(14, Math.min(baseFont, fontForWidth, fontForHeight));
  return { text: `${line1}\n${line2}`, fontSize, wrap: true };
}

export function SlideTitle(props: SlideTitleProps, tokens: DesignTokens): RenderedElement {
  // Action-titles (the slide thesis) are frequently long. The box is sized to
  // hold up to two lines centred inside the header band; `fitTitle` above
  // decides deterministically whether that needs a shrink, a manual 2-line
  // break, or neither.
  const pos: ElementPosition = {
    x: props.position?.x ?? tokens.grid.contentX,
    y: props.position?.y ?? 0.08,
    w: props.position?.w ?? tokens.grid.contentW,
    h: props.position?.h ?? 0.64,
  };

  const fit = fitTitle(props.text, pos.w * 72, pos.h * 72, tokens.fontSizes.slideTitle);

  return {
    kind: 'text',
    apply(slide) {
      slide.addText(fit.text, {
        x: pos.x,
        y: pos.y,
        w: pos.w,
        h: pos.h,
        fontSize: fit.fontSize,
        fontFace: tokens.fonts.title,
        color: tokens.colors.textInverse,
        bold: true,
        valign: 'middle',
        wrap: fit.wrap,
        // Kept as a defensive fallback only — the fontSize above already
        // guarantees fit by construction, so this should be a no-op.
        fit: 'shrink',
        lineSpacingMultiple: 0.9,
      });
    },
  };
}

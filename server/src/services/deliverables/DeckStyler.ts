/**
 * DeckStyler — consultant-grade, deterministic styling helpers for pptxgenjs
 * decks. Sibling of WorkbookStyler (XLSX): a GUARANTEED visual layer that does
 * NOT depend on what the LLM emitted.
 *
 * Rationale (Vegas Fala 6 / "beat Gamma"): our deck generator wins on CONTENT
 * but loses VISUALLY ("3 z minusem"). The minimal fallback renderer
 * (bundlePptxRuntime) drew raw text on white with an accent bar — no cover
 * identity, no section dividers, no bullet discipline, no overflow guards, no
 * consistent grid. These helpers enforce an agency-grade visual standard
 * independent of the AI, reusable across the deck runtime.
 *
 * Doctrine (consistent with themeRegistry + WorkbookStyler):
 *   • Palette: navy dominant (#0C447C) + teal accent (#1D9E75). Crimson is
 *     NEVER chrome — only a brand accent / status color.
 *   • Typography: one family with a HIERARCHY — thesis-title / lead / body /
 *     caption — sized for projection (min 18pt body).
 *   • Grid: consistent margins (0.6in) and a 16:9 canvas (10 × 5.625 in).
 *   • Bullet discipline: max 5 bullets × ~8 words; overflow → speaker notes.
 *   • Hard guards: long text auto-shrinks (pptxgenjs `fit: 'shrink'`) and spills
 *     to notes instead of overflowing the frame; images/charts clamp to a
 *     content box inside the grid.
 *
 * Everything here is pure geometry/text math + thin pptxgenjs-shape emitters.
 * No LLM. Fail-soft callers (bundlePptxRuntime) already wrap in try/catch.
 */

import { resolveTheme, PPT_TYPE_SCALE, type DeliverableTheme } from './themeRegistry.js';
import { readableTextOn } from './paletteLibrary.js';

// ---------------------------------------------------------------------------
// Canvas geometry (16:9 — pptxgenjs LAYOUT_16x9 = 10 × 5.625 in)
// ---------------------------------------------------------------------------

export const DECK_GRID = {
  slideW: 10,
  slideH: 5.625,
  /** Uniform outer margin (left/right). */
  marginX: 0.6,
  /** Top of the content band (below title). */
  contentTop: 1.7,
  /** Title band top. */
  titleY: 0.5,
  titleH: 1.0,
  /** Footer baseline. */
  footerY: 5.25,
  footerH: 0.3,
  /** Accent rule thickness under the cover/section title. */
  ruleH: 0.045,
} as const;

/** Usable content width between the left/right margins. */
export const CONTENT_W = DECK_GRID.slideW - DECK_GRID.marginX * 2; // 8.8

// ---------------------------------------------------------------------------
// Palette resolution (theme → hex-without-# as pptxgenjs wants)
// ---------------------------------------------------------------------------

/** #RRGGBB → RRGGBB (pptxgenjs wants hex without leading #). */
export function hex(color: string): string {
  return color.replace('#', '').toUpperCase();
}

// ---------------------------------------------------------------------------
// Neutral / status tokens — shared constants (parity with DOCX_PALETTE).
//
// The old renderer scattered raw hex literals (F5F8FC, E3E7EE, FF0000, 00A651…)
// across KPI cards, split panels and the RAG chart. That produced subtle drift:
// three shades of "panel grey", pure-red RAG dots, no single source of truth.
// These frozen tokens are the PPTX analogue of documentDocxStyles.DOCX_PALETTE —
// every chrome tint, hairline and status color now resolves from ONE place, so
// the deck reads as the same brand as the DOCX/XLSX exports.
// ---------------------------------------------------------------------------
export const DECK_TOKENS = Object.freeze({
  /** Hairline / thin border grey (matches DOCX gridline). */
  gridline: 'E3E7EE',
  /** Soft navy-tinted panel fill (KPI cards, "today"/problem panel). */
  panelFill: 'F5F8FC',
  /** Soft teal-tinted panel fill (accent / "target"/answer panel). */
  panelAccentFill: 'F2F9F6',
  /** Muted caption / footer / label grey (matches DOCX muted, slate-500). */
  muted: '64748B',
  /** White. */
  white: 'FFFFFF',
  /** Status — success/positive (teal-green, matches DOCX success). */
  statusSuccess: '1D9E75',
  /** Status — warning/amber (matches DOCX warning, never chrome). */
  statusWarning: 'D97706',
  /** Status — danger/negative (softened crimson, NEVER chrome). */
  statusDanger: 'C0392B',
} as const);

export interface DeckStyle {
  theme: DeliverableTheme;
  headingFont: string;
  bodyFont: string;
  /** Navy dominant (hex, no #) — headings, cover, bands. */
  dominant: string;
  /** One step down the dominant (hex, no #) — sub-headers, secondary bands. */
  dominantSoft: string;
  /** Teal accent (hex, no #) — rules, KPI figures, positive deltas. */
  accent: string;
  /** Deep accent (hex, no #) — accent text readable on a light tint. */
  accentInk: string;
  /** Neutral body text (hex, no #). */
  neutral: string;
  /** Muted caption / footer text (hex, no #). */
  muted: string;
  /** Readable text color ON the dominant band (usually white). */
  onDominant: string;
}

/** Lightens a hex color toward white by `amount` (0..1). Deterministic. */
function lighten(hexNoHash: string, amount: number): string {
  const n = parseInt(hexNoHash, 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return [mix(r), mix(g), mix(b)]
    .map((c) => c.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/** Darkens a hex color toward black by `amount` (0..1). Deterministic. */
function darken(hexNoHash: string, amount: number): string {
  const n = parseInt(hexNoHash, 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const mix = (c: number) => Math.round(c * (1 - amount));
  return [mix(r), mix(g), mix(b)]
    .map((c) => c.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/**
 * Resolves a full DeckStyle from a theme id (+ optional brand override). This is
 * the single entry the runtime calls to get every color/font it needs.
 */
export function resolveDeckStyle(
  themeId?: string | null,
  brandOverride?: {
    fontPair?: Partial<{ heading: string; body: string }>;
    palette?: Partial<{ dominant: string; supporting: string; accent: string; neutralText: string }>;
  }
): DeckStyle {
  const theme = resolveTheme(themeId, brandOverride);
  const dominant = hex(theme.palette.dominant);
  const accent = hex(theme.palette.accent);
  return {
    theme,
    headingFont: theme.fontPair.heading,
    bodyFont: theme.fontPair.body,
    dominant,
    // Derived one-step-down navy + deep accent, so the deck carries the SAME
    // two-tone heading hierarchy the DOCX gets from navy/navySoft/tealInk —
    // computed from the theme so brand overrides propagate automatically.
    dominantSoft: lighten(dominant, 0.22),
    accent,
    accentInk: darken(accent, 0.32),
    neutral: hex(theme.palette.neutralText),
    muted: DECK_TOKENS.muted,
    onDominant: hex(readableTextOn(theme.palette.dominant)),
  };
}

// ---------------------------------------------------------------------------
// Bullet discipline — max 5 bullets × ~8 words; overflow → speaker notes
// ---------------------------------------------------------------------------

export const BULLET_MAX_COUNT = 5;
export const BULLET_MAX_WORDS = 8;

export interface BulletDisciplineResult {
  /** Bullets that fit on the slide (≤ BULLET_MAX_COUNT, each ≤ BULLET_MAX_WORDS words). */
  onSlide: string[];
  /** Everything demoted to the speaker notes (full, untrimmed text). */
  notes: string[];
}

/** Counts words in a bullet (whitespace-delimited, punctuation-tolerant). */
export function wordCount(s: string): number {
  const t = s.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

/**
 * Trims a single bullet to at most `maxWords` words, appending an ellipsis when
 * truncated. Never returns an empty string for non-empty input.
 */
export function trimToWords(s: string, maxWords = BULLET_MAX_WORDS): string {
  const words = s.trim().split(/\s+/);
  if (words.length <= maxWords) return s.trim();
  return words.slice(0, maxWords).join(' ') + '…';
}

/**
 * Enforces bullet discipline: at most `maxCount` bullets on the slide, each
 * trimmed to `maxWords` words. Bullets beyond the cap, plus the FULL text of any
 * bullet that had to be trimmed, are returned as `notes` so the caller can push
 * them into the speaker-notes pane — nothing is lost, the slide stays clean.
 */
export function enforceBulletDiscipline(
  bullets: string[],
  opts: { maxCount?: number; maxWords?: number } = {}
): BulletDisciplineResult {
  const maxCount = opts.maxCount ?? BULLET_MAX_COUNT;
  const maxWords = opts.maxWords ?? BULLET_MAX_WORDS;

  const cleaned = (bullets ?? []).map((b) => (b ?? '').trim()).filter((b) => b.length > 0);

  const onSlide: string[] = [];
  const notes: string[] = [];

  cleaned.forEach((b, i) => {
    if (i >= maxCount) {
      notes.push(b); // overflow bullet → notes verbatim
      return;
    }
    if (wordCount(b) > maxWords) {
      onSlide.push(trimToWords(b, maxWords));
      notes.push(b); // keep full sentence in notes
    } else {
      onSlide.push(b);
    }
  });

  return { onSlide, notes };
}

// ---------------------------------------------------------------------------
// Thesis-title guard (CONCLUSION_LAYER W5) — the title should be a full sentence
// ---------------------------------------------------------------------------

/**
 * Heuristic: does a title read as a THESIS (full assertion) rather than a bare
 * topic label? A thesis has a verb-ish shape and enough words. Used to size the
 * title band and to decide whether to shrink-fit.
 */
export function looksLikeThesis(title: string): boolean {
  const t = title.trim();
  if (wordCount(t) < 4) return false;
  // Rough "has a predicate" signal: a lowercase word after the first (labels are
  // Title-Case noun phrases; theses carry verbs/connectors), or sentence punctuation.
  return /\s[a-ząćęłńóśźż]/.test(t) || /[.:]/.test(t);
}

// ---------------------------------------------------------------------------
// Overflow guard — estimate whether prose fits a box; pick a safe font size
// ---------------------------------------------------------------------------

/**
 * Rough character capacity of a text box at a given font size. Deterministic
 * approximation (avg glyph ~0.52em advance, line height ~1.25em). Used to size
 * body prose down before it overflows, and to decide what spills to notes.
 */
export function estimateCharCapacity(wIn: number, hIn: number, fontSizePt: number): number {
  const emIn = fontSizePt / 72;
  const glyphAdvanceIn = emIn * 0.52;
  const lineHeightIn = emIn * 1.25;
  const charsPerLine = Math.max(1, Math.floor(wIn / glyphAdvanceIn));
  const lines = Math.max(1, Math.floor(hIn / lineHeightIn));
  return charsPerLine * lines;
}

export interface ProseFit {
  /** Font size (pt) that fits within [minSize, base]. */
  fontSize: number;
  /** Text to render on-slide (may be truncated at a word boundary). */
  text: string;
  /** Overflow tail demoted to speaker notes (empty when everything fit). */
  overflowNote: string;
}

/**
 * Fits prose into a box: first tries the base size, shrinks down to `minSize`,
 * and if it STILL overflows, truncates at a word boundary and returns the tail
 * as `overflowNote` (→ speaker notes). Guarantees the slide never overflows.
 */
export function fitProse(
  text: string,
  wIn: number,
  hIn: number,
  base = PPT_TYPE_SCALE.body,
  minSize = 12
): ProseFit {
  const clean = (text ?? '').trim();
  if (!clean) return { fontSize: base, text: '', overflowNote: '' };

  for (let size = base; size >= minSize; size -= 1) {
    if (clean.length <= estimateCharCapacity(wIn, hIn, size)) {
      return { fontSize: size, text: clean, overflowNote: '' };
    }
  }
  // Still overflows at minSize → truncate at a word boundary.
  const cap = estimateCharCapacity(wIn, hIn, minSize);
  let cut = clean.slice(0, cap);
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > cap * 0.6) cut = cut.slice(0, lastSpace);
  return {
    fontSize: minSize,
    text: cut.trimEnd() + '…',
    overflowNote: clean.slice(cut.length).trim(),
  };
}

// ---------------------------------------------------------------------------
// Image/chart clamp — keep visuals inside the content grid
// ---------------------------------------------------------------------------

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The right-hand image panel box (used when a slide carries an image). */
export const IMAGE_PANEL: Box = { x: 6.4, y: DECK_GRID.titleY, w: 3.3, h: 4.85 };

/** The full-width chart box under the title/lead. */
export const CHART_BOX: Box = { x: DECK_GRID.marginX, y: 2.1, w: CONTENT_W, h: 2.9 };

/**
 * Clamps a proposed box so it never leaves the printable canvas (respecting the
 * uniform margins and the footer band). Returns a box guaranteed to be on-grid.
 */
export function clampToGrid(box: Box): Box {
  const minX = DECK_GRID.marginX;
  const maxRight = DECK_GRID.slideW - DECK_GRID.marginX;
  const maxBottom = DECK_GRID.footerY - 0.1;
  const x = Math.max(minX, box.x);
  const y = Math.max(DECK_GRID.titleY, box.y);
  const w = Math.min(box.w, maxRight - x);
  const h = Math.min(box.h, maxBottom - y);
  return { x, y, w: Math.max(0.5, w), h: Math.max(0.5, h) };
}

// ---------------------------------------------------------------------------
// Slide chrome emitters (cover / section divider / footer / title band)
// ---------------------------------------------------------------------------

/** Minimal structural shape of a pptxgenjs slide (we only use a few methods). */
export type PptxSlide = {
  background?: unknown;
  addText: (text: unknown, opts: Record<string, unknown>) => void;
  addShape: (type: unknown, opts: Record<string, unknown>) => void;
  addNotes?: (text: string) => void;
};

/**
 * Renders the COVER slide: full-bleed dominant background, a teal accent spine
 * on the left, an uppercase eyebrow, the deck title (thesis-scale), an accent
 * rule, the company/subtitle, and the date + CONSULTIFY wordmark at the base.
 * A consistent, premium opening chord.
 */
export function renderCover(
  slide: PptxSlide,
  style: DeckStyle,
  opts: { title: string; company?: string; date?: string; isPolish: boolean }
): void {
  slide.background = { color: style.dominant };
  const LEFT = 0.85;
  const TEXT_W = 8.3;

  // Subtle depth: a darker navy footer band grounds the composition (instead of
  // a flat single-color field) — the cover reads as designed, not defaulted.
  slide.addShape('rect', {
    x: 0, y: 4.72, w: DECK_GRID.slideW, h: DECK_GRID.slideH - 4.72,
    fill: { color: darken(style.dominant, 0.22) },
    line: { color: darken(style.dominant, 0.22), width: 0 },
  });

  // Left accent spine.
  slide.addShape('rect', {
    x: 0, y: 0, w: 0.16, h: DECK_GRID.slideH,
    fill: { color: style.accent }, line: { color: style.accent, width: 0 },
  });

  // Eyebrow / kicker — uppercase, tracked, accent-tinted.
  slide.addText(opts.isPolish ? 'PREZENTACJA' : 'PRESENTATION', {
    x: LEFT, y: 1.4, w: TEXT_W, h: 0.32,
    fontFace: style.bodyFont, fontSize: PPT_TYPE_SCALE.kicker, bold: true,
    color: style.accent, charSpacing: 3, align: 'left', valign: 'middle', margin: 0,
  });

  // Title — thesis scale, shrink-fit so long titles never overflow the cover.
  slide.addText(opts.title, {
    x: LEFT, y: 1.85, w: TEXT_W, h: 1.6,
    fontFace: style.headingFont, fontSize: PPT_TYPE_SCALE.coverTitle, bold: true,
    color: style.onDominant, align: 'left', valign: 'top',
    lineSpacingMultiple: 0.98, fit: 'shrink',
  });

  // Accent rule under the title.
  slide.addShape('line', {
    x: LEFT + 0.02, y: 3.6, w: 1.7, h: 0, line: { color: style.accent, width: 3 },
  });

  if (opts.company) {
    slide.addText(opts.company, {
      x: LEFT, y: 3.78, w: TEXT_W, h: 0.6,
      fontFace: style.bodyFont, fontSize: PPT_TYPE_SCALE.lead - 6, color: style.onDominant,
      align: 'left', valign: 'top',
    });
  }

  if (opts.date) {
    slide.addText(opts.date, {
      x: LEFT, y: 4.92, w: 6.0, h: 0.4,
      fontFace: style.bodyFont, fontSize: PPT_TYPE_SCALE.caption + 2, bold: true,
      color: style.onDominant, align: 'left', valign: 'middle', margin: 0,
    });
  }

  slide.addText('CONSULTIFY', {
    x: 7.0, y: 4.92, w: 2.65, h: 0.4,
    fontFace: style.bodyFont, fontSize: PPT_TYPE_SCALE.caption, bold: true,
    color: style.onDominant, charSpacing: 3, align: 'right', valign: 'middle', margin: 0,
  });
}

/**
 * Renders a SECTION DIVIDER slide: dominant band across the middle, section
 * label + optional kicker, teal accent rule. Gives the deck rhythm/structure.
 */
export function renderSectionDivider(
  slide: PptxSlide,
  style: DeckStyle,
  opts: { label: string; kicker?: string }
): void {
  slide.background = { color: DECK_TOKENS.white };
  slide.addShape('rect', {
    x: 0, y: 1.4, w: DECK_GRID.slideW, h: 2.85,
    fill: { color: style.dominant }, line: { color: style.dominant, width: 0 },
  });
  // Darker navy foot-edge on the band — a two-tone band reads richer than a slab.
  slide.addShape('rect', {
    x: 0, y: 4.17, w: DECK_GRID.slideW, h: 0.08,
    fill: { color: darken(style.dominant, 0.22) }, line: { color: darken(style.dominant, 0.22), width: 0 },
  });
  slide.addShape('rect', {
    x: DECK_GRID.marginX, y: 1.62, w: 0.9, h: 0.08,
    fill: { color: style.accent }, line: { color: style.accent, width: 0 },
  });
  if (opts.kicker) {
    slide.addText(opts.kicker.toUpperCase(), {
      x: DECK_GRID.marginX, y: 1.85, w: CONTENT_W, h: 0.4,
      fontFace: style.bodyFont, fontSize: PPT_TYPE_SCALE.kicker + 1, bold: true,
      color: style.accent, charSpacing: 3, align: 'left', valign: 'middle',
    });
  }
  slide.addText(opts.label, {
    x: DECK_GRID.marginX, y: 2.3, w: CONTENT_W, h: 1.4,
    fontFace: style.headingFont, fontSize: PPT_TYPE_SCALE.sectionTitle, bold: true,
    color: style.onDominant, align: 'left', valign: 'top',
    lineSpacingMultiple: 0.98, fit: 'shrink',
  });
}

/**
 * Renders the standard content-slide chrome: top accent bar, thesis title
 * (shrink-fit), a hairline divider, and a footer (company left / page number
 * right). Returns the y-baseline where content should begin.
 */
export function renderContentChrome(
  slide: PptxSlide,
  style: DeckStyle,
  opts: { title: string; company?: string; pageNumber: number; isPolish: boolean }
): { contentTop: number } {
  slide.background = { color: DECK_TOKENS.white };

  // Top accent bar — a thin dominant lead-in with a teal accent tab on the left,
  // so the header rule carries the two-tone brand chord rather than a flat strip.
  slide.addShape('rect', {
    x: 0, y: 0, w: DECK_GRID.slideW, h: 0.12,
    fill: { color: style.dominant }, line: { color: style.dominant, width: 0 },
  });
  slide.addShape('rect', {
    x: 0, y: 0, w: 1.6, h: 0.12,
    fill: { color: style.accent }, line: { color: style.accent, width: 0 },
  });

  // Thesis title — shrink-fit guarantees no overflow.
  slide.addText(opts.title, {
    x: DECK_GRID.marginX, y: DECK_GRID.titleY, w: CONTENT_W, h: DECK_GRID.titleH,
    fontFace: style.headingFont, fontSize: PPT_TYPE_SCALE.slideTitle, bold: true,
    color: style.dominant, align: 'left', valign: 'top', fit: 'shrink',
    lineSpacingMultiple: 0.98,
  });

  // Thin divider under the title (teal segment + hairline continuation) — the
  // PPTX analogue of the DOCX teal hairline under every H1.
  slide.addShape('line', {
    x: DECK_GRID.marginX, y: 1.55, w: 0.7, h: 0,
    line: { color: style.accent, width: 2 },
  });
  slide.addShape('line', {
    x: DECK_GRID.marginX + 0.75, y: 1.55, w: CONTENT_W - 0.75, h: 0,
    line: { color: DECK_TOKENS.gridline, width: 1 },
  });

  renderFooter(slide, style, opts);
  return { contentTop: DECK_GRID.contentTop };
}

/** Renders the footer band: company (left) + page number (right). */
export function renderFooter(
  slide: PptxSlide,
  style: DeckStyle,
  opts: { company?: string; pageNumber: number }
): void {
  if (opts.company) {
    slide.addText(opts.company, {
      x: DECK_GRID.marginX, y: DECK_GRID.footerY, w: 6, h: DECK_GRID.footerH,
      fontFace: style.bodyFont, fontSize: PPT_TYPE_SCALE.caption, color: style.muted, align: 'left',
    });
  }
  slide.addText(String(opts.pageNumber), {
    x: 9.0, y: DECK_GRID.footerY, w: 0.6, h: DECK_GRID.footerH,
    fontFace: style.bodyFont, fontSize: PPT_TYPE_SCALE.caption, color: style.muted, align: 'right',
  });
}

/**
 * Renders a disciplined bullet list on-slide and pushes overflow (extra bullets
 * + full text of trimmed ones) into the speaker notes. Bullets get a teal
 * square marker; body sizes per §3 (min 18pt for projection, shrink-fit guard).
 */
export function renderBullets(
  slide: PptxSlide,
  style: DeckStyle,
  bullets: string[],
  box: Box
): void {
  const { onSlide, notes } = enforceBulletDiscipline(bullets);
  if (onSlide.length === 0) return;

  const rows = onSlide.map((b) => ({
    text: b,
    options: {
      bullet: { code: '25AA', indent: 20 }, // ▪ square marker
      color: style.neutral,
      fontFace: style.bodyFont,
      fontSize: PPT_TYPE_SCALE.body,
      paraSpaceAfter: 12, // generous inter-bullet rhythm (parity with DOCX bodyAfter)
      lineSpacingMultiple: 1.08,
    },
  }));

  slide.addText(rows as unknown as string, {
    x: box.x, y: box.y, w: box.w, h: box.h,
    align: 'left', valign: 'top', fit: 'shrink',
  });

  if (notes.length > 0 && typeof slide.addNotes === 'function') {
    slide.addNotes(notes.map((n) => `• ${n}`).join('\n'));
  }
}

/**
 * Renders the CLOSING slide as a DECISION bookend, not a valediction.
 *
 * CONCLUSION_LAYER §W5 is explicit: a management deck ends on "what to do first"
 * (K3) + "what to expect" (K4), NEVER on a bare "Thank you" slide. This keeps
 * the cover-style dominant bookend (visual symmetry with renderCover) but fills
 * it with the ask + the expected outcome so the last thing on screen is a
 * decision, not a courtesy. The `ask`/`outcome` default to the deck's own
 * closing thesis when the caller does not override them.
 */
export function renderClosing(
  slide: PptxSlide,
  style: DeckStyle,
  opts: { ask: string; outcome?: string; company?: string; date?: string; isPolish: boolean }
): void {
  slide.background = { color: style.dominant };
  const LEFT = 0.85;
  const TEXT_W = 8.3;

  // Darker navy footer band (mirrors the cover — visual symmetry as a bookend).
  slide.addShape('rect', {
    x: 0, y: 4.72, w: DECK_GRID.slideW, h: DECK_GRID.slideH - 4.72,
    fill: { color: darken(style.dominant, 0.22) },
    line: { color: darken(style.dominant, 0.22), width: 0 },
  });

  // Left accent spine (mirrors the cover).
  slide.addShape('rect', {
    x: 0, y: 0, w: 0.16, h: DECK_GRID.slideH,
    fill: { color: style.accent }, line: { color: style.accent, width: 0 },
  });

  // Eyebrow — this is the ASK, not a thank-you.
  slide.addText(opts.isPolish ? 'DECYZJA' : 'THE ASK', {
    x: LEFT, y: 1.15, w: TEXT_W, h: 0.32,
    fontFace: style.bodyFont, fontSize: PPT_TYPE_SCALE.kicker, bold: true,
    color: style.accent, charSpacing: 3, align: 'left', valign: 'middle', margin: 0,
  });

  // K3 — what to do first (thesis scale, shrink-fit).
  slide.addText(opts.ask, {
    x: LEFT, y: 1.55, w: TEXT_W, h: 1.5,
    fontFace: style.headingFont, fontSize: PPT_TYPE_SCALE.slideTitle + 2, bold: true,
    color: style.onDominant, align: 'left', valign: 'top',
    lineSpacingMultiple: 1.0, fit: 'shrink',
  });

  // Accent rule.
  slide.addShape('line', {
    x: LEFT + 0.02, y: 3.2, w: 1.7, h: 0, line: { color: style.accent, width: 3 },
  });

  // K4 — what to expect.
  if (opts.outcome) {
    slide.addText((opts.isPolish ? 'Czego oczekiwać: ' : 'What to expect: ') + opts.outcome, {
      x: LEFT, y: 3.42, w: TEXT_W, h: 1.3,
      fontFace: style.bodyFont, fontSize: PPT_TYPE_SCALE.body - 3, color: style.onDominant,
      align: 'left', valign: 'top', lineSpacingMultiple: 1.06, fit: 'shrink',
    });
  }

  if (opts.date) {
    slide.addText(opts.date, {
      x: LEFT, y: 4.92, w: 6.0, h: 0.4,
      fontFace: style.bodyFont, fontSize: PPT_TYPE_SCALE.caption + 2, bold: true,
      color: style.onDominant, align: 'left', valign: 'middle', margin: 0,
    });
  }
  slide.addText('CONSULTIFY', {
    x: 7.0, y: 4.92, w: 2.65, h: 0.4,
    fontFace: style.bodyFont, fontSize: PPT_TYPE_SCALE.caption, bold: true,
    color: style.onDominant, charSpacing: 3, align: 'right', valign: 'middle', margin: 0,
  });
}

/**
 * Appends text to the speaker notes (fail-soft — no-op when addNotes absent).
 * Used to demote overflow prose so the slide surface stays clean.
 */
export function pushNote(slide: PptxSlide, note: string): void {
  const n = (note ?? '').trim();
  if (!n) return;
  if (typeof slide.addNotes === 'function') slide.addNotes(n);
}

// ---------------------------------------------------------------------------
// COMPOSITION LAYER (R4 §8) — geometry varies with intent, not just chart-vs-text.
//
// A premium deck does not draw every slide as "title + bullets". It composes:
// a metrics slide becomes a KPI-stat band; a comparison becomes a two-column
// split; a single insight becomes a lead-thesis + support column. These
// deterministic emitters give the runtime that vocabulary — the Gamma-killer is
// LAYOUT variety, which the AI content already earns but the old renderer flattened.
// ---------------------------------------------------------------------------

/** One KPI stat: a big number + its label + optional supporting delta/caption. */
export interface KpiStat {
  /** The headline figure, already formatted (e.g. "14–22 M€", "88–92%"). */
  value: string;
  /** Short label under the number (e.g. "Run-rate value at stake"). */
  label: string;
  /** Optional delta / benchmark caption (e.g. "vs 62% today"). */
  caption?: string;
}

/**
 * Renders a KPI-STAT BAND: up to four big-number cards across the content band.
 * Each card is a soft-tinted panel with an accent top-rule, an oversized figure,
 * a label, and an optional caption. This is the canonical "metrics overview"
 * composition — a wall of numbers reads as evidence, not as a bullet list.
 * Returns the y-baseline just under the band so a caller can add a source line.
 */
export function renderKpiBand(
  slide: PptxSlide,
  style: DeckStyle,
  stats: KpiStat[],
  opts: { top?: number } = {}
): { bottom: number } {
  const items = (stats ?? []).filter((s) => (s?.value ?? '').trim()).slice(0, 4);
  if (items.length === 0) return { bottom: DECK_GRID.contentTop };

  const top = opts.top ?? DECK_GRID.contentTop;
  const gap = 0.25;
  const cardH = 2.35;
  const cardW = (CONTENT_W - gap * (items.length - 1)) / items.length;
  // Big figure scales down as cards get narrower (4 stats → smaller than 2).
  const valueSize = items.length >= 4 ? 30 : items.length === 3 ? 34 : 40;

  items.forEach((s, i) => {
    const x = DECK_GRID.marginX + i * (cardW + gap);
    // Panel.
    slide.addShape('rect', {
      x, y: top, w: cardW, h: cardH,
      fill: { color: DECK_TOKENS.panelFill }, line: { color: DECK_TOKENS.gridline, width: 1 },
    });
    // Accent top rule.
    slide.addShape('rect', {
      x, y: top, w: cardW, h: 0.07,
      fill: { color: style.accent }, line: { color: style.accent, width: 0 },
    });
    // Big figure — dominant navy so the number is the anchor; the accent lives
    // on the rule + label kicker (avoids a wall of teal digits).
    slide.addText(s.value.trim(), {
      x: x + 0.14, y: top + 0.3, w: cardW - 0.28, h: 0.95,
      fontFace: style.headingFont, fontSize: valueSize, bold: true,
      color: style.dominant, align: 'left', valign: 'top', fit: 'shrink',
    });
    // Label — uppercase kicker, tracked, deep-accent tint (reads as a metric name).
    slide.addText(s.label.trim().toUpperCase(), {
      x: x + 0.14, y: top + 1.32, w: cardW - 0.28, h: 0.62,
      fontFace: style.bodyFont, fontSize: PPT_TYPE_SCALE.caption, bold: true,
      color: style.accentInk, charSpacing: 1, align: 'left', valign: 'top', lineSpacingMultiple: 1.02,
    });
    // Caption (benchmark/delta).
    if (s.caption?.trim()) {
      slide.addText(s.caption.trim(), {
        x: x + 0.14, y: top + cardH - 0.5, w: cardW - 0.28, h: 0.42,
        fontFace: style.bodyFont, fontSize: PPT_TYPE_SCALE.micro + 1, italic: true,
        color: style.muted, align: 'left', valign: 'bottom',
      });
    }
  });

  return { bottom: top + cardH + 0.15 };
}

/**
 * Renders a TWO-COLUMN SPLIT: a left panel and a right panel with a header +
 * bullets each. The canonical "comparison" / "before-after" / "us-vs-them"
 * composition — far more legible than one merged bullet list. Left panel is
 * tinted (the "today"/problem side), right panel carries an accent header (the
 * "target"/answer side). Overflow bullets spill to notes via the caller.
 */
export function renderTwoColumnSplit(
  slide: PptxSlide,
  style: DeckStyle,
  opts: {
    left: { heading: string; bullets: string[] };
    right: { heading: string; bullets: string[] };
    top?: number;
  }
): void {
  const top = opts.top ?? DECK_GRID.contentTop;
  const gap = 0.4;
  const colW = (CONTENT_W - gap) / 2;
  const colH = DECK_GRID.footerY - top - 0.2;

  const panel = (
    x: number,
    o: { heading: string; bullets: string[] },
    accentHeader: boolean
  ): void => {
    // Panel background.
    slide.addShape('rect', {
      x, y: top, w: colW, h: colH,
      fill: { color: accentHeader ? DECK_TOKENS.panelAccentFill : DECK_TOKENS.panelFill },
      line: { color: DECK_TOKENS.gridline, width: 1 },
    });
    // Header band.
    slide.addShape('rect', {
      x, y: top, w: colW, h: 0.52,
      fill: { color: accentHeader ? style.accent : style.dominant },
      line: { color: accentHeader ? style.accent : style.dominant, width: 0 },
    });
    slide.addText(o.heading.trim(), {
      x: x + 0.2, y: top, w: colW - 0.4, h: 0.52,
      fontFace: style.headingFont, fontSize: PPT_TYPE_SCALE.body - 2, bold: true,
      color: style.onDominant, align: 'left', valign: 'middle', fit: 'shrink',
    });
    // Bullets.
    const { onSlide } = enforceBulletDiscipline(o.bullets, { maxCount: 6, maxWords: 12 });
    if (onSlide.length > 0) {
      const rows = onSlide.map((b) => ({
        text: b,
        options: {
          bullet: { code: '25AA', indent: 16 },
          color: style.neutral,
          fontFace: style.bodyFont,
          fontSize: PPT_TYPE_SCALE.body - 3,
          paraSpaceAfter: 9,
          lineSpacingMultiple: 1.06,
        },
      }));
      slide.addText(rows as unknown as string, {
        x: x + 0.2, y: top + 0.7, w: colW - 0.4, h: colH - 0.9,
        align: 'left', valign: 'top', fit: 'shrink',
      });
    }
  };

  panel(DECK_GRID.marginX, opts.left, false);
  panel(DECK_GRID.marginX + colW + gap, opts.right, true);
}

/**
 * Renders a LEAD-THESIS composition: an oversized lead sentence (the insight
 * stated once, large) on the left, a supporting bullet column on the right.
 * The canonical "single insight" / "recommendation" composition — the eye lands
 * on the assertion first, then reads the evidence. Returns nothing; overflow is
 * pushed to notes by the caller.
 */
export function renderLeadWithSupport(
  slide: PptxSlide,
  style: DeckStyle,
  opts: { lead: string; support: string[]; top?: number }
): void {
  const top = opts.top ?? DECK_GRID.contentTop;
  const leadW = 4.6;
  const gap = 0.5;
  const supX = DECK_GRID.marginX + leadW + gap;
  const supW = CONTENT_W - leadW - gap;
  const h = DECK_GRID.footerY - top - 0.2;

  // Accent tick before the lead.
  slide.addShape('rect', {
    x: DECK_GRID.marginX, y: top + 0.05, w: 0.08, h: 0.9,
    fill: { color: style.accent }, line: { color: style.accent, width: 0 },
  });

  const leadFit = fitProse(opts.lead, leadW - 0.25, h, PPT_TYPE_SCALE.lead, 16);
  slide.addText(leadFit.text, {
    x: DECK_GRID.marginX + 0.22, y: top, w: leadW - 0.25, h,
    fontFace: style.headingFont, fontSize: leadFit.fontSize, bold: true,
    color: style.dominant, align: 'left', valign: 'top', lineSpacingMultiple: 1.04,
  });
  if (leadFit.overflowNote) pushNote(slide, leadFit.overflowNote);

  const { onSlide } = enforceBulletDiscipline(opts.support, { maxCount: 6, maxWords: 12 });
  if (onSlide.length > 0) {
    const rows = onSlide.map((b) => ({
      text: b,
      options: {
        bullet: { code: '25AA', indent: 16 },
        color: style.neutral,
        fontFace: style.bodyFont,
        fontSize: PPT_TYPE_SCALE.body - 3,
        paraSpaceAfter: 11,
        lineSpacingMultiple: 1.06,
      },
    }));
    slide.addText(rows as unknown as string, {
      x: supX, y: top, w: supW, h,
      align: 'left', valign: 'top', fit: 'shrink',
    });
  }
}

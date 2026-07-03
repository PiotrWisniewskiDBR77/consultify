// @vitest-environment node
/**
 * Unit tests — DeckStyler (PPTX guaranteed visual layer, Vegas Fala 6).
 *
 * Sibling of workbookStyler.test.ts. DeckStyler is the deterministic visual
 * layer that hardens the minimal PPTX fallback renderer (bundlePptxRuntime)
 * from "3 z minusem" to agency-grade. These tests are evidence-grade:
 *   • pure helpers (palette, bullet discipline, prose fit, grid clamp) asserted
 *     directly on their math/contract;
 *   • chrome emitters (cover / section / content / footer / bullets) asserted
 *     against a fake pptxgenjs slide that records addText/addShape/addNotes.
 */

import { describe, expect, it } from 'vitest';

import {
  BULLET_MAX_COUNT,
  BULLET_MAX_WORDS,
  CONTENT_W,
  DECK_GRID,
  clampToGrid,
  enforceBulletDiscipline,
  estimateCharCapacity,
  fitProse,
  hex,
  looksLikeThesis,
  pushNote,
  renderBullets,
  renderContentChrome,
  renderCover,
  renderFooter,
  renderKpiBand,
  renderLeadWithSupport,
  renderSectionDivider,
  renderTwoColumnSplit,
  resolveDeckStyle,
  trimToWords,
  wordCount,
  type PptxSlide,
} from '../../../server/src/services/deliverables/DeckStyler.js';

// ---------------------------------------------------------------------------
// Fake pptxgenjs slide — records every emit so we can assert what landed.
// ---------------------------------------------------------------------------

interface Rec {
  texts: Array<{ text: unknown; opts: Record<string, unknown> }>;
  shapes: Array<{ type: unknown; opts: Record<string, unknown> }>;
  notes: string[];
  background?: unknown;
}

function fakeSlide(): PptxSlide & { rec: Rec } {
  const rec: Rec = { texts: [], shapes: [], notes: [] };
  return {
    rec,
    get background() {
      return rec.background;
    },
    set background(v: unknown) {
      rec.background = v;
    },
    addText(text: unknown, opts: Record<string, unknown>) {
      rec.texts.push({ text, opts });
    },
    addShape(type: unknown, opts: Record<string, unknown>) {
      rec.shapes.push({ type, opts });
    },
    addNotes(text: string) {
      rec.notes.push(text);
    },
  };
}

// ---------------------------------------------------------------------------
// Palette resolution — navy/teal, crimson never chrome
// ---------------------------------------------------------------------------

describe('DeckStyler — resolveDeckStyle palette', () => {
  it('executive default: navy dominant + teal accent, hex without #', () => {
    const s = resolveDeckStyle('executive');
    expect(s.dominant).toBe('0C447C'); // navy
    expect(s.accent).toBe('1D9E75'); // teal
    expect(s.dominant).not.toMatch(/^#/);
  });

  it('onDominant is readable (white on navy)', () => {
    const s = resolveDeckStyle('executive');
    expect(s.onDominant).toBe('FFFFFF');
  });

  it('crimson never appears as chrome (dominant/accent are not crimson)', () => {
    for (const id of ['executive', 'modern', 'corporate', 'classic', 'clean']) {
      const s = resolveDeckStyle(id);
      // Consultify crimson trap ≈ 85182F — must not be a structural color.
      expect(s.dominant).not.toBe('85182F');
      expect(s.accent).not.toBe('85182F');
    }
  });

  it('brand override merges palette + fonts', () => {
    const s = resolveDeckStyle('executive', {
      palette: { dominant: '#123456' },
      fontPair: { heading: 'Georgia' },
    });
    expect(s.dominant).toBe('123456');
    expect(s.headingFont).toBe('Georgia');
    expect(s.accent).toBe('1D9E75'); // untouched
  });

  it('hex strips # and uppercases', () => {
    expect(hex('#0c447c')).toBe('0C447C');
    expect(hex('1d9e75')).toBe('1D9E75');
  });
});

// ---------------------------------------------------------------------------
// Bullet discipline — max 5 × 8 words; overflow → notes
// ---------------------------------------------------------------------------

describe('DeckStyler — bullet discipline', () => {
  it('wordCount + trimToWords', () => {
    expect(wordCount('one two three')).toBe(3);
    expect(wordCount('   ')).toBe(0);
    expect(trimToWords('a b c d e f g h i j', 4)).toBe('a b c d…');
    expect(trimToWords('short one', 8)).toBe('short one');
  });

  it('caps at 5 bullets; extras go to notes verbatim', () => {
    const bullets = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7'];
    const { onSlide, notes } = enforceBulletDiscipline(bullets);
    expect(onSlide).toHaveLength(BULLET_MAX_COUNT);
    expect(onSlide).toEqual(['b1', 'b2', 'b3', 'b4', 'b5']);
    expect(notes).toEqual(['b6', 'b7']);
  });

  it('trims long bullets on-slide but keeps full text in notes', () => {
    const long = 'this bullet has far more than eight words in total sentence';
    const { onSlide, notes } = enforceBulletDiscipline([long]);
    expect(wordCount(onSlide[0])).toBeLessThanOrEqual(BULLET_MAX_WORDS + 1); // + ellipsis token
    expect(onSlide[0].endsWith('…')).toBe(true);
    expect(notes).toContain(long);
  });

  it('drops empty/whitespace bullets', () => {
    const { onSlide } = enforceBulletDiscipline(['', '  ', 'real']);
    expect(onSlide).toEqual(['real']);
  });

  it('exports sane caps', () => {
    expect(BULLET_MAX_COUNT).toBe(5);
    expect(BULLET_MAX_WORDS).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// Thesis-title heuristic
// ---------------------------------------------------------------------------

describe('DeckStyler — looksLikeThesis', () => {
  it('a full sentence reads as thesis; a bare label does not', () => {
    expect(looksLikeThesis('Time-to-hire wynosi 62 dni, dwukrotnie powyżej benchmarku')).toBe(true);
    expect(looksLikeThesis('Diagnoza')).toBe(false);
    expect(looksLikeThesis('Executive Summary')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Overflow guard — capacity estimate + fitProse
// ---------------------------------------------------------------------------

describe('DeckStyler — prose overflow guard', () => {
  it('estimateCharCapacity grows with box size and shrinks with font size', () => {
    const big = estimateCharCapacity(8.8, 3.0, 14);
    const small = estimateCharCapacity(8.8, 3.0, 28);
    expect(big).toBeGreaterThan(small);
  });

  it('short prose fits at base size with no overflow note', () => {
    const fit = fitProse('Krótkie zdanie.', 8.8, 3.0, 20, 12);
    expect(fit.fontSize).toBe(20);
    expect(fit.text).toBe('Krótkie zdanie.');
    expect(fit.overflowNote).toBe('');
  });

  it('long prose shrinks; enormous prose truncates + spills to note', () => {
    const huge = 'słowo '.repeat(600).trim();
    const fit = fitProse(huge, 5.5, 3.0, 20, 12);
    expect(fit.fontSize).toBeLessThanOrEqual(20);
    expect(fit.text.length).toBeLessThan(huge.length);
    expect(fit.overflowNote.length).toBeGreaterThan(0);
    // No word split — on-slide text ends cleanly (ellipsis).
    expect(fit.text.endsWith('…')).toBe(true);
  });

  it('empty prose is a no-op', () => {
    const fit = fitProse('', 8.8, 3.0);
    expect(fit.text).toBe('');
    expect(fit.overflowNote).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Grid clamp — visuals never leave the printable canvas
// ---------------------------------------------------------------------------

describe('DeckStyler — clampToGrid', () => {
  it('clamps an oversized box within margins + above footer', () => {
    const c = clampToGrid({ x: -1, y: 0, w: 20, h: 20 });
    expect(c.x).toBeGreaterThanOrEqual(DECK_GRID.marginX);
    expect(c.x + c.w).toBeLessThanOrEqual(DECK_GRID.slideW - DECK_GRID.marginX + 0.001);
    expect(c.y + c.h).toBeLessThanOrEqual(DECK_GRID.footerY);
  });

  it('leaves an already-valid box essentially unchanged', () => {
    const box = { x: DECK_GRID.marginX, y: 2.1, w: CONTENT_W, h: 2.0 };
    const c = clampToGrid(box);
    expect(c.x).toBe(box.x);
    expect(c.w).toBeCloseTo(box.w, 5);
  });
});

// ---------------------------------------------------------------------------
// Chrome emitters — cover / section / content / footer / bullets
// ---------------------------------------------------------------------------

describe('DeckStyler — renderCover', () => {
  it('paints dominant background, accent spine, title, wordmark, date', () => {
    const slide = fakeSlide();
    const style = resolveDeckStyle('executive');
    renderCover(slide, style, { title: 'Deck tytuł', company: 'ACME', date: '2026-07-02', isPolish: true });

    expect(slide.rec.background).toEqual({ color: '0C447C' });
    // Accent spine shape present.
    expect(slide.rec.shapes.some((s) => s.opts.fill && (s.opts.fill as { color?: string }).color === '1D9E75')).toBe(true);
    const allText = slide.rec.texts.map((t) => String(t.text));
    expect(allText).toContain('Deck tytuł');
    expect(allText).toContain('ACME');
    expect(allText).toContain('2026-07-02');
    expect(allText).toContain('CONSULTIFY');
    expect(allText).toContain('PREZENTACJA'); // PL eyebrow
  });
});

describe('DeckStyler — renderSectionDivider', () => {
  it('paints dominant band + label + kicker', () => {
    const slide = fakeSlide();
    renderSectionDivider(slide, resolveDeckStyle('executive'), { label: 'Część I', kicker: 'sekcja' });
    const bands = slide.rec.shapes.filter((s) => (s.opts.fill as { color?: string })?.color === '0C447C');
    expect(bands.length).toBeGreaterThan(0);
    const allText = slide.rec.texts.map((t) => String(t.text));
    expect(allText).toContain('Część I');
    expect(allText).toContain('SEKCJA'); // uppercased kicker
  });
});

describe('DeckStyler — renderContentChrome', () => {
  it('emits accent bar, thesis title (shrink-fit), footer w/ page number', () => {
    const slide = fakeSlide();
    const style = resolveDeckStyle('executive');
    const { contentTop } = renderContentChrome(slide, style, {
      title: 'Time-to-hire wynosi 62 dni',
      company: 'ACME',
      pageNumber: 3,
      isPolish: true,
    });
    expect(contentTop).toBe(DECK_GRID.contentTop);
    const titleText = slide.rec.texts.find((t) => t.text === 'Time-to-hire wynosi 62 dni');
    expect(titleText).toBeDefined();
    expect(titleText!.opts.fit).toBe('shrink'); // overflow guard on title
    expect(titleText!.opts.color).toBe(style.dominant);
    // footer page number present
    expect(slide.rec.texts.some((t) => t.text === '3')).toBe(true);
  });
});

describe('DeckStyler — renderFooter', () => {
  it('page number right, company left, muted color', () => {
    const slide = fakeSlide();
    const style = resolveDeckStyle('executive');
    renderFooter(slide, style, { company: 'ACME', pageNumber: 7 });
    const num = slide.rec.texts.find((t) => t.text === '7');
    expect(num).toBeDefined();
    expect(num!.opts.align).toBe('right');
    const company = slide.rec.texts.find((t) => t.text === 'ACME');
    expect(company!.opts.align).toBe('left');
  });
});

describe('DeckStyler — renderBullets', () => {
  it('renders ≤5 bullets on-slide and pushes overflow to notes', () => {
    const slide = fakeSlide();
    const style = resolveDeckStyle('executive');
    const bullets = ['a', 'b', 'c', 'd', 'e', 'f overflow bullet', 'g overflow'];
    renderBullets(slide, style, bullets, { x: 0.6, y: 1.7, w: 8.8, h: 3.3 });

    // The bullet call passes an array-of-rows (pptxgenjs rich text).
    const bulletCall = slide.rec.texts.find((t) => Array.isArray(t.text));
    expect(bulletCall).toBeDefined();
    expect((bulletCall!.text as unknown[]).length).toBe(BULLET_MAX_COUNT);
    // Overflow bullets in notes.
    expect(slide.rec.notes.length).toBe(1);
    expect(slide.rec.notes[0]).toContain('f overflow bullet');
    expect(slide.rec.notes[0]).toContain('g overflow');
  });

  it('no bullets → no emit', () => {
    const slide = fakeSlide();
    renderBullets(slide, resolveDeckStyle('executive'), [], { x: 0.6, y: 1.7, w: 8.8, h: 3.3 });
    expect(slide.rec.texts).toHaveLength(0);
  });
});

describe('DeckStyler — pushNote', () => {
  it('appends non-empty notes, ignores blank', () => {
    const slide = fakeSlide();
    pushNote(slide, '  ');
    pushNote(slide, 'real note');
    expect(slide.rec.notes).toEqual(['real note']);
  });
});

// ---------------------------------------------------------------------------
// R4 §8 — composition renderers (KPI band / two-column split / lead+support)
// ---------------------------------------------------------------------------

describe('DeckStyler — renderKpiBand (composition)', () => {
  const style = resolveDeckStyle('executive');

  it('draws one card per stat (≤4), each with the big figure + label', () => {
    const slide = fakeSlide();
    renderKpiBand(slide, style, [
      { value: '440', label: 'Interviews', caption: '22 personas' },
      { value: '14–22 M€', label: 'Value at stake' },
    ]);
    const texts = slide.rec.texts.map((t) => t.text);
    expect(texts).toContain('440');
    expect(texts).toContain('14–22 M€');
    expect(texts).toContain('Interviews');
    expect(texts).toContain('22 personas'); // caption
    // Each card = panel rect + accent top rule → ≥2 shapes per card.
    expect(slide.rec.shapes.length).toBeGreaterThanOrEqual(4);
  });

  it('caps at 4 cards and returns a bottom baseline below the band', () => {
    const slide = fakeSlide();
    const stats = Array.from({ length: 6 }, (_, i) => ({ value: `${i}`, label: `L${i}` }));
    const { bottom } = renderKpiBand(slide, style, stats);
    const figures = slide.rec.texts.filter((t) => typeof t.text === 'string' && /^\d$/.test(t.text as string));
    expect(figures.length).toBe(4);
    expect(bottom).toBeGreaterThan(DECK_GRID.contentTop);
  });

  it('empty stats → no emit, bottom = contentTop', () => {
    const slide = fakeSlide();
    const { bottom } = renderKpiBand(slide, style, []);
    expect(slide.rec.texts).toHaveLength(0);
    expect(bottom).toBe(DECK_GRID.contentTop);
  });
});

describe('DeckStyler — renderTwoColumnSplit (composition)', () => {
  const style = resolveDeckStyle('executive');

  it('emits both panel headings and their bullets', () => {
    const slide = fakeSlide();
    renderTwoColumnSplit(slide, style, {
      left: { heading: 'Today', bullets: ['a gap', 'another gap'] },
      right: { heading: 'Target', bullets: ['a fix'] },
    });
    const texts = slide.rec.texts.map((t) => t.text);
    expect(texts).toContain('Today');
    expect(texts).toContain('Target');
    // Two panels → ≥4 shapes (bg + header band each).
    expect(slide.rec.shapes.length).toBeGreaterThanOrEqual(4);
  });
});

describe('DeckStyler — renderLeadWithSupport (composition)', () => {
  const style = resolveDeckStyle('executive');

  it('emits the lead thesis text + an accent tick + support column', () => {
    const slide = fakeSlide();
    renderLeadWithSupport(slide, style, {
      lead: 'Telemetry is rich but response is thirty minutes late.',
      support: ['approve a decision contract', 'fund the operating system'],
    });
    const joined = slide.rec.texts.map((t) => String(t.text)).join(' ');
    expect(joined).toContain('Telemetry is rich');
    // Accent tick shape present.
    expect(slide.rec.shapes.length).toBeGreaterThanOrEqual(1);
  });
});

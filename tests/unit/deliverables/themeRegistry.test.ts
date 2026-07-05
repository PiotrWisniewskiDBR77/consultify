// @vitest-environment node
/**
 * Unit tests — themeRegistry (F3.1)
 *
 * TR-1: registry shape — 5 themes, 10 distinct fonts, valid hex palettes
 * TR-2: resolveTheme — id lookup, fallback, overrides
 * TR-3: deliverableDefaults consumes registry (executive = registry executive)
 */

import { describe, expect, it } from 'vitest';
import {
  DELIVERABLE_THEMES,
  DEFAULT_THEME_ID,
  resolveTheme,
  isThemeId,
  allThemeFonts,
  FORMATTING_FONT_LIBRARY,
  isLibraryFont,
  PPT_TYPE_SCALE,
  LIST_MARKERS,
} from '../../../server/src/services/deliverables/themeRegistry.js';
import { resolveDeliverableDefaults } from '../../../server/src/services/deliverables/deliverableDefaults.js';

const HEX = /^#[0-9a-fA-F]{6}$/;

// ── TR-1: registry shape ─────────────────────────────────────────────────

describe('themeRegistry — shape', () => {
  it('TR-1.1: exactly 5 themes registered', () => {
    expect(DELIVERABLE_THEMES).toHaveLength(5);
    const ids = DELIVERABLE_THEMES.map((t) => t.id).sort();
    expect(ids).toEqual(['classic', 'clean', 'corporate', 'executive', 'modern']);
  });

  it('TR-1.2: every theme has a complete font pair', () => {
    for (const t of DELIVERABLE_THEMES) {
      expect(t.fontPair.heading.length).toBeGreaterThan(0);
      expect(t.fontPair.body.length).toBeGreaterThan(0);
    }
  });

  it('TR-1.3: every theme font comes from the curated §1 library (spec alignment)', () => {
    for (const t of DELIVERABLE_THEMES) {
      expect(isLibraryFont(t.fontPair.heading), `${t.id} heading "${t.fontPair.heading}" not in §1 library`).toBe(true);
      expect(isLibraryFont(t.fontPair.body), `${t.id} body "${t.fontPair.body}" not in §1 library`).toBe(true);
    }
    // 5 default pairs draw on a subset of the library (Inter/Calibri reused).
    expect(allThemeFonts().length).toBeGreaterThanOrEqual(5);
  });

  it('TR-1.4: every palette has 4 valid hex colors', () => {
    for (const t of DELIVERABLE_THEMES) {
      expect(t.palette.dominant).toMatch(HEX);
      expect(t.palette.supporting).toMatch(HEX);
      expect(t.palette.accent).toMatch(HEX);
      expect(t.palette.neutralText).toMatch(HEX);
    }
  });

  it('TR-1.5: each theme has a label + description for UI', () => {
    for (const t of DELIVERABLE_THEMES) {
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.description.length).toBeGreaterThan(10);
    }
  });
});

// ── TR-2: resolveTheme ───────────────────────────────────────────────────

describe('themeRegistry — resolveTheme', () => {
  it('TR-2.1: resolves a known id', () => {
    const modern = resolveTheme('modern');
    expect(modern.id).toBe('modern');
    expect(modern.fontPair.heading).toBe('Inter');
  });

  it('TR-2.2: unknown id → falls back to DEFAULT_THEME_ID', () => {
    expect(resolveTheme('nonexistent').id).toBe(DEFAULT_THEME_ID);
    expect(resolveTheme(undefined).id).toBe(DEFAULT_THEME_ID);
    expect(resolveTheme(null).id).toBe(DEFAULT_THEME_ID);
  });

  it('TR-2.3: overrides merge per field (brand client > theme)', () => {
    const t = resolveTheme('executive', {
      fontPair: { heading: 'Acme Sans' },
      palette: { accent: '#FF0000' },
    });
    expect(t.fontPair.heading).toBe('Acme Sans'); // overridden
    expect(t.fontPair.body).toBe('Inter'); // theme default kept
    expect(t.palette.accent).toBe('#FF0000'); // overridden
    expect(t.palette.dominant).toBe('#0C447C'); // theme default kept
  });

  it('TR-2.4: isThemeId type guard', () => {
    expect(isThemeId('executive')).toBe(true);
    expect(isThemeId('nope')).toBe(false);
    expect(isThemeId(42)).toBe(false);
  });
});

// ── TR-3: deliverableDefaults integration ────────────────────────────────

describe('themeRegistry — deliverableDefaults integration', () => {
  it('TR-3.1: default deck graphic = executive theme from registry', () => {
    const d = resolveDeliverableDefaults('deck');
    const exec = resolveTheme('executive');
    expect(d.graphic.theme).toBe('executive');
    expect(d.graphic.fontPair).toEqual(exec.fontPair);
    expect(d.graphic.palette).toEqual(exec.palette);
  });

  it('TR-3.2: themeId override pulls theme into graphic defaults', () => {
    const d = resolveDeliverableDefaults('deck', { themeId: 'modern' });
    const modern = resolveTheme('modern');
    expect(d.graphic.theme).toBe('modern');
    expect(d.graphic.fontPair.heading).toBe('Inter');
    expect(d.graphic.palette.dominant).toBe(modern.palette.dominant);
    // format-specific graphic (layout) preserved
    expect(d.graphic.layout?.minDistinctLayouts).toBe(8);
  });

  it('TR-3.3: explicit graphic override beats theme', () => {
    const d = resolveDeliverableDefaults('deck', {
      themeId: 'modern',
      graphic: { palette: { dominant: '#000000', supporting: '#111111', accent: '#222222', neutralText: '#333333' } },
    });
    expect(d.graphic.theme).toBe('modern'); // theme id from registry
    expect(d.graphic.palette.dominant).toBe('#000000'); // explicit override wins
  });
});

// ── TR-4: F3.3 typography SSOT (DELIVERABLE_FORMATTING_SPEC §1/§3/§4) ──────

describe('themeRegistry — F3.3 typography SSOT', () => {
  it('TR-4.1: §1 font library = 5 sans + 5 serif (10 curated)', () => {
    expect(FORMATTING_FONT_LIBRARY.sans).toHaveLength(5);
    expect(FORMATTING_FONT_LIBRARY.serif).toHaveLength(5);
    const all = [...FORMATTING_FONT_LIBRARY.sans, ...FORMATTING_FONT_LIBRARY.serif];
    expect(new Set(all).size).toBe(10);
  });

  it('TR-4.2: the 5 canonical pairs match spec §2', () => {
    // spec §2 mandates these exact heading/body pairs
    const expected: Record<string, [string, string]> = {
      modern: ['Inter', 'Inter'],
      executive: ['Merriweather', 'Inter'],
      corporate: ['Calibri', 'Calibri'],
      classic: ['EB Garamond', 'Georgia'],
      clean: ['Lato', 'Source Sans 3'],
    };
    for (const t of DELIVERABLE_THEMES) {
      const [h, b] = expected[t.id];
      expect(t.fontPair.heading, `${t.id} heading`).toBe(h);
      expect(t.fontPair.body, `${t.id} body`).toBe(b);
    }
  });

  it('TR-4.3: isLibraryFont guards membership', () => {
    expect(isLibraryFont('Inter')).toBe(true);
    expect(isLibraryFont('Times New Roman')).toBe(true);
    expect(isLibraryFont('Poppins')).toBe(false); // not curated
    expect(isLibraryFont('Comic Sans MS')).toBe(false);
  });

  it('TR-4.4: §3 PPT scale honors projection floor (body ≥ 18pt)', () => {
    expect(PPT_TYPE_SCALE.coverTitle).toBeGreaterThanOrEqual(PPT_TYPE_SCALE.slideTitle);
    expect(PPT_TYPE_SCALE.slideTitle).toBeGreaterThanOrEqual(PPT_TYPE_SCALE.body);
    expect(PPT_TYPE_SCALE.body).toBeGreaterThanOrEqual(18); // spec: min 18 do projekcji
    expect(PPT_TYPE_SCALE.caption).toBeLessThan(PPT_TYPE_SCALE.body);
  });

  it('TR-4.5: §4 list markers = 3 nesting levels per list type', () => {
    expect(LIST_MARKERS.bullet).toEqual(['•', '–', '·']);
    expect(LIST_MARKERS.number).toEqual(['1.', 'a.', 'i.']);
    expect(LIST_MARKERS.checklist.unchecked).toBe('☐');
    expect(LIST_MARKERS.checklist.checked).toBe('☑');
  });
});

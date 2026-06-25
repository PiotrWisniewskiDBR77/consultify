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

  it('TR-1.3: 10 distinct fonts across the registry (DoD F3.1)', () => {
    const fonts = allThemeFonts();
    expect(fonts).toHaveLength(10);
    // no duplicates
    expect(new Set(fonts).size).toBe(10);
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
    expect(modern.fontPair.heading).toBe('Poppins');
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
    expect(d.graphic.fontPair.heading).toBe('Poppins');
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

// @vitest-environment node
/**
 * W7.4 + W14.3 — paletteLibrary: semantyka, serie, Okabe-Ito, kontrast WCAG.
 */
import { describe, expect, it } from 'vitest';
import {
  resolveSemanticPalette,
  seriesPalette,
  okabeIto,
  OKABE_ITO,
  contrastRatio,
  readableTextOn,
} from '../../../server/src/services/deliverables/paletteLibrary';

const HEX = /^#[0-9A-Fa-f]{6}$/;

describe('W7.4 — resolveSemanticPalette', () => {
  it('zwraca 6 kolorów semantycznych dla każdego motywu', () => {
    for (const id of ['executive', 'modern', 'corporate', 'classic', 'clean']) {
      const p = resolveSemanticPalette(id);
      for (const key of ['success', 'warning', 'danger', 'info', 'positive', 'negative'] as const) {
        expect(p[key], `${id}.${key}`).toMatch(HEX);
      }
    }
  });

  it('nieznany motyw → fallback executive', () => {
    expect(resolveSemanticPalette('nope')).toEqual(resolveSemanticPalette('executive'));
    expect(resolveSemanticPalette(null)).toEqual(resolveSemanticPalette('executive'));
    expect(resolveSemanticPalette(undefined)).toEqual(resolveSemanticPalette('executive'));
  });

  it('success ≠ danger (znaczenie rozróżnialne)', () => {
    const p = resolveSemanticPalette('modern');
    expect(p.success).not.toBe(p.danger);
    expect(p.positive).not.toBe(p.negative);
  });
});

describe('W14.3 — Okabe-Ito colorblind-safe', () => {
  it('OKABE_ITO ma 8 unikalnych kolorów #hex', () => {
    expect(OKABE_ITO).toHaveLength(8);
    expect(new Set(OKABE_ITO).size).toBe(8);
    for (const c of OKABE_ITO) expect(c).toMatch(HEX);
  });

  it('okabeIto(N) zwraca dokładnie N kolorów, cyklicznie gdy N>8', () => {
    expect(okabeIto(3)).toHaveLength(3);
    expect(okabeIto(8)).toHaveLength(8);
    expect(okabeIto(10)).toHaveLength(10);
    expect(okabeIto(10)[8]).toBe(OKABE_ITO[0]); // cykl
    expect(okabeIto(0)).toEqual([]);
    expect(okabeIto(-1)).toEqual([]);
  });
});

describe('W7.4 — seriesPalette', () => {
  it('zwraca N kolorów dla motywu, pierwszy = brand anchor', () => {
    const exec = seriesPalette(3, { themeId: 'executive' });
    expect(exec).toHaveLength(3);
    expect(exec[0]).toBe('#0C447C'); // dominant executive
  });

  it('colorblindSafe=true → ignoruje motyw, używa Okabe-Ito', () => {
    const cb = seriesPalette(4, { themeId: 'modern', colorblindSafe: true });
    expect(cb).toEqual(okabeIto(4));
  });

  it('cyklicznie gdy count > dostępnych tonów', () => {
    const many = seriesPalette(10, { themeId: 'clean' });
    expect(many).toHaveLength(10);
  });

  it('count<=0 → []', () => {
    expect(seriesPalette(0)).toEqual([]);
  });

  it('brak themeId → executive default', () => {
    expect(seriesPalette(2)[0]).toBe('#0C447C');
  });
});

describe('W14.3 — contrastRatio WCAG 2.1', () => {
  it('czarny na białym = 21:1 (max)', () => {
    const r = contrastRatio('#000000', '#FFFFFF');
    expect(r.ratio).toBe(21);
    expect(r.passesAAA).toBe(true);
  });

  it('biały na białym = 1:1 (min)', () => {
    const r = contrastRatio('#FFFFFF', '#FFFFFF');
    expect(r.ratio).toBe(1);
    expect(r.passesAA).toBe(false);
    expect(r.passesAALarge).toBe(false);
  });

  it('progi AA (4.5) / AA-large (3.0) / AAA (7.0) działają', () => {
    // #767676 na białym ≈ 4.54 (graniczny AA)
    const r = contrastRatio('#767676', '#FFFFFF');
    expect(r.ratio).toBeGreaterThanOrEqual(4.5);
    expect(r.passesAA).toBe(true);
  });

  it('symetryczny (fg/bg zamiana nie zmienia ratio)', () => {
    const a = contrastRatio('#0C447C', '#FFFFFF');
    const b = contrastRatio('#FFFFFF', '#0C447C');
    expect(a.ratio).toBe(b.ratio);
  });

  it('obsługuje #RGB shorthand', () => {
    const r = contrastRatio('#000', '#FFF');
    expect(r.ratio).toBe(21);
  });

  it('niepoprawny hex → ratio 1 (fail-safe)', () => {
    const r = contrastRatio('garbage', '#FFFFFF');
    expect(r.ratio).toBe(1);
    expect(r.passesAA).toBe(false);
  });

  it('executive dominant na białym przechodzi AA (czytelny pas nagłówka)', () => {
    const r = contrastRatio('#FFFFFF', '#0C447C'); // biały tekst na granatowym pasie
    expect(r.passesAA).toBe(true);
  });
});

describe('W14.3 — readableTextOn', () => {
  it('ciemne tło → biały tekst', () => {
    expect(readableTextOn('#0C447C')).toBe('#FFFFFF');
    expect(readableTextOn('#000000')).toBe('#FFFFFF');
  });

  it('jasne tło → ciemny tekst', () => {
    expect(readableTextOn('#FFFFFF')).toBe('#111827');
    expect(readableTextOn('#F0E442')).toBe('#111827'); // żółty Okabe-Ito
  });

  it('wybrany kolor faktycznie daje wyższy kontrast', () => {
    const bg = '#4338CA'; // modern dominant
    const chosen = readableTextOn(bg);
    const other = chosen === '#FFFFFF' ? '#111827' : '#FFFFFF';
    expect(contrastRatio(chosen, bg).ratio).toBeGreaterThanOrEqual(contrastRatio(other, bg).ratio);
  });
});

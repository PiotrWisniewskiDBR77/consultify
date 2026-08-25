import { describe, expect, it } from 'vitest';

import {
  normalizeAppearancePreferences,
  normalizeFontScale,
  serializeAppearancePreferences,
} from '../settings.api';

// Settings > Appearance & Advanced > Appearance now exposes a Font Size
// control (owner ask: "gęstość/wielkość czcionki/strona startowa" —
// density already shipped, font size was the missing cheap win; start page
// was skipped because nothing in app-boot routing reads it — see the FAZA 2
// report). The server's default preference row stores a raw multiplier
// (fontScale: 1) while the UI always works in whole percent (90/100/110/120),
// so the normalize/serialize pair is the one place that conversion must be
// correct in both directions.
describe('settings.api — appearance fontScale normalize/serialize', () => {
  it('treats the server default multiplier (1) as 100%', () => {
    expect(normalizeFontScale(1)).toBe(100);
  });

  it('treats a already-percent value as itself', () => {
    expect(normalizeFontScale(110)).toBe(110);
  });

  it('converts a fractional multiplier (0.9) to percent (90)', () => {
    expect(normalizeFontScale(0.9)).toBe(90);
  });

  it('snaps an off-step value to the nearest supported step', () => {
    expect(normalizeFontScale(103)).toBe(100);
    expect(normalizeFontScale(117)).toBe(120);
  });

  it('falls back to 100 for missing, non-numeric or non-positive input', () => {
    expect(normalizeFontScale(undefined)).toBe(100);
    expect(normalizeFontScale(null)).toBe(100);
    expect(normalizeFontScale('110')).toBe(100);
    expect(normalizeFontScale(0)).toBe(100);
    expect(normalizeFontScale(-50)).toBe(100);
    expect(normalizeFontScale(NaN)).toBe(100);
  });

  it('normalizeAppearancePreferences round-trips a full server payload', () => {
    const prefs = normalizeAppearancePreferences({
      theme: 'dark',
      accentColor: '#3b82f6',
      uiDensity: 'compact',
      fontScale: 110,
    });
    expect(prefs).toEqual({
      theme: 'dark',
      accentColor: '#3b82f6',
      density: 'compact',
      fontScale: 110,
    });
  });

  it('normalizeAppearancePreferences defaults fontScale to 100 when absent (fresh account)', () => {
    const prefs = normalizeAppearancePreferences({ theme: 'light', accentColor: '#A51C30' });
    expect(prefs.fontScale).toBe(100);
  });

  it('serializeAppearancePreferences sends fontScale as a whole percent for the PUT body', () => {
    const body = serializeAppearancePreferences({
      theme: 'system',
      accentColor: '#A51C30',
      density: 'spacious',
      fontScale: 120,
    });
    expect(body).toEqual({
      theme: 'system',
      accentColor: '#A51C30',
      uiDensity: 'spacious',
      fontScale: 120,
    });
  });

  it('a save-then-load round trip is stable (no drift across repeated saves)', () => {
    const saved = serializeAppearancePreferences({
      theme: 'dark',
      accentColor: '#A51C30',
      density: 'comfortable',
      fontScale: 90,
    });
    const reloaded = normalizeAppearancePreferences(saved);
    expect(reloaded.fontScale).toBe(90);
  });
});

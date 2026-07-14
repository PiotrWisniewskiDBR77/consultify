/**
 * paletteLibrary — W7.4 + W14.3: kuratorowane palety semantyczne, serie wykresów,
 * colorblind-safe oraz walidacja kontrastu WCAG.
 *
 * Rozszerza `themeRegistry` (paleta 60-30-10 marki) o:
 *   • palety SEMANTYCZNE  — success/warning/danger/info/positive/negative (per motyw)
 *   • palety SERII        — N-kolorowe sekwencje dla wykresów wieloseryjnych
 *   • palety COLORBLIND   — Okabe-Ito 8-kolor (deuteranopia/protanopia/tritanopia-safe)
 *   • walidację KONTRASTU — WCAG 2.1 ratio (AA = 4.5:1 tekst, 3:1 large/UI)
 *
 * Wszystko deterministyczne (bez LLM). Renderery (PPTX/DOCX/XLSX/web) konsumują
 * przez `resolveSemanticPalette` / `seriesPalette` / `okabeIto`.
 *
 * SSOT: DELIVERABLE_FORMATTING_SPEC §2 (kolor). Reguła 60-30-10 pozostaje w themeRegistry.
 */

import type { ThemeId } from './themeRegistry.js';

// ── Typy ─────────────────────────────────────────────────────────────────────

/** Kolory semantyczne — znaczenie, nie tylko estetyka. Wszystkie #RRGGBB. */
export interface SemanticPalette {
  success: string; // pozytywny wynik, „zielone światło", on-track
  warning: string; // ostrzeżenie, at-risk, uwaga
  danger: string; // błąd, off-track, krytyczne ryzyko
  info: string; // neutralna informacja, podpowiedź
  positive: string; // wzrost liczby (delta dodatnia)
  negative: string; // spadek liczby (delta ujemna)
}

export interface ContrastResult {
  ratio: number; // 1.0 – 21.0
  passesAA: boolean; // ≥ 4.5 (normalny tekst)
  passesAALarge: boolean; // ≥ 3.0 (duży tekst / UI / wykresy)
  passesAAA: boolean; // ≥ 7.0
}

// ── §2a Palety semantyczne per motyw ─────────────────────────────────────────
// Dobrane tak, by harmonizowały z akcentem motywu, ale zachowały czytelność
// znaczenia (zielony=dobrze, czerwony=źle) — uniwersalna konwencja biznesowa.
const SEMANTIC_BY_THEME: Record<ThemeId, SemanticPalette> = {
  executive: {
    success: '#1D9E75',
    warning: '#D9A407',
    danger: '#C0392B',
    info: '#0C447C',
    positive: '#1D9E75',
    negative: '#C0392B',
  },
  modern: {
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#06B6D4',
    positive: '#10B981',
    negative: '#EF4444',
  },
  corporate: {
    success: '#15803D',
    warning: '#C2410C',
    danger: '#B91C1C',
    info: '#1F3A5F',
    positive: '#15803D',
    negative: '#B91C1C',
  },
  classic: {
    success: '#14532D',
    warning: '#B45309',
    danger: '#991B1B',
    info: '#1E3A5F',
    positive: '#14532D',
    negative: '#991B1B',
  },
  clean: {
    success: '#059669',
    warning: '#D97706',
    danger: '#DC2626',
    info: '#2563EB',
    positive: '#059669',
    negative: '#DC2626',
  },
};

const DEFAULT_SEMANTIC: SemanticPalette = SEMANTIC_BY_THEME.executive;

/** Zwraca paletę semantyczną dla motywu (fallback → executive). */
export function resolveSemanticPalette(themeId?: string | null): SemanticPalette {
  if (themeId && themeId in SEMANTIC_BY_THEME) {
    return SEMANTIC_BY_THEME[themeId as ThemeId];
  }
  return DEFAULT_SEMANTIC;
}

// ── §2b Okabe-Ito — paleta colorblind-safe (W14.3) ───────────────────────────
// 8 kolorów rozróżnialnych przy wszystkich typach daltonizmu (Okabe & Ito 2008).
// Standard de facto dla naukowych/dostępnych wizualizacji. Kolejność = priorytet.
export const OKABE_ITO = [
  '#0072B2', // niebieski
  '#E69F00', // pomarańczowy
  '#009E73', // zielony bluish
  '#CC79A7', // różowy/fiolet
  '#56B4E9', // jasny niebieski (sky)
  '#D55E00', // wermilion
  '#F0E442', // żółty
  '#000000', // czarny
] as const;

/** Czarno-biały bezpieczny zwrot N kolorów Okabe-Ito (cyklicznie gdy N>8). */
export function okabeIto(count: number): string[] {
  if (count <= 0) return [];
  return Array.from({ length: count }, (_, i) => OKABE_ITO[i % OKABE_ITO.length]);
}

// ── §2c Palety serii wykresów ────────────────────────────────────────────────
// Sekwencje dla wykresów wieloseryjnych — harmonijne, dystynktywne, brand-anchored.
// Pierwszy kolor = akcent motywu (najważniejsza seria), reszta dobrana tonalnie.
const SERIES_BY_THEME: Record<ThemeId, readonly string[]> = {
  executive: ['#0C447C', '#1D9E75', '#5F8FBF', '#D9A407', '#8FB8DE', '#C0392B'],
  modern: ['#4338CA', '#06B6D4', '#818CF8', '#10B981', '#A5B4FC', '#F59E0B'],
  corporate: ['#1F3A5F', '#C2410C', '#4B6584', '#15803D', '#8295AB', '#B91C1C'],
  classic: ['#14532D', '#B45309', '#3F7A56', '#1E3A5F', '#86A795', '#991B1B'],
  clean: ['#334155', '#2563EB', '#64748B', '#059669', '#94A3B8', '#D97706'],
};

/**
 * Zwraca N kolorów serii dla motywu. Gdy `colorblindSafe`, ignoruje motyw i
 * używa Okabe-Ito (dostępność > branding dla wykresów z wieloma seriami).
 */
export function seriesPalette(
  count: number,
  opts?: { themeId?: string | null; colorblindSafe?: boolean }
): string[] {
  if (count <= 0) return [];
  if (opts?.colorblindSafe) return okabeIto(count);
  const base =
    opts?.themeId && opts.themeId in SERIES_BY_THEME
      ? SERIES_BY_THEME[opts.themeId as ThemeId]
      : SERIES_BY_THEME.executive;
  // Cyklicznie gdy potrzeba więcej niż dostępnych tonów.
  return Array.from({ length: count }, (_, i) => base[i % base.length]);
}

// ── §2d Walidacja kontrastu WCAG 2.1 ─────────────────────────────────────────

/** Parsuje #RGB lub #RRGGBB → [r,g,b] 0-255. Zwraca null gdy niepoprawny. */
function parseHex(hex: string): [number, number, number] | null {
  const m = hex.trim().replace(/^#/, '');
  if (m.length === 3) {
    const r = parseInt(m[0] + m[0], 16);
    const g = parseInt(m[1] + m[1], 16);
    const b = parseInt(m[2] + m[2], 16);
    if ([r, g, b].some(Number.isNaN)) return null;
    return [r, g, b];
  }
  if (m.length === 6) {
    const r = parseInt(m.slice(0, 2), 16);
    const g = parseInt(m.slice(2, 4), 16);
    const b = parseInt(m.slice(4, 6), 16);
    if ([r, g, b].some(Number.isNaN)) return null;
    return [r, g, b];
  }
  return null;
}

/** Względna luminancja wg WCAG 2.1 (sRGB → linearized). */
function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Współczynnik kontrastu WCAG dwóch kolorów (#hex). Zwraca pełny wynik z progami.
 * Niepoprawny kolor → ratio 1.0 (najgorszy, fail-safe).
 */
export function contrastRatio(fg: string, bg: string): ContrastResult {
  const a = parseHex(fg);
  const b = parseHex(bg);
  if (!a || !b) {
    return { ratio: 1, passesAA: false, passesAALarge: false, passesAAA: false };
  }
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  const ratio = (lighter + 0.05) / (darker + 0.05);
  const rounded = Math.round(ratio * 100) / 100;
  return {
    ratio: rounded,
    passesAA: rounded >= 4.5,
    passesAALarge: rounded >= 3.0,
    passesAAA: rounded >= 7.0,
  };
}

/**
 * Dla danego tła zwraca czytelny kolor tekstu (#111827 ciemny LUB #FFFFFF biały) —
 * ten, który daje wyższy kontrast. Używane do auto-tekstu na kolorowych pasach.
 */
export function readableTextOn(bg: string): string {
  const dark = contrastRatio('#111827', bg).ratio;
  const light = contrastRatio('#FFFFFF', bg).ratio;
  return light >= dark ? '#FFFFFF' : '#111827';
}

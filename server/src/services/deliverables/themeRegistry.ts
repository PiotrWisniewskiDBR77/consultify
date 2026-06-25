/**
 * themeRegistry — SSOT MOTYWÓW dla materiałów (Materiały / M17, F3.1).
 *
 * Jeden motyw = (para fontów + paleta 60-30-10 + akcent na liczby). Ten rejestr
 * jest JEDYNYM źródłem prawdy o wyglądzie typograficzno-kolorystycznym, który
 * konsumują 4 renderery (PPTX / DOCX / XLSX / web-viewer) ORAZ `deliverableDefaults`.
 *
 * Cel (DoD F3.1): 5 par fontów (10 unikalnych krojów) + spójna paleta, jeden
 * motyw → każda powierzchnia wygląda tak samo. Brief/brand klienta nadpisuje
 * (merge per pole) — patrz `resolveTheme`.
 *
 * Wszystkie kroje to web-safe / Google Fonts dostępne w rendererach docx/pptx
 * (fallback do system serif/sans gdy brak osadzenia).
 */

export type ThemeId = 'executive' | 'modern' | 'corporate' | 'classic' | 'clean';

export interface ThemeFontPair {
  /** Krój nagłówków (H1-H3, action-titles). */
  heading: string;
  /** Krój treści (akapity, listy, komórki). */
  body: string;
}

/** Paleta 60-30-10 + kolor tekstu neutralnego (wszystkie hex #RRGGBB). */
export interface ThemePalette {
  dominant: string; // 60% — tło nagłówków, pasy, akcenty marki
  supporting: string; // 30% — drugorzędne elementy, subtelne tła
  accent: string; // 10% — liczby kluczowe, highlighty, CTA
  neutralText: string; // tekst zasadniczy
}

export interface DeliverableTheme {
  id: ThemeId;
  /** Etykieta do UI „Motyw". */
  label: string;
  /** Krótki opis charakteru (do podpowiedzi w UI). */
  description: string;
  fontPair: ThemeFontPair;
  palette: ThemePalette;
}

// ── Rejestr 5 motywów (10 unikalnych fontów) ─────────────────────────────────
const THEMES: Record<ThemeId, DeliverableTheme> = {
  // Look McKinsey: serif-nagłówek + sans-treść, granat + teal.
  executive: {
    id: 'executive',
    label: 'Executive',
    description: 'McKinsey-grade: serif headlines, navy + teal. Domyślny dla decków zarządczych.',
    fontPair: { heading: 'Merriweather', body: 'Inter' },
    palette: { dominant: '#0C447C', supporting: '#5F5E5A', accent: '#1D9E75', neutralText: '#2C2C2A' },
  },
  // Tech/startup: czysty humanistyczny sans (Inter head+body), indygo + cyan.
  modern: {
    id: 'modern',
    label: 'Modern',
    description: 'Tech/startup: czysty sans Inter (head+body), indygo + cyan. Dla produktowych i GTM.',
    fontPair: { heading: 'Inter', body: 'Inter' },
    palette: { dominant: '#4338CA', supporting: '#64748B', accent: '#06B6D4', neutralText: '#1E293B' },
  },
  // Korporacyjny/Office-natywny: Calibri (head+body), granat + burnt orange.
  corporate: {
    id: 'corporate',
    label: 'Corporate',
    description: 'Office-natywny/B2B: Calibri (head+body), granat + burnt orange. Dla raportów operacyjnych.',
    fontPair: { heading: 'Calibri', body: 'Calibri' },
    palette: { dominant: '#1F3A5F', supporting: '#6B7280', accent: '#C2410C', neutralText: '#111827' },
  },
  // Tradycyjny raport: elegancki serif (EB Garamond head + Georgia body), forest + amber.
  classic: {
    id: 'classic',
    label: 'Classic',
    description: 'Tradycyjny raport: serif EB Garamond + Georgia, forest + amber. Dla prestiżowych.',
    fontPair: { heading: 'EB Garamond', body: 'Georgia' },
    palette: { dominant: '#14532D', supporting: '#78716C', accent: '#B45309', neutralText: '#1C1917' },
  },
  // Lekki/przyjazny: Lato head + Source Sans 3 body, slate + blue, dużo światła.
  clean: {
    id: 'clean',
    label: 'Clean',
    description: 'Lekki/przyjazny: Lato + Source Sans 3, slate + blue. Dla data-heavy i tabel.',
    fontPair: { heading: 'Lato', body: 'Source Sans 3' },
    palette: { dominant: '#334155', supporting: '#94A3B8', accent: '#2563EB', neutralText: '#0F172A' },
  },
};

export const DEFAULT_THEME_ID: ThemeId = 'executive';

/** Wszystkie motywy (read-only) — do galerii UI „Motyw". */
export const DELIVERABLE_THEMES: ReadonlyArray<DeliverableTheme> = Object.values(THEMES);

/** Czy string jest znanym ThemeId? */
export function isThemeId(id: unknown): id is ThemeId {
  return typeof id === 'string' && id in THEMES;
}

/**
 * Zwraca motyw po id (fallback → DEFAULT_THEME_ID), z opcjonalnym nadpisaniem
 * (brand klienta / brief). Override merge per pole — brak pola = default motywu.
 */
export function resolveTheme(
  id?: string | null,
  overrides?: { fontPair?: Partial<ThemeFontPair>; palette?: Partial<ThemePalette> }
): DeliverableTheme {
  const base = isThemeId(id) ? THEMES[id] : THEMES[DEFAULT_THEME_ID];
  if (!overrides) return base;
  return {
    ...base,
    fontPair: { ...base.fontPair, ...(overrides.fontPair || {}) },
    palette: { ...base.palette, ...(overrides.palette || {}) },
  };
}

/** Lista unikalnych krojów używanych w 5 domyślnych parach motywów. */
export function allThemeFonts(): string[] {
  const set = new Set<string>();
  for (const t of DELIVERABLE_THEMES) {
    set.add(t.fontPair.heading);
    set.add(t.fontPair.body);
  }
  return [...set];
}

// ── §1 Kuratorowana biblioteka fontów (DELIVERABLE_FORMATTING_SPEC §1) ────────
// 10 krojów czytelnych+profesjonalnych+dostępnych wszędzie (Office-natywne LUB
// Google Fonts → działają w .docx, .pptx i web-viewerze). 5 sans + 5 serif.
// To zbiór, z którego MUSZĄ pochodzić fonty każdego motywu (guard isLibraryFont).
export const FORMATTING_FONT_LIBRARY = {
  sans: ['Inter', 'Calibri', 'Lato', 'Arial', 'Source Sans 3'] as const,
  serif: ['Georgia', 'Merriweather', 'EB Garamond', 'Source Serif', 'Times New Roman'] as const,
} as const;

const ALL_LIBRARY_FONTS: ReadonlySet<string> = new Set<string>([
  ...FORMATTING_FONT_LIBRARY.sans,
  ...FORMATTING_FONT_LIBRARY.serif,
]);

/** Czy font należy do kuratorowanej biblioteki §1? */
export function isLibraryFont(font: string): boolean {
  return ALL_LIBRARY_FONTS.has(font);
}

// ── §3 Skala typograficzna per format (DELIVERABLE_FORMATTING_SPEC §3) ────────
// Rozmiary w PUNKTACH (pt). Druk ≠ ekran ≠ projekcja → osobna skala per powierzchnia.
// Konsumowane przez renderery: PPT przez bundlePptxRuntime, Word ma własną
// (documentDocxStyles SIZING_BY_CLASS, spójną z tymi wartościami).
export interface TypeScalePpt {
  coverTitle: number; // slajd tytułowy / divider
  slideTitle: number; // tytuł slajdu treści
  body: number; // treść/bullety (min 18 do projekcji)
  caption: number; // źródło/stopka
}
export const PPT_TYPE_SCALE: TypeScalePpt = {
  coverTitle: 40,
  slideTitle: 30,
  body: 20,
  caption: 11,
};

// ── §4 Markery punktowań i wyliczników (DELIVERABLE_FORMATTING_SPEC §4) ───────
// Max 3 poziomy zagnieżdżenia. Spójne na wszystkich powierzchniach.
export const LIST_MARKERS = {
  bullet: ['•', '–', '·'] as const, // L1 / L2 / L3
  number: ['1.', 'a.', 'i.'] as const,
  checklist: { unchecked: '☐', checked: '☑' } as const,
} as const;

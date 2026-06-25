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
  // Startup/tech: geometryczny sans, indygo + cyan.
  modern: {
    id: 'modern',
    label: 'Modern',
    description: 'Tech/startup: geometryczny sans, indygo + cyan. Dla produktowych i GTM.',
    fontPair: { heading: 'Poppins', body: 'Roboto' },
    palette: { dominant: '#4338CA', supporting: '#64748B', accent: '#06B6D4', neutralText: '#1E293B' },
  },
  // Korporacyjny/przemysłowy: stonowany, granat + burnt orange.
  corporate: {
    id: 'corporate',
    label: 'Corporate',
    description: 'Przemysł/B2B: stonowany granat + burnt orange. Dla raportów operacyjnych.',
    fontPair: { heading: 'Georgia', body: 'Arial' },
    palette: { dominant: '#1F3A5F', supporting: '#6B7280', accent: '#C2410C', neutralText: '#111827' },
  },
  // Elegancki/instytucjonalny: display-serif, forest + amber.
  classic: {
    id: 'classic',
    label: 'Classic',
    description: 'Instytucjonalny/elegancki: display-serif, forest + amber. Dla prestiżowych.',
    fontPair: { heading: 'Playfair Display', body: 'Lato' },
    palette: { dominant: '#14532D', supporting: '#78716C', accent: '#B45309', neutralText: '#1C1917' },
  },
  // Minimalistyczny: czysty sans, slate + blue, dużo światła.
  clean: {
    id: 'clean',
    label: 'Clean',
    description: 'Minimalistyczny: czysty sans, slate + blue. Dla data-heavy i tabel.',
    fontPair: { heading: 'Montserrat', body: 'Open Sans' },
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

/** Lista unikalnych krojów w całym rejestrze (do osadzania/QA fontów). */
export function allThemeFonts(): string[] {
  const set = new Set<string>();
  for (const t of DELIVERABLE_THEMES) {
    set.add(t.fontPair.heading);
    set.add(t.fontPair.body);
  }
  return [...set];
}

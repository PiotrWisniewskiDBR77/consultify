/**
 * deliverableDefaults — ZESTAW ZAŁOŻEŃ STARTOWYCH dla materiałów (Materiały / M17).
 *
 * Gdy dokument NIE dostaje precyzyjnych instrukcji, musi mieć sensowny zestaw
 * założeń — i co do TREŚCI (jak budowana), i co do GRAFIKI (jak wygląda). To
 * jest jeden kanoniczny SSOT tych defaultów, czytany przez generatory B1/B3/B4
 * + orkiestrator. Jawne wskazówki z briefu ZAWSZE nadpisują default (merge).
 *
 * Oparte na: DELIVERABLE_FORMATTING_SPEC + DELIVERABLE_STANDARDS_AND_TOOLING +
 * doktrynie konsultanckiej (Minto/answer-first, ≤6 bulletów, action-titles).
 */

import { resolveTheme, DEFAULT_THEME_ID } from './themeRegistry.js';

export type DeliverableFormat = 'deck' | 'report' | 'table';
export type Register = 'executive' | 'professional' | 'operational';
export type Density = 'concise' | 'standard' | 'detailed';

/** Założenia TREŚCI — jak budowana jest zawartość gdy brief jest skąpy. */
export interface ContentDefaults {
  register: Register;
  density: Density;
  /** Answer-first (Minto): teza/wniosek na początku. */
  answerFirst: boolean;
  /** Deck: docelowa liczba slajdów; report: sekcji; table: kolumn. */
  targetUnits: number;
  /** Deck/report: kanon narracyjny gdy brak własnej struktury. */
  narrativeArc?: string[];
  /** Deck: limity czytelności. */
  maxBullets?: number;
  maxWordsPerBullet?: number;
  /** Deck/report: twardy limit długości action-title (headline, nie akapit). */
  maxWordsPerTitle?: number;
  /** Table: realne dane przykładowe + wiersz sumy. */
  seedRows?: number;
  totalsRow?: boolean;
  /** Tytuły jako zdania-„so-what" (deck/report). */
  actionTitles?: boolean;
}

/** Założenia GRAFIKI — jak wygląda gdy brief nie mówi inaczej. */
export interface GraphicDefaults {
  /** Motyw = para fontów (z formatting spec). */
  theme: 'executive' | 'modern' | 'corporate' | 'classic' | 'clean';
  fontPair: { heading: string; body: string };
  /** Paleta 60-30-10 (dominujący/wspierający/akcent) — hex. */
  palette: { dominant: string; supporting: string; accent: string; neutralText: string };
  /** Obrazy: gęstość + polityka źródła. */
  images: { density: 'low' | 'medium' | 'high'; sourcePreference: 'stock-first' | 'generated-first'; maxImages: number };
  /** Deck: różnorodność layoutów. */
  layout?: { minDistinctLayouts: number; noConsecutiveRepeat: boolean };
  /** Table: styl wizualny. */
  tableStyle?: { headerTint: boolean; zebra: 'never' | 'whenDense' | 'always'; minimalBorders: boolean; numbersRightAligned: boolean; conditionalFormatting: boolean };
}

export interface DeliverableDefaults {
  format: DeliverableFormat;
  content: ContentDefaults;
  graphic: GraphicDefaults;
}

// ── Motyw domyślny: czerpany z themeRegistry (SSOT, F3.1) — „Executive". ──
// Fonty/paleta NIE są tu duplikowane: jedno źródło prawdy = themeRegistry.
const DEFAULT_THEME = resolveTheme(DEFAULT_THEME_ID);

const GRAPHIC_BASE: Omit<GraphicDefaults, 'images' | 'layout' | 'tableStyle'> = {
  theme: DEFAULT_THEME.id,
  fontPair: DEFAULT_THEME.fontPair,
  palette: DEFAULT_THEME.palette,
};

const DEFAULTS: Record<DeliverableFormat, DeliverableDefaults> = {
  deck: {
    format: 'deck',
    content: {
      register: 'executive',
      density: 'standard',
      answerFirst: true,
      targetUnits: 10,
      narrativeArc: ['problem', 'approach', 'findings', 'recommendations', 'roadmap', 'risks'],
      maxBullets: 6,
      maxWordsPerBullet: 8,
      maxWordsPerTitle: 12,
      actionTitles: true,
    },
    graphic: {
      ...GRAPHIC_BASE,
      images: { density: 'medium', sourcePreference: 'stock-first', maxImages: 3 },
      layout: { minDistinctLayouts: 8, noConsecutiveRepeat: true },
    },
  },
  report: {
    format: 'report',
    content: {
      register: 'professional',
      density: 'standard', // 4-8 stron
      answerFirst: true,
      targetUnits: 8,
      narrativeArc: ['exec_summary', 'context', 'methodology', 'findings', 'recommendations', 'risks', 'next_steps'],
      maxWordsPerTitle: 16,
      actionTitles: true,
    },
    graphic: {
      ...GRAPHIC_BASE,
      images: { density: 'low', sourcePreference: 'stock-first', maxImages: 2 },
    },
  },
  table: {
    format: 'table',
    content: {
      register: 'operational',
      density: 'standard',
      answerFirst: false,
      targetUnits: 10, // kolumny (cap)
      seedRows: 8,
      totalsRow: true,
    },
    graphic: {
      ...GRAPHIC_BASE,
      images: { density: 'low', sourcePreference: 'stock-first', maxImages: 0 },
      tableStyle: {
        headerTint: true,
        zebra: 'whenDense',
        minimalBorders: true,
        numbersRightAligned: true,
        conditionalFormatting: true,
      },
    },
  },
};

/** Deep-ish merge: jawne wskazówki z briefu nadpisują default per pole. */
function mergeContent(base: ContentDefaults, over?: Partial<ContentDefaults>): ContentDefaults {
  return { ...base, ...(over || {}) };
}
function mergeGraphic(base: GraphicDefaults, over?: Partial<GraphicDefaults>): GraphicDefaults {
  return {
    ...base,
    ...(over || {}),
    fontPair: { ...base.fontPair, ...(over?.fontPair || {}) },
    palette: { ...base.palette, ...(over?.palette || {}) },
    images: { ...base.images, ...(over?.images || {}) },
    layout: over?.layout ? { ...base.layout, ...over.layout } as GraphicDefaults['layout'] : base.layout,
    tableStyle: over?.tableStyle ? { ...base.tableStyle, ...over.tableStyle } as GraphicDefaults['tableStyle'] : base.tableStyle,
  };
}

/**
 * Zwraca założenia startowe dla formatu, z opcjonalnym nadpisaniem z briefu/motywu.
 * To jest punkt, w którym „brak precyzyjnych instrukcji" zamienia się w sensowny materiał.
 *
 * `themeId` (F3.1): wybiera motyw z `themeRegistry` (fonty+paleta+theme). Jawne
 * `overrides.graphic` mają pierwszeństwo nad motywem (brand klienta > motyw > default).
 */
export function resolveDeliverableDefaults(
  format: DeliverableFormat,
  overrides?: { content?: Partial<ContentDefaults>; graphic?: Partial<GraphicDefaults>; themeId?: string }
): DeliverableDefaults {
  const base = DEFAULTS[format];

  // Motyw (jeśli podany) wchodzi jako warstwa pod jawne overrides.graphic.
  let graphicOverride = overrides?.graphic;
  if (overrides?.themeId) {
    const theme = resolveTheme(overrides.themeId);
    graphicOverride = {
      theme: theme.id,
      fontPair: theme.fontPair,
      palette: theme.palette,
      ...(overrides?.graphic || {}),
    } as Partial<GraphicDefaults>;
  }

  return {
    format,
    content: mergeContent(base.content, overrides?.content),
    graphic: mergeGraphic(base.graphic, graphicOverride),
  };
}

/** Surowe defaulty (read-only) — do inspekcji/UI „Opcje". */
export const DELIVERABLE_DEFAULTS = DEFAULTS;

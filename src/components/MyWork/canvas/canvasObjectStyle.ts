/**
 * WSPÓLNY KONTRAKT STYLU OBIEKTU PŁÓTNA (Mapa Myśli · Tablica · Proces).
 *
 * Jedno miejsce, w którym mieszka odpowiedź na pytanie „gdzie renderer czyta
 * kolor tła, a gdzie kolor ramki". Powstało po ustaleniu z audytu, że stary
 * pływający pasek Mapy Myśli zapisywał do `node.data` pola, których ŻADEN
 * renderer nie czytał:
 *   • `fontSize` — martwe (etykieta ma na sztywno `text-[11px]`),
 *   • `bold` — martwe (etykieta ma na sztywno `font-semibold`),
 *   • `color` — czytane, ale jako JEDEN kolor sterujący i ramką, i poświatą
 *     tła naraz (nie dało się ustawić innego tła niż ramki),
 *   • ramka (`type: 'group'`) w ogóle nie czytała `data` — jej wygląd rysuje
 *     `node.style` nakładany przez reactflow na wrapper węzła.
 *
 * KONTRAKT (pola na `node.data`, wspólne dla trzech narzędzi):
 *   fontFamily   — klucz z `CANVAS_FONT_FAMILIES` ('sans'|'serif'|'mono')
 *   fontSize     — px (number)
 *   textColor    — token CSS (`var(--c-tag-3)`) albo undefined = domyślny
 *   bold         — boolean
 *   underline    — boolean
 *   bgColor      — token CSS · TŁO (osobno!)
 *   borderColor  — token CSS · RAMKA (osobno!)
 *   shape        — klucz kształtu ('rect'|'rounded'|'circle'|'diamond'|…)
 *
 * `bgColor`/`borderColor` są ŚWIADOMIE nowymi nazwami zamiast rozszczepienia
 * istniejącego `color`: stary `color` zostaje nietknięty jako „akcent
 * semantyczny" (pisze go m.in. `inferNodeAccentColor` z tagów), a nowe pola
 * mają nad nim pierwszeństwo. Dzięki temu włączenie flagi nie przemalowuje
 * istniejących map, a wyłączenie nie gubi danych.
 *
 * Cała ta warstwa jest BRAMKOWANA flagą `ff_canvasObjectEditBar`
 * (`isCanvasObjectEditBarEnabled`) — patrz `canvasObjectStyleEnabled` niżej.
 */
import type { CSSProperties } from 'react';

import { isCanvasObjectEditBarEnabled } from '@/utils/canvasObjectEditBarFlag';

export type CanvasFontFamilyKey = 'sans' | 'serif' | 'mono';

/** Rodziny pisma dostępne w pasku. Stosy systemowe — zero zewnętrznych fontów. */
export const CANVAS_FONT_FAMILIES: Record<
  CanvasFontFamilyKey,
  { css: string; labelKey: string; fallback: string }
> = {
  sans: {
    css: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    labelKey: 'canvasEditBar.font.sans',
    fallback: 'Bezszeryfowa',
  },
  serif: {
    css: 'ui-serif, Georgia, Cambria, "Times New Roman", serif',
    labelKey: 'canvasEditBar.font.serif',
    fallback: 'Szeryfowa',
  },
  mono: {
    css: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
    labelKey: 'canvasEditBar.font.mono',
    fallback: 'Maszynowa',
  },
};

/** Kroki wielkości pisma oferowane w pasku (px). */
export const CANVAS_FONT_SIZES = [10, 11, 12, 14, 16, 18, 22, 28] as const;

/**
 * Paleta kolorów paska — WYŁĄCZNIE tokeny `--c-tag-*` + akcenty statusowe
 * (identyczne źródło co `ColorPickerPopover` Mapy Myśli). Zero surowego hexa,
 * zero `primary-*` (crimson = tylko semantyka krytyczna, CLAUDE.md #3).
 */
export const CANVAS_COLOR_PALETTE: string[] = [
  ...Array.from({ length: 12 }, (_, i) => `var(--c-tag-${i + 1})`),
  'var(--c-info)',
  'var(--c-success)',
  'var(--c-warning)',
  'var(--c-danger)',
];

/**
 * Kształty obiektu — JEDEN zestaw dla wszystkich narzędzi, wzięty z tego, co
 * Tablica oferuje już w „Create" (Rectangle/Circle/Diamond/Hexagon) i co Mapa
 * Myśli cyklowała w `ctx_change_shape`. Paleta zamiast cyklu: właściciel ma
 * wybierać kształt, a nie klikać cztery razy, żeby wrócić do poprzedniego.
 */
export type CanvasShapeKey = 'rounded' | 'rect' | 'circle' | 'diamond' | 'hexagon' | 'pill';

export const CANVAS_SHAPES: Array<{ key: CanvasShapeKey; labelKey: string; fallback: string }> = [
  { key: 'rounded', labelKey: 'canvasEditBar.shape.rounded', fallback: 'Zaokrąglony' },
  { key: 'rect', labelKey: 'canvasEditBar.shape.rect', fallback: 'Prostokąt' },
  { key: 'pill', labelKey: 'canvasEditBar.shape.pill', fallback: 'Pigułka' },
  { key: 'circle', labelKey: 'canvasEditBar.shape.circle', fallback: 'Koło' },
  { key: 'diamond', labelKey: 'canvasEditBar.shape.diamond', fallback: 'Romb' },
  { key: 'hexagon', labelKey: 'canvasEditBar.shape.hexagon', fallback: 'Sześciokąt' },
];

export interface CanvasObjectStyle {
  fontFamily?: CanvasFontFamilyKey;
  fontSize?: number;
  textColor?: string;
  bold?: boolean;
  underline?: boolean;
  bgColor?: string;
  borderColor?: string;
  shape?: string;
}

/** Odczyt kontraktu z `node.data` (tolerancyjny na śmieci i legacy). */
export function readCanvasObjectStyle(data: unknown): CanvasObjectStyle {
  const d = (data || {}) as Record<string, unknown>;
  const family = typeof d.fontFamily === 'string' ? d.fontFamily : undefined;
  return {
    fontFamily:
      family && family in CANVAS_FONT_FAMILIES ? (family as CanvasFontFamilyKey) : undefined,
    fontSize: typeof d.fontSize === 'number' && d.fontSize > 0 ? d.fontSize : undefined,
    textColor: typeof d.textColor === 'string' && d.textColor ? d.textColor : undefined,
    // `fontWeight: 'bold'` to zapis Tablicy (WhiteboardStyleBar) — czytamy oba,
    // żeby pasek pokazywał prawdę niezależnie od tego, kto ustawił pogrubienie.
    bold: d.bold === true || d.fontWeight === 'bold',
    underline: d.underline === true || d.textDecoration === 'underline',
    bgColor: typeof d.bgColor === 'string' && d.bgColor ? d.bgColor : undefined,
    borderColor: typeof d.borderColor === 'string' && d.borderColor ? d.borderColor : undefined,
    shape: typeof d.shape === 'string' && d.shape ? d.shape : undefined,
  };
}

/**
 * Czy warstwa stylu jest aktywna. Renderery pytają o to RAZ i przy `false`
 * zwracają `undefined` — zero zmiany wyglądu przy fladze OFF.
 */
export function canvasObjectStyleEnabled(): boolean {
  return isCanvasObjectEditBarEnabled();
}

/**
 * Inline-style POWIERZCHNI: tło i ramka OSOBNO. Zwraca `undefined`, gdy nic nie
 * ustawiono — wtedy renderer zostaje przy własnej palecie (gałąź/tag/kształt).
 *
 * `bgOpacityPct` pozwala rendererowi zdecydować, jak mocno token ma wypełniać
 * pudełko (karteczka chce mocniej, węzeł mapy delikatnie) — bez tego jeden
 * wspólny kolor wyglądałby dobrze tylko w jednym narzędziu.
 */
export function canvasObjectSurfaceStyle(
  style: CanvasObjectStyle,
  opts?: { bgOpacityPct?: number }
): CSSProperties | undefined {
  if (!canvasObjectStyleEnabled()) return undefined;
  const out: CSSProperties = {};
  if (style.bgColor) {
    const pct = opts?.bgOpacityPct ?? 18;
    out.backgroundColor = `color-mix(in srgb, ${style.bgColor} ${pct}%, transparent)`;
    // Tło ustawione ręcznie musi wygrać z klasą Tailwind `bg-*` na tym samym
    // elemencie — inline style i tak ma wyższą specyficzność, ale gradienty
    // (np. poświata akcentu w węźle mapy) trzeba jawnie skasować.
    out.backgroundImage = 'none';
  }
  if (style.borderColor) {
    out.borderColor = style.borderColor;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Inline-style TEKSTU: rodzina, wielkość, kolor, grubość, podkreślenie. */
export function canvasObjectTextStyle(style: CanvasObjectStyle): CSSProperties | undefined {
  if (!canvasObjectStyleEnabled()) return undefined;
  const out: CSSProperties = {};
  if (style.fontFamily) out.fontFamily = CANVAS_FONT_FAMILIES[style.fontFamily].css;
  if (style.fontSize) out.fontSize = style.fontSize;
  if (style.textColor) out.color = style.textColor;
  if (style.bold) out.fontWeight = 700;
  if (style.underline) out.textDecoration = 'underline';
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Klasy kształtu — wspólna mapa dla trzech narzędzi. `innerRotate` odkręca
 * treść w kształtach obróconych (romb), żeby tekst został poziomo.
 */
export function canvasShapeClasses(shape?: string): { box: string; inner: string } {
  switch (shape) {
    case 'rect':
      return { box: 'rounded-none', inner: '' };
    case 'pill':
      return { box: 'rounded-full', inner: '' };
    case 'circle':
      return { box: 'rounded-full aspect-square flex items-center justify-center', inner: '' };
    case 'diamond':
      return { box: 'rotate-45', inner: '-rotate-45' };
    case 'hexagon':
      return {
        box: '[clip-path:polygon(25%_0%,75%_0%,100%_50%,75%_100%,25%_100%,0%_50%)]',
        inner: '',
      };
    case 'rounded':
    default:
      return { box: 'rounded-xl', inner: '' };
  }
}

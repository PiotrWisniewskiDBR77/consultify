/**
 * Popovery paska edycji obiektu — WSPÓLNE dla Mapy Myśli, Tablicy i Procesu.
 *
 * Osobno kolor TEKSTU, osobno TŁO, osobno RAMKA — trzy wywołania tego samego
 * `ColorPalettePopover` z innym `title`/`value`/`onPick`. To jest odpowiedź na
 * zgłoszenie właściciela „kolor linii oraz oddzielnie kolory i kształty okienek
 * (nodów) tak aby można było robić też inne kształty oraz tła i ramki" —
 * poprzednio Mapa Myśli miała JEDNO pole `color` sterujące jednocześnie ramką i
 * poświatą tła.
 *
 * Wszystkie próbki pochodzą z `CANVAS_COLOR_PALETTE` (tokeny `--c-tag-*` +
 * akcenty statusowe). Zero surowego hexa, zero crimson.
 */
import { ArrowLeft, ArrowLeftRight, ArrowRight, Ban } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  CANVAS_COLOR_PALETTE,
  CANVAS_FONT_FAMILIES,
  CANVAS_FONT_SIZES,
  CANVAS_SHAPES,
  type CanvasFontFamilyKey,
  type CanvasShapeKey,
} from './canvasObjectStyle';

const PANEL =
  'rounded-xl border border-c-border-subtle bg-c-surface-raised shadow-xl p-2 pointer-events-auto';
const CAPTION =
  'mb-1 text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary whitespace-nowrap';
const ROW_BTN =
  'w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-medium ' +
  'text-c-text-secondary hover:bg-c-surface transition-colors focus:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-c-focus';
const ROW_ACTIVE = 'bg-c-surface text-c-text ring-1 ring-c-border-strong';

// ─────────────────────────── KOLOR (tekst · tło · ramka) ────────────────────

export const ColorPalettePopover: React.FC<{
  title: string;
  value?: string | null;
  onPick: (color: string | null) => void;
  close: () => void;
  /** Etykieta pozycji zerującej — „Domyślny" / „Bez tła" / „Bez ramki". */
  resetLabel: string;
}> = ({ title, value, onPick, close, resetLabel }) => (
  <div className={`${PANEL} w-[188px]`}>
    <div className={CAPTION}>{title}</div>
    <div className="grid grid-cols-8 gap-1">
      {CANVAS_COLOR_PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => {
            onPick(c);
            close();
          }}
          aria-label={c}
          aria-pressed={value === c}
          className={`h-5 w-5 rounded border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
            value === c
              ? 'border-c-text ring-1 ring-c-border-strong scale-110'
              : 'border-transparent hover:border-c-border-subtle'
          }`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
    <button
      type="button"
      onClick={() => {
        onPick(null);
        close();
      }}
      className={`${ROW_BTN} mt-2 justify-center`}
    >
      <Ban size={12} aria-hidden="true" />
      {resetLabel}
    </button>
  </div>
);

// ─────────────────────────────── TYPOGRAFIA ─────────────────────────────────

export const FontFamilyPopover: React.FC<{
  value?: CanvasFontFamilyKey;
  onPick: (key: CanvasFontFamilyKey) => void;
  close: () => void;
}> = ({ value, onPick, close }) => {
  const { t } = useTranslation();
  return (
    <div className={`${PANEL} w-[168px]`}>
      <div className={CAPTION}>{t('canvasEditBar.fontFamily', 'Czcionka')}</div>
      {(Object.keys(CANVAS_FONT_FAMILIES) as CanvasFontFamilyKey[]).map((key) => {
        const entry = CANVAS_FONT_FAMILIES[key];
        return (
          <button
            key={key}
            type="button"
            onClick={() => {
              onPick(key);
              close();
            }}
            aria-pressed={value === key}
            className={`${ROW_BTN} ${value === key ? ROW_ACTIVE : ''}`}
            style={{ fontFamily: entry.css }}
          >
            {t(entry.labelKey, entry.fallback)}
          </button>
        );
      })}
    </div>
  );
};

export const FontSizePopover: React.FC<{
  value?: number;
  onPick: (size: number) => void;
  close: () => void;
}> = ({ value, onPick, close }) => {
  const { t } = useTranslation();
  return (
    <div className={`${PANEL} w-[112px]`}>
      <div className={CAPTION}>{t('canvasEditBar.fontSize', 'Wielkość')}</div>
      <div className="grid grid-cols-2 gap-1">
        {CANVAS_FONT_SIZES.map((size) => (
          <button
            key={size}
            type="button"
            onClick={() => {
              onPick(size);
              close();
            }}
            aria-pressed={value === size}
            className={`rounded-lg py-1 text-[11px] font-semibold tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
              value === size
                ? 'bg-c-surface text-c-text ring-1 ring-c-border-strong'
                : 'text-c-text-secondary hover:bg-c-surface'
            }`}
          >
            {size}
          </button>
        ))}
      </div>
    </div>
  );
};

// ──────────────────────────────── KSZTAŁTY ──────────────────────────────────

/** Miniaturka kształtu — rysowana CSS-em, bez ikon, żeby wybór był dosłowny. */
const ShapeGlyph: React.FC<{ shape: CanvasShapeKey }> = ({ shape }) => {
  const base = 'block h-5 w-6 border-2 border-current';
  if (shape === 'circle') return <span className={`${base} !w-5 rounded-full`} />;
  if (shape === 'pill') return <span className={`${base} rounded-full`} />;
  if (shape === 'rect') return <span className={base} />;
  if (shape === 'diamond') return <span className={`${base} !w-5 rotate-45`} />;
  if (shape === 'hexagon')
    return (
      <span
        className="block h-5 w-6 bg-current"
        style={{ clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' }}
      />
    );
  return <span className={`${base} rounded-lg`} />;
};

export const ShapePalettePopover: React.FC<{
  value?: string;
  onPick: (shape: CanvasShapeKey) => void;
  close: () => void;
}> = ({ value, onPick, close }) => {
  const { t } = useTranslation();
  return (
    <div className={`${PANEL} w-[168px]`}>
      <div className={CAPTION}>{t('canvasEditBar.shapeTitle', 'Kształt obiektu')}</div>
      <div className="grid grid-cols-3 gap-1">
        {CANVAS_SHAPES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => {
              onPick(s.key);
              close();
            }}
            title={t(s.labelKey, s.fallback)}
            aria-label={t(s.labelKey, s.fallback)}
            aria-pressed={value === s.key}
            className={`flex h-11 items-center justify-center rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
              value === s.key
                ? 'bg-c-surface text-c-text ring-1 ring-c-border-strong'
                : 'text-c-text-secondary hover:bg-c-surface'
            }`}
          >
            <ShapeGlyph shape={s.key} />
          </button>
        ))}
      </div>
    </div>
  );
};

// ───────────────────────────── LISTA POLECEŃ ────────────────────────────────

/**
 * Zwykła lista poleceń w popoverze — używana tam, gdzie stary pasek miał
 * `ToolbarDropdown` (Wyrównaj / Rozłóż w Tablicy). Dzięki temu przy zamianie
 * etykiet na ikony ANI JEDNA pozycja z tamtych rozwijek nie ginie.
 */
export const MenuListPopover: React.FC<{
  title: string;
  items: Array<{
    id: string;
    label: string;
    icon?: React.ComponentType<{ size?: number }>;
    onClick: () => void;
    disabled?: boolean;
  }>;
  close: () => void;
}> = ({ title, items, close }) => (
  <div className={`${PANEL} w-[186px]`}>
    <div className={CAPTION}>{title}</div>
    {items.map((item) => (
      <button
        key={item.id}
        type="button"
        disabled={item.disabled}
        onClick={() => {
          item.onClick();
          close();
        }}
        className={`${ROW_BTN} disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        {item.icon ? <item.icon size={13} /> : null}
        {item.label}
      </button>
    ))}
  </div>
);

// ─────────────────────── STRZAŁKI / KIERUNEK PRZEPŁYWU ──────────────────────

export type CanvasArrowDirection = 'none' | 'start' | 'end' | 'both';

export const ARROW_OPTIONS: Array<{
  id: CanvasArrowDirection;
  icon: React.ComponentType<{ size?: number }>;
  labelKey: string;
  fallback: string;
}> = [
  { id: 'none', icon: Ban, labelKey: 'canvasEditBar.arrow.none', fallback: 'Bez strzałki' },
  { id: 'end', icon: ArrowRight, labelKey: 'canvasEditBar.arrow.end', fallback: 'W przód' },
  { id: 'start', icon: ArrowLeft, labelKey: 'canvasEditBar.arrow.start', fallback: 'W tył' },
  {
    id: 'both',
    icon: ArrowLeftRight,
    labelKey: 'canvasEditBar.arrow.both',
    fallback: 'Obustronna',
  },
];

export const ArrowDirectionPopover: React.FC<{
  value?: CanvasArrowDirection;
  onPick: (direction: CanvasArrowDirection) => void;
  close: () => void;
  title?: string;
}> = ({ value, onPick, close, title }) => {
  const { t } = useTranslation();
  return (
    <div className={`${PANEL} w-[176px]`}>
      <div className={CAPTION}>{title ?? t('canvasEditBar.arrowTitle', 'Strzałki i kierunek')}</div>
      {ARROW_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => {
            onPick(opt.id);
            close();
          }}
          aria-pressed={value === opt.id}
          className={`${ROW_BTN} ${value === opt.id ? ROW_ACTIVE : ''}`}
        >
          <opt.icon size={13} />
          {t(opt.labelKey, opt.fallback)}
        </button>
      ))}
    </div>
  );
};

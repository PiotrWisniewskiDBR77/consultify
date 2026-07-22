/**
 * Shared helpers and constants for whiteboard node components.
 */
import React from 'react';

// rose-exempt: sticky-note brand palette swatch (one of yellow/pink/primary/amber/blue/rose);
// these are deliberate decorative note colors, not danger semantics — keep raw palette.
export const STICKY_COLORS = [
  {
    bg: 'bg-warning-100 dark:bg-warning-950/60',
    border: 'border-warning-300 dark:border-warning-400/60',
    hex: '#fef9c3',
    darkHex: '#422006',
    glow: '0 0 14px rgba(250,204,21,0.28)',
  },
  {
    bg: '',
    bgVar: '--c-info',
    border: 'border-c-info',
    hex: '#dbeafe',
    darkHex: '#172554',
    glow: '0 0 14px rgba(96,165,250,0.28)',
  },
  {
    bg: 'bg-success-100 dark:bg-success-950/60',
    border: 'border-success-300 dark:border-success-400/60',
    hex: '#dcfce7',
    darkHex: '#052e16',
    glow: '0 0 14px rgba(74,222,128,0.28)',
  },
  {
    bg: 'bg-danger-100 dark:bg-danger-950/60',
    border: 'border-danger-300 dark:border-danger-400/60',
    hex: '#fce7f3',
    darkHex: '#500724',
    glow: '0 0 14px rgba(244,114,182,0.28)',
  },
  {
    bg: 'bg-indigo-100 dark:bg-indigo-950/60',
    border: 'border-indigo-300 dark:border-indigo-400/60',
    hex: '#e0e7ff',
    darkHex: '#312e81',
    glow: '0 0 14px rgba(129,140,248,0.28)',
  },
  {
    bg: 'bg-warning-100 dark:bg-warning-950/60',
    border: 'border-warning-300 dark:border-warning-400/60',
    hex: '#ffedd5',
    darkHex: '#431407',
    glow: '0 0 14px rgba(251,146,60,0.28)',
  },
  {
    bg: '',
    bgVar: '--c-info',
    border: 'border-c-info',
    hex: '#dbeafe',
    darkHex: '#172554',
    glow: '0 0 14px rgba(96,165,250,0.28)',
  },
  {
    bg: 'bg-danger-100 dark:bg-danger-950/60',
    border: 'border-danger-300 dark:border-danger-400/60',
    hex: '#ffe4e6',
    darkHex: '#4c0519',
    glow: '0 0 14px rgba(251,113,133,0.28)',
  },
];

export const STICKY_SIZES: Record<string, { w: number; h: number; textRows: number }> = {
  s: { w: 120, h: 80, textRows: 2 },
  m: { w: 180, h: 100, textRows: 3 },
  l: { w: 240, h: 140, textRows: 5 },
};

export const darkenHex = (hex: string, factor = 0.7): string => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return '#1e1b4b';
  const r = Math.round(parseInt(m[1], 16) * (1 - factor));
  const g = Math.round(parseInt(m[2], 16) * (1 - factor));
  const b = Math.round(parseInt(m[3], 16) * (1 - factor));
  return `rgb(${r},${g},${b})`;
};

export const hexToGlow = (hex: string): string => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return 'rgba(148,163,184,0.25)';
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},0.25)`;
};

// ── Z15: per-element style overrides (font/color) ─────────────────────────────
// The floating WhiteboardStyleBar writes these fields onto node.data; renderers
// read them here so a single element can be restyled after creation (Miro/
// Whimsical parity). All colors resolve to c-tag tokens (theme-aware), never hex.

// Font-size steps (S/M/L) → concrete px. Stored on data.fontSize as a NUMBER so
// TextBlockNode's existing numeric-fontSize reader stays compatible.
export const STYLE_FONT_SIZES: Record<'s' | 'm' | 'l', number> = { s: 11, m: 13, l: 16 };

// Resolve a c-tag accent var into theme-aware bg/border for a node body. Returns
// null when no accent is set so the renderer keeps its default palette/branch color.
export const resolveNodeAccentBg = (
  accentColor?: unknown
): { backgroundColor: string; borderColor: string } | null => {
  if (!accentColor || typeof accentColor !== 'string') return null;
  return {
    backgroundColor: `color-mix(in srgb, ${accentColor} 16%, transparent)`,
    borderColor: `color-mix(in srgb, ${accentColor} 45%, transparent)`,
  };
};

// Resolve data.fontSize / data.fontWeight into an inline CSSProperties patch for
// the node's text. fontSize accepts a number (px) or an 's'|'m'|'l' step; weight
// accepts 'bold' | 'normal' (and legacy boolean data.bold for mind-map parity).
export const resolveNodeFontStyle = (data: unknown): React.CSSProperties => {
  const d = (data || {}) as Record<string, unknown>;
  const style: React.CSSProperties = {};
  const fs = d.fontSize;
  if (typeof fs === 'number') style.fontSize = fs;
  else if (typeof fs === 'string' && fs in STYLE_FONT_SIZES) {
    style.fontSize = STYLE_FONT_SIZES[fs as 's' | 'm' | 'l'];
  }
  if (d.fontWeight === 'bold' || d.bold === true) style.fontWeight = 700;
  else if (d.fontWeight === 'normal') style.fontWeight = 500;
  return style;
};

export const useIsDark = () => {
  const [isDark, setIsDark] = React.useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );
  React.useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => setIsDark(el.classList.contains('dark')));
    obs.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return isDark;
};

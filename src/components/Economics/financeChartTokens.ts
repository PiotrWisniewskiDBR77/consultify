/*
 * The hardcoded hex values in this file are the SANCTIONED fallbacks that mirror
 * the `--c-*` CSS tokens in src/index.css — used only when getComputedStyle() is
 * unavailable (SSR / detached DOM). This is the single place allowed to name them,
 * so the hex-literal lint is intentionally disabled here.
 */
/* eslint-disable no-restricted-syntax */
import { useEffect, useState } from 'react';

/**
 * financeChartTokens — instrument color layer for FinanceHub (M16).
 *
 * SSOT: docs/ui-standards — the app design tokens live as `--c-*` CSS variables
 * in src/index.css (light `:root` + dark `.dark`). Recharts and inline SVG need
 * concrete color strings (they do not resolve `var()` for fills/strokes), so this
 * helper resolves the semantic finance-series roles to the *current theme's* hex
 * at read time. Re-read on theme flip via `useFinanceChartColors()`.
 *
 * Rules:
 *  - No crimson-leak: the brand accent (`--c-accent`) is NEVER a data-series color.
 *  - Semantic roles (cost/benefit/net/cumulative/target/actual) map to the
 *    semantic tokens (danger/success/info) and the categorical `--c-tag-*` ramp.
 *  - Categorical series cycle the 12-step `--c-tag-*` ramp so every chart shares
 *    one palette in both light and dark.
 */

/** Read a single `--c-*` token off the document root; falls back to `fallback`. */
export function readCssToken(name: string, fallback: string): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return raw || fallback;
}

/** The categorical ramp (`--c-tag-1..12`) resolved to the current theme. */
export function readTagRamp(): string[] {
  const fallbacks = [
    '#3b8ea5',
    '#6a74d8',
    '#9d5bd2',
    '#c45b9c',
    '#b06a4a',
    '#5a9367',
    '#8a8f3a',
    '#7b8794',
    '#b5783a',
    '#5566b8',
    '#a0568f',
    '#4f9e6f',
  ];
  return fallbacks.map((fb, i) => readCssToken(`--c-tag-${i + 1}`, fb));
}

export interface FinanceChartColors {
  /** grid lines / hairlines */
  grid: string;
  /** axis tick labels + muted reference labels */
  axis: string;
  /** neutral reference line (e.g. break-even @ 0) */
  reference: string;
  /** cost / outflow series (semantic danger) */
  cost: string;
  /** benefit / inflow series (semantic success) */
  benefit: string;
  /** net flow series (semantic info) */
  net: string;
  /** variance / caution series (semantic warning) */
  warning: string;
  /** translucent fill for the net-flow area */
  netFill: string;
  /** cumulative / trend series (categorical periwinkle) */
  cumulative: string;
  /** planned / target series */
  target: string;
  /** actual / current series */
  actual: string;
  /** full categorical ramp for N-series charts */
  ramp: string[];
}

/** Resolve every finance instrument color role against the current theme. */
export function readFinanceChartColors(): FinanceChartColors {
  const ramp = readTagRamp();
  const info = readCssToken('--c-info', '#3b2883');
  const net = info;
  // netFill: translucent version of the info token. rgba only works off hex, so
  // fall back to a fixed translucent blue if the token is non-hex.
  const netFill = hexToRgba(info, 0.2) ?? 'rgba(59, 130, 246, 0.2)';
  return {
    grid: readCssToken('--c-border-subtle', 'rgba(148, 163, 184, 0.2)'),
    axis: readCssToken('--c-text-muted', '#64748b'),
    reference: readCssToken('--c-border-strong', '#94a3b8'),
    cost: readCssToken('--c-danger', '#e80538'),
    benefit: readCssToken('--c-success', '#026833'),
    net,
    netFill,
    warning: readCssToken('--c-warning', '#ae6429'),
    cumulative: ramp[1], // periwinkle
    // Plan/target reads as the neutral "info" blue; actual/realised reads green.
    target: info,
    actual: readCssToken('--c-success', '#026833'),
    ramp,
  };
}

/**
 * React hook: finance instrument colors resolved for the current theme,
 * re-resolved whenever the `dark`/`light` class on <html> flips.
 */
export function useFinanceChartColors(): FinanceChartColors {
  const [colors, setColors] = useState<FinanceChartColors>(() => readFinanceChartColors());
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const resolve = () => setColors(readFinanceChartColors());
    resolve();
    const observer = new MutationObserver(resolve);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    });
    return () => observer.disconnect();
  }, []);
  return colors;
}

/** Convert `#rrggbb` (or `#rgb`) to an rgba() string; null if not a hex color. */
export function hexToRgba(hex: string, alpha: number): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

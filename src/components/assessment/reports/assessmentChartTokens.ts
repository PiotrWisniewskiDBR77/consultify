/*
 * The hardcoded hex values in this file are the SANCTIONED fallbacks that mirror
 * the `--c-*` CSS tokens in src/index.css — used only when getComputedStyle() is
 * unavailable (SSR / detached DOM / jsdom). This is the single place allowed to
 * name them for the assessment radar, so the hex-literal lint is disabled here.
 */
/* eslint-disable no-restricted-syntax */
import { useEffect, useState } from 'react';

/**
 * assessmentChartTokens — instrument color layer for assessment maturity charts
 * (DRD radar & friends). Mirrors the financeChartTokens (M16, wave #23) pattern:
 * Recharts needs concrete color strings (it will not resolve `var()` for
 * fills/strokes), so this resolves the semantic radar-series roles to the
 * *current theme's* hex at read time, re-reading on a dark/light flip.
 *
 * Rules (same doctrine as finance):
 *  - No crimson-leak: the brand accent (`--c-accent`, app `primary` = crimson) is
 *    NEVER a data-series color. The "current" series reads info-blue, "target"
 *    reads success-green.
 *  - Fallbacks below are the light-theme resolutions of the `--c-*` tokens.
 */

/** Read a single `--c-*` token off the document root; falls back to `fallback`. */
export function readCssToken(name: string, fallback: string): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return raw || fallback;
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

export interface AssessmentChartColors {
  /** polar grid rings / spokes */
  grid: string;
  /** angle-axis dimension labels */
  axis: string;
  /** radius-axis tick labels */
  tick: string;
  /** "current state" series stroke */
  current: string;
  /** translucent fill for the current-state area */
  currentFill: string;
  /** "target state (N+1)" series stroke */
  target: string;
  /** translucent fill for the target-state area */
  targetFill: string;
  /** tooltip surface background */
  tooltipBg: string;
  /** tooltip border */
  tooltipBorder: string;
  /** primary text on the tooltip surface */
  tooltipText: string;
  /** muted text on the tooltip surface */
  tooltipMuted: string;
}

/** Resolve every assessment radar color role against the current theme. */
export function readAssessmentChartColors(): AssessmentChartColors {
  // Info-blue for "current", success-green for "target". Deliberately not crimson.
  const current = readCssToken('--c-info', '#3b2883');
  const target = readCssToken('--c-success', '#026833');
  return {
    grid: readCssToken('--c-border-subtle', 'rgba(148, 163, 184, 0.35)'),
    axis: readCssToken('--c-text', '#0f172a'),
    tick: readCssToken('--c-text-muted', '#64748b'),
    current,
    currentFill: hexToRgba(current, 0.28) ?? 'rgba(59, 130, 246, 0.28)',
    target,
    targetFill: hexToRgba(target, 0.1) ?? 'rgba(2, 104, 51, 0.1)',
    tooltipBg: readCssToken('--c-surface', '#ffffff'),
    tooltipBorder: readCssToken('--c-border-strong', '#cbd5e1'),
    tooltipText: readCssToken('--c-text', '#0f172a'),
    tooltipMuted: readCssToken('--c-text-muted', '#64748b'),
  };
}

/**
 * React hook: assessment radar colors resolved for the current theme,
 * re-resolved whenever the `dark`/`light` class on <html> flips.
 */
export function useAssessmentChartColors(): AssessmentChartColors {
  const [colors, setColors] = useState<AssessmentChartColors>(() =>
    readAssessmentChartColors()
  );
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const resolve = () => setColors(readAssessmentChartColors());
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

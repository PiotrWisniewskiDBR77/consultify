/**
 * Shared helpers and constants for whiteboard node components.
 */
import React from 'react';

export const STICKY_COLORS = [
  {
    bg: 'bg-yellow-100 dark:bg-yellow-950/60',
    border: 'border-yellow-300 dark:border-yellow-400/60',
    hex: '#fef9c3',
    darkHex: '#422006',
    glow: '0 0 14px rgba(250,204,21,0.28)',
  },
  {
    bg: 'bg-blue-100 dark:bg-blue-950/60',
    border: 'border-blue-300 dark:border-blue-400/60',
    hex: '#dbeafe',
    darkHex: '#172554',
    glow: '0 0 14px rgba(96,165,250,0.28)',
  },
  {
    bg: 'bg-green-100 dark:bg-green-950/60',
    border: 'border-green-300 dark:border-green-400/60',
    hex: '#dcfce7',
    darkHex: '#052e16',
    glow: '0 0 14px rgba(74,222,128,0.28)',
  },
  {
    bg: 'bg-pink-100 dark:bg-pink-950/60',
    border: 'border-pink-300 dark:border-pink-400/60',
    hex: '#fce7f3',
    darkHex: '#500724',
    glow: '0 0 14px rgba(244,114,182,0.28)',
  },
  {
    bg: 'bg-purple-100 dark:bg-purple-950/60',
    border: 'border-purple-300 dark:border-purple-400/60',
    hex: '#f3e8ff',
    darkHex: '#3b0764',
    glow: '0 0 14px rgba(192,132,252,0.28)',
  },
  {
    bg: 'bg-orange-100 dark:bg-orange-950/60',
    border: 'border-orange-300 dark:border-orange-400/60',
    hex: '#ffedd5',
    darkHex: '#431407',
    glow: '0 0 14px rgba(251,146,60,0.28)',
  },
  {
    bg: 'bg-teal-100 dark:bg-teal-950/60',
    border: 'border-teal-300 dark:border-teal-400/60',
    hex: '#ccfbf1',
    darkHex: '#042f2e',
    glow: '0 0 14px rgba(45,212,191,0.28)',
  },
  {
    bg: 'bg-rose-100 dark:bg-rose-950/60',
    border: 'border-rose-300 dark:border-rose-400/60',
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

/*
 * The hardcoded hex values below are SANCTIONED fallbacks mirroring the
 * `--c-chart-*` CSS tokens (src/index.css) for SSR/detached-DOM reads, same
 * pattern as `financeChartTokens.ts` — see that file's header comment.
 */
/* eslint-disable no-restricted-syntax */
/**
 * Scenario line/bar colors for the Financial Case charts.
 *
 * Scenarios (Base/Upside/Downside) are a categorical IDENTITY where order
 * matters (series 1/2/3), not a status signal — Upside is not literally
 * "success" and Downside is not literally "danger" (a downside case can still
 * be the accepted plan). Per dataviz-skill + this repo's token guide
 * (tailwind.config.js "DATA-PALETTE DECISION GUIDE"), that means the ordered
 * `--c-chart-1..8` ramp (blue-first, never red-first), not `--c-success` /
 * `--c-danger`. Cost vs benefit (a real polarity) still uses `--c-danger` /
 * `--c-success` via `financeChartTokens.ts`.
 */
import { useEffect, useState } from 'react';

import { readCssToken } from '@/components/Economics/financeChartTokens';

import type { FinancialScenarioId } from './financialTypes';

const FALLBACKS: Record<FinancialScenarioId, string> = {
  base: '#2f6f95', // --c-chart-1 light fallback
  upside: '#2f8f6b', // --c-chart-2 light fallback
  downside: '#b5793a', // --c-chart-3 light fallback
};

const TOKEN_BY_SCENARIO: Record<FinancialScenarioId, string> = {
  base: '--c-chart-1',
  upside: '--c-chart-2',
  downside: '--c-chart-3',
};

export function readScenarioColors(): Record<FinancialScenarioId, string> {
  return {
    base: readCssToken(TOKEN_BY_SCENARIO.base, FALLBACKS.base),
    upside: readCssToken(TOKEN_BY_SCENARIO.upside, FALLBACKS.upside),
    downside: readCssToken(TOKEN_BY_SCENARIO.downside, FALLBACKS.downside),
  };
}

export function useScenarioColors(): Record<FinancialScenarioId, string> {
  const [colors, setColors] = useState(() => readScenarioColors());
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const resolve = () => setColors(readScenarioColors());
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

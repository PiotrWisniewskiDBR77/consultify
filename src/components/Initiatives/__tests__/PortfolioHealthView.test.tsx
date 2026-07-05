/**
 * @vitest-environment jsdom
 *
 * Render tests for PortfolioHealthView (Kręgosłup inicjatyw · F4 · Zdrowie portfela).
 * Wstrzykuje obiekt `health` (pomija fetch), sprawdza że render pokazuje mapę
 * pokrycia, luki, klastry duplikatów i balans — bez sieci/DB.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: any) => {
      if (typeof opts === 'string') return opts;
      if (opts?.defaultValue) return opts.defaultValue;
      return k;
    },
    i18n: { language: 'pl' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

import { PortfolioHealthView, type PortfolioHealth } from '../PortfolioHealthView';

const sample: PortfolioHealth = {
  total: 4,
  byStatus: { DRAFT: 2, EXECUTING: 2 },
  coverage: [
    { area: 'data', count: 1, sharePct: 25 },
    { area: 'process', count: 1, sharePct: 25 },
    { area: 'people', count: 1, sharePct: 25 },
    { area: 'governance', count: 1, sharePct: 25 },
    { area: 'product', count: 0, sharePct: 0 },
    { area: 'technology', count: 0, sharePct: 0 },
    { area: 'customer', count: 0, sharePct: 0 },
    { area: 'finance', count: 0, sharePct: 0 },
  ],
  gaps: ['product', 'technology', 'customer', 'finance'],
  balance: {
    grid: [
      { effort: 'low', impact: 'low', count: 1 },
      { effort: 'low', impact: 'medium', count: 0 },
      { effort: 'low', impact: 'high', count: 1 },
      { effort: 'medium', impact: 'low', count: 0 },
      { effort: 'medium', impact: 'medium', count: 0 },
      { effort: 'medium', impact: 'high', count: 0 },
      { effort: 'high', impact: 'low', count: 1 },
      { effort: 'high', impact: 'medium', count: 0 },
      { effort: 'high', impact: 'high', count: 1 },
    ],
    quickWins: 1,
    bigBets: 1,
    moneyPits: 1,
    fillIns: 1,
  },
  duplicateClusters: [
    { ids: ['d1', 'd2'], titles: ['Hurtownia danych', 'Hurtownia danych'], peakScore: 0.9 },
  ],
};

describe('PortfolioHealthView', () => {
  it('renderuje widok zdrowia z mapą pokrycia, lukami i duplikatami', () => {
    render(<PortfolioHealthView health={sample} />);

    expect(screen.getByTestId('portfolio-health-view')).toBeInTheDocument();
    // Mapa pokrycia: obszar 'data' obecny.
    expect(screen.getByText('Data')).toBeInTheDocument();
    // Luki widoczne jako chipy.
    expect(screen.getByTestId('portfolio-health-gaps')).toBeInTheDocument();
    // Klaster duplikatów wyrenderowany (1 grupa).
    expect(screen.getByTestId('portfolio-health-dupes')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
  });

  it('pokazuje honest empty state gdy brak danych', () => {
    render(<PortfolioHealthView health={null} />);
    expect(screen.getByTestId('portfolio-health-empty')).toBeInTheDocument();
  });

  it('pokazuje brak duplikatów gdy duplicateClusters puste', () => {
    render(<PortfolioHealthView health={{ ...sample, duplicateClusters: [] }} />);
    expect(screen.getByTestId('portfolio-health-no-dupes')).toBeInTheDocument();
  });
});

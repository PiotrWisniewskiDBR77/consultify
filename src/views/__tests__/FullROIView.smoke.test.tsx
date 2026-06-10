/**
 * @vitest-environment jsdom
 *
 * Smoke tests for FullROIView (Module 05 — Value Realization & ROI).
 * Verifies the former "Under Construction" stub is gone and that the dashboard
 * renders real economics data: empty-state CTA when there are no analyses, and
 * KPI/table figures when analyses are returned.
 */

import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: any) => {
      // Support both t(key, 'fallback') and t(key, { defaultValue, count })
      if (typeof opts === 'string') return opts;
      if (opts?.defaultValue) {
        return opts.count != null
          ? String(opts.defaultValue).replace('{{count}}', String(opts.count))
          : opts.defaultValue;
      }
      return k;
    },
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

const { getEconomicsAnalyses } = vi.hoisted(() => ({
  getEconomicsAnalyses: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  Api: { getEconomicsAnalyses },
  shouldAllowDemoData: () => false,
}));

vi.mock('../store/useAppStore', () => ({
  useAppStore: (selector: any) => selector({ currentProjectId: 'proj-1' }),
}));

import { FullROIView } from '../FullROIView';

const renderView = () =>
  render(
    <MemoryRouter initialEntries={['/roi']}>
      <FullROIView />
    </MemoryRouter>
  );

beforeEach(() => {
  getEconomicsAnalyses.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('FullROIView smoke', () => {
  it('shows the empty-state CTA (not "Under Construction") when there are no analyses', async () => {
    getEconomicsAnalyses.mockResolvedValue({ analyses: [], total: 0 });
    renderView();
    await waitFor(() => {
      expect(screen.getByText('Go to Portfolio')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Under Construction/i)).not.toBeInTheDocument();
  });

  it('renders ROI %, NPV and payback figures from real analysis data', async () => {
    getEconomicsAnalyses.mockResolvedValue({
      analyses: [
        {
          id: 'a1',
          name: 'Warehouse Automation',
          initiativeName: 'Warehouse Automation',
          status: 'EXECUTING',
          npv: 120000,
          roi: 0.45,
          payback_months: 18,
        },
      ],
      total: 1,
    });
    renderView();

    // ROI 0.45 fraction -> "45%" (appears in both the KPI card and the table)
    await waitFor(() => {
      expect(screen.getAllByText('45%').length).toBeGreaterThan(0);
    });
    // Payback 18 months
    expect(screen.getByText(/18 months/)).toBeInTheDocument();
    // Dashboard present, no stub text
    expect(screen.getByTestId('roi-dashboard')).toBeInTheDocument();
    expect(screen.queryByText(/Under Construction/i)).not.toBeInTheDocument();
  });

  it('renders an error state with retry when the economics call fails', async () => {
    getEconomicsAnalyses.mockRejectedValue(new Error('boom'));
    renderView();
    await waitFor(() => {
      expect(screen.getByText("Couldn't load ROI data")).toBeInTheDocument();
    });
  });
});

/**
 * @vitest-environment jsdom
 *
 * Smoke tests for ROIAnalysisView (Module 07 — Rezultaty).
 * Mocks the V8 Results API so the view mounts deterministically offline.
 * Asserts: empty portfolio renders the honest empty state, a populated
 * portfolio renders the initiative, and a finalized/locked initiative surfaces
 * the lock badge + governance banner (the P1 lock/approval UI).
 */

import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, optsOrDefault?: any, opts?: any) => {
      // Support both t(key, default) and t(key, default, { interpolation })
      const def = typeof optsOrDefault === 'string' ? optsOrDefault : optsOrDefault?.defaultValue;
      const interp = typeof optsOrDefault === 'object' ? optsOrDefault : opts;
      let out = def ?? k;
      if (interp && typeof out === 'string') {
        out = out.replace(/\{\{(\w+)\}\}/g, (_m, key) =>
          interp[key] != null ? String(interp[key]) : ''
        );
      }
      return out;
    },
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

const { getRoiPortfolioSummary } = vi.hoisted(() => ({ getRoiPortfolioSummary: vi.fn() }));

vi.mock('@/services/api/v8/results', () => ({
  V8ResultsApi: { getRoiPortfolioSummary },
  shouldFallbackToLegacyResults: () => false,
}));

vi.mock('@/services/api', () => ({
  Api: { get: vi.fn(async () => ({ items: [], summary: null })) },
}));

vi.mock('@/services/funnelAnalytics', () => ({ trackFunnelEvent: vi.fn() }));

vi.mock('../ROIDetailDrawer', () => ({
  ROIDetailDrawer: () => <div data-testid="roi-detail-drawer" />,
}));

import { deriveROILockState, ROIAnalysisView } from '../ROIAnalysisView';

const baseSummary = {
  totalProjected: 0,
  totalRealized: 0,
  totalCapex: 0,
  totalVariance: 0,
  initiativeCount: 0,
  coveragePercent: 0,
};

describe('ROIAnalysisView smoke', () => {
  it('renders the empty state when the portfolio has no initiatives', async () => {
    getRoiPortfolioSummary.mockResolvedValue({ items: [], summary: baseSummary });
    render(<ROIAnalysisView />);
    await waitFor(() => {
      expect(screen.getByText('No initiatives with ROI data')).toBeInTheDocument();
    });
  });

  it('renders an initiative row when the portfolio has one initiative', async () => {
    getRoiPortfolioSummary.mockResolvedValue({
      items: [
        {
          initiativeId: 'init-1',
          initiativeName: 'SMED rollout',
          status: 'EXECUTING',
          priority: 'high',
          capex: 0,
          opexAnnual: 0,
          projectedBenefit: 1000,
          realizedBenefit: 900,
          variance: -100,
          confidence: 'medium',
          hasRealized: true,
        },
      ],
      summary: { ...baseSummary, initiativeCount: 1 },
    });
    render(<ROIAnalysisView />);
    await waitFor(() => {
      expect(screen.getByText('SMED rollout')).toBeInTheDocument();
    });
  });

  it('surfaces the lock badge and governance banner for a finalized initiative', async () => {
    getRoiPortfolioSummary.mockResolvedValue({
      items: [
        {
          initiativeId: 'init-2',
          initiativeName: 'Energy optimization',
          status: 'COMPLETED', // terminal lifecycle → locked
          priority: 'medium',
          capex: 0,
          opexAnnual: 0,
          projectedBenefit: 500,
          realizedBenefit: 500,
          variance: 0,
          confidence: 'high',
          hasRealized: true,
        },
      ],
      summary: { ...baseSummary, initiativeCount: 1 },
    });
    render(<ROIAnalysisView />);
    await waitFor(() => {
      expect(screen.getByText('Energy optimization')).toBeInTheDocument();
    });
    // Lock badge (per-row) and the governance banner both render the "Locked" copy.
    expect(screen.getAllByText('Locked').length).toBeGreaterThan(0);
  });

  it('renders an error state when the portfolio load fails', async () => {
    getRoiPortfolioSummary.mockRejectedValue(new Error('boom'));
    render(<ROIAnalysisView />);
    await waitFor(() => {
      expect(screen.getByText('Could not load ROI analysis')).toBeInTheDocument();
    });
  });
});

describe('deriveROILockState', () => {
  it('maps terminal statuses to locked', () => {
    expect(deriveROILockState('COMPLETED')).toBe('locked');
    expect(deriveROILockState('closed')).toBe('locked');
    expect(deriveROILockState('CANCELLED')).toBe('locked');
  });
  it('maps approved/tracking statuses to approved', () => {
    expect(deriveROILockState('APPROVED')).toBe('approved');
    expect(deriveROILockState('TRACKING')).toBe('approved');
  });
  it('maps active/unknown statuses to open', () => {
    expect(deriveROILockState('EXECUTING')).toBe('open');
    expect(deriveROILockState(null)).toBe('open');
    expect(deriveROILockState('')).toBe('open');
  });
});

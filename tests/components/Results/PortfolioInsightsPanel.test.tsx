/**
 * @vitest-environment jsdom
 *
 * M15 Seria T / T2 — FE component tests for PortfolioInsightsPanel.
 * Covers: render with signals/reallocation/run-rate/scenarios/finance-link/funnel payloads,
 * funnel section + value-at-risk, run-rate assumption flag, finance-link empty state,
 * board-pack CTA (always-on), and all-reject resilience.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any, opts?: any) => {
      let str = typeof fallback === 'string' ? fallback : _key;
      if (opts && typeof opts === 'object') {
        str = str.replace(/\{\{(\w+)\}\}/g, (_m: string, k: string) => String(opts[k] ?? ''));
      }
      return str;
    },
    i18n: { language: 'pl' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('@/services/api', () => ({
  Api: { get: vi.fn(), post: vi.fn() },
}));

import PortfolioInsightsPanel from '@/components/Results/PortfolioInsightsPanel';
import { Api } from '@/services/api';

const SIGNALS = {
  signals: [
    { id: 'sig-1', name: 'Adopcja poniżej progu', type: 'adoption', severity: 'critical', realizationPct: 0.3 },
    { id: 'sig-2', name: 'Trend spadkowy', type: 'trend', severity: 'warning', realizationPct: 0.55 },
  ],
  summary: { total: 2, critical: 1, warning: 1 },
};

const REALLOCATION = {
  moves: [
    { fromId: 'init-aaa', fromName: 'Inicjatywa A', toId: 'init-bbb', toName: 'Inicjatywa B', fteSuggested: 2, rationale: 'więcej wartości' },
  ],
  summary: {},
  capacityAssumed: true,
};

const RUN_RATE = {
  bridge: { runRate: 4_000_000, projectedInYear: 5_000_000, alreadyRealized: 2_000_000 },
  timing: { totalRunRate: 4_000_000, totalRealized: 2_000_000, aheadOfPlanCount: 3, behindPlanCount: 1 },
  periodMonths: 6,
  periodMonthsAssumed: true,
};

const SCENARIOS = {
  scenarios: [
    { label: 'Bazowy', npv: 3_000_000, irr: 0.18, paybackMonths: 2.5 },
    { label: 'Optymistyczny', npv: 5_000_000, irr: 0.27, paybackMonths: 1.8 },
  ],
  irr: 0.18,
  paybackPeriod: 2.5,
  initiativeCount: 8,
};

const FINANCE_LINK = {
  aggregate: { totalPositiveImpact: 2_000_000, totalNegativeImpact: -500_000, netImpact: 1_500_000 },
  mappingCount: 4,
};

const FUNNEL = {
  stages: [
    { stage: 'ideas', count: 20, value: 8_000_000, riskAdjustedValue: 2_000_000 },
    { stage: 'validated', count: 12, value: 6_000_000, riskAdjustedValue: 3_000_000 },
    { stage: 'inflight', count: 6, value: 4_000_000, riskAdjustedValue: 3_000_000 },
    { stage: 'realized', count: 3, value: 2_000_000, riskAdjustedValue: 2_000_000 },
  ],
  conversion: [
    { from: 'ideas', to: 'validated', conversionPct: 60, leakageValue: 2_000_000 },
    { from: 'validated', to: 'inflight', conversionPct: 50, leakageValue: 1_000_000 },
  ],
  valueAtRisk: { atRiskValue: 1_500_000, atRiskCount: 2 },
  total: 20,
};

function mockEndpoints(map: Record<string, any>) {
  vi.mocked(Api.get).mockImplementation(async (url: string) => {
    for (const [suffix, value] of Object.entries(map)) {
      // Wrap real payloads in { data } (mirrors API envelope); pass null raw so the
      // component's `(v)?.data ?? v` resolves to null (section is skipped entirely).
      if (url.endsWith(suffix)) return (value == null ? value : { data: value }) as any;
    }
    throw new Error(`Unexpected GET ${url}`);
  });
}

const FULL = {
  '/signals': SIGNALS,
  '/reallocation': REALLOCATION,
  '/run-rate': RUN_RATE,
  '/scenarios': SCENARIOS,
  '/finance-link': FINANCE_LINK,
  '/funnel': FUNNEL,
};

describe('PortfolioInsightsPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the panel without crashing for a realistic payload', async () => {
    mockEndpoints(FULL);
    render(<PortfolioInsightsPanel projectId="all" />);
    await waitFor(() => expect(screen.getByTestId('portfolio-insights-panel')).toBeInTheDocument());
  });

  it('renders the value funnel section with stages and value-at-risk', async () => {
    mockEndpoints(FULL);
    render(<PortfolioInsightsPanel projectId="all" />);
    await waitFor(() => expect(screen.getByTestId('portfolio-funnel')).toBeInTheDocument());
    expect(screen.getByText('Portfolio value funnel')).toBeInTheDocument();
    // Stage labels appear in the stage grid AND in conversion rows -> getAllByText.
    expect(screen.getAllByText('Ideas').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Realized').length).toBeGreaterThan(0);
    expect(screen.getByText(/Value at risk/)).toBeInTheDocument();
  });

  it('renders the manager-signals section with a critical signal', async () => {
    mockEndpoints(FULL);
    render(<PortfolioInsightsPanel projectId="all" />);
    await waitFor(() => expect(screen.getByTestId('portfolio-insights-panel')).toBeInTheDocument());
    expect(screen.getByText('Signals to M14 Implementation')).toBeInTheDocument();
    expect(screen.getByText('Adopcja poniżej progu')).toBeInTheDocument();
    expect(screen.getByText('1 critical')).toBeInTheDocument();
  });

  it('renders the run-rate section with the assumption flag', async () => {
    mockEndpoints(FULL);
    render(<PortfolioInsightsPanel projectId="all" />);
    await waitFor(() => expect(screen.getByTestId('portfolio-insights-panel')).toBeInTheDocument());
    expect(screen.getByText('Run-rate vs in-year')).toBeInTheDocument();
    expect(screen.getByText(/assumption: 6-month measurement window/)).toBeInTheDocument();
  });

  it('renders the scenarios table with NPV/IRR rows', async () => {
    mockEndpoints(FULL);
    render(<PortfolioInsightsPanel projectId="all" />);
    await waitFor(() => expect(screen.getByTestId('portfolio-insights-panel')).toBeInTheDocument());
    expect(screen.getByText('Scenarios + IRR')).toBeInTheDocument();
    expect(screen.getByText('Bazowy')).toBeInTheDocument();
    expect(screen.getByText('Optymistyczny')).toBeInTheDocument();
  });

  it('renders the reallocation section with the capacity-assumed flag', async () => {
    mockEndpoints(FULL);
    render(<PortfolioInsightsPanel projectId="all" />);
    await waitFor(() => expect(screen.getByTestId('portfolio-insights-panel')).toBeInTheDocument());
    expect(screen.getByText('Recommended resource shifts')).toBeInTheDocument();
    expect(screen.getByText(/FTE capacity = assumption/)).toBeInTheDocument();
  });

  it('renders the finance-link aggregate when mappings exist', async () => {
    mockEndpoints(FULL);
    render(<PortfolioInsightsPanel projectId="all" />);
    await waitFor(() => expect(screen.getByTestId('portfolio-insights-panel')).toBeInTheDocument());
    expect(screen.getByText('Link to Finance (M16)')).toBeInTheDocument();
    expect(screen.getByText('Net impact')).toBeInTheDocument();
  });

  it('shows the finance-link empty state when mappingCount is 0', async () => {
    mockEndpoints({ ...FULL, '/finance-link': { aggregate: null, mappingCount: 0 } });
    render(<PortfolioInsightsPanel projectId="all" />);
    await waitFor(() => expect(screen.getByTestId('portfolio-insights-panel')).toBeInTheDocument());
    expect(screen.getByText(/No KPI→Finance mappings/)).toBeInTheDocument();
  });

  it('always renders the board-pack CTA', async () => {
    mockEndpoints(FULL);
    render(<PortfolioInsightsPanel projectId="all" />);
    await waitFor(() => expect(screen.getByTestId('portfolio-insights-panel')).toBeInTheDocument());
    expect(screen.getByText('Board-pack / Auto value narrative')).toBeInTheDocument();
    expect(screen.getByText('Go to Outputs →')).toBeInTheDocument();
  });

  it('renders only the board-pack CTA when every endpoint returns empty payloads (no crash)', async () => {
    mockEndpoints({
      '/signals': { signals: [], summary: { total: 0, critical: 0, warning: 0 } },
      '/reallocation': { moves: [], summary: {} },
      '/run-rate': null,
      '/scenarios': null,
      '/finance-link': null,
      '/funnel': { stages: [], conversion: [], valueAtRisk: { atRiskValue: 0, atRiskCount: 0 }, total: 0 },
    });
    render(<PortfolioInsightsPanel projectId="all" />);
    await waitFor(() => expect(screen.getByTestId('portfolio-insights-panel')).toBeInTheDocument());
    expect(screen.queryByTestId('portfolio-funnel')).not.toBeInTheDocument();
    expect(screen.queryByText('Run-rate vs in-year')).not.toBeInTheDocument();
    expect(screen.getByText('Board-pack / Auto value narrative')).toBeInTheDocument();
  });

  it('survives all endpoints rejecting without crashing', async () => {
    vi.mocked(Api.get).mockRejectedValue(new Error('boom'));
    render(<PortfolioInsightsPanel projectId="all" />);
    await waitFor(() => expect(screen.getByTestId('portfolio-insights-panel')).toBeInTheDocument());
    expect(screen.getByText('Board-pack / Auto value narrative')).toBeInTheDocument();
  });
});

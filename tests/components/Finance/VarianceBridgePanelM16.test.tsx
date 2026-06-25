/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
    i18n: { language: 'pl' },
  }),
}));

vi.mock('@/components/Economics/charts', () => ({
  BulletChart: (_props: any) => <div data-testid="bullet-chart" />,
  FinanceWaterfall: (_props: any) => <div data-testid="waterfall" />,
  FootballField: (_props: any) => <div data-testid="football-field" />,
  SensitivityHeatmap: (_props: any) => <div data-testid="sensitivity-heatmap" />,
  TornadoChart: (_props: any) => <div data-testid="tornado-chart" />,
  PortfolioBubble: (_props: any) => <div data-testid="portfolio-bubble" />,
  SCurve: (_props: any) => <div data-testid="scurve" />,
  GoldenThreadSankey: (_props: any) => <div data-testid="golden-thread-sankey" />,
}));

vi.mock('@/components/Economics/charts/FinanceWaterfall', () => ({
  default: (_props: any) => <div data-testid="waterfall" />,
  FinanceWaterfall: (_props: any) => <div data-testid="waterfall" />,
}));

vi.mock('@/services/api', () => {
  const api = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
  return { Api: api, default: api };
});

import { VarianceBridgePanel, type VarianceLine, type VarianceBridgeData } from '@/components/Economics/panels/VarianceBridgePanel';

const sampleLines: VarianceLine[] = [
  { label: 'Revenue', plan: 500_000, actual: 550_000, isCost: false },
  { label: 'COGS', plan: 200_000, actual: 230_000, isCost: true },
];

const bridgeData: VarianceBridgeData = {
  steps: [
    { label: 'Plan', value: 300_000, kind: 'start' },
    { label: 'Revenue', value: 50_000, kind: 'increase' },
    { label: 'COGS', value: -30_000, kind: 'decrease' },
    { label: 'Actual', value: 320_000, kind: 'total' },
  ],
  totalVariance: 20_000,
};

describe('VarianceBridgePanel (F5 — Budget Variance Bridge)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when lines is undefined', () => {
    render(<VarianceBridgePanel />);

    expect(screen.getByTestId('variance-bridge-panel')).toBeInTheDocument();
    expect(screen.getByTestId('variance-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('variance-total')).not.toBeInTheDocument();
  });

  it('renders empty state when lines is an empty array', () => {
    render(<VarianceBridgePanel lines={[]} />);

    expect(screen.getByTestId('variance-bridge-panel')).toBeInTheDocument();
    expect(screen.getByTestId('variance-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('variance-total')).not.toBeInTheDocument();
  });

  it('calls fetcher with the provided lines when lines are present', async () => {
    const fetcher = vi.fn<[VarianceLine[]], Promise<VarianceBridgeData>>().mockResolvedValue(bridgeData);

    render(<VarianceBridgePanel lines={sampleLines} fetcher={fetcher} />);

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledWith(sampleLines);
    });
  });

  it('renders total variance KPI after fetch succeeds', async () => {
    const fetcher = vi.fn<[VarianceLine[]], Promise<VarianceBridgeData>>().mockResolvedValue(bridgeData);

    render(<VarianceBridgePanel lines={sampleLines} fetcher={fetcher} />);

    await waitFor(() => {
      expect(screen.getByTestId('variance-total')).toBeInTheDocument();
    });

    expect(screen.getByTestId('variance-total')).toHaveTextContent('20');
  });

  it('renders favorable and unfavorable counts from steps', async () => {
    const fetcher = vi.fn<[VarianceLine[]], Promise<VarianceBridgeData>>().mockResolvedValue(bridgeData);

    render(<VarianceBridgePanel lines={sampleLines} fetcher={fetcher} />);

    await waitFor(() => {
      expect(screen.getByTestId('variance-favorable')).toBeInTheDocument();
    });

    expect(screen.getByTestId('variance-favorable')).toHaveTextContent('1');
    expect(screen.getByTestId('variance-unfavorable')).toHaveTextContent('1');
  });
});

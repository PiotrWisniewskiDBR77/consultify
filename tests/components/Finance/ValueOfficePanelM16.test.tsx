/**
 * @vitest-environment jsdom
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
    i18n: { language: 'pl' },
  }),
}));

vi.mock('@/services/api', () => {
  const api = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  };
  return {
    Api: api,
    default: api,
  };
});

vi.mock('@/components/Economics/charts', () => ({
  FinanceWaterfall: () => <div data-testid="waterfall" />,
  PortfolioBubble: () => <div data-testid="portfolio-bubble" />,
  FootballField: () => <div data-testid="football-field" />,
  SensitivityHeatmap: () => <div data-testid="sensitivity-heatmap" />,
  TornadoChart: () => <div data-testid="tornado-chart" />,
  SCurve: () => <div data-testid="s-curve" />,
  BulletChart: () => <div data-testid="bullet-chart" />,
  GoldenThreadSankey: () => <div data-testid="golden-thread-sankey" />,
}));

vi.mock('@/components/Economics/charts/FinanceWaterfall', () => ({
  FinanceWaterfall: () => <div data-testid="waterfall" />,
}));

vi.mock('@/components/Economics/charts/PortfolioBubble', () => ({
  PortfolioBubble: () => <div data-testid="portfolio-bubble" />,
}));

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ValueOfficePanel,
  type ValueOfficeInitiative,
  type ValueBridgeResponse,
  type PortfolioResponse,
} from '../../../src/components/Economics/panels/ValueOfficePanel';

// ── Helpers ──────────────────────────────────────────────────────────────────

const makeBridgeResponse = (): ValueBridgeResponse => ({
  data: {
    steps: [
      { label: 'Baseline', value: 0, kind: 'start' },
      { label: 'Automatyzacja', value: 1_200_000, kind: 'increase' },
      { label: 'Zrealizowana', value: 1_200_000, kind: 'total' },
    ],
    totalRealized: 1_200_000,
    totalIdentified: 3_050_000,
  },
});

const makePortfolioResponse = (ids: string[]): PortfolioResponse => ({
  data: ids.map((id, i) => ({
    id,
    name: `Initiative ${id}`,
    npv: 500_000 * (i + 1),
    risk: 0.2 * (i + 1),
    effort: i + 2,
    quadrant: 'fund' as const,
    rank: i + 1,
  })),
});

const sampleInitiatives: ValueOfficeInitiative[] = [
  { id: 'i1', name: 'Alpha', value: 900_000, stage: 'realized', npv: 700_000, risk: 0.2, effort: 3 },
  { id: 'i2', name: 'Beta', value: 600_000, stage: 'in_flight', npv: 400_000, risk: 0.5, effort: 5 },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ValueOfficePanel — epic F3 (Value Bridge Waterfall + Portfolio Prioritization)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with default example initiatives when no props given (panel is never empty)', async () => {
    // Injected fetchers resolve immediately so the panel doesn't stay in loading state
    const bridgeFetcher = vi.fn().mockResolvedValue(makeBridgeResponse());
    const portfolioFetcher = vi.fn().mockResolvedValue(makePortfolioResponse(['demo-1', 'demo-2']));

    render(
      <ValueOfficePanel
        valueBridgeFetcher={bridgeFetcher}
        portfolioFetcher={portfolioFetcher}
      />,
    );

    // Panel mounts and is not in failed state
    expect(screen.getByTestId('value-office-panel')).toBeInTheDocument();

    // Fetchers were called (with the internal SAMPLE_INITIATIVES since no initiatives prop given)
    await waitFor(() => expect(bridgeFetcher).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(portfolioFetcher).toHaveBeenCalledTimes(1));
  });

  it('calls bridgeFetcher with provided initiatives', async () => {
    const bridgeFetcher = vi.fn().mockResolvedValue(makeBridgeResponse());
    const portfolioFetcher = vi.fn().mockResolvedValue(makePortfolioResponse(['i1', 'i2']));

    render(
      <ValueOfficePanel
        initiatives={sampleInitiatives}
        valueBridgeFetcher={bridgeFetcher}
        portfolioFetcher={portfolioFetcher}
      />,
    );

    await waitFor(() => {
      expect(bridgeFetcher).toHaveBeenCalledWith(sampleInitiatives);
    });
  });

  it('calls portfolioFetcher with provided initiatives', async () => {
    const bridgeFetcher = vi.fn().mockResolvedValue(makeBridgeResponse());
    const portfolioFetcher = vi.fn().mockResolvedValue(makePortfolioResponse(['i1', 'i2']));

    render(
      <ValueOfficePanel
        initiatives={sampleInitiatives}
        valueBridgeFetcher={bridgeFetcher}
        portfolioFetcher={portfolioFetcher}
      />,
    );

    await waitFor(() => {
      expect(portfolioFetcher).toHaveBeenCalledWith(sampleInitiatives);
    });
  });

  it('renders waterfall and portfolio sections after both fetchers succeed', async () => {
    const bridgeFetcher = vi.fn().mockResolvedValue(makeBridgeResponse());
    const portfolioFetcher = vi.fn().mockResolvedValue(makePortfolioResponse(['i1', 'i2']));

    render(
      <ValueOfficePanel
        initiatives={sampleInitiatives}
        valueBridgeFetcher={bridgeFetcher}
        portfolioFetcher={portfolioFetcher}
      />,
    );

    // Waterfall section (data-testid="value-bridge-chart")
    await waitFor(() => {
      expect(screen.getByTestId('value-bridge-chart')).toBeInTheDocument();
    });

    // Mocked FinanceWaterfall inside the section
    expect(screen.getByTestId('waterfall')).toBeInTheDocument();

    // Portfolio section (data-testid="portfolio-board")
    expect(screen.getByTestId('portfolio-board')).toBeInTheDocument();

    // Mocked PortfolioBubble inside the section
    expect(screen.getByTestId('portfolio-bubble')).toBeInTheDocument();
  });
});

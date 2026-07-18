/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key)),
    i18n: { language: 'pl' },
  }),
}));

vi.mock('@/components/Economics/charts', () => ({
  BulletChart: (_props: any) => <div data-testid="bullet-chart" />,
  FinanceWaterfall: (_props: any) => <div data-testid="finance-waterfall" />,
  FootballField: (_props: any) => <div data-testid="football-field" />,
  SensitivityHeatmap: (_props: any) => <div data-testid="sensitivity-heatmap" />,
  TornadoChart: (_props: any) => <div data-testid="tornado-chart" />,
  PortfolioBubble: (_props: any) => <div data-testid="portfolio-bubble" />,
  SCurve: (_props: any) => <div data-testid="scurve" />,
  GoldenThreadSankey: (_props: any) => <div data-testid="golden-thread-sankey" />,
}));

vi.mock('@/services/api', () => {
  const api = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
  return { Api: api, default: api };
});

import { InvestmentAppraisalPanel, type AppraisalResult, type AppraisalRequest } from '@/components/Economics/panels/InvestmentAppraisalPanel';

const goResult: AppraisalResult = {
  npv: 250_000,
  irr: 18.5,
  mirr: 14.2,
  payback: 2.7,
  discountedPayback: 3.4,
  pi: 1.25,
  verdict: 'go',
};

const noGoResult: AppraisalResult = { ...goResult, npv: -50_000, verdict: 'no-go' };
const conditionalResult: AppraisalResult = { ...goResult, npv: 5_000, verdict: 'conditional' };

describe('InvestmentAppraisalPanel (F7 — Investment Appraisal)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the cash-flow input UI with a "Oblicz" button', () => {
    render(<InvestmentAppraisalPanel />);

    expect(screen.getByTestId('investment-appraisal-panel')).toBeInTheDocument();
    expect(screen.getByTestId('appraise-cashflows')).toBeInTheDocument();
    expect(screen.getByTestId('appraise-compute')).toHaveTextContent('Oblicz');
    expect(screen.getByLabelText('Nakład początkowy')).toBeInTheDocument();
    expect(screen.getByLabelText('Stopa dyskontowa')).toBeInTheDocument();
  });

  it('calls fetcher with correct payload and displays NPV on success', async () => {
    const fetcher = vi.fn<[AppraisalRequest], Promise<AppraisalResult>>().mockResolvedValue(goResult);

    render(
      <InvestmentAppraisalPanel
        initialCashFlows={[-1000, 400, 400, 400]}
        discountRatePct={10}
        fetcher={fetcher}
      />,
    );

    fireEvent.click(screen.getByTestId('appraise-compute'));

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledWith({
        cashFlows: [-1000, 400, 400, 400],
        discountRate: 10,
        hurdleRatePct: 10,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('appraise-npv')).toBeInTheDocument();
    });

    expect(screen.getByTestId('appraise-npv')).toHaveTextContent('250');
  });

  it('shows go badge when verdict = "go"', async () => {
    const fetcher = vi.fn<[AppraisalRequest], Promise<AppraisalResult>>().mockResolvedValue(goResult);

    render(<InvestmentAppraisalPanel fetcher={fetcher} />);
    fireEvent.click(screen.getByTestId('appraise-compute'));

    await waitFor(() => {
      expect(screen.getByTestId('appraise-verdict')).toBeInTheDocument();
    });

    expect(screen.getByTestId('appraise-verdict')).toHaveTextContent('Realizować (go)');
  });

  it('shows no-go badge when verdict = "no-go"', async () => {
    const fetcher = vi.fn<[AppraisalRequest], Promise<AppraisalResult>>().mockResolvedValue(noGoResult);

    render(<InvestmentAppraisalPanel fetcher={fetcher} />);
    fireEvent.click(screen.getByTestId('appraise-compute'));

    await waitFor(() => {
      expect(screen.getByTestId('appraise-verdict')).toBeInTheDocument();
    });

    expect(screen.getByTestId('appraise-verdict')).toHaveTextContent('Odrzucić (no-go)');
  });

  it('shows conditional badge when verdict = "conditional"', async () => {
    const fetcher = vi.fn<[AppraisalRequest], Promise<AppraisalResult>>().mockResolvedValue(conditionalResult);

    render(<InvestmentAppraisalPanel fetcher={fetcher} />);
    fireEvent.click(screen.getByTestId('appraise-compute'));

    await waitFor(() => {
      expect(screen.getByTestId('appraise-verdict')).toBeInTheDocument();
    });

    expect(screen.getByTestId('appraise-verdict')).toHaveTextContent('Warunkowo (conditional)');
  });

  it('degrades to an error notice (no throw) when fetcher rejects', async () => {
    const fetcher = vi.fn<[AppraisalRequest], Promise<AppraisalResult>>().mockRejectedValue(new Error('network error'));

    render(<InvestmentAppraisalPanel fetcher={fetcher} />);
    fireEvent.click(screen.getByTestId('appraise-compute'));

    await waitFor(() => {
      expect(screen.getByTestId('appraise-failed')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('appraise-verdict')).not.toBeInTheDocument();
    expect(screen.queryByTestId('appraise-metrics')).not.toBeInTheDocument();
  });
});

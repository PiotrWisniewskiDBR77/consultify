/**
 * FIN-005 round 8 — InvestmentAppraisalPanel's MODEL-BOUND mode.
 *
 * Proves: passing `modelId` fetches automatically (no "Oblicz" click needed),
 * hides the editable calculator controls (these numbers are canonical, not
 * user input), renders the real NPV/verdict from the fetch response, shows a
 * failed state on rejection, and re-fetching (simulating "reopen") with the
 * same inputs gives the same rendered result — without ever touching the
 * standalone calculator's own default behavior.
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { InvestmentAppraisalPanel, type ModelAppraisalResponse } from '../InvestmentAppraisalPanel';

const REAL_RESPONSE: ModelAppraisalResponse = {
  input: {
    cashflows: [2_400_000, 2_001_920, 2_003_841.54],
    initialInvestment: 800_000,
    discountRatePct: 10,
    hurdleRatePct: 10,
  },
  result: {
    npv: 4_541_813.33,
    irr: 282.53,
    mirr: 107.14,
    payback: 0.33,
    discountedPayback: 0.37,
    pi: 6.68,
    verdict: 'go',
  },
  periodLabels: ['FY2015', 'FY2016', 'FY2017'],
};

describe('InvestmentAppraisalPanel — model-bound mode', () => {
  it('fetches automatically on mount, with no "Oblicz" button to click', async () => {
    const modelFetcher = vi.fn().mockResolvedValue(REAL_RESPONSE);
    render(
      <InvestmentAppraisalPanel
        modelId="model-atelier"
        discountRatePct={10}
        modelFetcher={modelFetcher}
      />
    );

    expect(modelFetcher).toHaveBeenCalledWith('model-atelier', {
      discountRatePct: 10,
      hurdleRatePct: 10,
    });
    expect(screen.queryByTestId('appraise-compute')).not.toBeInTheDocument();
    expect(screen.queryByTestId('appraise-cashflows')).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByTestId('appraise-verdict')).toBeInTheDocument());
    expect(screen.getByTestId('appraise-npv').textContent).toMatch(/4/); // real number rendered, not a placeholder
    expect(screen.getByTestId('appraise-period-labels').textContent).toMatch(/FY2015/);
  });

  it('renders a failed state on rejection, without throwing', async () => {
    const modelFetcher = vi.fn().mockRejectedValue(new Error('network error'));
    render(<InvestmentAppraisalPanel modelId="model-atelier" modelFetcher={modelFetcher} />);

    await waitFor(() => expect(screen.getByTestId('appraise-failed')).toBeInTheDocument());
    expect(screen.queryByTestId('appraise-verdict')).not.toBeInTheDocument();
  });

  it('reopen determinism: re-mounting with the same modelId+rates renders the same result', async () => {
    const modelFetcher = vi.fn().mockResolvedValue(REAL_RESPONSE);
    const { unmount } = render(
      <InvestmentAppraisalPanel
        modelId="model-atelier"
        discountRatePct={10}
        modelFetcher={modelFetcher}
      />
    );
    await waitFor(() => expect(screen.getByTestId('appraise-verdict')).toBeInTheDocument());
    const firstNpvText = screen.getByTestId('appraise-npv').textContent;
    unmount();

    render(
      <InvestmentAppraisalPanel
        modelId="model-atelier"
        discountRatePct={10}
        modelFetcher={modelFetcher}
      />
    );
    await waitFor(() => expect(screen.getByTestId('appraise-verdict')).toBeInTheDocument());
    expect(screen.getByTestId('appraise-npv').textContent).toBe(firstNpvText);
    expect(modelFetcher).toHaveBeenCalledTimes(2);
  });

  it('standalone mode (no modelId) is unchanged — calculator controls still present, no auto-fetch', () => {
    const modelFetcher = vi.fn();
    render(<InvestmentAppraisalPanel modelFetcher={modelFetcher} />);

    expect(modelFetcher).not.toHaveBeenCalled();
    expect(screen.getByTestId('appraise-compute')).toBeInTheDocument();
    expect(screen.getByTestId('appraise-cashflows')).toBeInTheDocument();
  });
});

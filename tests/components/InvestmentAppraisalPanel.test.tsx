/**
 * @vitest-environment jsdom
 *
 * M16/7.1 — Investment Appraisal panel: edits cash flows, computes metrics +
 * verdict via an injected fetcher, fails soft on error.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import InvestmentAppraisalPanel, {
  AppraisalResult,
} from '../../src/components/Economics/panels/InvestmentAppraisalPanel';

const goResult: AppraisalResult = {
  npv: 267,
  irr: 21.9,
  mirr: 15.3,
  payback: 2.5,
  discountedPayback: 3.1,
  pi: 1.27,
  verdict: 'go',
};

describe('InvestmentAppraisalPanel', () => {
  it('renders the panel shell with header and default cash flows', () => {
    render(<InvestmentAppraisalPanel />);
    expect(screen.getByTestId('investment-appraisal-panel')).toBeTruthy();
    expect(screen.getByText('Analiza inwestycyjna (NPV/IRR/payback)')).toBeTruthy();
    // default example [-1000, 400, 400, 400, 400] → 5 inputs
    const cashflows = screen.getByTestId('appraise-cashflows');
    expect(cashflows.querySelectorAll('input').length).toBe(5);
  });

  it('computes metrics and shows the verdict after clicking Oblicz', async () => {
    const fetcher = vi.fn().mockResolvedValue(goResult);
    render(<InvestmentAppraisalPanel fetcher={fetcher} />);

    fireEvent.click(screen.getByTestId('appraise-compute'));

    await waitFor(() => expect(screen.getByTestId('appraise-metrics')).toBeTruthy());

    expect(fetcher).toHaveBeenCalledTimes(1);
    const req = fetcher.mock.calls[0][0];
    expect(req.cashFlows).toEqual([-1000, 400, 400, 400, 400]);
    expect(req.discountRate).toBe(10);

    // verdict badge
    const verdict = screen.getByTestId('appraise-verdict');
    expect(verdict.textContent).toContain('go');
    // NPV tile rendered
    expect(screen.getByTestId('appraise-npv').textContent).toContain('NPV');
    // metrics present
    expect(screen.getByText('IRR')).toBeTruthy();
    expect(screen.getByText('MIRR')).toBeTruthy();
    expect(screen.getByText('PI')).toBeTruthy();
  });

  it('honors initialCashFlows and discountRatePct props in the request', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ...goResult, verdict: 'no-go' as const });
    render(
      <InvestmentAppraisalPanel
        initialCashFlows={[-500, 100, 100]}
        discountRatePct={12}
        fetcher={fetcher}
      />,
    );

    fireEvent.click(screen.getByTestId('appraise-compute'));
    await waitFor(() => expect(fetcher).toHaveBeenCalled());

    const req = fetcher.mock.calls[0][0];
    expect(req.cashFlows).toEqual([-500, 100, 100]);
    expect(req.discountRate).toBe(12);
    expect(req.hurdleRatePct).toBe(12);
  });

  it('fails soft when the fetcher rejects', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('boom'));
    render(<InvestmentAppraisalPanel fetcher={fetcher} />);

    fireEvent.click(screen.getByTestId('appraise-compute'));

    await waitFor(() => expect(screen.getByTestId('appraise-failed')).toBeTruthy());
    // panel still present, no metrics/verdict
    expect(screen.getByTestId('investment-appraisal-panel')).toBeTruthy();
    expect(screen.queryByTestId('appraise-verdict')).toBeNull();
  });
});

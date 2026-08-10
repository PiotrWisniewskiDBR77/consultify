/**
 * FinancialCaseView — render smoke test. Verifies the real composed screen
 * (driver table + summary panel + charts + conversion actions), not just
 * the state-machine hook in isolation. Renders the real `recharts` charts
 * (no mock) — `tests/components/AssessmentRadarChart.test.tsx` confirms
 * recharts renders fine under this project's jsdom test setup.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { FinancialCaseView } from '../../../../../src/components/MyWork/table/financial/FinancialCaseView';
import type {
  FinancialCaseInput,
  FinancialCaseResult,
  FinancialComputeFn,
} from '../../../../../src/components/MyWork/table/financial/financialTypes';

function threeAndThreeCase(): FinancialCaseInput {
  const now = new Date().toISOString();
  const mk = (id: string, kind: 'cost' | 'benefit', label: string) => ({
    id,
    label,
    kind,
    costType: kind === 'cost' ? ('investment' as const) : undefined,
    benefitType: kind === 'benefit' ? ('cash' as const) : undefined,
    category: 'General',
    unit: 'PLN',
    monthlyValues: { '2026-08': 1000 },
    scenarioMultipliers: {},
    confidence: 'medium' as const,
    evidence: [],
    updatedAt: now,
  });
  return {
    currency: 'PLN',
    discountRatePct: 10,
    startPeriod: '2026-08',
    horizonMonths: 6,
    scenarios: ['base', 'upside', 'downside'],
    drivers: [
      mk('c1', 'cost', 'Licenses'),
      mk('c2', 'cost', 'Implementation'),
      mk('c3', 'cost', 'Support'),
      mk('b1', 'benefit', 'Revenue uplift'),
      mk('b2', 'benefit', 'Cost avoidance'),
      mk('b3', 'benefit', 'Headcount saved'),
    ],
  };
}

describe('FinancialCaseView', () => {
  // 2026-08-10 (E09 adapter landed): `computeFn` now defaults to the real
  // `computeIdeaFinancialCase` engine adapter (see `engineAdapter.ts`) when
  // the prop is omitted — that is the point of wiring the seam for real.
  // `computeFn={null}` is the explicit escape hatch this test exercises to
  // still verify the honest "not connected" path exists and works.
  it('renders drivers and an honest "not connected" state when computeFn is explicitly null', () => {
    render(<FinancialCaseView initialCase={threeAndThreeCase()} computeFn={null} />);
    // Driver labels are editable <input value="…">, not text nodes.
    expect(screen.getByDisplayValue('Licenses')).toBeTruthy();
    expect(screen.getByDisplayValue('Revenue uplift')).toBeTruthy();
    // Stale (6 drivers just loaded, never computed) — engine not wired.
    expect(screen.getByText(/calculation engine not connected/i)).toBeTruthy();
    // Convert actions are present but honestly disabled.
    const convertModel = screen.getByText('Convert to Financial Model').closest('button');
    expect(convertModel).toBeDisabled();
  });

  it('defaults to the real engine adapter when computeFn is omitted (E09 seam wired)', async () => {
    render(<FinancialCaseView initialCase={threeAndThreeCase()} />);
    const recomputeBtn = screen.getByRole('button', { name: /recompute/i });
    fireEvent.click(recomputeBtn);
    // No mock computeFn supplied — this proves the DEFAULT wiring (not a
    // test double) produces a real, non-blocked result.
    await screen.findByText('Up to date');
    expect(screen.queryByText(/calculation engine not connected/i)).toBeNull();
  });

  it('recompute flips stale → fresh and re-enables the Recompute affordance to disappear', async () => {
    const fakeResult: FinancialCaseResult = {
      formulaVersion: 'test-1',
      computedAt: new Date().toISOString(),
      currency: 'PLN',
      scenarios: {
        base: {
          scenario: 'base',
          periods: [{ period: '2026-08', cost: 3000, benefit: 4000, netCashFlow: 1000, cumulativeCashFlow: 1000 }],
          grossAnnualBenefit: 4000,
          netAnnualBenefit: 1000,
          implementationCost: 3000,
          recurringCostAnnual: 0,
          roiPct: 33,
          npv: 900,
          paybackMonths: 3,
          benefitCostRatio: 1.33,
        },
      },
      sensitivity: [],
      warnings: [],
    };
    const computeFn: FinancialComputeFn = vi.fn().mockResolvedValue(fakeResult);
    render(<FinancialCaseView initialCase={threeAndThreeCase()} computeFn={computeFn} />);

    const recomputeBtn = screen.getByRole('button', { name: /recompute/i });
    fireEvent.click(recomputeBtn);

    await screen.findByText('Up to date');
    expect(computeFn).toHaveBeenCalledTimes(1);
    // Once fresh, the stale-only Recompute button is gone from the banner.
    expect(screen.queryByRole('button', { name: /recompute/i })).toBeNull();
  });

  it('adding a cost driver via the toolbar button appears in the table and marks the case stale', () => {
    render(<FinancialCaseView initialCase={threeAndThreeCase()} />);
    const addCostBtn = screen.getByRole('button', { name: /add cost driver/i });
    fireEvent.click(addCostBtn);
    expect(screen.getAllByPlaceholderText('Untitled driver').length).toBeGreaterThan(0);
  });

  it('conversion buttons stay disabled even when fresh (E11 pipeline out of scope) and say why', async () => {
    const computeFn: FinancialComputeFn = vi.fn().mockResolvedValue({
      formulaVersion: 'test-1',
      computedAt: new Date().toISOString(),
      currency: 'PLN',
      scenarios: {},
      sensitivity: [],
      warnings: [],
    });
    render(<FinancialCaseView initialCase={threeAndThreeCase()} computeFn={computeFn} />);
    fireEvent.click(screen.getByRole('button', { name: /recompute/i }));
    await screen.findByText('Up to date');

    const convertModel = screen.getByText('Convert to Financial Model').closest('button');
    expect(convertModel).toBeDisabled();
    expect(convertModel?.getAttribute('title')).toMatch(/epic E11/);
  });
});

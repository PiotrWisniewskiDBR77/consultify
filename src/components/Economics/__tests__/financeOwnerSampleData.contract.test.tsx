import { render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { isFinanceOwnerReviewModeEnabled } from '@/utils/financeOwnerReviewMode';
import { FinanceSampleDataBanner } from '../FinanceSampleDataBanner';
import {
  FINANCE_OWNER_SAMPLE_ANALYSES,
  FINANCE_OWNER_SAMPLE_MODELS,
  FINANCE_OWNER_SAMPLE_STATEMENTS,
  FINANCE_OWNER_SAMPLE_VALUATIONS,
  isFinanceOwnerSampleDataEnabled,
} from '../financeOwnerSampleData';

describe('Finance owner-review sample-data honesty', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is opt-in and remains disabled without the explicit query', () => {
    expect(isFinanceOwnerSampleDataEnabled({ search: '', hostname: 'demo.consultify.ai' })).toBe(
      false
    );
    expect(
      isFinanceOwnerSampleDataEnabled({
        search: '?sampleData=finance-vnext',
        hostname: 'demo.consultify.ai',
      })
    ).toBe(true);
  });

  it('fails closed for sample data on public production', () => {
    expect(
      isFinanceOwnerSampleDataEnabled({
        search: '?sampleData=finance-vnext',
        hostname: 'www.consultify.ai',
      })
    ).toBe(false);
  });

  it('fails closed for the aggregate Finance review flag on public production', () => {
    vi.stubGlobal('window', {
      location: { search: '?ff_wave3FinanceOwnerReview=1', hostname: 'consultify.ai' },
      localStorage: { getItem: vi.fn(() => '1'), setItem: vi.fn() },
    });
    expect(isFinanceOwnerReviewModeEnabled()).toBe(false);
  });

  it('renders the banner only for explicit sample mode', () => {
    const { rerender } = render(<FinanceSampleDataBanner enabled={false} />);
    expect(screen.queryByTestId('finance-sample-data-banner')).not.toBeInTheDocument();
    rerender(<FinanceSampleDataBanner enabled />);
    expect(screen.getByTestId('finance-sample-data-banner')).toHaveTextContent(
      'Sample data — not from the database'
    );
  });

  it('freezes the sample record denominator', () => {
    expect({
      statements: FINANCE_OWNER_SAMPLE_STATEMENTS.length,
      models: FINANCE_OWNER_SAMPLE_MODELS.length,
      analyses: FINANCE_OWNER_SAMPLE_ANALYSES.length,
      valuations: FINANCE_OWNER_SAMPLE_VALUATIONS.length,
    }).toEqual({ statements: 1, models: 2, analyses: 2, valuations: 1 });
  });
});

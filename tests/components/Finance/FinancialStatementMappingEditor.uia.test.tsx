/** @vitest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
    i18n: { language: 'pl' },
  }),
}));

import {
  FinancialStatementMappingEditor,
  isFinancialStatementValueVerified,
} from '../../../src/components/Finance/FinancialStatementMappingEditor';

describe('FinancialStatementMappingEditor acceptance states', () => {
  it('counts user, system, and unverified rows with the exact editor predicate', () => {
    expect(
      [
        { canonicalLineId: 'a', confidence: 0.2, mappingTier: 'review_required' as const, userVerified: true },
        { canonicalLineId: 'b', confidence: 0.85, mappingTier: 'auto' as const, userVerified: false },
        { canonicalLineId: 'c', confidence: 0.99, mappingTier: 'review_required' as const, userVerified: false },
        { canonicalLineId: null, confidence: 0.99, mappingTier: 'auto' as const, userVerified: true },
      ].map(isFinancialStatementValueVerified)
    ).toEqual([true, true, false, false]);
  });
  it('keeps algorithm confidence while rendering PL numbers and explicit user verification', () => {
    const onCanonicalChange = vi.fn();
    const onVerifiedChange = vi.fn();
    render(
      <FinancialStatementMappingEditor
        mappedValues={[
          {
            originalLabel: 'Przychody netto',
            value: 1234567.89,
            confidence: 0.73,
            canonicalLineId: 'revenue',
            canonicalLabel: 'Przychody',
            mappingStatus: 'manual',
            mappingTier: 'review_required',
            userVerified: false,
          },
        ]}
        canonicalLines={[{ id: 'revenue', line_name: 'Revenue', line_name_pl: 'Przychody' }]}
        onValueChange={vi.fn()}
        onCanonicalChange={onCanonicalChange}
        onVerifiedChange={onVerifiedChange}
      />
    );
    expect(screen.getByRole('button', { name: /Edit Przychody netto value/ })).toHaveTextContent(
      /1.234.567,89|1\s234\s567,89/
    );
    expect(screen.getByText('73%')).toBeInTheDocument();
    expect(screen.getByText('review')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Przychody netto: Verify extracted value'));
    expect(onVerifiedChange).toHaveBeenCalledWith(0, true);
    expect(onCanonicalChange).not.toHaveBeenCalled();
  });

  it('distinguishes system verification and lets the user verify every eligible reviewed row', () => {
    const onVerifiedChange = vi.fn();
    const onVerifyAllReady = vi.fn();
    render(
      <FinancialStatementMappingEditor
        mappedValues={[
          {
            originalLabel: 'Przychody',
            value: 100,
            confidence: 0.9,
            canonicalLineId: 'revenue',
            mappingStatus: 'auto',
            mappingTier: 'auto',
          },
          {
            originalLabel: 'Koszty pozostałe',
            value: 20,
            confidence: 0.6,
            canonicalLineId: 'other-costs',
            mappingStatus: 'manual',
            mappingTier: 'review_required',
          },
          {
            originalLabel: 'Nieznana pozycja',
            value: 5,
            confidence: 0.4,
            canonicalLineId: null,
            mappingStatus: 'unmapped',
            mappingTier: 'review_required',
          },
        ]}
        canonicalLines={[
          { id: 'revenue', line_name: 'Revenue', line_name_pl: 'Przychody' },
          { id: 'other-costs', line_name: 'Other costs', line_name_pl: 'Koszty pozostałe' },
        ]}
        onValueChange={vi.fn()}
        onCanonicalChange={vi.fn()}
        onVerifiedChange={onVerifiedChange}
        onVerifyAllReady={onVerifyAllReady}
      />
    );

    expect(screen.getByLabelText('Przychody: System verified')).toBeChecked();
    expect(
      screen.getByLabelText(
        'Nieznana pozycja: Select a target category before verification'
      )
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Verify all eligible extracted values' }));
    expect(onVerifyAllReady).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByLabelText('Koszty pozostałe: Verify extracted value'));
    expect(onVerifiedChange).toHaveBeenCalledWith(1, true);
  });

  it('requires an explicit owner action before applying a reasoned exclusion suggestion', () => {
    const onExcludeAllSuggested = vi.fn();
    const onExcludeChange = vi.fn();
    render(
      <FinancialStatementMappingEditor
        mappedValues={[
          {
            originalLabel: 'Szczegół pokryty sumą',
            value: 25,
            confidence: 0.6,
            canonicalLineId: null,
            mappingStatus: 'unmapped',
            mappingTier: 'review_required',
            suggestedExclusionReason: 'DETAIL_COVERED_BY_CANONICAL_TOTAL',
          },
        ]}
        canonicalLines={[]}
        onValueChange={vi.fn()}
        onCanonicalChange={vi.fn()}
        onExcludeChange={onExcludeChange}
        onExcludeAllSuggested={onExcludeAllSuggested}
      />
    );

    expect(screen.getByText('Szczegół pokryty sumą')).not.toHaveTextContent('non-fin');
    fireEvent.click(screen.getByRole('button', { name: /Review and exclude suggested/ }));
    expect(onExcludeAllSuggested).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Exclude with reason' }));
    expect(onExcludeChange).toHaveBeenCalledWith(
      0,
      true,
      'DETAIL_COVERED_BY_CANONICAL_TOTAL'
    );
  });
});

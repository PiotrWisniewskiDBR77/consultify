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

import { FinancialStatementMappingEditor } from '../../../src/components/Finance/FinancialStatementMappingEditor';

describe('FinancialStatementMappingEditor acceptance states', () => {
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
    expect(screen.getByLabelText('Nieznana pozycja: Verify extracted value')).toBeEnabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Verify all eligible extracted values' }));
    expect(onVerifyAllReady).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByLabelText('Koszty pozostałe: Verify extracted value'));
    expect(onVerifiedChange).toHaveBeenCalledWith(1, true);
  });
});

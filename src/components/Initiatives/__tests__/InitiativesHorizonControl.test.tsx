/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  getInitiativesHorizonGranularity,
  InitiativesHorizonControl,
} from '../InitiativesHorizonControl';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string, values?: { count?: number }) =>
      fallback.replace('{{count}}', String(values?.count ?? '')),
  }),
}));

describe('F2-1 E1 shared initiative horizon', () => {
  it('offers exactly 1/3/6/12 months and reports the selected value', () => {
    const onChange = vi.fn();
    render(<InitiativesHorizonControl value={3} onChange={onChange} />);
    const choices = screen.getAllByRole('radio');
    expect(choices.map((choice) => choice.textContent)).toEqual(['1 mo', '3 mo', '6 mo', '12 mo']);
    expect(choices.map((choice) => choice.getAttribute('aria-checked'))).toEqual([
      'false',
      'true',
      'false',
      'false',
    ]);
    fireEvent.click(screen.getByRole('radio', { name: '12 mo' }));
    expect(onChange).toHaveBeenCalledWith(12);
  });

  it('uses weeks for 1/3 months and months for 6/12 months', () => {
    expect([1, 3].map(getInitiativesHorizonGranularity)).toEqual(['week', 'week']);
    expect([6, 12].map(getInitiativesHorizonGranularity)).toEqual(['month', 'month']);
  });
});

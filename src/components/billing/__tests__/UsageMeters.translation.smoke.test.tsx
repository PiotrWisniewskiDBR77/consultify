/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string, values?: { date?: string }) =>
      fallback.replace('{{date}}', values?.date ?? ''),
  }),
}));

import { UsageMeters } from '../UsageMeters';

describe('UsageMeters translation smoke', () => {
  it('renders the translated period end without an undeclared t reference', () => {
    render(
      <UsageMeters
        usage={{
          tokens: { used: 10, limit: 100, remaining: 90, percentage: 10 },
          storage: { usedGB: 1, limitGB: 5, percentage: 20 },
          plan: 'Free',
          periodEnd: '2026-09-01T00:00:00.000Z',
        }}
      />
    );

    expect(screen.getByText(/Limit odnowi się/)).toBeTruthy();
    expect(screen.getByText(/0?1\.0?9\.2026/)).toBeTruthy();
  });
});

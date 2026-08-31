/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { UsageMeters } from '../UsageMeters';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string, values?: Record<string, string>) =>
      Object.entries(values ?? {}).reduce(
        (text, [name, value]) => text.replace(`{{${name}}}`, value),
        fallback
      ),
  }),
}));

describe('day176 UsageMeters period end', () => {
  it('renders the unchanged Polish reset message with the formatted periodEnd date', () => {
    render(
      <UsageMeters
        usage={{
          tokens: { used: 100, limit: 1000, remaining: 900, percentage: 10 },
          storage: { usedGB: 1, limitGB: 5, percentage: 20 },
          plan: 'Free',
          periodEnd: '2026-09-15T12:00:00.000Z',
        }}
      />
    );

    expect(screen.getByText('Limit odnowi się 15.09.2026')).toBeInTheDocument();
  });
});

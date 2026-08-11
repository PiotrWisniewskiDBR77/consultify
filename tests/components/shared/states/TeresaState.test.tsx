/**
 * TeresaUnavailableNotice — sixth member of the write-state vocabulary
 * (tor PLATFORMY, punkt zakresu 4). Rules being locked in:
 *   - always announces politely (`status`/`polite`), never `alert` — this is
 *     a degradation, not an error the user caused
 *   - retry is offered ONLY when the caller provides `onRetry`
 *   - `compact` drops the explanatory sentence but keeps the title
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: Record<string, unknown>) => {
      const raw = (opts?.defaultValue as string) ?? _key;
      return raw.replace(/\{\{(\w+)\}\}/g, (m, k) => (opts?.[k] != null ? String(opts[k]) : m));
    },
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));

import { TeresaUnavailableNotice } from '../../../../src/components/shared/states/TeresaState';

describe('TeresaUnavailableNotice', () => {
  it('announces the degradation politely, not as an alert', () => {
    render(<TeresaUnavailableNotice />);
    const el = screen.getByRole('status');
    expect(el).toHaveAttribute('aria-live', 'polite');
    expect(el).toHaveAttribute('data-state', 'teresa-unavailable');
  });

  it('states that the manual workflow is not blocked', () => {
    render(<TeresaUnavailableNotice />);
    expect(screen.getByText('Teresa is unavailable')).toBeInTheDocument();
    expect(screen.getByText(/keep working manually/i)).toBeInTheDocument();
  });

  it('offers retry only when the caller provides onRetry', () => {
    const { rerender } = render(<TeresaUnavailableNotice />);
    expect(screen.queryByText('Try again')).not.toBeInTheDocument();
    const onRetry = vi.fn();
    rerender(<TeresaUnavailableNotice onRetry={onRetry} />);
    expect(screen.getByText('Try again')).toBeInTheDocument();
  });

  it('compact mode keeps the title but drops the explanatory sentence', () => {
    render(<TeresaUnavailableNotice compact />);
    expect(screen.getByText('Teresa is unavailable')).toBeInTheDocument();
    expect(screen.queryByText(/keep working manually/i)).not.toBeInTheDocument();
  });

  it('accepts an override description', () => {
    render(<TeresaUnavailableNotice description="Custom manual-path sentence" />);
    expect(screen.getByText('Custom manual-path sentence')).toBeInTheDocument();
  });
});

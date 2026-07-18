/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { HubWorkAreaLoading } from '../../../../src/components/shared/ModuleHub/HubWorkAreaLoading';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key)),
    i18n: { language: 'en' },
  }),
}));

describe('HubWorkAreaLoading', () => {
  it('renders a status region with shared loading label', () => {
    render(<HubWorkAreaLoading />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('honors custom root className', () => {
    render(<HubWorkAreaLoading className="hub-work-area-loading--test" />);
    expect(screen.getByRole('status')).toHaveClass('hub-work-area-loading--test');
  });
});

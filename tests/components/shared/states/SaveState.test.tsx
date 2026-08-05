/**
 * SaveStateIndicator / ConflictBanner — the write half of UI-STATE-01 (M02-011).
 *
 * The rules being locked in:
 *   - `idle` renders nothing (callers mount it unconditionally)
 *   - retry is offered ONLY for a retryable failure
 *   - a conflict offers reload-latest and never a blind retry
 *   - a forbidden write offers neither
 *   - the status is machine-readable so evidence capture can assert a state
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

import {
  ConflictBanner,
  SaveStateIndicator,
} from '../../../../src/components/shared/states/SaveState';

describe('SaveStateIndicator', () => {
  it('renders nothing while idle', () => {
    const { container } = render(<SaveStateIndicator status="idle" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('exposes the status as a data attribute for evidence capture', () => {
    render(<SaveStateIndicator status="saving" />);
    expect(document.querySelector('[data-save-status="saving"]')).toBeInTheDocument();
  });

  it('offers retry only for a retryable failure', () => {
    const onRetry = vi.fn();
    const onReload = vi.fn();
    render(<SaveStateIndicator status="error" onRetry={onRetry} onReload={onReload} />);
    expect(screen.getByText('Try again')).toBeInTheDocument();
    expect(screen.queryByText('Load latest')).not.toBeInTheDocument();
  });

  it('offers reload — never a blind retry — on a conflict', () => {
    const onRetry = vi.fn();
    const onReload = vi.fn();
    render(<SaveStateIndicator status="conflict" onRetry={onRetry} onReload={onReload} />);
    expect(screen.getByText('Load latest')).toBeInTheDocument();
    expect(screen.queryByText('Try again')).not.toBeInTheDocument();
  });

  it('offers no escape hatch for a forbidden write', () => {
    const onRetry = vi.fn();
    const onReload = vi.fn();
    render(<SaveStateIndicator status="forbidden" onRetry={onRetry} onReload={onReload} />);
    expect(screen.getByText('Not permitted')).toBeInTheDocument();
    expect(screen.queryByText('Try again')).not.toBeInTheDocument();
    expect(screen.queryByText('Load latest')).not.toBeInTheDocument();
  });

  it('states WHEN the value was last read back, not just that it saved', () => {
    render(<SaveStateIndicator status="saved" savedAt={new Date('2026-08-04T21:54:00Z')} />);
    expect(screen.getByText(/^Saved /)).toBeInTheDocument();
  });

  it('announces problems assertively and progress politely', () => {
    const { rerender } = render(<SaveStateIndicator status="saving" />);
    expect(document.querySelector('[data-save-status]')).toHaveAttribute('aria-live', 'polite');
    rerender(<SaveStateIndicator status="error" />);
    expect(document.querySelector('[data-save-status]')).toHaveAttribute('aria-live', 'assertive');
  });
});

describe('ConflictBanner', () => {
  it('offers exactly one exit: load the latest', () => {
    render(<ConflictBanner onReload={vi.fn()} />);
    expect(screen.getByText('This was changed somewhere else')).toBeInTheDocument();
    expect(screen.getByText('Load latest')).toBeInTheDocument();
    // No "overwrite anyway" — a shared shell cannot know if clobbering is safe.
    expect(screen.queryByText(/overwrite/i)).not.toBeInTheDocument();
  });
});

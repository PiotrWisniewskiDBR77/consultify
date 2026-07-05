/**
 * @vitest-environment jsdom
 *
 * Shared systemic state components (VEGAS V7.1):
 *   src/components/shared/states/{EmptyState,LoadingState}
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { Lightbulb } from 'lucide-react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { EmptyState, LoadingState } from '../../../src/components/shared/states';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));

// framer-motion → plain div so we can assert without animation noise.
vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get:
        () =>
        ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
          // Strip motion-only props that React would warn about.
          const {
            initial: _i,
            animate: _a,
            transition: _tr,
            exit: _e,
            ...rest
          } = props as Record<string, unknown>;
          return <div {...rest}>{children}</div>;
        },
    }
  ),
}));

describe('EmptyState', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders title and description', () => {
    render(<EmptyState variant="new" title="No ideas yet" description="Capture your first idea." />);
    expect(screen.getByText('No ideas yet')).toBeTruthy();
    expect(screen.getByText('Capture your first idea.')).toBeTruthy();
  });

  it('fires the primary CTA', () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        variant="new"
        title="No ideas yet"
        primaryAction={{ label: 'New idea', onClick, icon: Lightbulb }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /New idea/ }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders both primary and secondary actions', () => {
    const primary = vi.fn();
    const secondary = vi.fn();
    render(
      <EmptyState
        variant="filter"
        title="Nothing matches"
        primaryAction={{ label: 'Clear filters', onClick: primary }}
        secondaryAction={{ label: 'Reset all', onClick: secondary }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reset all' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(secondary).toHaveBeenCalledTimes(1);
    expect(primary).toHaveBeenCalledTimes(1);
  });

  it('error variant renders role=alert and a Retry button wired to onRetry', () => {
    const onRetry = vi.fn();
    render(<EmptyState variant="error" title="Could not load" onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('forbidden variant renders as a polite status (not alert) with no CTA by default', () => {
    render(<EmptyState variant="forbidden" title="No access" />);
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('LoadingState', () => {
  it('renders a status region for the list template', () => {
    const { container } = render(<LoadingState template="list" rows={3} />);
    expect(screen.getByRole('status')).toBeTruthy();
    // 3 rows rendered.
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThanOrEqual(3);
  });

  it('renders the card template grid', () => {
    const { container } = render(<LoadingState template="card" count={4} />);
    expect(container.querySelector('.grid')).toBeTruthy();
  });

  it('renders the panel template', () => {
    render(<LoadingState template="panel" />);
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('progress variant shows the named label', () => {
    render(<LoadingState variant="progress" label="Generating presentation…" />);
    expect(screen.getByText('Generating presentation…')).toBeTruthy();
  });

  it('falls back to a translated default label when none is given', () => {
    render(<LoadingState variant="progress" />);
    // i18n mock returns defaultValue "Loading…"
    expect(screen.getByText('Loading…')).toBeTruthy();
  });
});

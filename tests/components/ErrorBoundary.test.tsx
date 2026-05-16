/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ErrorBoundary } from '../../src/components/ErrorBoundary';

const Thrower = ({ message = 'Kaboom' }: { message?: string }) => {
  throw new Error(message);
};

describe('ErrorBoundary', () => {
  const user = userEvent.setup();
  const originalFetch = window.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    window.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 })) as typeof fetch;
  });

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>OK</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('OK')).toBeInTheDocument();
  });

  it('renders fallback UI and resets app data', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    window.localStorage.setItem('__test_key__', '1');

    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, href: 'http://localhost/' },
      writable: true,
    });

    render(
      <ErrorBoundary>
        <Thrower message="Boom" />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Boom')).toBeInTheDocument();

    await user.click(screen.getByText('Reset Application Data (Fix)'));
    expect(window.localStorage.getItem('__test_key__')).toBeNull();
    expect(window.location.href).toBe('/');

    consoleSpy.mockRestore();
  });

  it('shows telemetry failed hint when crash report upload fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    window.fetch = vi.fn().mockRejectedValue(new Error('network'));

    render(
      <ErrorBoundary>
        <Thrower message="Boom telemetry fail" />
      </ErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByTestId('error-boundary-telemetry-failed')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('error-boundary-telemetry-sent')).not.toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('shows telemetry unavailable hint when fetch is not present', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    Object.defineProperty(window, 'fetch', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    render(
      <ErrorBoundary>
        <Thrower message="Boom no fetch" />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('error-boundary-telemetry-unavailable')).toBeInTheDocument();
    consoleSpy.mockRestore();
    Object.defineProperty(window, 'fetch', {
      value: originalFetch,
      writable: true,
      configurable: true,
    });
  });
});

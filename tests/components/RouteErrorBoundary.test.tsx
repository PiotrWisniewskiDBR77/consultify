/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';

const Thrower = ({ message = 'Route crash' }: { message?: string }) => {
  throw new Error(message);
};

describe('RouteErrorBoundary telemetry delivery honesty', () => {
  it('shows sent state when crash telemetry upload succeeds', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 })) as typeof fetch;

    render(
      <RouteErrorBoundary>
        <Thrower message="boom sent" />
      </RouteErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByTestId('route-error-boundary-telemetry-sent')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('route-error-boundary-telemetry-failed')).not.toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('shows failed state when telemetry endpoint returns non-ok response', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 500 })) as typeof fetch;

    render(
      <RouteErrorBoundary>
        <Thrower message="boom failed status" />
      </RouteErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByTestId('route-error-boundary-telemetry-failed')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('route-error-boundary-telemetry-sent')).not.toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('shows unavailable state when fetch is missing', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    Object.defineProperty(window, 'fetch', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    render(
      <RouteErrorBoundary>
        <Thrower message="boom no fetch" />
      </RouteErrorBoundary>
    );

    expect(screen.getByTestId('route-error-boundary-telemetry-unavailable')).toBeInTheDocument();
    consoleSpy.mockRestore();
  });
});

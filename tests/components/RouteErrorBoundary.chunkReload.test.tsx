/**
 * @vitest-environment jsdom
 *
 * Z-11 (2026-09-14) — RouteErrorBoundary side of the shared chunk-load
 * recovery mechanism (chunkLoadRecovery.ts), for a route whose own lazy
 * import fails (as opposed to MainLayout itself, covered by
 * ErrorBoundary.chunkReload.test.tsx).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import { RouteErrorBoundary } from '../../src/components/RouteErrorBoundary';

const ChunkThrower = () => {
  throw new Error('Importing a module script failed');
};

describe('RouteErrorBoundary — Z-11 chunk-load recovery', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.clearAllMocks();
    window.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 })) as typeof fetch;
  });

  it('reloads once on the first chunk-load failure this session', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reloadSpy = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, href: 'http://localhost/my-work', reload: reloadSpy },
      writable: true,
      configurable: true,
    });

    render(
      <RouteErrorBoundary>
        <ChunkThrower />
      </RouteErrorBoundary>
    );

    await waitFor(() => expect(reloadSpy).toHaveBeenCalledTimes(1));

    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
    consoleSpy.mockRestore();
  });

  it('shows the shared "new version, refresh" banner once already attempted this session', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reloadSpy = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, href: 'http://localhost/my-work', reload: reloadSpy },
      writable: true,
      configurable: true,
    });
    window.sessionStorage.setItem('consultify:chunk-reload-attempted:v1', '|http://localhost/my-work');

    render(
      <RouteErrorBoundary>
        <ChunkThrower />
      </RouteErrorBoundary>
    );

    expect(await screen.findByTestId('route-error-boundary-chunk-update-banner')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    expect(reloadSpy).not.toHaveBeenCalled();

    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
    consoleSpy.mockRestore();
  });
});

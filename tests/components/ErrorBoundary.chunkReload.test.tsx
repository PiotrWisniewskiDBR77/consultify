/**
 * @vitest-environment jsdom
 *
 * Z-11 (2026-09-14): karta otwarta przed wdrożeniem prosi o nieistniejący
 * chunk (`Failed to fetch dynamically imported module .../MainLayout-XXXX.js`).
 * `ErrorBoundary` wraps `MainLayout` (see routes/AppRoutes.tsx — MainLayout is
 * lazy-loaded ABOVE `RouteErrorBoundary`, so a chunk failure there previously
 * hit the generic "Something went wrong / Reset Application Data" screen with
 * no auto-reload at all). This test proves: first occurrence in a session ->
 * one automatic reload; second occurrence (reload already used, chunk still
 * missing) -> the "new version, refresh" banner, not the scary crash screen.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import { ErrorBoundary } from '../../src/components/ErrorBoundary';

const ChunkThrower = () => {
  throw new Error('Failed to fetch dynamically imported module https://demo.consultify.ai/assets/MainLayout-abc123.js');
};

describe('ErrorBoundary — Z-11 chunk-load recovery', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.clearAllMocks();
    window.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 })) as typeof fetch;
  });

  it('reloads exactly once on the first chunk-load failure this session', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reloadSpy = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, href: 'http://localhost/execution', reload: reloadSpy },
      writable: true,
      configurable: true,
    });

    render(
      <ErrorBoundary>
        <ChunkThrower />
      </ErrorBoundary>
    );

    // Pending state: no scary crash screen, no "Reset Application Data".
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    expect(screen.getByTestId('error-boundary-chunk-reload-pending')).toBeInTheDocument();

    await waitFor(() => expect(reloadSpy).toHaveBeenCalledTimes(1));

    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
    consoleSpy.mockRestore();
  });

  it('shows the "new version, refresh" banner instead of reloading again once already attempted', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reloadSpy = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, href: 'http://localhost/execution', reload: reloadSpy },
      writable: true,
      configurable: true,
    });

    // Simulate: the one automatic reload already happened this session for
    // this exact build+URL (e.g. this IS the reloaded page, and it still
    // throws because the deploy/CDN is still serving the stale index.html).
    window.sessionStorage.setItem(
      'consultify:chunk-reload-attempted:v1',
      '|http://localhost/execution'
    );

    render(
      <ErrorBoundary>
        <ChunkThrower />
      </ErrorBoundary>
    );

    expect(await screen.findByTestId('error-boundary-chunk-update-banner')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    // Must NOT auto-reload again — that would be an infinite loop.
    expect(reloadSpy).not.toHaveBeenCalled();

    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
    consoleSpy.mockRestore();
  });
});

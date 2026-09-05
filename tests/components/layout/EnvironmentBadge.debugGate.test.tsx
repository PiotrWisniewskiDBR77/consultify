/** @vitest-environment jsdom */

/**
 * 2026-09-05: EnvironmentBadge used to render for every ADMIN/SUPERADMIN
 * visitor on every screen — noise on otherwise clean MVP acceptance
 * screenshots. It now also requires local Vite dev, or an explicit
 * `?debug=1` opt-in (persisted in sessionStorage for the tab — see
 * `src/utils/debugOverlays.ts`). These tests exercise that gate in a
 * simulated production build (`import.meta.env.DEV` stubbed `false`),
 * which the existing `EnvironmentBadge.hitTarget.test.tsx` does not
 * cover (it runs under the always-`DEV=true` vitest default and pins a
 * single ADMIN mock at module scope).
 */

import { render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEBUG_OVERLAYS_SESSION_KEY } from '../../../src/utils/debugOverlays';

function mockRole(role: string | null) {
  vi.doMock('../../../src/store/useAppStore', () => ({
    useAppStore: (selector: (state: unknown) => unknown) =>
      selector({ currentUser: role ? { role } : null }),
  }));
}

async function renderBadge() {
  const { EnvironmentBadge } = await import('../../../src/components/layout/EnvironmentBadge');
  return render(<EnvironmentBadge />);
}

function setSearch(search: string) {
  // `tests/setup.ts` replaces `window.location` with a plain object
  // snapshot (to stub navigation methods), so it no longer tracks
  // `history.pushState` — mutate `.search` directly instead.
  (window.location as unknown as { search: string }).search = search;
}

describe('EnvironmentBadge debug gate (production build simulation)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('DEV', false as unknown as string);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    );
    window.sessionStorage.clear();
    setSearch('');
  });

  afterEach(() => {
    vi.doUnmock('../../../src/store/useAppStore');
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
    setSearch('');
  });

  it('stays hidden for an admin outside dev with no ?debug opt-in', async () => {
    mockRole('ADMIN');
    await renderBadge();
    expect(screen.queryByTestId('environment-badge')).not.toBeInTheDocument();
  });

  it('stays hidden for a non-admin even with ?debug=1', async () => {
    mockRole('USER');
    setSearch('?debug=1');
    await renderBadge();
    expect(screen.queryByTestId('environment-badge')).not.toBeInTheDocument();
  });

  it('shows for an admin with ?debug=1 and persists the opt-in in sessionStorage', async () => {
    mockRole('ADMIN');
    setSearch('?debug=1');
    await renderBadge();
    expect(await screen.findByTestId('environment-badge')).toBeInTheDocument();
    expect(window.sessionStorage.getItem(DEBUG_OVERLAYS_SESSION_KEY)).toBe('1');
  });

  it('keeps showing for an admin on a later render with no query param, once opted in', async () => {
    window.sessionStorage.setItem(DEBUG_OVERLAYS_SESSION_KEY, '1');
    mockRole('ADMIN');
    await renderBadge();
    expect(await screen.findByTestId('environment-badge')).toBeInTheDocument();
  });

  it('?debug=0 clears a standing opt-in and hides the badge again', async () => {
    window.sessionStorage.setItem(DEBUG_OVERLAYS_SESSION_KEY, '1');
    mockRole('ADMIN');
    setSearch('?debug=0');
    await renderBadge();
    expect(screen.queryByTestId('environment-badge')).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem(DEBUG_OVERLAYS_SESSION_KEY)).toBeNull();
  });
});

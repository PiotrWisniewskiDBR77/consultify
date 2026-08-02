/**
 * TLS-01 — the five Tools Hub surfaces (Library, Sessions, Outputs, Reports,
 * Initiatives) as a stable, routable `?tab=` query param.
 *
 * Mirrors the harness pattern from `tests/components/Discovery/useDocumentUrlSync.test.tsx`
 * (Codex's own fix for the sibling docId-sync hook): a tiny real-mounted
 * harness component using the REAL `useSurfaceUrlSync` hook inside a real
 * `MemoryRouter`, rather than mounting the full ~5200-line `DiscoveryToolsHub`.
 */
import { act, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import {
  normalizeSurfaceParam,
  useSurfaceUrlSync,
} from '@/components/Discovery/hooks/useSurfaceUrlSync';

const SURFACES = ['library', 'sessions', 'outputs', 'reports', 'initiatives'] as const;

function Harness() {
  const [activeTab, setActiveTab] = useState<string>('library');
  const location = useLocation();

  useSurfaceUrlSync({ hydrated: true, activeTab, setActiveTab, defaultTab: 'library' });

  return (
    <>
      <output data-testid="url">{location.search}</output>
      <output data-testid="active-tab">{activeTab}</output>
      {SURFACES.map((s) => (
        <button key={s} onClick={() => setActiveTab(s)}>
          go-{s}
        </button>
      ))}
    </>
  );
}

describe('useSurfaceUrlSync (TLS-01 five surfaces)', () => {
  it('normalizeSurfaceParam accepts only the five known surfaces, else falls back', () => {
    for (const s of SURFACES) {
      expect(normalizeSurfaceParam(s, 'library')).toBe(s);
    }
    expect(normalizeSurfaceParam('bogus', 'library')).toBe('library');
    expect(normalizeSurfaceParam(null, 'outputs')).toBe('outputs');
    expect(normalizeSurfaceParam('', 'outputs')).toBe('outputs');
  });

  it('deep-link with no prior Hub visit: a cold ?tab=reports URL activates Reports immediately', () => {
    render(
      <MemoryRouter initialEntries={['/discovery-tools?tab=reports']}>
        <Harness />
      </MemoryRouter>
    );
    // useLayoutEffect runs synchronously before paint -- no waitFor needed,
    // this proves there is no flash of the wrong (library) surface.
    expect(screen.getByTestId('active-tab')).toHaveTextContent('reports');
    expect(screen.getByTestId('url')).toHaveTextContent('?tab=reports');
  });

  it('deep-link works for all five surfaces, not just one', () => {
    for (const surface of SURFACES) {
      const { unmount } = render(
        <MemoryRouter initialEntries={[`/discovery-tools?tab=${surface}`]}>
          <Harness />
        </MemoryRouter>
      );
      expect(screen.getByTestId('active-tab')).toHaveTextContent(surface);
      unmount();
    }
  });

  it('an invalid/unknown ?tab= value falls back to the default surface, not a crash', () => {
    render(
      <MemoryRouter initialEntries={['/discovery-tools?tab=not-a-real-surface']}>
        <Harness />
      </MemoryRouter>
    );
    expect(screen.getByTestId('active-tab')).toHaveTextContent('library');
  });

  it('switching surfaces writes the URL (state -> URL, so hard reload / share preserves it)', () => {
    render(
      <MemoryRouter initialEntries={['/discovery-tools']}>
        <Harness />
      </MemoryRouter>
    );
    expect(screen.getByTestId('active-tab')).toHaveTextContent('library');
    expect(screen.getByTestId('url')).toHaveTextContent('');

    act(() => {
      screen.getByText('go-initiatives').click();
    });
    expect(screen.getByTestId('active-tab')).toHaveTextContent('initiatives');
    expect(screen.getByTestId('url')).toHaveTextContent('?tab=initiatives');
  });

  it('mounting directly on a non-default surface (equivalent to landing there via back/forward) applies it, same as any other URL-first mount', () => {
    // A genuine RTL simulation of browser back/forward (useNavigate()'s
    // delta/absolute navigation actually mutating `location.search` within
    // a MemoryRouter+act() cycle) was attempted here and does NOT resolve
    // in this repo's current jsdom/react-router-dom test environment --
    // confirmed with a hook-FREE diagnostic component (bare useNavigate()
    // + useLocation(), zero custom logic) that exhibited the identical
    // symptom (location.search never updates after navigate(-1) or an
    // absolute navigate() push, even awaited inside act() and polled with
    // waitFor up to 2s). This is a pre-existing environment limitation, not
    // a property of this hook -- it is verified live in a real browser as
    // part of this packet's browser-smoke evidence instead.
    //
    // What IS meaningfully provable here, and is the actual mechanism back/
    // forward relies on: the hook has no way to distinguish "how" `?tab=`
    // in the URL came to hold a given value -- deep link, reload, a typed
    // address, or history navigation are all just "the URL says X on this
    // render" to `useSurfaceUrlSync`. This case mounts DIRECTLY on the
    // second of two real history entries (rather than navigating there),
    // which is the exact same input shape the hook would see immediately
    // after a real back/forward hop resolves.
    render(
      <MemoryRouter
        initialEntries={['/discovery-tools?tab=outputs', '/discovery-tools?tab=reports']}
        initialIndex={1}
      >
        <Harness />
      </MemoryRouter>
    );
    expect(screen.getByTestId('active-tab')).toHaveTextContent('reports');
    expect(screen.getByTestId('url')).toHaveTextContent('?tab=reports');
  });

  it('hard reload (fresh mount reading the current URL) never resets to a different tab', () => {
    // A "hard reload" is modeled as a brand-new mount whose initial component
    // state is always the hook's own `defaultTab` (exactly what happens in
    // the real DiscoveryToolsHub: activeTab's useState always seeds from the
    // route-baked initialTab prop) -- the URL must still win.
    const { unmount } = render(
      <MemoryRouter initialEntries={['/discovery-tools?tab=initiatives']}>
        <Harness />
      </MemoryRouter>
    );
    expect(screen.getByTestId('active-tab')).toHaveTextContent('initiatives');
    unmount();

    // Simulate the reload landing on the exact same URL again.
    render(
      <MemoryRouter initialEntries={['/discovery-tools?tab=initiatives']}>
        <Harness />
      </MemoryRouter>
    );
    expect(screen.getByTestId('active-tab')).toHaveTextContent('initiatives');
  });
});

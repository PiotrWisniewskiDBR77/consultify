/**
 * @vitest-environment jsdom
 *
 * Regression test — Bramka 3 (Ustawienia, przekierowanie ciche):
 * RouterSync.tsx (~L330-344) redirects a pilot-restricted role away from any
 * `/settings/*` sub-path outside the pilot allowlist to
 * `getPilotDefaultSettingsRoute()` ('/settings/profile'). Unlike the
 * sibling gate at ~L316-328 (which calls `dispatchPilotAccessBlocked`, an
 * `access:blocked` CustomEvent carrying a user-facing message), this block
 * calls ONLY `navigate(...)` — no `dispatchPilotAccessBlocked` call and (as
 * measured on this branch) no `console.log` either. The redirect is silent:
 * nothing tells the user why the URL just changed. (Note: the task brief
 * that pointed here described "wyłącznie wpis do dziennika" (log entry
 * only); this branch's code has neither a log entry nor a user message in
 * this specific block — verified by reading the block directly, see below.)
 *
 * This test does not add a user message (explicitly out of scope — the
 * product behavior stays as-is per instruction). It only proves the
 * existing redirect keeps firing for the pilot role and does NOT fire for
 * the owner/admin role, so a future refactor can't silently drop it.
 *
 * `tests/setup.ts` globally stubs `react-router-dom`'s `useNavigate` and
 * `@/store/useAppStore` for other tests; both are overridden here via
 * per-file `vi.mock` (hoisted, so they win for this file) — mirroring
 * `RouterSync.pilotMeetings.test.tsx`'s established pattern — so we can spy
 * on real `navigate(...)` calls and control `currentUser.role` per test.
 *
 * Evidence pair:
 *  - "obcy nie widzi": pilot-restricted role (`USER`) on `/settings/webhooks`
 *    -> RouterSync calls navigate('/settings/profile', { replace: true }).
 *  - "wlasciciel widzi": admin role on the same `/settings/webhooks` -> no
 *    navigate call at all; the Webhooks stub stays mounted.
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RouterSync } from '../RouterSync';

const hoisted = vi.hoisted(() => {
  const navigateSpy = vi.fn();
  let mockCurrentUser: Record<string, unknown> | null = null;

  const buildStoreState = () => ({
    currentUser: mockCurrentUser,
    currentView: null,
    setCurrentViewState: vi.fn(),
    setMyWorkIntent: vi.fn(),
    setSessionMode: vi.fn(),
    setAuthInitialStep: vi.fn(),
  });

  const useAppStoreMock = (selector?: (state: ReturnType<typeof buildStoreState>) => unknown) => {
    const state = buildStoreState();
    return selector ? selector(state) : state;
  };

  return {
    navigateSpy,
    setMockCurrentUser: (user: Record<string, unknown> | null) => {
      mockCurrentUser = user;
    },
    useAppStoreMock,
  };
});

const { navigateSpy } = hoisted;

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => hoisted.navigateSpy,
  };
});

vi.mock('@/store/useAppStore', () => ({ useAppStore: hoisted.useAppStoreMock }));
vi.mock('../../store/useAppStore', () => ({ useAppStore: hoisted.useAppStoreMock }));

function makePilotUser() {
  return {
    id: 'u3-settings-pilot-v1',
    email: 'pilot@settings.local.test',
    role: 'USER',
    isAuthenticated: true,
  };
}

function makeOwnerUser() {
  return {
    id: 'u3-settings-owner-v1',
    email: 'owner@settings.local.test',
    role: 'ADMIN',
    isAuthenticated: true,
  };
}

function WebhooksStub() {
  return <div data-testid="settings-webhooks">Webhooks</div>;
}

function ProfileStub() {
  return <div data-testid="settings-profile">Profile</div>;
}

describe('RouterSync pilot silent settings redirect (regression, bramka 3)', () => {
  afterEach(() => {
    hoisted.setMockCurrentUser(null);
    navigateSpy.mockClear();
  });

  it('obcy nie widzi: pilot-restricted role on /settings/webhooks is redirected to /settings/profile', async () => {
    hoisted.setMockCurrentUser(makePilotUser());

    render(
      <MemoryRouter initialEntries={['/settings/webhooks']}>
        <RouterSync />
        <Routes>
          <Route path="/settings/webhooks" element={<WebhooksStub />} />
          <Route path="/settings/profile" element={<ProfileStub />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(navigateSpy).toHaveBeenCalledWith('/settings/profile', { replace: true });
    });
  });

  it('wlasciciel widzi: admin role on /settings/webhooks is not redirected', async () => {
    hoisted.setMockCurrentUser(makeOwnerUser());

    render(
      <MemoryRouter initialEntries={['/settings/webhooks']}>
        <RouterSync />
        <Routes>
          <Route path="/settings/webhooks" element={<WebhooksStub />} />
          <Route path="/settings/profile" element={<ProfileStub />} />
        </Routes>
      </MemoryRouter>
    );

    // Give RouterSync's effect a tick, then assert the negative + that the
    // originally-requested settings sub-page stayed mounted (own behavior
    // unchanged, no redirect fired at all).
    await waitFor(() => {
      expect(screen.getByTestId('settings-webhooks')).toBeInTheDocument();
    });
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});

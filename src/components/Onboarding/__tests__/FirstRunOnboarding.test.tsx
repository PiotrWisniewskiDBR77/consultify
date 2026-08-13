/**
 * @vitest-environment jsdom
 *
 * Tests for the X4 first-run onboarding flow (decision D22):
 *  - new user (no completed flag) sees the flow; existing user does not
 *  - full happy path: Welcome → Role → Sample → Start fresh navigates + persists
 *  - "Open the demo" wires to useDemo().toggleDemoMode
 *  - demo session never shows the flow
 *  - skip persists completion
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---- i18n: return the provided fallback (defaultValue) string ----------------
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: unknown, opts?: Record<string, unknown>) => {
      const base = typeof fallback === 'string' ? fallback : (_k as string);
      if (opts) {
        return base.replace(/\{\{(\w+)\}\}/g, (_m, name) => String(opts[name] ?? ''));
      }
      return base;
    },
  }),
}));

// ---- router navigate ---------------------------------------------------------
const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

// ---- app store: control currentUser + demo mode -----------------------------
const { storeState } = vi.hoisted(() => ({
  storeState: { currentUser: { id: 'user-1' } as { id: string } | undefined, isDemoMode: false },
}));
vi.mock('../../../store/useAppStore', () => ({
  useAppStore: (selector: (s: typeof storeState) => unknown) => selector(storeState),
}));

// ---- demo hook ---------------------------------------------------------------
const { toggleDemoMode } = vi.hoisted(() => ({ toggleDemoMode: vi.fn() }));
vi.mock('../../../hooks/useDemo', () => ({
  useDemo: () => ({ toggleDemoMode, isDemoLoading: false }),
}));

// ---- API ---------------------------------------------------------------------
const { getFirstRunState, setFirstRunRole, markFirstRunComplete, resetFirstRun } = vi.hoisted(
  () => ({
    getFirstRunState: vi.fn(),
    setFirstRunRole: vi.fn(),
    markFirstRunComplete: vi.fn(),
    resetFirstRun: vi.fn(),
  })
);
vi.mock('../../../services/api', () => ({
  Api: {
    onboarding: { getFirstRunState, setFirstRunRole, markFirstRunComplete, resetFirstRun },
  },
}));

import { FirstRunOnboarding } from '../FirstRunOnboarding';

beforeEach(() => {
  localStorage.clear();
  storeState.currentUser = { id: 'user-1' };
  storeState.isDemoMode = false;
  navigateMock.mockReset();
  toggleDemoMode.mockReset().mockResolvedValue({ success: true, isDemoMode: true });
  getFirstRunState.mockReset().mockResolvedValue({ completed: false, role: null });
  setFirstRunRole.mockReset().mockResolvedValue(undefined);
  markFirstRunComplete.mockReset().mockResolvedValue(undefined);
  resetFirstRun.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('FirstRunOnboarding', () => {
  it('shows the welcome step for a new user', async () => {
    render(<FirstRunOnboarding />);
    expect(await screen.findByText('Meet Teresa — a consultant that talks')).toBeTruthy();
    expect(getFirstRunState).toHaveBeenCalled();
  });

  it('does NOT show for a user who already completed onboarding', async () => {
    getFirstRunState.mockResolvedValue({ completed: true, role: 'chat' });
    render(<FirstRunOnboarding />);
    await waitFor(() => expect(getFirstRunState).toHaveBeenCalled());
    expect(screen.queryByText('Meet Teresa — a consultant that talks')).toBeNull();
  });

  it('does NOT show during a demo session', async () => {
    storeState.isDemoMode = true;
    render(<FirstRunOnboarding />);
    await waitFor(() => {});
    expect(screen.queryByText('Meet Teresa — a consultant that talks')).toBeNull();
    expect(getFirstRunState).not.toHaveBeenCalled();
  });

  it('skips short-circuits when a local done flag is present', async () => {
    localStorage.setItem('consultify_onboarding_done:user-1', 'true');
    render(<FirstRunOnboarding />);
    await waitFor(() => {});
    expect(screen.queryByText('Meet Teresa — a consultant that talks')).toBeNull();
    expect(getFirstRunState).not.toHaveBeenCalled();
  });

  it('walks Welcome → Role → Sample and "Start fresh" navigates + persists', async () => {
    render(<FirstRunOnboarding />);

    // Step 1 → 2
    fireEvent.click(await screen.findByText('Get started'));
    expect(await screen.findByText('What brings you here?')).toBeTruthy();

    // Pick a role (financial → /finance)
    fireEvent.click(screen.getByText('Build a financial model'));
    fireEvent.click(screen.getByText('Continue'));

    // role persisted on continue
    expect(setFirstRunRole).toHaveBeenCalledWith('financial');

    // Step 3 → Start fresh
    expect(await screen.findByText('Start with a sample or a clean slate?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Start fresh' }));

    await waitFor(() => expect(markFirstRunComplete).toHaveBeenCalledWith('financial'));
    expect(navigateMock).toHaveBeenCalledWith('/finance');
    expect(localStorage.getItem('consultify_onboarding_done:user-1')).toBe('true');
  });

  it('"Open the demo" toggles demo mode and persists completion', async () => {
    render(<FirstRunOnboarding />);
    fireEvent.click(await screen.findByText('Get started'));
    fireEvent.click(await screen.findByText('Think through a decision with Teresa'));
    fireEvent.click(screen.getByText('Continue'));
    fireEvent.click(await screen.findByText('Open the demo'));

    await waitFor(() =>
      expect(toggleDemoMode).toHaveBeenCalledWith(true, { source: 'onboarding_first_run' })
    );
    expect(markFirstRunComplete).toHaveBeenCalledWith('chat');
    expect(navigateMock).toHaveBeenCalledWith('/chat');
  });

  // D4 (P3, 2026-08-12): this used to assert `navigateMock` was called with
  // '/chat' — that WAS the bug, reproduced live: a user on /my-work clicking
  // "Skip for now" was force-navigated to /chat and lost the screen they
  // were on. "Skip for now" is shown as a modal overlaid on top of whatever
  // screen the user was already on (My Work, Ideas, Chat, ...); the fix is
  // to only close the modal (and persist the skip) without navigating at
  // all, so the underlying screen — whichever it was — is never touched.
  //
  // The reviewable contract is "pathname before === pathname after" for any
  // starting route, not merely "didn't land on /chat" (which would miss a
  // silent navigation to some OTHER route). We assert the stronger,
  // route-agnostic form of that here — `navigateMock` was called ZERO
  // times, for ANY destination — rather than checking against one specific
  // path. Given `navigate()` is the only navigation primitive this
  // component (and useFirstRunOnboarding's `complete()`) ever calls — no
  // `window.location` / `history` writes anywhere in this flow — "navigate
  // was never called" is equivalent to "pathname never changed".
  //
  // (A companion test asserting the real `useLocation().pathname` via an
  // actual `MemoryRouter` was attempted and dropped: in this worktree,
  // react-router-dom v7's `React.startTransition`-wrapped navigation never
  // flushes under vitest/jsdom regardless of `act`/`waitFor` — a pre-existing
  // test-environment limitation unrelated to this fix, not evidence the fix
  // is wrong. Confirmed by reproducing the same non-flush with a minimal,
  // unrelated MemoryRouter+useNavigate component.)
  it('Skip on the welcome step completes and does NOT navigate anywhere', async () => {
    render(<FirstRunOnboarding />);
    fireEvent.click(await screen.findByText('Skip for now'));
    await waitFor(() => expect(markFirstRunComplete).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.queryByText('Meet Teresa — a consultant that talks')).toBeNull()
    );
    expect(navigateMock).not.toHaveBeenCalled();
  });
});

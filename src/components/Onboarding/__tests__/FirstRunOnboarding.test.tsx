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

  it('Skip on the welcome step completes and lands on the default door', async () => {
    render(<FirstRunOnboarding />);
    fireEvent.click(await screen.findByText('Skip for now'));
    await waitFor(() => expect(markFirstRunComplete).toHaveBeenCalled());
    expect(navigateMock).toHaveBeenCalledWith('/chat');
  });
});

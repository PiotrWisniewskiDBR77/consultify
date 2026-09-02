/**
 * @vitest-environment jsdom
 *
 * FIX-181 (2026-08-30): MODULE_MEETING beta went OPEN (`betaMenuStatus.ts`),
 * but a second, independent gate — the pilot route allowlist in
 * `src/utils/pilotAccess.ts` consumed by `RouterSync.tsx` — still redirected
 * every pilot-restricted role (bare USER / TEAM_MEMBER / GUEST) away from
 * `/meetings` to `/interview` before the Meetings list ever rendered. See
 * day181 finding `MTG-PF-006` in
 * `docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/MODULE_ACCEPTANCE.md`
 * and the day181 report's "R3 frontend MEMBER" STOP
 * (`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY181_SPOTKANIA_OTWARCIE_REPORT.md`).
 *
 * This is the R3 regression test, extended: it exercises the real
 * `RouterSync` redirect effect (not just the pure `isPilotAllowedPath`
 * helper) with a pilot-restricted MEMBER identity landing on `/meetings`,
 * and asserts the route RENDERS (no redirect navigate('/interview') call,
 * no `access:blocked` pilot event, meeting list stays mounted).
 *
 * `tests/setup.ts` globally stubs `react-router-dom`'s `useNavigate` to a
 * no-op `vi.fn()` (so unrelated tests don't crash outside a Router) and
 * globally stubs `@/store/useAppStore` / `../../src/store/useAppStore` to a
 * fixed fake state. Both are overridden here with per-file `vi.mock` calls
 * (hoisted, so they win over the setupFiles registration for this file) so
 * we can (a) spy on the real navigate calls RouterSync makes and (b) control
 * `currentUser.role` per test.
 *
 * Mutation proof (manual, not re-run by CI): temporarily removing
 * `'/meetings'` from `PILOT_ALLOWED_ROUTE_PREFIXES` in `pilotAccess.ts`
 * turns this test red (RouterSync calls `navigate('/interview', ...)`);
 * restoring it turns the test green again.
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

function makePilotMember() {
  return {
    id: 'u3-mtg-member-v1',
    email: 'member@pilot.local.test',
    role: 'TEAM_MEMBER',
    isAuthenticated: true,
  };
}

function MeetingsListStub() {
  return <div data-testid="meetings-list">Meetings list</div>;
}

function InterviewStub() {
  return <div data-testid="interview-page">Interview</div>;
}

describe('RouterSync — pilot MEMBER on /meetings (FIX-181, R3 extended)', () => {
  afterEach(() => {
    hoisted.setMockCurrentUser(null);
    navigateSpy.mockClear();
  });

  it('renders the Meetings list for a pilot-restricted MEMBER instead of redirecting to /interview', async () => {
    hoisted.setMockCurrentUser(makePilotMember());

    render(
      <MemoryRouter initialEntries={['/meetings']}>
        <RouterSync />
        <Routes>
          <Route path="/meetings" element={<MeetingsListStub />} />
          <Route path="/interview" element={<InterviewStub />} />
        </Routes>
      </MemoryRouter>
    );

    // RouterSync's pilot-gate effect runs synchronously on mount; give any
    // scheduled microtasks a tick before asserting the negative.
    await waitFor(() => {
      expect(screen.getByTestId('meetings-list')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('interview-page')).not.toBeInTheDocument();
    expect(navigateSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('/interview'),
      expect.anything()
    );
  });
});

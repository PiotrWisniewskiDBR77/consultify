/**
 * @vitest-environment jsdom
 *
 * W1 (DEC-573, plan row 39, KANAL Wpis 82): the retired surfaces `resources` / `summary` /
 * `rollout` lost their Menu-2 seats and have NO MVP successor, so their deep links and the
 * legacy pathname `/rollout` must land on the canonical Execution list — a redirect, never a
 * 404 and never a dead surface.
 *
 * The redirect target is computed by `buildExecutionRetiredTabRedirect`
 * (`src/components/Execution/executionNavigationState.ts`), which `AppRoutes.tsx` wires through
 * `ExecutionRetiredTabGate` on both `/execution` routes plus `RedirectToCanonicalTab tab="list"`
 * on `/rollout`. This suite drives that resolver through a real router; the wiring in
 * `AppRoutes.tsx` is pinned by the source assertions in `executionCanonicalRoute.test.ts`
 * (rendering the real AppRoutes pulls in the whole provider tree — same convention as
 * `tests/components/AppRoutes.ai-chat-routing.test.tsx`).
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import {
  buildExecutionRetiredTabRedirect,
  isRetiredExecutionDeepLinkTab,
  parseExecutionNavigationState,
} from '@/components/Execution/executionNavigationState';

import { buildCanonicalTabRedirectTarget } from '../canonicalRedirect';
import { ROUTES } from '../routeConfig';

const RETIRED_TABS = ['resources', 'summary', 'rollout'];
const LIVE_TABS = ['list', 'work', 'control', 'reports'];

const readLocation = () => screen.getByTestId('location').textContent || '';

const LocationProbe: React.FC = () => {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
      {location.hash}
    </output>
  );
};

/** Mirrors `ExecutionRetiredTabGate` in `src/routes/AppRoutes.tsx` (minus funnel tracking). */
const RetiredTabGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const target = buildExecutionRetiredTabRedirect(location);
  if (!target) return <>{children}</>;
  return <Navigate to={target} replace />;
};

/** Mirrors `RedirectToCanonicalTab tab="list"` on the legacy `/rollout` route. */
const RolloutLegacyRedirect: React.FC = () => {
  const location = useLocation();
  return (
    <Navigate to={buildCanonicalTabRedirectTarget(ROUTES.EXECUTION, location, 'list')} replace />
  );
};

const canonicalList = <div data-testid="execution-list" />;

const mountAt = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <LocationProbe />
      <Routes>
        <Route path={ROUTES.EXECUTION} element={<RetiredTabGate>{canonicalList}</RetiredTabGate>} />
        <Route
          path={`${ROUTES.EXECUTION}/:executionCaseId`}
          element={<RetiredTabGate>{canonicalList}</RetiredTabGate>}
        />
        <Route path={ROUTES.ROLLOUT} element={<RolloutLegacyRedirect />} />
        <Route path="*" element={<div data-testid="not-found">404</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('W1 — retired Execution deep links redirect to the canonical list', () => {
  it.each(RETIRED_TABS)('?tab=%s lands on the canonical Execution list', (tab) => {
    mountAt(`${ROUTES.EXECUTION}?tab=${tab}`);
    expect(readLocation()).toBe(`${ROUTES.EXECUTION}?tab=list`);
    expect(screen.getByTestId('execution-list')).toBeTruthy();
    expect(screen.queryByTestId('not-found')).toBeNull();
  });

  it.each(['ROLLOUT', ' Rollout ', 'resources'])('?tab=%s is normalized before the redirect', (tab) => {
    mountAt(`${ROUTES.EXECUTION}?tab=${encodeURIComponent(tab)}`);
    expect(readLocation()).toBe(`${ROUTES.EXECUTION}?tab=list`);
  });

  it('keeps the rest of the query and the hash', () => {
    mountAt(
      `${ROUTES.EXECUTION}?tab=rollout&view=kanban&initiativeId=i-8&preset=capacity#row-i-8`
    );
    expect(readLocation()).toBe(
      `${ROUTES.EXECUTION}?tab=list&view=kanban&initiativeId=i-8&preset=capacity#row-i-8`
    );
    expect(screen.getByTestId('execution-list')).toBeTruthy();
  });

  it('drops the retired-surface params instead of carrying them into the list URL', () => {
    mountAt(`${ROUTES.EXECUTION}?tab=summary&subview=summary&kokpit=ryzyka&view=table`);
    expect(readLocation()).toBe(`${ROUTES.EXECUTION}?tab=list&view=table`);
  });

  it('redirects the same way on the execution case route', () => {
    mountAt(`${ROUTES.EXECUTION}/case-9?tab=resources&view=grid`);
    expect(readLocation()).toBe(`${ROUTES.EXECUTION}/case-9?tab=list&view=grid`);
    expect(screen.getByTestId('execution-list')).toBeTruthy();
  });

  it('routes the legacy /rollout pathname to the list, not to a 404', () => {
    mountAt(ROUTES.ROLLOUT);
    expect(readLocation()).toBe(`${ROUTES.EXECUTION}?tab=list`);
    expect(screen.getByTestId('execution-list')).toBeTruthy();
    expect(screen.queryByTestId('not-found')).toBeNull();
  });

  it('routes /rollout with legacy state to the list and preserves that state', () => {
    mountAt(`${ROUTES.ROLLOUT}?view=kanban#risk`);
    expect(readLocation()).toBe(`${ROUTES.EXECUTION}?view=kanban&tab=list#risk`);
    expect(screen.getByTestId('execution-list')).toBeTruthy();
  });

  it.each(LIVE_TABS)('?tab=%s (a live Menu-2 function) is left untouched', (tab) => {
    mountAt(`${ROUTES.EXECUTION}?tab=${tab}&view=table`);
    expect(readLocation()).toBe(`${ROUTES.EXECUTION}?tab=${tab}&view=table`);
    expect(screen.getByTestId('execution-list')).toBeTruthy();
  });

  it('leaves a bare /execution (no tab) untouched', () => {
    mountAt(ROUTES.EXECUTION);
    expect(readLocation()).toBe(ROUTES.EXECUTION);
    expect(screen.getByTestId('execution-list')).toBeTruthy();
  });
});

describe('W1 — the redirect target is the canonical list and cannot bounce again', () => {
  it('parses to the list function with no navigation issue', () => {
    expect(
      parseExecutionNavigationState(`${ROUTES.EXECUTION}?tab=list`, { summaryOneLookEnabled: false })
    ).toMatchObject({ functionId: 'list', subview: 'bank', surfaceTab: 'list', issue: null });
  });

  it('the old target ?tab=rollout is itself retired (mutation anchor), the new one is stable', () => {
    expect(
      buildExecutionRetiredTabRedirect({ pathname: ROUTES.EXECUTION, search: '?tab=rollout' })
    ).toBe(`${ROUTES.EXECUTION}?tab=list`);
    expect(
      buildExecutionRetiredTabRedirect({ pathname: ROUTES.EXECUTION, search: '?tab=list' })
    ).toBeNull();
  });

  it.each([...RETIRED_TABS, 'ROLLout'])('isRetiredExecutionDeepLinkTab(%s) is true', (tab) => {
    expect(isRetiredExecutionDeepLinkTab(tab)).toBe(true);
  });

  it.each([...LIVE_TABS, 'bank', 'realizacje', 'decisions', '', 'unknown'])
    ('isRetiredExecutionDeepLinkTab(%s) is false', (tab) => {
      expect(isRetiredExecutionDeepLinkTab(tab)).toBe(false);
    });

  it('isRetiredExecutionDeepLinkTab(null) is false', () => {
    expect(isRetiredExecutionDeepLinkTab(null)).toBe(false);
  });
});

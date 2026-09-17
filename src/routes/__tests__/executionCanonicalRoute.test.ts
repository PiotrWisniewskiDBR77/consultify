import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { AppView } from '../../types';
import {
  buildCanonicalRedirectTarget,
  buildCanonicalTabRedirectTarget,
} from '../canonicalRedirect';
import { getAppViewFromPath, getRouteFromAppView, ROUTES } from '../routeConfig';

describe('Execution canonical route', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/routes/AppRoutes.tsx'), 'utf8');
  const executionRoutes = source.slice(
    source.indexOf('path={ROUTES.EXECUTION}'),
    source.indexOf('path={ROUTES.IMPLEMENTATION}')
  );
  const rolloutRoute = source.slice(
    source.indexOf('path={ROUTES.ROLLOUT}'),
    source.indexOf('path={ROUTES.REPORTS.ROOT}')
  );

  it('does not replace the usable Execution module with the global V8 unavailable banner', () => {
    expect(executionRoutes).toContain('<ExecutionHub />');
    expect(executionRoutes).not.toContain('<V8UnavailableBanner moduleName="Execution">');
  });

  it('gates both /execution routes with the retired-tab redirect (W1, DEC-573)', () => {
    expect(executionRoutes.match(/<ExecutionRetiredTabGate>/g) ?? []).toHaveLength(2);
    expect(executionRoutes.match(/<ExecutionHub \/>/g) ?? []).toHaveLength(2);
    expect(source).toContain('buildExecutionRetiredTabRedirect');
  });

  it('sends the legacy /rollout pathname to the canonical list tab, not a retired tab', () => {
    expect(rolloutRoute).toContain('tab="list"');
    expect(rolloutRoute).not.toContain('tab="rollout"');
    expect(rolloutRoute).toContain('RedirectToCanonicalTab');
  });

  it('emits /execution for historical Execution app views', () => {
    expect(getRouteFromAppView(AppView.FULL_STEP5_EXECUTION)).toBe(ROUTES.EXECUTION);
    expect(getRouteFromAppView(AppView.IMPLEMENTATION)).toBe(ROUTES.EXECUTION);
    expect(getRouteFromAppView(AppView.FULL_PILOT_EXECUTION)).toBe(ROUTES.EXECUTION);
  });

  it.each([ROUTES.EXECUTION, ROUTES.IMPLEMENTATION])(
    'maps %s to the canonical Execution view',
    (path) => {
      expect(getAppViewFromPath(path)).toBe(AppView.FULL_STEP5_EXECUTION);
    }
  );

  it('preserves implementation query and hash', () => {
    expect(
      buildCanonicalRedirectTarget(ROUTES.EXECUTION, {
        search: '?tab=people_change&view=table',
        hash: '#owner',
      })
    ).toBe('/execution?tab=people_change&view=table#owner');
  });

  it('merges legacy rollout state and enforces the canonical list tab', () => {
    expect(
      buildCanonicalTabRedirectTarget(
        ROUTES.EXECUTION,
        { search: '?view=kanban&tab=rollout', hash: '#risk' },
        'list'
      )
    ).toBe('/execution?view=kanban&tab=list#risk');
  });
});

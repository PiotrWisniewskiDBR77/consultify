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
  it('does not replace the usable Execution module with the global V8 unavailable banner', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/routes/AppRoutes.tsx'), 'utf8');
    const executionRoutes = source.slice(
      source.indexOf('path={ROUTES.EXECUTION}'),
      source.indexOf('path={ROUTES.IMPLEMENTATION}')
    );

    expect(executionRoutes).toContain('<ExecutionHub />');
    expect(executionRoutes).not.toContain('<V8UnavailableBanner moduleName="Execution">');
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

  it('merges rollout state and enforces the rollout tab', () => {
    expect(
      buildCanonicalTabRedirectTarget(
        ROUTES.EXECUTION,
        { search: '?view=kanban&tab=old', hash: '#risk' },
        'rollout'
      )
    ).toBe('/execution?view=kanban&tab=rollout#risk');
  });
});

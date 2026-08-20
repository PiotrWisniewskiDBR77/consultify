import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { AppView } from '../../types';
import { buildCanonicalRedirectTarget } from '../canonicalRedirect';
import { getAppViewFromPath, getRouteFromAppView, ROUTES } from '../routeConfig';

describe('Finance canonical route', () => {
  it('keeps /finance as the route emitted for the Finance app view', () => {
    expect(getRouteFromAppView(AppView.ECONOMICS)).toBe(ROUTES.FINANCE);
    expect(getAppViewFromPath(ROUTES.FINANCE)).toBe(AppView.ECONOMICS);
  });

  it('preserves legacy query and hash when redirecting /economics', () => {
    expect(
      buildCanonicalRedirectTarget(ROUTES.FINANCE, {
        search: '?tab=analysis&case=case-1',
        hash: '#assumptions',
      })
    ).toBe('/finance?tab=analysis&case=case-1#assumptions');
  });

  it('mounts all five canonical Finance detail routes, including Prediction', () => {
    const appRoutes = readFileSync(resolve(process.cwd(), 'src/routes/AppRoutes.tsx'), 'utf8');
    for (const path of [
      '/finance/statements/:id',
      '/finance/models/:id',
      '/finance/analyses/:id',
      '/finance/predictions/:id',
      '/finance/valuations/:id',
    ]) {
      expect(appRoutes).toContain(`path="${path}"`);
    }
  });
});

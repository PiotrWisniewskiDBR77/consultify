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
});

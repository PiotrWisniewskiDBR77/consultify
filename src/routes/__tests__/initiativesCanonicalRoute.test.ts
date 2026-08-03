import { describe, expect, it } from 'vitest';

import { DEFAULT_INITIATIVES_VIEW_MODE } from '../../components/Initiatives/initiativesViewDefaults';
import { AppView } from '../../types';
import { buildCanonicalRedirectTarget } from '../canonicalRedirect';
import { getAppViewFromPath, getRouteFromAppView, ROUTES } from '../routeConfig';

describe('Initiatives canonical route', () => {
  it('opens the canonical List surface in table mode', () => {
    expect(DEFAULT_INITIATIVES_VIEW_MODE).toBe('table');
  });

  it.each([
    AppView.FULL_STEP2_INITIATIVES,
    AppView.FULL_STEP3_ROADMAP,
    AppView.PORTFOLIO_ROADMAP,
    AppView.INITIATIVE_MANAGEMENT,
  ])('emits /initiatives for %s', (view) => {
    expect(getRouteFromAppView(view)).toBe(ROUTES.INITIATIVES);
  });

  it('uses the canonical Initiatives owner identity for /initiatives', () => {
    expect(getAppViewFromPath(ROUTES.INITIATIVES)).toBe(AppView.FULL_STEP2_INITIATIVES);
  });

  it.each([ROUTES.PORTFOLIO, ROUTES.ROADMAP])('recognizes legacy alias %s', (path) => {
    expect(getAppViewFromPath(path)).toBe(AppView.PORTFOLIO_ROADMAP);
  });

  it.each([ROUTES.PORTFOLIO, ROUTES.ROADMAP])(
    'preserves query and hash when redirecting %s',
    () => {
      expect(
        buildCanonicalRedirectTarget(ROUTES.INITIATIVES, {
          search: '?scope=all&open=init-7',
          hash: '#timeline',
        })
      ).toBe('/initiatives?scope=all&open=init-7#timeline');
    }
  );
});

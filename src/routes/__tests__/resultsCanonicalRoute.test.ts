import { describe, expect, it } from 'vitest';

import { AppView } from '../../types';
import { buildCanonicalRedirectTarget } from '../canonicalRedirect';
import { getAppViewFromPath, getRouteFromAppView, ROUTES } from '../routeConfig';

describe('Results canonical route', () => {
  it('emits /results for both historical Results app views', () => {
    expect(getRouteFromAppView(AppView.BENEFITS_REALIZATION)).toBe(ROUTES.RESULTS);
    expect(getRouteFromAppView(AppView.KPI_OKR_DASHBOARD)).toBe(ROUTES.RESULTS);
  });

  it.each([ROUTES.RESULTS, ROUTES.BENEFITS, ROUTES.KPI_OKR])(
    'maps %s to the Results app view',
    (path) => {
      expect(getAppViewFromPath(path)).toBe(AppView.BENEFITS_REALIZATION);
    }
  );

  it('preserves legacy Results query and hash', () => {
    expect(
      buildCanonicalRedirectTarget(ROUTES.RESULTS, {
        search: '?tab=results_kpi&mode=scorecards&initiativeId=i-1',
        hash: '#owner',
      })
    ).toBe('/results?tab=results_kpi&mode=scorecards&initiativeId=i-1#owner');
  });
});

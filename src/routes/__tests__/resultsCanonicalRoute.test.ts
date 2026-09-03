import { describe, expect, it } from 'vitest';

import { AppView } from '../../types';
import { buildCanonicalRedirectTarget } from '../canonicalRedirect';
import { getAppViewFromPath, getRouteFromAppView, ROUTES } from '../routeConfig';

describe('Results canonical route', () => {
  it('emits the KPI registry for both historical Results app views', () => {
    expect(getRouteFromAppView(AppView.BENEFITS_REALIZATION)).toBe(ROUTES.RESULTS_KPI.ROOT);
    expect(getRouteFromAppView(AppView.KPI_OKR_DASHBOARD)).toBe(ROUTES.RESULTS_KPI.ROOT);
  });

  it.each([ROUTES.RESULTS, ROUTES.BENEFITS, ROUTES.KPI_OKR])(
    'maps %s to the Results app view',
    (path) => {
      expect(getAppViewFromPath(path)).toBe(AppView.BENEFITS_REALIZATION);
    }
  );

  it('builds the canonical KPI registry target with legacy query and hash', () => {
    expect(
      buildCanonicalRedirectTarget(ROUTES.RESULTS_KPI.ROOT, {
        search: '?tab=results_kpi&mode=scorecards&initiativeId=i-1',
        hash: '#owner',
      })
    ).toBe('/results/kpi?tab=results_kpi&mode=scorecards&initiativeId=i-1#owner');
  });
});

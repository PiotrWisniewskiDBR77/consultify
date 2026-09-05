/**
 * AppRoutes — 404 for truly unknown routes (WAŻNY, RAPORT_B #4).
 *
 * Before this fix, ANY unmatched route silently redirected: authenticated →
 * `/chat`, anonymous → `/`. Zero indication the URL didn't exist — a broken
 * link and a normal visit to `/chat` were indistinguishable.
 *
 * Full-render integration is impractical here (the whole provider tree —
 * matches the existing convention in `AppRoutes.ai-chat-routing.test.tsx`,
 * which documents the same tradeoff), so this is a source-level + route-config
 * contract test: the wildcard route must render `NotFoundPage`, and a real
 * module route (`/results/kpi`) must have its OWN dedicated `<Route>` above
 * the wildcard so it never falls through to 404.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ROUTES } from '../../src/routes/routeConfig';

const readSource = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8');

describe('AppRoutes — 404 for unknown routes', () => {
  const appRoutes = readSource('src/routes/AppRoutes.tsx');

  // NOTE: AppRoutes.tsx has several nested `<Routes>` blocks with their OWN
  // local `path="*"` (legacy sub-flows, e.g. Organization's internal router).
  // The TOP-LEVEL 404 catch-all is the LAST `path="*"` in the file — it is
  // the trailing <Route> of the outermost <Routes>, confirmed by reading the
  // file: all other `path="*"` occurrences sit inside a nested <Routes>.
  const topLevelWildcardIndex = () => appRoutes.lastIndexOf('path="*"');

  it('imports and renders NotFoundPage on the wildcard route, not a silent redirect', () => {
    expect(appRoutes).toContain("import { NotFoundPage } from '@/components/NotFoundPage';");

    const wildcardIndex = topLevelWildcardIndex();
    expect(wildcardIndex).toBeGreaterThan(-1);
    const wildcardBlock = appRoutes.slice(wildcardIndex, wildcardIndex + 600);

    // Both auth branches of the wildcard render NotFoundPage.
    expect(wildcardBlock).toContain('<NotFoundPage');
    // The old silent-redirect behaviour must be gone from this exact route.
    expect(wildcardBlock).not.toContain(`<Navigate to={ROUTES.AI_CHAT}`);
    expect(wildcardBlock).not.toContain(`<Navigate to={ROUTES.WELCOME}`);
  });

  it('wraps the authenticated branch in MainLayout (404 lives inside the app shell)', () => {
    const wildcardIndex = topLevelWildcardIndex();
    const wildcardBlock = appRoutes.slice(wildcardIndex, wildcardIndex + 600);
    expect(wildcardBlock).toContain('MainLayout');
  });

  it('a real module route (/results/kpi) has its own dedicated Route and is not the wildcard', () => {
    expect(ROUTES.RESULTS_KPI.ROOT).toBe('/results/kpi');
    // The route must be declared explicitly BEFORE the top-level catch-all wildcard.
    const kpiRouteIndex = appRoutes.indexOf('path={ROUTES.RESULTS_KPI.ROOT}');
    const wildcardIndex = topLevelWildcardIndex();
    expect(kpiRouteIndex).toBeGreaterThan(-1);
    expect(wildcardIndex).toBeGreaterThan(-1);
    expect(kpiRouteIndex).toBeLessThan(wildcardIndex);
  });

  it('a made-up path like /nie-ma-takiej-strony has no dedicated Route (falls through to 404)', () => {
    expect(appRoutes).not.toContain('/nie-ma-takiej-strony');
  });
});

describe('NotFoundPage i18n', () => {
  const readLocale = (locale: 'en' | 'pl') =>
    JSON.parse(
      readFileSync(resolve(process.cwd(), 'public', 'locales', locale, 'translation.json'), 'utf8')
    );

  it.each(['en', 'pl'] as const)(
    '%s locale has non-empty notFoundPage.title/message/backToChat/goBack',
    (locale) => {
      const translation = readLocale(locale);
      for (const key of ['title', 'message', 'backToChat', 'goBack']) {
        const value = translation.notFoundPage?.[key];
        expect(value, `notFoundPage.${key}`).toEqual(expect.any(String));
        expect(String(value).trim(), `notFoundPage.${key}`).not.toBe('');
      }
    }
  );

  it('pl locale title is literally "Nie ma takiej strony"', () => {
    const pl = readLocale('pl');
    expect(pl.notFoundPage.title).toBe('Nie ma takiej strony');
  });
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ROUTES } from '../routeConfig';

/**
 * DEC-2026-08-24-01 (OWNER_DECISION_LEDGER_2026-08-24.md): `/interview` is the
 * sole mounted Interview address. `/discovery` and `/project-intelligence` are
 * legacy aliases that must redirect to `/interview` instead of mounting
 * `InterviewHub` under a second identity. `/discovery/canvas` (the separate
 * `DiscoveryConsultantView` canvas tool) and `/interview/respond/:token` (the
 * public respondent link) are untouched by this decision and stay mounted.
 */
describe('Interview alias redirects (DEC-2026-08-24-01)', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/routes/AppRoutes.tsx'), 'utf8');

  it.each([
    ['ROUTES.DISCOVERY_CONSULTANT', ROUTES.DISCOVERY_CONSULTANT],
    ['ROUTES.PROJECT_INTELLIGENCE', ROUTES.PROJECT_INTELLIGENCE],
  ])('redirects %s to ROUTES.INTERVIEW via RedirectWithTracking', (routeConstantName) => {
    const routeIndex = source.indexOf(`path={${routeConstantName}}`);
    expect(routeIndex).toBeGreaterThan(-1);
    const routeSlice = source.slice(routeIndex, routeIndex + 400);
    expect(routeSlice).toContain('<RedirectWithTracking');
    expect(routeSlice).toContain(`from={${routeConstantName}}`);
    expect(routeSlice).toContain('to={ROUTES.INTERVIEW}');
    // Must not mount InterviewHub a second time under the legacy identity.
    expect(routeSlice).not.toContain('<InterviewHub');
  });

  it('still mounts InterviewHub directly on the canonical /interview route', () => {
    const routeIndex = source.indexOf('path={ROUTES.INTERVIEW}');
    expect(routeIndex).toBeGreaterThan(-1);
    const routeSlice = source.slice(routeIndex, routeIndex + 300);
    expect(routeSlice).toContain('<InterviewHub');
    expect(routeSlice).not.toContain('<RedirectWithTracking');
  });

  it('keeps /discovery/canvas mounted on DiscoveryConsultantView (untouched by DEC-2026-08-24-01)', () => {
    const routeIndex = source.indexOf('path="/discovery/canvas"');
    expect(routeIndex).toBeGreaterThan(-1);
    const routeSlice = source.slice(routeIndex, routeIndex + 300);
    expect(routeSlice).toContain('<DiscoveryConsultantView');
  });

  it('keeps the public respondent route /interview/respond/:token mounted (untouched by DEC-2026-08-24-01)', () => {
    const routeIndex = source.indexOf('path="/interview/respond/:token"');
    expect(routeIndex).toBeGreaterThan(-1);
  });

  it('resolves the legacy Interview alias URLs and the canonical Interview URL', () => {
    expect(ROUTES.INTERVIEW).toBe('/interview');
    expect(ROUTES.DISCOVERY_CONSULTANT).toBe('/discovery');
    expect(ROUTES.PROJECT_INTELLIGENCE).toBe('/project-intelligence');
  });
});

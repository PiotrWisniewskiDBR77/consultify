import { describe, expect, it } from 'vitest';

import { resolveAdminLocation } from '../AdminSettingsModule';
import { ROUTES } from '../../../routes/routeConfig';
import { ADMIN_DOMAINS, ADMIN_DEFAULTS, type AdminDomain } from '../../../components/Admin/adminNavigation';

/**
 * DEC-2026-08-24-10 — Admin route alias cleanup.
 *
 * ROUTES.ADMIN used to carry five duplicate names for three canonical
 * addresses (`MEMBERS`/`TEAM` -> `PEOPLE`, `ORGANIZATION`/`WORKSPACE` ->
 * `OPERATIONS`, `COLLABORATION` -> `SECURITY`) — "several names, one
 * screen". The duplicate *names* were removed from the dictionary, but no
 * URL *value* changed, so every historical admin address a user could have
 * bookmarked, linked from Settings/Organization redirects, or navigated to
 * via the legacy AppView table must keep resolving to the same real domain
 * screen as before.
 *
 * `resolveAdminLocation` (exported from AdminSettingsModule) is the actual
 * runtime mechanism: it takes a pathname and decides which of the seven
 * real Admin domains (team/billing/ai/security/audit/command/health) to
 * show. This test locks in that every surviving ROUTES.ADMIN value — the
 * ones the removed aliases used to point at — still resolves, deterministically,
 * to its expected domain.
 */
describe('Historical Admin address aliases resolve to the correct canonical domain (DEC-2026-08-24-10)', () => {
  const domainIds = new Set(ADMIN_DOMAINS.map((d) => d.id));

  function domainFor(pathname: string): AdminDomain {
    return resolveAdminLocation(pathname, '').domain;
  }

  it.each([
    // path                              expected domain   formerly reachable only via
    [ROUTES.ADMIN.ROOT, 'team'], // /admin
    [ROUTES.ADMIN.OVERVIEW, 'team'], // /admin/overview
    [ROUTES.ADMIN.PEOPLE, 'team'], // /admin/people — was also MEMBERS, TEAM
    [ROUTES.ADMIN.SECURITY, 'security'], // /admin/security — was also COLLABORATION
    [ROUTES.ADMIN.BILLING, 'billing'], // /admin/billing
    [ROUTES.ADMIN.AI, 'ai'], // /admin/ai
    [ROUTES.ADMIN.INTEGRATIONS, 'security'], // /admin/integrations — was also ADMIN_WORKSPACE's real target
    [ROUTES.ADMIN.AUDIT, 'audit'], // /admin/audit
    // DEC-2026-08-24-10 (werdykt nadzorcy): operations to nie-domena; alias na Command Center,
    // nie cichy fallback na team. Regres: przekierowania lądowały na Team & Access.
    [ROUTES.ADMIN.OPERATIONS, 'command'], // /admin/operations — was also ORGANIZATION, WORKSPACE
    [ROUTES.ADMIN.COMPLIANCE, 'audit'], // /admin/compliance
  ] as const)('%s resolves to the %s domain', (path, expectedDomain) => {
    expect(domainFor(path)).toBe(expectedDomain);
  });

  it('every resolved domain is one of the seven real Admin domains', () => {
    const paths = [
      ROUTES.ADMIN.ROOT,
      ROUTES.ADMIN.OVERVIEW,
      ROUTES.ADMIN.PEOPLE,
      ROUTES.ADMIN.SECURITY,
      ROUTES.ADMIN.BILLING,
      ROUTES.ADMIN.AI,
      ROUTES.ADMIN.INTEGRATIONS,
      ROUTES.ADMIN.AUDIT,
      ROUTES.ADMIN.OPERATIONS,
      ROUTES.ADMIN.COMPLIANCE,
    ];
    for (const path of paths) {
      const domain = domainFor(path);
      expect(domainIds.has(domain), `${path} resolved to unknown domain "${domain}"`).toBe(true);
    }
  });

  it('resolves to a concrete, default screen within the domain (never undefined)', () => {
    const location = resolveAdminLocation(ROUTES.ADMIN.PEOPLE, '');
    expect(location.screen).toBe(ADMIN_DEFAULTS[location.domain]);
    expect(location.screen).toBeTruthy();
  });

  it('the seven real Admin domains are exactly team/billing/ai/security/audit/command/health', () => {
    expect(new Set(ADMIN_DOMAINS.map((d) => d.id))).toEqual(
      new Set(['team', 'billing', 'ai', 'security', 'audit', 'command', 'health'])
    );
  });
});

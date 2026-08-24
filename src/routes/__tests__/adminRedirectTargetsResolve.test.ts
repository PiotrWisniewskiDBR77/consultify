import { describe, expect, it } from 'vitest';

import { ROUTES } from '../routeConfig';
import { resolveAdminLocation } from '../../views/admin/AdminSettingsModule';

// DEC-2026-08-24-10 — strażnik anty-fantomowy (werdykt nadzorcy 2026-08-24):
// każdy adres Admina używany jako cel przekierowania z Organization/Settings
// musi rozwiązywać się do zamierzonej domeny, nigdy przez cichy fallback
// na domenę domyślną. Regres: /admin/operations lądował na Team & Access.
describe('admin redirect targets resolve to intended domains', () => {
  const cases: Array<[string, string, string]> = [
    [ROUTES.ADMIN.PEOPLE, 'team', 'members redirect target'],
    [ROUTES.ADMIN.BILLING, 'billing', 'billing/limits redirect target'],
    [ROUTES.ADMIN.COMMAND, 'command', 'branding/organization/tenant-defaults redirect target'],
    [ROUTES.ADMIN.OPERATIONS, 'command', 'deprecated operations URL (alias)'],
    [ROUTES.ADMIN.HEALTH, 'health', 'system health constant'],
  ];

  it.each(cases)('%s -> domain %s (%s)', (path, domain) => {
    expect(resolveAdminLocation(path, '', undefined).domain).toBe(domain);
  });

  it('security domains target resolves to the exact spec child screen', () => {
    const resolved = resolveAdminLocation(ROUTES.ADMIN.SECURITY_DOMAINS, '', undefined);
    expect(resolved.domain).toBe('security');
    expect(resolved.screen).toBe('domains');
  });
});

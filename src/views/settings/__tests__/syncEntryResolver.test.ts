import { describe, expect, it } from 'vitest';

import { ROUTES } from '@/routes/routeConfig';

import {
  resolveLegacySyncSettingsEntry,
  resolveLegacySyncSettingsRedirectTarget,
} from '../syncEntryResolver';

// SET-INT-REC-001 — the OAuth callback (server/src/routes/settings.routes.ts,
// GET /api/settings/integrations/oauth/callback) always redirects the browser
// to the legacy `/settings/integrations` alias with `?oauth_success=<id>` or
// `?oauth_error=<reason>`. SettingsView bounces that legacy alias to the
// canonical `/settings/connected-apps` route; if the redirect target drops
// the query string, ConnectedAppsSettings never learns whether the OAuth
// round-trip succeeded and the user sees no confirmation at all.
describe('resolveLegacySyncSettingsRedirectTarget — OAuth return path', () => {
  it('preserves oauth_success across the legacy /settings/integrations alias', () => {
    const target = resolveLegacySyncSettingsRedirectTarget(
      ROUTES.SETTINGS.INTEGRATIONS,
      '?oauth_success=gmail',
      '',
      'USER'
    );
    expect(target).toBe(`${ROUTES.SETTINGS.ROOT}/connected-apps?oauth_success=gmail`);
  });

  it('preserves oauth_error across the legacy /settings/integrations alias', () => {
    const target = resolveLegacySyncSettingsRedirectTarget(
      ROUTES.SETTINGS.INTEGRATIONS,
      '?oauth_error=access_denied',
      '',
      'USER'
    );
    expect(target).toBe(`${ROUTES.SETTINGS.ROOT}/connected-apps?oauth_error=access_denied`);
  });

  it('preserves a hash fragment alongside the query string', () => {
    const target = resolveLegacySyncSettingsRedirectTarget(
      ROUTES.SETTINGS.INTEGRATIONS,
      '?oauth_success=outlook',
      '#panel',
      'USER'
    );
    expect(target).toBe(`${ROUTES.SETTINGS.ROOT}/connected-apps?oauth_success=outlook#panel`);
  });

  it('ustawienia-integracje defekt 05.09: admin/owner/superadmin roles land on the SAME real connected-apps screen (no /admin/integrations dead-end)', () => {
    // ROUTES.ADMIN.INTEGRATIONS has no domain/screen in AdminSettingsModule's
    // taxonomy — routing admin/owner/superadmin through it produced a second,
    // uncontrolled redirect hop (AdminSettingsModule's own alias fallback
    // bounced 'integrations' to '/admin/security/security-policy'), so 8/8
    // real navigations in the 05.09 acceptance run landed on one of three
    // different wrong outcomes depending on timing. One route, one screen,
    // for every role.
    for (const role of ['ADMIN', 'OWNER', 'SUPERADMIN', 'USER', null, undefined]) {
      const target = resolveLegacySyncSettingsRedirectTarget(
        ROUTES.SETTINGS.INTEGRATIONS,
        '?oauth_success=gmail',
        '',
        role
      );
      expect(target).toBe(`${ROUTES.SETTINGS.ROOT}/connected-apps?oauth_success=gmail`);
    }
  });

  it('returns null (no redirect) for a canonical, non-legacy path', () => {
    const target = resolveLegacySyncSettingsRedirectTarget(
      `${ROUTES.SETTINGS.ROOT}/connected-apps`,
      '?oauth_success=gmail',
      '',
      'USER'
    );
    expect(target).toBeNull();
  });

  it('does not append an empty query string when none is present', () => {
    const target = resolveLegacySyncSettingsRedirectTarget(
      ROUTES.SETTINGS.INTEGRATIONS,
      '',
      '',
      'USER'
    );
    expect(target).toBe(`${ROUTES.SETTINGS.ROOT}/connected-apps`);
  });

  it('stays consistent with the pathname-only resolver for every legacy alias', () => {
    const cases: Array<[string, string | null | undefined]> = [
      [ROUTES.SETTINGS.BILLING, 'USER'],
      [ROUTES.SETTINGS.BILLING, 'OWNER'],
      [ROUTES.SETTINGS.AI, 'USER'],
      [ROUTES.SETTINGS.NOTIFICATIONS, 'USER'],
      [ROUTES.SETTINGS.ORGANIZATION, 'USER'],
      [ROUTES.SETTINGS.SECURITY, 'USER'],
    ];
    for (const [pathname, role] of cases) {
      const base = resolveLegacySyncSettingsEntry(pathname, role);
      const withSearch = resolveLegacySyncSettingsRedirectTarget(pathname, '?x=1', '', role);
      expect(withSearch).toBe(base ? `${base}?x=1` : null);
    }
  });
});

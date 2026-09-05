import { ROUTES } from '@/routes/routeConfig';
import { isAdminOwnerOrSuperAdminRole } from '@/utils/roleGuards';

export function resolveLegacySyncSettingsEntry(
  pathname: string,
  role: string | null | undefined
): string | null {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  switch (normalized) {
    case ROUTES.SETTINGS.BILLING:
      return isAdminOwnerOrSuperAdminRole(role)
        ? `${ROUTES.ADMIN.BILLING}/overview`
        : ROUTES.SETTINGS.PROFILE;
    case ROUTES.SETTINGS.AI:
      return `${ROUTES.SETTINGS.ROOT}/ai-behavior`;
    case ROUTES.SETTINGS.NOTIFICATIONS:
      return `${ROUTES.SETTINGS.ROOT}/notifications-overview`;
    case ROUTES.SETTINGS.INTEGRATIONS:
      // ustawienia-integracje defekt 05.09: ROUTES.ADMIN.INTEGRATIONS
      // ('/admin/integrations') has no corresponding domain/screen in
      // AdminSettingsModule's taxonomy (adminNavigation.ts defines no
      // 'integrations' entry) — it only existed as a legacy redirect
      // target. AdminSettingsModule's own alias table then silently
      // reinterpreted the unrecognized 'integrations' path segment as the
      // 'security' domain and auto-canonicalized the URL a SECOND time to
      // '/admin/security/security-policy'. Routing admin/owner/superadmin
      // through that dead alias produced a two-hop redirect chain whose
      // final (and every intermediate) state depended on render/effect
      // timing — 8/8 real navigations in the 05.09 acceptance run landed
      // on three different, all-wrong outcomes. Every role now gets the
      // one real, working destination — same as everyone else.
      return `${ROUTES.SETTINGS.ROOT}/connected-apps`;
    case ROUTES.SETTINGS.ORGANIZATION:
      return `${ROUTES.SETTINGS.ROOT}/tenant-defaults`;
    case ROUTES.SETTINGS.SECURITY:
      return `${ROUTES.SETTINGS.ROOT}/security-dashboard`;
    default:
      return null;
  }
}

/**
 * Same resolution as `resolveLegacySyncSettingsEntry`, but preserves the
 * query string and hash across the redirect.
 *
 * The OAuth callback (server/src/routes/settings.routes.ts) redirects the
 * browser to the legacy `/settings/integrations` alias with
 * `?oauth_success=<connector>` or `?oauth_error=<reason>`. SettingsView then
 * bounces that legacy alias to the canonical `/settings/connected-apps`
 * route; if that redirect drops the search string, ConnectedAppsSettings
 * never sees the OAuth result and the connect/disconnect confirmation is
 * silently lost.
 */
export function resolveLegacySyncSettingsRedirectTarget(
  pathname: string,
  search: string,
  hash: string,
  role: string | null | undefined
): string | null {
  const target = resolveLegacySyncSettingsEntry(pathname, role);
  if (!target) return null;
  return `${target}${search}${hash}`;
}

const LEGACY_AI_SECTION_MAP: Record<string, string> = {
  'ai-instructions': 'ai-behavior',
  'ai-personality': 'ai-behavior',
  'ai-model': 'ai-model-params',
  'ai-parameters': 'ai-model-params',
  'ai-history': 'ai-chat-history',
};

export function normalizeSettingsSectionFromPath(pathname: string): string {
  const pathSection = pathname.replace('/settings/', '').replace(/^\/+|\/+$/g, '') || 'overview';
  if (LEGACY_AI_SECTION_MAP[pathSection]) {
    return LEGACY_AI_SECTION_MAP[pathSection];
  }
  return pathSection;
}

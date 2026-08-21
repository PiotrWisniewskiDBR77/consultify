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
      return isAdminOwnerOrSuperAdminRole(role)
        ? ROUTES.ADMIN.INTEGRATIONS
        : `${ROUTES.SETTINGS.ROOT}/connected-apps`;
    case ROUTES.SETTINGS.ORGANIZATION:
      return `${ROUTES.SETTINGS.ROOT}/tenant-defaults`;
    case ROUTES.SETTINGS.SECURITY:
      return `${ROUTES.SETTINGS.ROOT}/security-dashboard`;
    default:
      return null;
  }
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

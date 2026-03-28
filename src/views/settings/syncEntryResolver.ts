import { ROUTES } from '@/routes/routeConfig';
import { isAdminOrSuperAdminRole } from '@/utils/roleGuards';

export function resolveLegacySyncSettingsEntry(
  pathname: string,
  role: string | null | undefined
): string | null {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  if (normalized !== ROUTES.SETTINGS.INTEGRATIONS) {
    return null;
  }

  if (isAdminOrSuperAdminRole(role)) {
    return `${ROUTES.ADMIN.ROOT}?tab=integrations`;
  }

  return `${ROUTES.SETTINGS.ROOT}/connected-apps`;
}

export function normalizeSettingsSectionFromPath(pathname: string): string {
  const pathSection = pathname.replace('/settings/', '').replace(/^\/+|\/+$/g, '') || 'profile';
  if (pathSection === 'integrations') {
    return 'connected-apps';
  }
  return pathSection;
}

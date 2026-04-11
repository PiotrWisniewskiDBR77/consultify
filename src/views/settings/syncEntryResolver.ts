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
    return ROUTES.ADMIN.INTEGRATIONS;
  }

  return `${ROUTES.SETTINGS.ROOT}/connected-apps`;
}

const LEGACY_AI_SECTION_MAP: Record<string, string> = {
  'ai-instructions': 'ai-behavior',
  'ai-personality': 'ai-behavior',
  'ai-model': 'ai-model-params',
  'ai-parameters': 'ai-model-params',
};

export function normalizeSettingsSectionFromPath(pathname: string): string {
  const pathSection = pathname.replace('/settings/', '').replace(/^\/+|\/+$/g, '') || 'overview';
  if (pathSection === 'integrations') {
    return 'connected-apps';
  }
  if (pathSection === 'organization') {
    return 'tenant-defaults';
  }
  if (pathSection === 'security') {
    return 'tenant-security';
  }
  if (LEGACY_AI_SECTION_MAP[pathSection]) {
    return LEGACY_AI_SECTION_MAP[pathSection];
  }
  return pathSection;
}

import { isPilotRestrictedRole } from './roleGuards';
import { isBetaClosed } from './betaAccess';

// VTS pilot scope: Chat + Interview plus My Work (Ideas stays locked via
// isPilotAllowedMyWorkTab), Initiatives, Execution and Settings.
export const PILOT_VISIBLE_MENU_IDS = new Set([
  'AI_CHAT',
  'INTERVIEW',
  'MY_WORK',
  'MODULE_INITIATIVES',
  'MODULE_EXECUTION',
  'SETTINGS',
]);

export const PILOT_ALLOWED_SETTINGS_SECTIONS = new Set([
  'profile',
  'auth-access',
  'language',
  'theme',
]);

const PILOT_ALLOWED_ROUTE_PREFIXES = [
  '/chat',
  '/interview',
  '/my-work',
  '/initiatives',
  '/execution',
  '/implementation',
  '/settings',
  '/share/',
] as const;

const PILOT_ALLOWED_ARTIFACT_TYPES = new Set(['insight']);

export function getPilotLockedAreaDetail(
  areaId?: string | null,
  fallbackLabel?: string | null
): {
  message: string;
  href: string;
} {
  const normalized = String(areaId || '')
    .trim()
    .toUpperCase();
  const areaLabel = String(fallbackLabel || '')
    .trim()
    .toLowerCase();

  if (normalized === 'IDEAS_TAB' || areaLabel === 'ideas' || areaLabel === 'pomysly') {
    return {
      href: '/my-work',
      message:
        'Ideas are locked for the pilot session. This area will open in the next project phase.',
    };
  }

  if (normalized === 'TOOLS' || normalized.startsWith('TOOLS_')) {
    return {
      href: '/interview',
      message:
        'Tools and Assessment are locked for tomorrow’s pilot. We will unlock them in the next project phase.',
    };
  }

  if (
    normalized === 'MODULE_BENEFITS' ||
    normalized === 'MODULE_ECONOMICS' ||
    normalized === 'MODULE_PRESENTATIONS' ||
    normalized === 'MODULE_WORDY' ||
    normalized === 'MODULE_EXCELE' ||
    normalized === 'MODULE_PREZENTACJE_GEN' ||
    (normalized === 'MODULE_MEETING' && isBetaClosed('MODULE_MEETING')) ||
    normalized === 'MCP_IRIS' ||
    normalized === 'MCP_MARKETPLACE'
  ) {
    return {
      href: '/interview',
      message:
        'This module is locked for the pilot session. It will be available in the next project phase.',
    };
  }

  return {
    href: '/interview',
    message:
      'This area is locked for the pilot session. Contact the administrator if you need access now.',
  };
}

export function isPilotParticipantRole(role: string | null | undefined): boolean {
  return isPilotRestrictedRole(role);
}

export function isPilotAllowedPath(path: string): boolean {
  const normalized = String(path || '').trim();
  return PILOT_ALLOWED_ROUTE_PREFIXES.some((prefix) =>
    prefix.endsWith('/')
      ? normalized.startsWith(prefix)
      : normalized === prefix || normalized.startsWith(`${prefix}/`)
  );
}

export function isPilotAllowedMenuId(id: string | null | undefined): boolean {
  return PILOT_VISIBLE_MENU_IDS.has(
    String(id || '')
      .trim()
      .toUpperCase()
  );
}

export function isPilotAllowedArtifactType(type: string | null | undefined): boolean {
  return PILOT_ALLOWED_ARTIFACT_TYPES.has(
    String(type || '')
      .trim()
      .toLowerCase()
  );
}

export function isPilotAllowedMyWorkTab(tab: string | null | undefined): boolean {
  return (
    String(tab || '')
      .trim()
      .toLowerCase() !== 'ideas'
  );
}

export function isPilotAllowedSettingsSection(section: string | null | undefined): boolean {
  return PILOT_ALLOWED_SETTINGS_SECTIONS.has(
    String(section || '')
      .trim()
      .toLowerCase()
  );
}

export function getPilotDefaultSettingsRoute(): string {
  return '/settings/profile';
}

export function getPilotBlockedFallbackPath(path?: string | null): string {
  const normalized = String(path || '')
    .trim()
    .toLowerCase();
  if (normalized.startsWith('/settings')) {
    return getPilotDefaultSettingsRoute();
  }
  if (normalized.startsWith('/my-work')) {
    return '/interview';
  }
  if (normalized.startsWith('/initiatives')) {
    return '/initiatives';
  }
  if (normalized.startsWith('/execution') || normalized.startsWith('/implementation')) {
    return '/execution';
  }
  return '/interview';
}

export function dispatchPilotAccessBlocked(detail?: {
  message?: string;
  href?: string;
  code?: string;
}): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent('access:blocked', {
        detail: {
          code: detail?.code || 'PILOT_LOCKED',
          message:
            detail?.message ||
            'This area will be available in the next project phase. Contact the administrator if you need access now.',
          cta: {
            label: 'Go to Interview',
            href: detail?.href || '/interview',
          },
        },
      })
    );
  } catch {
    // ignore UI-only notification errors
  }
}

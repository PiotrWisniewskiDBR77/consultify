export function normalizeAppRole(role: string | null | undefined): string {
  const normalized = String(role || '')
    .trim()
    .toUpperCase();

  if (normalized === 'SUPER_ADMIN') {
    return 'SUPERADMIN';
  }

  if (normalized === 'ADMINISTRATOR') {
    return 'ADMIN';
  }

  if (
    normalized === 'TEAM_MEMBER' ||
    normalized === 'MEMBER' ||
    normalized === 'PROJECT_MANAGER' ||
    normalized === 'MANAGER' ||
    normalized === 'CONSULTANT'
  ) {
    return 'USER';
  }

  if (normalized === 'VIEWER' || normalized === 'CLIENT') {
    return 'GUEST';
  }

  return normalized;
}

export function isSuperAdminRole(role: string | null | undefined): boolean {
  return normalizeAppRole(role) === 'SUPERADMIN';
}

export function isAdminOrSuperAdminRole(role: string | null | undefined): boolean {
  const normalized = normalizeAppRole(role);
  return normalized === 'ADMIN' || normalized === 'SUPERADMIN';
}

export function isAdminOwnerOrSuperAdminRole(role: string | null | undefined): boolean {
  const normalized = normalizeAppRole(role);
  return normalized === 'ADMIN' || normalized === 'OWNER' || normalized === 'SUPERADMIN';
}

/**
 * Delivery/staff roles that normalize to the USER band but are NOT pilot
 * respondents — they operate the platform (create/run initiatives, full app).
 * Genuine pilot respondents (bare USER, MEMBER/TEAM_MEMBER, GUEST/VIEWER/CLIENT)
 * stay restricted. Keep in sync with the server guard
 * (server/src/services/initiative/initiativeGovernanceGuard.ts → STAFF_EXEMPT_FROM_PILOT).
 */
const STAFF_EXEMPT_FROM_PILOT = new Set(['PROJECT_MANAGER', 'MANAGER', 'CONSULTANT']);

export function isPilotRestrictedRole(role: string | null | undefined): boolean {
  const raw = String(role || '')
    .trim()
    .toUpperCase();
  if (STAFF_EXEMPT_FROM_PILOT.has(raw)) return false;
  const normalized = normalizeAppRole(role);
  return normalized === 'USER' || normalized === 'GUEST';
}

export function getDefaultAuthenticatedRoute(role: string | null | undefined): string {
  if (isSuperAdminRole(role)) {
    return '/superadmin';
  }

  if (isPilotRestrictedRole(role)) {
    return '/interview';
  }

  return '/chat';
}

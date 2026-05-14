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
    normalized === 'MEMBER' ||
    normalized === 'TEAM_MEMBER' ||
    normalized === 'VIEWER' ||
    normalized === 'GUEST'
  ) {
    return 'USER';
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

export function isPilotRestrictedRole(role: string | null | undefined): boolean {
  const normalized = normalizeAppRole(role);
  return (
    normalized === 'USER' ||
    normalized === 'MEMBER' ||
    normalized === 'GUEST' ||
    normalized === 'TEAM_MEMBER' ||
    normalized === 'VIEWER'
  );
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

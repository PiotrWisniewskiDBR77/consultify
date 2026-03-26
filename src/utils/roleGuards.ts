export function normalizeAppRole(role: string | null | undefined): string {
  const normalized = String(role || '')
    .trim()
    .toUpperCase();

  if (normalized === 'SUPER_ADMIN') {
    return 'SUPERADMIN';
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

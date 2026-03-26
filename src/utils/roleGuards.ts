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

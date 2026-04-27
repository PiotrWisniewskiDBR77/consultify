export function normalizePlatformRole(role: string | null | undefined): string {
  const normalized = String(role || '')
    .trim()
    .toUpperCase();

  if (normalized === 'SUPER_ADMIN') return 'SUPERADMIN';
  return normalized;
}

export function parseForcedSuperAdminEmails(raw: string | null | undefined): Set<string> {
  return new Set(
    String(raw || '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isForcedSuperAdminEmail(
  email: string | null | undefined,
  raw = process.env.FORCE_SUPERADMIN_EMAILS
): boolean {
  const normalizedEmail = String(email || '')
    .trim()
    .toLowerCase();
  if (!normalizedEmail) return false;
  return parseForcedSuperAdminEmails(raw).has(normalizedEmail);
}

export function resolveAuthEffectiveRole(params: {
  email?: string | null;
  userRole?: string | null;
  membershipRole?: string | null;
  forcedSuperAdminEmails?: string | null;
}): string {
  const userRole = normalizePlatformRole(params.userRole);

  if (
    userRole === 'SUPERADMIN' ||
    isForcedSuperAdminEmail(params.email, params.forcedSuperAdminEmails)
  ) {
    return 'SUPERADMIN';
  }

  return normalizePlatformRole(params.membershipRole) || userRole;
}

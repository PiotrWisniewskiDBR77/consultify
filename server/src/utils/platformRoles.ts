import {
  normalizeApplicationRole,
  normalizePlatformRole as normalizePlatformRoleCanonical,
} from './roleNormalization.js';

export {
  defaultProjectRoleForApplicationRole,
  normalizeApplicationRole,
} from './roleNormalization.js';

export function normalizePlatformRole(role: string | null | undefined): string {
  return normalizePlatformRoleCanonical(role) || normalizeApplicationRole(role);
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
    isForcedSuperAdminEmail(params.email, params.forcedSuperAdminEmails || undefined)
  ) {
    return 'SUPERADMIN';
  }

  return normalizePlatformRole(params.membershipRole) || userRole;
}

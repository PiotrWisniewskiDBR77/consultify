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

// Unlike `normalizePlatformRole` above, this returns `null` when there is no
// role to normalize (missing/blank input) instead of silently defaulting to
// the application "USER" role. It exists so callers can distinguish "no
// membership row was found" from "a membership row exists with some role
// string in it" — `normalizeApplicationRole` has a non-nullable return type
// and defaults unrecognized/empty input to USER, which made any `||`
// fallback that follows it dead code (the left side was always truthy).
function normalizePlatformRoleOrNull(role: string | null | undefined): string | null {
  const trimmed = typeof role === 'string' ? role.trim() : role;
  if (!trimmed) return null;
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

  return normalizePlatformRoleOrNull(params.membershipRole) || userRole;
}

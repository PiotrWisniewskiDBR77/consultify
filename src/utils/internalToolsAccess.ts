import type { User } from '@/types';
import { normalizeAppRole } from '@/utils/roleGuards';

type InternalToolsUser = Pick<
  User,
  'email' | 'role' | 'companyName' | 'organizationName' | 'organizationId'
>;

const DEFAULT_ALLOWED_EMAIL_DOMAINS = ['dbr77.com'];
const DEFAULT_ALLOWED_ORG_NAMES = ['dbr77'];
const DEFAULT_ALLOWED_ROLES = ['SUPERADMIN', 'ADMIN', 'OWNER'];

function csv(value: unknown, fallback: string[]): string[] {
  const raw = typeof value === 'string' ? value : '';
  const parsed = raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : fallback;
}

function emailDomain(email?: string | null): string {
  return (
    String(email || '')
      .split('@')
      .pop()
      ?.trim()
      .toLowerCase() || ''
  );
}

export function isInternalToolsPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/ai/work-canvas' || path.startsWith('/ai/work-canvas/')) return false;
  return (
    path === '/ai' || path.startsWith('/ai/') || path === '/ai-os' || path.startsWith('/ai-os/')
  );
}

export function canUseInternalTools(user?: InternalToolsUser | null): boolean {
  if (import.meta.env.DEV) return true;
  if (import.meta.env.VITE_INTERNAL_TOOLS_ENABLED !== 'true') return false;
  if (!user?.email) return false;

  const allowedDomains = csv(
    import.meta.env.VITE_INTERNAL_TOOLS_ALLOWED_EMAIL_DOMAINS,
    DEFAULT_ALLOWED_EMAIL_DOMAINS
  );
  const allowedOrgNames = csv(
    import.meta.env.VITE_INTERNAL_TOOLS_ALLOWED_ORG_NAMES,
    DEFAULT_ALLOWED_ORG_NAMES
  );
  const allowedOrgIds = csv(import.meta.env.VITE_INTERNAL_TOOLS_ALLOWED_ORG_IDS, []);
  const allowedRoles = csv(
    import.meta.env.VITE_INTERNAL_TOOLS_ALLOWED_ROLES,
    DEFAULT_ALLOWED_ROLES
  ).map((role) => role.toUpperCase());

  const userOrgNames = [user.companyName, user.organizationName]
    .map((name) =>
      String(name || '')
        .trim()
        .toLowerCase()
    )
    .filter(Boolean);
  const userOrgId = String(user.organizationId || '')
    .trim()
    .toLowerCase();
  const hasAllowedOrgName = userOrgNames.some((name) => allowedOrgNames.includes(name));
  const hasAllowedOrgId = allowedOrgIds.length === 0 || allowedOrgIds.includes(userOrgId);

  return (
    allowedDomains.includes(emailDomain(user.email)) &&
    allowedRoles.includes(normalizeAppRole(user.role).toUpperCase()) &&
    (hasAllowedOrgName || hasAllowedOrgId)
  );
}

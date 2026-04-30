import type { NextFunction, Response } from 'express';

import type { AuthRequest } from './auth.middleware.js';

const DEFAULT_ALLOWED_EMAIL_DOMAINS = ['dbr77.com'];
const DEFAULT_ALLOWED_ROLES = ['SUPERADMIN', 'ADMIN', 'OWNER'];

function csv(value: unknown, fallback: string[]): string[] {
  const raw = typeof value === 'string' ? value : '';
  const parsed = raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : fallback;
}

function normalizeRole(role?: string | null): string {
  const normalized = String(role || '')
    .trim()
    .toUpperCase();

  if (normalized === 'SUPER_ADMIN' || normalized === 'OWNER') return 'SUPERADMIN';
  if (normalized === 'ADMINISTRATOR') return 'ADMIN';
  return normalized;
}

function emailDomain(email?: string | null): string {
  return String(email || '')
    .split('@')
    .pop()
    ?.trim()
    .toLowerCase() || '';
}

function isInternalToolsEnabled(): boolean {
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') return true;
  return process.env.INTERNAL_TOOLS_ENABLED === 'true';
}

export function requireInternalToolsAccess(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!isInternalToolsEnabled()) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const user = req.user;
  if (!user?.email) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const allowedDomains = csv(
    process.env.INTERNAL_TOOLS_ALLOWED_EMAIL_DOMAINS,
    DEFAULT_ALLOWED_EMAIL_DOMAINS
  );
  const allowedRoles = csv(
    process.env.INTERNAL_TOOLS_ALLOWED_ROLES,
    DEFAULT_ALLOWED_ROLES
  ).map((role) => role.toUpperCase());
  const allowedOrgIds = csv(process.env.INTERNAL_TOOLS_ALLOWED_ORG_IDS, []);

  const orgId = String(user.organizationId || req.organizationId || '').trim().toLowerCase();
  const hasAllowedOrg = allowedOrgIds.length === 0 || allowedOrgIds.includes(orgId);
  const hasAllowedDomain = allowedDomains.includes(emailDomain(user.email));
  const hasAllowedRole = allowedRoles.includes(normalizeRole(user.role));

  if (!hasAllowedDomain || !hasAllowedRole || !hasAllowedOrg) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  next();
}

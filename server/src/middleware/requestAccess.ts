import type { AuthRequest } from './auth.middleware.js';

export type RequestAccessRole = 'superadmin' | 'owner' | 'admin' | 'member' | 'guest' | '';
const MAX_ACCESS_ROLE_INPUT_CHARS = 128;

const safeRead = <T>(reader: () => T, fallback: T): T => {
  try {
    return reader();
  } catch {
    return fallback;
  }
};

export const normalizeAccessRole = (role?: unknown): RequestAccessRole => {
  const normalized = safeRead(() => {
    if (role === null || role === undefined) return '';
    const roleInput =
      role instanceof String
        ? role.valueOf()
        : typeof role === 'string' || typeof role === 'number' || typeof role === 'bigint'
          ? role
          : '';
    if (roleInput === '') return '';
    return String(role)
      .slice(0, MAX_ACCESS_ROLE_INPUT_CHARS)
      .normalize('NFKC')
      .replace(/[\x00-\x1F\x7F]+/g, '')
      .replace(/[\u200B-\u200D\uFEFF]+/g, '')
      .replace(/[\u202A-\u202E\u2060-\u2069]+/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');
  }, '');

  if (!normalized) return '';

  if (normalized === 'superadmin' || normalized === 'super_admin' || normalized === 'super-admin') {
    return 'superadmin';
  }

  if (normalized === 'owner') return 'owner';
  if (normalized === 'admin' || normalized === 'administrator') return 'admin';
  if (normalized === 'guest' || normalized === 'viewer' || normalized === 'client') {
    return 'guest';
  }

  return 'member';
};

export const isRequestSuperAdmin = (req: AuthRequest): boolean => {
  if (safeRead(() => req.user?.isSuperAdmin === true, false)) return true;
  const userRoleSnapshot = safeRead(() => req.userRole, undefined);
  return normalizeAccessRole(userRoleSnapshot) === 'superadmin';
};

export const getRequestAccessRole = (req: AuthRequest): RequestAccessRole => {
  const requestUserSnapshot = safeRead(() => req.user, undefined as AuthRequest['user']);
  const userRoleSnapshot = safeRead(() => req.userRole, undefined);
  if (
    safeRead(() => requestUserSnapshot?.isSuperAdmin === true, false) ||
    normalizeAccessRole(userRoleSnapshot) === 'superadmin'
  ) {
    return 'superadmin';
  }

  const rawRole = normalizeAccessRole(userRoleSnapshot);
  if (rawRole) return rawRole;

  return normalizeAccessRole(safeRead(() => requestUserSnapshot?.role, undefined));
};

export const getSettingsActorRole = (
  req: AuthRequest
): Exclude<RequestAccessRole, 'superadmin' | ''> => {
  const resolvedRole = getRequestAccessRole(req);
  if (resolvedRole === 'superadmin') return 'owner';
  if (resolvedRole === 'owner' || resolvedRole === 'admin' || resolvedRole === 'guest') {
    return resolvedRole;
  }

  return 'member';
};

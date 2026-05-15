import type { AuthRequest } from './auth.middleware.js';

export type RequestAccessRole = 'superadmin' | 'owner' | 'admin' | 'member' | 'guest' | '';

const hasOwn = (obj: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key);

const isOwnSuperAdminTrue = (user: AuthRequest['user'] | undefined): boolean => {
  if (!user || typeof user !== 'object' || !hasOwn(user as object, 'isSuperAdmin')) {
    return false;
  }
  return user.isSuperAdmin === true;
};

const getOwnUserRole = (user: AuthRequest['user'] | undefined): unknown => {
  if (!user || typeof user !== 'object' || !hasOwn(user as object, 'role')) {
    return undefined;
  }
  return user.role;
};

export const normalizeAccessRole = (role?: string): RequestAccessRole => {
  const normalized = String(role || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

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
  if (isOwnSuperAdminTrue(req.user)) return true;
  return normalizeAccessRole(req.userRole) === 'superadmin';
};

export const getRequestAccessRole = (req: AuthRequest): RequestAccessRole => {
  if (isRequestSuperAdmin(req)) return 'superadmin';

  const rawRole = normalizeAccessRole(req.userRole);
  if (rawRole) return rawRole;

  return normalizeAccessRole(getOwnUserRole(req.user));
};

export const getSettingsActorRole = (
  req: AuthRequest
): Exclude<RequestAccessRole, 'superadmin' | ''> => {
  if (isRequestSuperAdmin(req)) return 'owner';

  const resolvedRole = getRequestAccessRole(req);
  if (resolvedRole === 'owner' || resolvedRole === 'admin' || resolvedRole === 'guest') {
    return resolvedRole;
  }

  return 'member';
};

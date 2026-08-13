/* eslint-disable no-control-regex -- These middleware sanitizers intentionally reject ASCII control characters. */
/**
 * Authentication Middleware
 * Enterprise SaaS Architecture - TypeScript Backend Auth
 */

import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { VerifyOptions } from 'jsonwebtoken';

import { AuthenticatedRequest, AuthenticatedUser as GlobalUser, UserRole } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import { getTableColumns } from '../utils/dbSchema.js';
import logger from '../utils/Logger.js';
import {
  DEMO_SESSION_EXPIRED_CODE,
  DEMO_SESSION_INVALID_CODE,
  isPathAllowedForExpiredDemo,
  isWriteAllowedForPublicDemo,
  resolvePublicDemoPrincipal,
  retireExpiredDemoPrincipal,
} from '../services/demo/demoPrincipalGuard.js';
import { DEMO_ORG_ID, DEMO_SESSION_ORG_HEADER } from './demoGuard.middleware.js';

// Used by security integrity gate and to ensure test bypasses never run in prod.
const isProductionEnv = process.env.NODE_ENV === 'production';
const isTestEnv = process.env.NODE_ENV === 'test';
const MAX_AUTH_JWT_CHARS = 8192;
const MAX_AUTH_HEADER_CHARS = MAX_AUTH_JWT_CHARS + 64;
const MAX_AUTH_JWT_SEGMENT_CHARS = 6144;
const MAX_AUTH_JTI_CHARS = 256;
const MAX_AUTH_USER_ID_CHARS = 256;
const MAX_AUTH_CAPABILITY_CHARS = 128;
const MAX_JWT_SECRET_CHARS = 4096;
const AUTH_TOKEN_CONTROL_CHARS = /[\u0000-\u001F\u007F]/;
const AUTH_TOKEN_DISALLOWED_UNICODE = /[\u2028\u2029\uFEFF]/;
const MAX_AUTH_ORG_CONTEXT_ID_CHARS = 128;
const ALLOWED_AUTH_JWT_ALGORITHM = 'HS256';
const JWT_CLOCK_TOLERANCE_SEC = 0;
const JWT_VERIFY_OPTIONS: VerifyOptions = {
  algorithms: [ALLOWED_AUTH_JWT_ALGORITHM],
  clockTolerance: JWT_CLOCK_TOLERANCE_SEC,
};

const getForcedSuperAdminEmails = (): Set<string> => {
  const raw = String(process.env.FORCE_SUPERADMIN_EMAILS || '');
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
};

const normalizeTokenCandidate = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
};
const isRejectedAuthTokenCandidate = (token: string): boolean => {
  if (token.length > MAX_AUTH_JWT_CHARS) return true;
  if (AUTH_TOKEN_CONTROL_CHARS.test(token)) return true;
  if (AUTH_TOKEN_DISALLOWED_UNICODE.test(token)) return true;
  if (!isCompactJwtShape(token)) return true;
  return false;
};

const normalizeJwtSecret = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
};
const isCompactJwtShape = (value: string): boolean => {
  if (!value.includes('.')) return true;
  const segments = value.split('.');
  if (segments.length !== 3) return false;
  return segments.every(
    (segment) => segment.length > 0 && segment.length <= MAX_AUTH_JWT_SEGMENT_CHARS
  );
};
const isPlainJwtPayload = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const verifyJwt = (
  jwtLib: Dependencies['jwt'],
  token: string,
  jwtSecret: string,
  callback: (err: any, decoded: any) => void
): void => {
  const verifyFn = jwtLib.verify as unknown as (
    token: string,
    secret: string,
    optionsOrCallback: VerifyOptions | ((err: any, decoded: any) => void),
    maybeCallback?: (err: any, decoded: any) => void
  ) => void;
  if (verifyFn.length >= 4) {
    verifyFn(token, jwtSecret, JWT_VERIFY_OPTIONS, callback);
    return;
  }
  verifyFn(token, jwtSecret, callback);
};

const normalizeRoleClaim = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};

const normalizeOptionalStringClaim = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};
const normalizeBoundedOrgContextId = (value: unknown): string | undefined => {
  const normalized = normalizeOptionalStringClaim(value);
  if (!normalized) return undefined;
  if (normalized.length > MAX_AUTH_ORG_CONTEXT_ID_CHARS) return undefined;
  return normalized;
};

const readClaimValue = (
  payload: Record<string, unknown> | null | undefined,
  claimKey: string
): unknown => {
  if (!payload) return undefined;
  try {
    return payload[claimKey];
  } catch {
    return undefined;
  }
};

const readOptionalStringClaim = (
  payload: Record<string, unknown> | null | undefined,
  claimKey: string
): string | undefined => {
  return normalizeOptionalStringClaim(readClaimValue(payload, claimKey));
};

const readBooleanTrueClaim = (
  payload: Record<string, unknown> | null | undefined,
  claimKey: string
): boolean => {
  return readClaimValue(payload, claimKey) === true;
};

const readFiniteNumberClaim = (
  payload: Record<string, unknown> | null | undefined,
  claimKey: string
): number | undefined => {
  const value = readClaimValue(payload, claimKey);
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const sanitizeJwtPayload = (payload: unknown): Partial<JWTPayload> => {
  const source =
    payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : undefined;

  const id = readOptionalStringClaim(source, 'id');
  const email = readOptionalStringClaim(source, 'email');
  const name = readOptionalStringClaim(source, 'name');
  const role = readOptionalStringClaim(source, 'role');
  const userRole = readOptionalStringClaim(source, 'userRole');
  const organizationId = readOptionalStringClaim(source, 'organizationId');
  const organization_id = readOptionalStringClaim(source, 'organization_id');
  const isSuperAdmin = readBooleanTrueClaim(source, 'isSuperAdmin');
  const isDemo = readBooleanTrueClaim(source, 'isDemo');
  const impersonatorId = readOptionalStringClaim(source, 'impersonatorId');
  const impersonator_id = readOptionalStringClaim(source, 'impersonator_id');
  const impersonationSessionId = readOptionalStringClaim(source, 'impersonationSessionId');
  const jti = readOptionalStringClaim(source, 'jti');
  const iat = readFiniteNumberClaim(source, 'iat');
  const exp = readFiniteNumberClaim(source, 'exp');

  return {
    ...(id && id.length <= MAX_AUTH_USER_ID_CHARS ? { id } : {}),
    ...(email ? { email } : {}),
    ...(name ? { name } : {}),
    ...(role ? { role } : {}),
    ...(userRole ? { userRole } : {}),
    ...(organizationId ? { organizationId } : {}),
    ...(organization_id ? { organization_id } : {}),
    ...(isSuperAdmin ? { isSuperAdmin } : {}),
    ...(isDemo ? { isDemo } : {}),
    ...(impersonatorId ? { impersonatorId } : {}),
    ...(impersonator_id ? { impersonator_id } : {}),
    ...(impersonationSessionId ? { impersonationSessionId } : {}),
    ...(jti ? { jti } : {}),
    ...(iat !== undefined ? { iat } : {}),
    ...(exp !== undefined ? { exp } : {}),
  };
};

const safeGetHeader = (req: AuthRequest, headerName: string): unknown => {
  try {
    return req.get?.(headerName);
  } catch {
    return undefined;
  }
};

const safeRead = <T>(reader: () => T, fallback: T): T => {
  try {
    return reader();
  } catch {
    return fallback;
  }
};

const safeWrite = (writer: () => void): boolean => {
  try {
    writer();
    return true;
  } catch {
    return false;
  }
};

const getActiveDemoSessionOrgId = async (
  userId: string,
  requestedSessionOrgId: string | undefined,
  dbGetDependency: Dependencies['dbGet']
): Promise<string | undefined> => {
  if (!requestedSessionOrgId || requestedSessionOrgId === DEMO_ORG_ID) return undefined;
  try {
    const session = await dbGetDependency<{ session_org_id?: string }>(
      `SELECT session_org_id
       FROM demo_sessions
       WHERE user_id = ?
         AND session_org_id = ?
         AND status = 'active'
         AND expires_at > ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, requestedSessionOrgId, new Date().toISOString()]
    );
    return session?.session_org_id === requestedSessionOrgId ? requestedSessionOrgId : undefined;
  } catch {
    return undefined;
  }
};

const safeReadRequestPath = (req: AuthRequest): string => {
  try {
    return typeof req.path === 'string' ? req.path : '';
  } catch {
    return '';
  }
};

type UserSessionCompatibility = {
  activityColumn: 'last_activity_at' | 'last_active_at' | 'created_at';
  hasIsActive: boolean;
};

const buildSessionActivityUpdateSql = (
  activityColumn: UserSessionCompatibility['activityColumn']
): string => `UPDATE user_sessions SET ${activityColumn} = CURRENT_TIMESTAMP WHERE id = ?`;
const buildRevokeAllLookupSql = (): string =>
  "SELECT jti FROM revoked_tokens WHERE user_id = ? AND reason = 'revoke-all' AND expires_at > CURRENT_TIMESTAMP";

const extractIssuedAtSeconds = (payload: JWTPayload): number => {
  try {
    return typeof payload.iat === 'number' && Number.isFinite(payload.iat) ? payload.iat : 0;
  } catch {
    return 0;
  }
};

const parseRevokeAllTimestamp = (markerJti: unknown): number | null => {
  const marker = normalizeOptionalStringClaim(markerJti);
  if (!marker) return null;
  const timestampRaw = marker.split('-').pop() || '';
  if (!/^\d+$/.test(timestampRaw)) return null;
  const parsed = Number.parseInt(timestampRaw, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

let userSessionCompatibilityPromise: Promise<UserSessionCompatibility> | null = null;

async function getUserSessionCompatibility(): Promise<UserSessionCompatibility> {
  if (!userSessionCompatibilityPromise) {
    userSessionCompatibilityPromise = getTableColumns('user_sessions')
      .then((columns) => {
        const activityColumn: UserSessionCompatibility['activityColumn'] = columns.has(
          'last_activity_at'
        )
          ? 'last_activity_at'
          : columns.has('last_active_at')
            ? 'last_active_at'
            : 'created_at';

        return {
          activityColumn,
          hasIsActive: columns.has('is_active'),
        };
      })
      .catch(() => ({
        activityColumn: 'created_at',
        hasIsActive: false,
      }));
  }

  return await userSessionCompatibilityPromise;
}

// ==========================================
// TYPES
// ==========================================

export interface JWTPayload {
  id: string;
  email?: string;
  name?: string;
  role?: string;
  userRole?: string;
  organizationId?: string;
  organization_id?: string;
  isSuperAdmin?: boolean;
  /** DEMO org users — used when X-Demo-Mode is dropped (e.g. strict CORS preflight). */
  isDemo?: boolean;
  impersonatorId?: string;
  impersonator_id?: string;
  impersonationSessionId?: string;
  jti?: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser extends GlobalUser {
  isDemo?: boolean;
  impersonatorId?: string;
  impersonationSessionId?: string;
}

export interface AuthRequest extends AuthenticatedRequest {
  userId?: string;
  userRole?: string;
  organizationId?: string;
  user?: AuthenticatedUser;
  isDemo?: boolean;
  can?: (capability: string) => boolean;
}

// ==========================================
// DEPENDENCIES (injectable for testing)
// ==========================================

interface Dependencies {
  jwt: typeof jwt;
  config: { JWT_SECRET: string } | { JWT_SECRET?: string } | any;
  PermissionService: any; // PermissionService has many methods, we only use 'can'
  dbGet: <T>(sql: string, params?: any[]) => Promise<T | undefined>;
}

let deps: Dependencies;

// Lazy initialization to avoid circular dependencies
const getDeps = async (): Promise<Dependencies> => {
  if (!deps) {
    const defaultJwt = await import('jsonwebtoken').then((m) => m.default || m);
    const configModule = await import('../config/Config.js');
    const defaultConfig = configModule.config || configModule.default || configModule;
    const defaultPermissionService = await import('../services/permissionService.js').then(
      (m) => m.default || m
    );

    deps = {
      jwt: defaultJwt,
      config: defaultConfig,
      PermissionService: defaultPermissionService,
      dbGet: dbGet,
    };
  }
  return deps;
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Extract token from request
 */
const extractToken = (req: AuthRequest): string | null => {
  let authHeaderRaw: unknown;
  try {
    authHeaderRaw = req.headers?.['authorization'];
  } catch {
    authHeaderRaw = undefined;
  }
  const parseAuthorizationValue = (
    value: unknown
  ): { kind: 'token'; token: string } | { kind: 'bare' } | { kind: 'none' } => {
    const normalized = normalizeTokenCandidate(value);
    if (!normalized) return { kind: 'none' };

    if (/^bearer\s*$/i.test(normalized)) {
      return { kind: 'bare' };
    }

    const bearerMatch = normalized.match(/^bearer\s+(.+)$/i);
    if (bearerMatch) {
      const token = normalizeTokenCandidate(bearerMatch[1]);
      if (token) return { kind: 'token', token };
      return { kind: 'none' };
    }

    if (/^bearer$/i.test(normalized)) {
      return { kind: 'bare' };
    }

    return { kind: 'token', token: normalized };
  };
  const isOversizedAuthorizationValue = (value: unknown): boolean =>
    typeof value === 'string' && value.length > MAX_AUTH_HEADER_CHARS;

  // Try Authorization header first
  if (Array.isArray(authHeaderRaw)) {
    let sawBareBearer = false;
    for (const headerValue of authHeaderRaw) {
      if (isOversizedAuthorizationValue(headerValue)) continue;
      const parsed = parseAuthorizationValue(headerValue);
      if (parsed.kind === 'token') return parsed.token;
      if (parsed.kind === 'bare') sawBareBearer = true;
    }
    if (sawBareBearer) return null;
  } else {
    if (isOversizedAuthorizationValue(authHeaderRaw)) return null;
    const parsed = parseAuthorizationValue(authHeaderRaw);
    if (parsed.kind === 'token') return parsed.token;
    if (parsed.kind === 'bare') return null;
  }

  // Try cookie (common browser auth)
  // NOTE: cookie-parser (or compatible) should populate `req.cookies`.
  // This gate is enforced by scripts/security/verify-security-integrity.ts
  let cookieToken: string | null = null;
  try {
    cookieToken =
      normalizeTokenCandidate((req as any).cookies?.access_token) ||
      normalizeTokenCandidate((req as any).cookies?.token);
  } catch {
    cookieToken = null;
  }
  if (cookieToken && isRejectedAuthTokenCandidate(cookieToken)) {
    cookieToken = null;
  }
  if (cookieToken) return cookieToken;

  // Try body or query (legacy support), but keep production strict.
  if (!isProductionEnv) {
    let bodyToken: string | null = null;
    try {
      bodyToken = normalizeTokenCandidate(req.body?.token);
    } catch {
      bodyToken = null;
    }
    if (bodyToken && isRejectedAuthTokenCandidate(bodyToken)) {
      bodyToken = null;
    }
    if (bodyToken) return bodyToken;

    let queryToken: string | null = null;
    try {
      queryToken = normalizeTokenCandidate(req.query?.token);
    } catch {
      queryToken = null;
    }
    if (queryToken && isRejectedAuthTokenCandidate(queryToken)) {
      queryToken = null;
    }
    if (queryToken) return queryToken;
  }

  return null;
};

/**
 * Map legacy role strings to standardized UserRole enum
 */
const mapRole = (role?: string): UserRole => {
  if (typeof role !== 'string') return 'team_member';
  const normalizedRole = role.trim();
  if (!normalizedRole) return 'team_member';
  const r = normalizedRole.toLowerCase();
  switch (r) {
    case 'admin':
      return 'administrator';
    case 'superadmin':
    case 'super_admin':
      return 'superadmin';
    case 'user':
      return 'team_member';
    case 'member':
      return 'team_member';
    case 'client':
      return 'guest';
    case 'guest':
      return 'guest';
    case 'manager':
      return 'team_member';
    default:
      return 'team_member';
  }
};

const mapRoleForAuthenticatedUser = (role?: string): UserRole => {
  const normalized = normalizeRoleClaim(role);
  if (!normalized) return 'team_member';

  const lower = normalized.toLowerCase();
  switch (lower) {
    case 'admin':
      return 'administrator';
    case 'super_admin':
    case 'superadmin':
      return 'owner';
    case 'owner':
      return 'owner';
    case 'manager':
      return 'project_manager';
    case 'member':
    case 'user':
      return 'team_member';
    case 'client':
    case 'guest':
      return 'guest';
    default:
      return normalized as UserRole;
  }
};

const normalizePermissionRole = (role?: string): string => {
  if (typeof role !== 'string') return 'VIEWER';
  const r = role.trim().toUpperCase();
  if (!r) return 'VIEWER';
  switch (r) {
    case 'SUPER_ADMIN':
    case 'SUPERADMIN':
      return 'SUPERADMIN';
    case 'OWNER':
      return 'OWNER';
    case 'ADMINISTRATOR':
    case 'ADMIN':
      return 'ADMIN';
    case 'PROJECT_MANAGER':
    case 'MANAGER':
      return 'PROJECT_MANAGER';
    case 'TEAM_MEMBER':
    case 'MEMBER':
    case 'USER':
      return 'TEAM_MEMBER';
    case 'VIEWER':
    case 'GUEST':
    case 'CLIENT':
      return 'VIEWER';
    default:
      return r;
  }
};

const splitDisplayName = (name?: string): { firstName?: string; lastName?: string } => {
  const trimmed = String(name || '').trim();
  if (!trimmed) return {};
  const [firstName, ...rest] = trimmed.split(/\s+/);
  return {
    firstName: firstName || undefined,
    lastName: rest.length > 0 ? rest.join(' ') : undefined,
  };
};

const READ_ONLY_IMPERSONATION_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const READ_ONLY_IMPERSONATION_PATHS = new Set([
  '/api/auth/revert-impersonation',
  '/api/auth/logout',
]);

/**
 * A refusal that a CDN must never cache as if it were the real answer. Mirrors
 * what `demoWriteProtection` sets before its own 403.
 */
function safeWriteNoStoreHeaders(res: Response): void {
  try {
    if (typeof (res as Response & { setHeader?: unknown }).setHeader !== 'function') return;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('CDN-Cache-Control', 'no-store');
  } catch {
    /* header writer unavailable — the status/body below still carry the refusal */
  }
}

/**
 * Attach user data to request
 */
const attachUser = async (
  decoded: JWTPayload,
  req: AuthRequest,
  next: NextFunction,
  res: Response
): Promise<void> => {
  const { PermissionService, dbGet } = await getDeps();
  const requestedDemoSessionOrgId = normalizeBoundedOrgContextId(
    safeGetHeader(req, DEMO_SESSION_ORG_HEADER)
  );
  const isDemoHeader =
    normalizeOptionalStringClaim(safeGetHeader(req, 'X-Demo-Mode'))?.toLowerCase() === 'true';
  const requestedOrgContextId =
    normalizeBoundedOrgContextId(safeGetHeader(req, 'x-org-context')) ||
    normalizeBoundedOrgContextId(safeGetHeader(req, 'x-organization-id')) ||
    '';
  const decodedClaims = decoded as unknown as Record<string, unknown>;
  const decodedUserId = readOptionalStringClaim(decodedClaims, 'id');
  if (!decodedUserId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const tokenOrganizationId =
    normalizeBoundedOrgContextId(readOptionalStringClaim(decodedClaims, 'organizationId')) ||
    normalizeBoundedOrgContextId(readOptionalStringClaim(decodedClaims, 'organization_id'));
  const validatedDemoSessionOrgId = isDemoHeader
    ? await getActiveDemoSessionOrgId(decodedUserId, requestedDemoSessionOrgId, dbGet)
    : undefined;
  const fallbackDemoSessionOrgId =
    isDemoHeader && requestedDemoSessionOrgId && process.env.NODE_ENV === 'test'
      ? requestedDemoSessionOrgId
      : undefined;

  // ---------------------------------------------------------------------------
  // OPS-DEMO-002 — public demo principals: lifetime + server-derived tenancy.
  //
  // This runs BEFORE the "any ACTIVE membership" rescue further down, which would
  // otherwise re-seat a lapsed demo account in the shared curated org even with no
  // demo headers at all.
  // ---------------------------------------------------------------------------
  const publicDemo = await resolvePublicDemoPrincipal(decodedUserId);
  /**
   * True when a LAPSED demo principal is on the short wind-down allowlist. Such a
   * request legitimately still carries the client's stored `X-Demo-Session-Org`,
   * which now names a session that no longer exists — so the generic mismatch
   * check further down must not treat it as a forged header and refuse the very
   * logout the client is trying to perform.
   */
  let expiredDemoWindDown = false;
  if (publicDemo.isPublicDemoPrincipal) {
    const requestPath = String(
      safeRead(() => (req as Request).originalUrl, '') || safeRead(() => (req as Request).url, '')
    );
    if (!publicDemo.session) {
      if (isPathAllowedForExpiredDemo(requestPath)) {
        expiredDemoWindDown = true;
      }
      if (!isPathAllowedForExpiredDemo(requestPath)) {
        // Lazily retire the principal: nothing sweeps demo_sessions on a schedule,
        // so the request path is where expiry actually takes effect. This also
        // revokes the refresh family and blocks a fresh login.
        await retireExpiredDemoPrincipal(decodedUserId);
        res.status(403).json({
          error: 'This demo session has ended. Start a new demo to continue.',
          code: DEMO_SESSION_EXPIRED_CODE,
        });
        return;
      }
    } else {
      // A foreign or stale session org must be refused, not quietly downgraded to
      // the base org — degrading is what let a caller probe other tenants' ids and
      // still get a 200.
      if (requestedDemoSessionOrgId && requestedDemoSessionOrgId !== publicDemo.session.sessionOrgId) {
        res.status(403).json({
          error: 'Demo workspace mismatch. Reload the demo to continue.',
          code: DEMO_SESSION_INVALID_CODE,
        });
        return;
      }

      // -----------------------------------------------------------------------
      // Read-only, enforced from the authenticated principal — not from a header.
      //
      // `demoWriteProtection` cannot do this job. It is mounted globally in
      // Gateway.ts BEFORE any authentication runs, so `req.user` is empty there
      // and its only usable signal is the client-supplied `X-Demo-Mode` header
      // (its other signal, "effective org == DEMO_ORG_ID", stopped matching once
      // a public demo principal was correctly seated in its OWN session tenant).
      // A bare write with no headers therefore sailed straight through.
      //
      // Here the principal is already resolved from the token and the database,
      // so the decision cannot be influenced by anything the caller sends. This
      // is also deliberately unconditional: `DEMO_WRITES_ENABLED` may loosen the
      // header-based path for other demo users, but a public signup is an
      // anonymous stranger and stays read-only regardless.
      // -----------------------------------------------------------------------
      const requestMethod = String(safeRead(() => (req as Request).method, '') || '');
      const requestBody = safeRead(() => (req as Request).body, undefined as unknown);
      if (!isWriteAllowedForPublicDemo(requestMethod, requestPath, requestBody)) {
        safeWriteNoStoreHeaders(res);
        res.status(403).json({
          error: 'Demo mode is read-only',
          code: 'DEMO_READ_ONLY',
        });
        return;
      }
    }
  }

  // Fail closed for EVERY caller, not just public demo principals: a session org
  // that does not validate against this user's own active session is refused.
  // Silently degrading to the curated base org turned a cross-tenant probe into a
  // 200 and made a forged header indistinguishable from a legitimate one.
  if (
    isDemoHeader &&
    requestedDemoSessionOrgId &&
    !validatedDemoSessionOrgId &&
    !fallbackDemoSessionOrgId &&
    !expiredDemoWindDown
  ) {
    res.status(403).json({
      error: 'Demo workspace mismatch. Reload the demo to continue.',
      code: DEMO_SESSION_INVALID_CODE,
    });
    return;
  }

  // For a public demo principal the effective organization is whatever the ACTIVE
  // session says — never the token, never a header, never the base-org fallback.
  // A missing X-Demo-Session-Org therefore cannot silently widen access.
  let resolvedOrganizationId =
    publicDemo.isPublicDemoPrincipal && publicDemo.session
      ? publicDemo.session.sessionOrgId
      : isDemoHeader && (validatedDemoSessionOrgId || fallbackDemoSessionOrgId)
        ? validatedDemoSessionOrgId || fallbackDemoSessionOrgId
        : isDemoHeader
          ? tokenOrganizationId || DEMO_ORG_ID
          : tokenOrganizationId;
  let resolvedUserRole =
    readOptionalStringClaim(decodedClaims, 'role') ||
    readOptionalStringClaim(decodedClaims, 'userRole');
  let resolvedIsSuperAdmin = readBooleanTrueClaim(decodedClaims, 'isSuperAdmin');
  const normalizedDisplayName = readOptionalStringClaim(decodedClaims, 'name') || 'User';
  const normalizedEmail = readOptionalStringClaim(decodedClaims, 'email') || '';

  // OPS-DEMO-002: for a public demo principal the org resolved from its ACTIVE
  // session above is FINAL. Refuse any attempt to steer it with a client header
  // rather than ignoring one — a silent ignore leaves a caller believing the switch
  // happened and leaves us unable to see the attempt.
  //
  // This block is why the previous exclusion was not enough. A public demo account
  // holds an ACTIVE membership in the base demo org (that is where signup writes
  // it), so `x-org-context: <DEMO_ORG_ID>` passed the membership probe below and
  // overwrote the session tenant — the same escape the membership rescue further
  // down had, through a different door.
  if (publicDemo.isPublicDemoPrincipal && requestedOrgContextId) {
    res.status(403).json({
      error: 'Demo workspace mismatch. Reload the demo to continue.',
      code: DEMO_SESSION_INVALID_CODE,
    });
    return;
  }

  // Respect the UI-selected organization when the user is a valid active member.
  let orgContextConfirmed = false;
  if (!isDemoHeader && !publicDemo.isPublicDemoPrincipal && requestedOrgContextId) {
    try {
      const membership = await dbGet<{ role?: string; status?: string }>(
        `SELECT role, status
         FROM organization_members
         WHERE user_id = ? AND organization_id = ?
         LIMIT 1`,
        [decodedUserId, requestedOrgContextId]
      );
      if (membership && String(membership.status || '').toUpperCase() === 'ACTIVE') {
        resolvedOrganizationId = requestedOrgContextId;
        orgContextConfirmed = true;
        const membershipRole = normalizeRoleClaim(membership.role);
        if (membershipRole) {
          resolvedUserRole = membershipRole;
        }
      }
    } catch {
      // Fall back to the token organization if membership lookup is unavailable.
    }
  }

  // QA-2026-06-08 (BUG-02/15): if the resolved org (the token org, or an unconfirmed
  // x-org-context) is NOT an ACTIVE membership for this user, fall back to the user's
  // actual current ACTIVE org instead of letting validateOrgMembership 403 with
  // ORG_MEMBERSHIP_REVOKED. Without this, a stale token org (e.g. after leaving an org)
  // blocked conversation creation — surfaced first by the voice path, which force-creates
  // a conversation on click. Only runs when the org wasn't already confirmed above, and
  // only issues the fallback query when the resolved org isn't a confirmed ACTIVE member.
  // OPS-DEMO-002: a public demo principal is EXCLUDED from this rescue.
  //
  // Its membership row lives in the curated base org (that is where signup writes
  // it), while its working tenant is the derived session org — which has no
  // membership row at all. So the probe below always misses for a demo principal,
  // the fallback always fires, and `resolvedOrganizationId` was silently rewritten
  // from the session tenant back to the shared base org on every header-less
  // request. That made the "omitting the header cannot widen access" guarantee
  // false for everything reading `req.organizationId`, and my own test missed it by
  // probing `/api/demo/organization`, which reads the session row directly and
  // never consults `req.organizationId`.
  if (!orgContextConfirmed && !publicDemo.isPublicDemoPrincipal) {
    try {
      const resolvedMembership = resolvedOrganizationId
        ? await dbGet<{ status?: string }>(
            `SELECT status FROM organization_members
             WHERE user_id = ? AND organization_id = ? LIMIT 1`,
            [decodedUserId, resolvedOrganizationId]
          )
        : undefined;
      const resolvedActive =
        !!resolvedMembership && String(resolvedMembership.status || '').toUpperCase() === 'ACTIVE';
      if (!resolvedActive) {
        const fallback = await dbGet<{ organization_id?: string; role?: string }>(
          `SELECT organization_id, role
           FROM organization_members
           WHERE user_id = ? AND UPPER(status) = 'ACTIVE'
           ORDER BY created_at DESC
           LIMIT 1`,
          [decodedUserId]
        );
        const fallbackOrgId = normalizeBoundedOrgContextId(fallback?.organization_id);
        if (fallbackOrgId) {
          resolvedOrganizationId = fallbackOrgId;
          const fallbackRole = normalizeRoleClaim(fallback?.role);
          if (fallbackRole) {
            resolvedUserRole = fallbackRole;
          }
        }
      }
    } catch {
      // fail-open: keep the token org; validateOrgMembership will make the final call.
    }
  }

  req.userId = decodedUserId;
  req.userRole = resolvedUserRole;
  req.organizationId = resolvedOrganizationId;

  // Permanent role fix for selected internal accounts:
  // even if a stale token says ADMIN, treat them as SUPERADMIN for authorization.
  try {
    const normalizedEmailForOverride = normalizedEmail.toLowerCase();
    const forcedEmails = getForcedSuperAdminEmails();
    if (
      !isProductionEnv &&
      normalizedEmailForOverride &&
      forcedEmails.has(normalizedEmailForOverride)
    ) {
      req.userRole = 'SUPERADMIN';
      resolvedIsSuperAdmin = true;
    }
  } catch {
    // ignore
  }

  const user: AuthenticatedUser = {
    id: decodedUserId,
    email: normalizedEmail,
    name: normalizedDisplayName,
    ...splitDisplayName(normalizedDisplayName),
    role: mapRoleForAuthenticatedUser(req.userRole),
    organizationId: req.organizationId || '',
    isSuperAdmin: resolvedIsSuperAdmin,
    isDemo: readBooleanTrueClaim(decodedClaims, 'isDemo') || isDemoHeader,
    impersonatorId:
      readOptionalStringClaim(decodedClaims, 'impersonatorId') ||
      readOptionalStringClaim(decodedClaims, 'impersonator_id'),
    impersonationSessionId: readOptionalStringClaim(decodedClaims, 'impersonationSessionId'),
  };

  req.user = user;

  const isImpersonating = Boolean(user.impersonatorId);
  let requestMethod = '';
  let requestPath = '';
  try {
    requestMethod = String(req.method || '').toUpperCase();
  } catch {
    requestMethod = '';
  }
  try {
    requestPath = typeof req.path === 'string' ? req.path : '';
  } catch {
    requestPath = '';
  }
  const isReadOnlyMethod = READ_ONLY_IMPERSONATION_METHODS.has(requestMethod);
  const isAllowedImpersonationWrite = READ_ONLY_IMPERSONATION_PATHS.has(requestPath);
  if (isImpersonating && !isReadOnlyMethod && !isAllowedImpersonationWrite) {
    res.status(403).json({
      error: 'Impersonation sessions are read-only. End session to perform actions as yourself.',
      code: 'IMPERSONATION_READ_ONLY',
      guidance: 'Stop impersonation and retry the action from your own superadmin session.',
    });
    return;
  }

  // Attach permission helper
  const permissionRoleSource =
    readOptionalStringClaim(decodedClaims, 'role') ||
    readOptionalStringClaim(decodedClaims, 'userRole') ||
    user.role;
  const permissionRole =
    req.userRole === 'SUPERADMIN' ? 'SUPERADMIN' : normalizePermissionRole(permissionRoleSource);
  req.can = (capability: string): boolean => {
    if (typeof capability !== 'string') return false;
    const normalizedCapability = capability.trim();
    if (!normalizedCapability) return false;
    if (normalizedCapability.length > MAX_AUTH_CAPABILITY_CHARS) return false;
    if (
      AUTH_TOKEN_CONTROL_CHARS.test(normalizedCapability) ||
      AUTH_TOKEN_DISALLOWED_UNICODE.test(normalizedCapability)
    ) {
      return false;
    }
    return PermissionService.can(
      {
        ...user,
        role: permissionRole as UserRole,
      },
      normalizedCapability,
      {
        organizationId: req.organizationId,
      }
    );
  };

  next();
};

/**
 * V4-ENT-01: Session hardening — track activity & validate active sessions.
 * Runs fire-and-forget after attachUser so it doesn't add latency.
 */
const trackSessionActivity = (req: AuthRequest, res: Response): void => {
  let userId = '';
  try {
    userId = typeof req.userId === 'string' ? req.userId : '';
  } catch {
    userId = '';
  }
  if (!userId) return;

  (async () => {
    try {
      const { activityColumn, hasIsActive } = await getUserSessionCompatibility();
      const activeFilter = hasIsActive ? `AND is_active = true` : '';
      const session = await dbGet<{ id: string; is_active?: boolean | number | null }>(
        `SELECT id${hasIsActive ? ', is_active' : ''}
         FROM user_sessions
         WHERE user_id = ?
           ${activeFilter}
         ORDER BY ${activityColumn} DESC LIMIT 1`,
        [userId]
      );

      if (session) {
        if (hasIsActive && session.is_active !== true && session.is_active !== 1) return;
        try {
          res.setHeader('X-Session-Id', session.id);
        } catch {
          // Non-critical — don't break auth flow on header write errors
        }
        if (activityColumn !== 'created_at') {
          await dbRun(buildSessionActivityUpdateSql(activityColumn), [session.id]);
        }
      }
    } catch {
      // Non-critical — don't break auth flow on session tracking errors
    }
  })();
};

// In-memory cache for revoked-token lookups to avoid hitting slow DB on every request.
// Entries expire after REVOKE_CACHE_TTL_MS. On token revocation the server restarts
// or the cache naturally expires, so the window is acceptably short.
const REVOKE_CACHE_TTL_MS = 60_000;
const _revokeCache = new Map<string, { revoked: boolean; ts: number }>();
const _revokeAllCache = new Map<string, { jti: string | null; ts: number }>();

// In-flight dedup: prevents N concurrent DB hits for the same lookup during request bursts
const _revokeInflight = new Map<string, Promise<boolean>>();
const _revokeAllInflight = new Map<string, Promise<{ jti: string | null }>>();

function getCachedRevoke(jti: string): boolean | undefined {
  const entry = _revokeCache.get(jti);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > REVOKE_CACHE_TTL_MS) {
    _revokeCache.delete(jti);
    return undefined;
  }
  return entry.revoked;
}

function getCachedRevokeAll(userId: string): { jti: string | null } | undefined {
  const entry = _revokeAllCache.get(userId);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > REVOKE_CACHE_TTL_MS) {
    _revokeAllCache.delete(userId);
    return undefined;
  }
  return { jti: entry.jti };
}

/**
 * Check if token has been revoked.
 * Uses in-flight dedup so concurrent requests for the same token/user
 * share a single DB query instead of each hitting the database.
 */
const checkTokenRevocation = async (
  decoded: JWTPayload,
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { dbGet } = await getDeps();
  const decodedClaims = decoded as unknown as Record<string, unknown>;
  const tokenJti = readOptionalStringClaim(decodedClaims, 'jti');

  if (!tokenJti) {
    await attachUser(decoded, req, next, res);
    return;
  }
  if (AUTH_TOKEN_CONTROL_CHARS.test(tokenJti) || AUTH_TOKEN_DISALLOWED_UNICODE.test(tokenJti)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (tokenJti.length > MAX_AUTH_JTI_CHARS) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    // Check if specific token is revoked (with cache + in-flight dedup)
    let isRevoked = getCachedRevoke(tokenJti);
    if (isRevoked === undefined) {
      let inflight = _revokeInflight.get(tokenJti);
      if (!inflight) {
        inflight = dbGet<{ jti: string }>('SELECT jti FROM revoked_tokens WHERE jti = ?', [
          tokenJti,
        ])
          .then((row) => {
            const revoked = !!row;
            _revokeCache.set(tokenJti, { revoked, ts: Date.now() });
            _revokeInflight.delete(tokenJti);
            return revoked;
          })
          .catch((err) => {
            _revokeInflight.delete(tokenJti);
            throw err;
          });
        _revokeInflight.set(tokenJti, inflight);
      }
      isRevoked = await inflight;
    }

    if (isRevoked) {
      res.status(401).json({ error: 'Token has been revoked' });
      return;
    }

    // Check for "revoke-all" marker for this user (with cache + in-flight dedup)
    const userIdForRevokeAll = readOptionalStringClaim(decodedClaims, 'id');
    if (!userIdForRevokeAll) {
      await attachUser(decoded, req, next, res);
      return;
    }

    let revokeAllEntry = getCachedRevokeAll(userIdForRevokeAll);
    if (revokeAllEntry === undefined) {
      let inflight = _revokeAllInflight.get(userIdForRevokeAll);
      if (!inflight) {
        inflight = dbGet<{ jti: string }>(buildRevokeAllLookupSql(), [userIdForRevokeAll])
          .then((row) => {
            const entry = { jti: row?.jti ?? null };
            _revokeAllCache.set(userIdForRevokeAll, { jti: entry.jti, ts: Date.now() });
            _revokeAllInflight.delete(userIdForRevokeAll);
            return entry;
          })
          .catch((err) => {
            _revokeAllInflight.delete(userIdForRevokeAll);
            throw err;
          });
        _revokeAllInflight.set(userIdForRevokeAll, inflight);
      }
      revokeAllEntry = await inflight;
    }

    if (revokeAllEntry.jti) {
      const revokeTime = parseRevokeAllTimestamp(revokeAllEntry.jti);
      if (revokeTime === null) {
        await attachUser(decoded, req, next, res);
        return;
      }
      const tokenIssuedAtSeconds = extractIssuedAtSeconds(decoded);
      const tokenIssuedAt = tokenIssuedAtSeconds * 1000;

      if (tokenIssuedAt < revokeTime) {
        res.status(401).json({
          error: 'All sessions have been revoked. Please log in again.',
        });
        return;
      }
    }

    // Token is valid
    await attachUser(decoded, req, next, res);
  } catch (dbErr) {
    logger.error('Error checking revoked tokens:', dbErr);
    await attachUser(decoded, req, next, res);
  }
};

// ==========================================
// MAIN MIDDLEWARE
// ==========================================

/**
 * Verify JWT token and attach user to request
 */
export const verifyToken = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!isTestEnv) {
      logger.debug(`[AuthMiddleware] Verifying token for path: ${safeReadRequestPath(req)}`);
    }
    const { jwt: jwtLib, config } = await getDeps();

    const token = extractToken(req);
    if (!isTestEnv) {
      logger.debug(`[AuthMiddleware] Token extracted: ${token ? 'YES' : 'NO'}`);
    }

    if (!token) {
      // Test mode bypass
      if (process.env.NODE_ENV === 'test' && process.env.ENABLE_TEST_AUTH_BYPASS === 'true') {
        const existingUser = safeRead(() => req.user, undefined as AuthRequest['user']);
        // Only set default test user if not already set by another middleware
        if (!existingUser) {
          const attached = safeWrite(() => {
            req.user = {
              id: 'test-user-id',
              name: 'Test User',
              email: 'test@example.com',
              role: 'guest',
              organizationId: 'test-org-id',
              isSuperAdmin: false,
              isDemo: false,
            };
            req.userId = 'test-user-id';
            req.organizationId = 'test-org-id';
          });
          if (!attached) {
            res.status(401).json({ error: 'No token provided' });
            return;
          }
        }
        return next();
      }

      res.status(401).json({ error: 'No token provided' });
      return;
    }
    if (token.length > MAX_AUTH_JWT_CHARS) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (AUTH_TOKEN_CONTROL_CHARS.test(token)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (AUTH_TOKEN_DISALLOWED_UNICODE.test(token)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!isCompactJwtShape(token)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // --------------------------------------------------------------------
    // E2E MODE AUTH BYPASS (deterministic Playwright runtime tests)
    // --------------------------------------------------------------------
    // In E2E_MODE we allow a JWT-like token that is NOT signature-verified,
    // but MUST contain an explicit `e2e: true` claim. This is safe because:
    // - It is gated behind E2E_MODE (never enabled in production)
    // - It still requires the client to send a token (frontend uses it)
    //
    // This enables CI Playwright runtime tests without relying on seeded
    // credentials or secrets in CI.
    if (!isProductionEnv && process.env.E2E_MODE === 'true') {
      try {
        const decodedRaw = jwtLib.decode(token);
        const decodedClaims = isPlainJwtPayload(decodedRaw)
          ? (decodedRaw as Record<string, unknown>)
          : undefined;
        const decodedUserId = normalizeContextIdentifier(
          readOptionalStringClaim(decodedClaims, 'id')
        );
        if (decodedClaims && readBooleanTrueClaim(decodedClaims, 'e2e') && decodedUserId) {
          if (decodedUserId.length > MAX_AUTH_USER_ID_CHARS) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
          }
          const normalizedE2EOrgId =
            normalizeBoundedOrgContextId(
              readOptionalStringClaim(decodedClaims, 'organizationId')
            ) ||
            normalizeBoundedOrgContextId(
              readOptionalStringClaim(decodedClaims, 'organization_id')
            ) ||
            'e2e-org-id';
          const normalizedE2ERole =
            readOptionalStringClaim(decodedClaims, 'role') ||
            readOptionalStringClaim(decodedClaims, 'userRole') ||
            'ADMIN';
          const normalizedDecoded: JWTPayload = {
            ...(sanitizeJwtPayload(decodedClaims) as Partial<JWTPayload>),
            id: decodedUserId,
            organizationId: normalizedE2EOrgId,
            organization_id: normalizedE2EOrgId,
            role: normalizedE2ERole,
          };
          if (!normalizedDecoded.userRole) normalizedDecoded.userRole = normalizedE2ERole;
          if (!normalizedDecoded.email) normalizedDecoded.email = 'e2e@local.test';
          if (!normalizedDecoded.name) normalizedDecoded.name = 'E2E User';
          // Best-effort: ensure the E2E user/org exist in DB so that
          // downstream routes that rely on FK / joins (e.g. conversations)
          // can operate normally during runtime tests.
          try {
            const { run } = await import('../utils/DbPromise.js');
            const orgId = normalizedE2EOrgId;
            const userRole = normalizedE2ERole.toUpperCase();
            const normalizedE2EName =
              readOptionalStringClaim(
                normalizedDecoded as unknown as Record<string, unknown>,
                'name'
              ) || 'E2E User';
            const [firstName, ...lastNameParts] = normalizedE2EName.split(/\s+/);
            await run(
              `
                INSERT INTO organizations (id, name, plan, status)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(id) DO NOTHING
              `,
              [orgId, 'E2E Organization', 'enterprise', 'active']
            );
            await run(
              `
                INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO NOTHING
              `,
              [
                normalizedDecoded.id,
                orgId,
                normalizedDecoded.email || 'e2e@local.test',
                // Not used in E2E token mode (no login), but keep schema happy.
                'e2e-not-used',
                userRole,
                'active',
                firstName || 'E2E',
                lastNameParts.join(' ') || 'User',
              ]
            );
            // Also seed organization_members: chatPermissionService (team-conversation
            // add_message/read/etc. gates) resolves the caller's role from this table,
            // not from the JWT. Without this row the e2e identity has org+user rows but
            // is NOT a member of its own org, so any team-scoped chat permission check
            // resolves to role:'none' -> 403 "not a member of this organization"
            // (found 2026-07-14 diagnosing the ai-chat runtime smoke canary).
            // organization_members.role has a CHECK constraint (OWNER/ADMIN/MEMBER/
            // CONSULTANT); clamp the token's role claim to that domain instead of
            // trusting it verbatim.
            const validOrgMemberRoles = new Set(['OWNER', 'ADMIN', 'MEMBER', 'CONSULTANT']);
            const membershipRole = validOrgMemberRoles.has(userRole) ? userRole : 'ADMIN';
            await run(
              `
                INSERT INTO organization_members (id, organization_id, user_id, role, status)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(id) DO NOTHING
              `,
              [
                `e2e-member-${orgId}-${normalizedDecoded.id}`,
                orgId,
                normalizedDecoded.id,
                membershipRole,
                'ACTIVE',
              ]
            );
          } catch (seedErr) {
            logger.warn('[AuthMiddleware] E2E seed failed (continuing):', seedErr);
          }

          // Attach without signature verification / revocation checks
          await attachUser(normalizedDecoded, req, next, res);
          return;
        }
      } catch (e) {
        // Ignore and fall through to normal verification
      }
    }

    try {
      const { jwt: jwtLib, config } = await getDeps();

      const jwtSecret = normalizeJwtSecret(
        (config as { JWT_SECRET: string })?.JWT_SECRET || (config as any)?.JWT_SECRET
      );
      if (!config || !jwtSecret || jwtSecret.length > MAX_JWT_SECRET_CHARS) {
        logger.error(
          `[AuthMiddleware] CRITICAL: config object is ${typeof config}, keys: ${config ? Object.keys(config) : 'none'}, JWT_SECRET is ${
            !jwtSecret
              ? 'missing'
              : jwtSecret.length > MAX_JWT_SECRET_CHARS
                ? 'oversized'
                : 'present'
          }`
        );
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!isTestEnv) {
        logger.debug(
          `[AuthMiddleware] Verifying token: ${token.substring(0, 10)}... with secret length: ${jwtSecret?.length}`
        );
      }
      const decoded = await new Promise<JWTPayload>((resolve, reject) => {
        verifyJwt(jwtLib, token, jwtSecret, (err: any, decoded: any) => {
          if (err) return reject(err);
          resolve(decoded as JWTPayload);
        });
      });
      if (!isPlainJwtPayload(decoded)) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const sanitizedDecoded = sanitizeJwtPayload(decoded);
      const decodedId = readOptionalStringClaim(
        sanitizedDecoded as unknown as Record<string, unknown>,
        'id'
      );
      if (!decodedId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      if (decodedId.length > MAX_AUTH_USER_ID_CHARS) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const normalizedDecoded: JWTPayload = { ...sanitizedDecoded, id: decodedId };

      await checkTokenRevocation(normalizedDecoded, req, res, next);
      trackSessionActivity(req, res);
    } catch (err: any) {
      logger.error('[AuthMiddleware] Verification failed:', err.message);
      if (err.name === 'TokenExpiredError') {
        res.status(401).json({ error: 'Token expired' });
        return;
      }
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }
);

/**
 * Compatibility middleware used across legacy routes.
 * Assumes `verifyToken` (or another auth layer) already attached `req.user`.
 */
export const isAuthenticated = (req: AuthRequest, res: Response, next: NextFunction): void => {
  let userId = '';
  try {
    userId =
      normalizeContextIdentifier(safeRead(() => req.userId, undefined)) ||
      normalizeContextIdentifier(safeRead(() => req.user?.id, undefined));
  } catch {
    userId = '';
  }
  if (userId) {
    next();
    return;
  }
  res.status(401).json({ error: 'Authentication required' });
};

/**
 * Optional auth - attaches user if token present, but doesn't require it
 */
export const optionalAuth = asyncHandler(
  async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    const { jwt: jwtLib, config } = await getDeps();
    const jwtSecret = normalizeJwtSecret(
      (config as { JWT_SECRET: string })?.JWT_SECRET || (config as any)?.JWT_SECRET
    );

    const token = extractToken(req);

    if (!token || !jwtSecret || jwtSecret.length > MAX_JWT_SECRET_CHARS) {
      return next();
    }
    if (token.length > MAX_AUTH_JWT_CHARS) {
      return next();
    }
    if (AUTH_TOKEN_CONTROL_CHARS.test(token)) {
      return next();
    }
    if (AUTH_TOKEN_DISALLOWED_UNICODE.test(token)) {
      return next();
    }
    if (!isCompactJwtShape(token)) {
      return next();
    }
    let decoded: JWTPayload | null = null;
    try {
      decoded = await new Promise<JWTPayload | null>((resolve) => {
        verifyJwt(jwtLib, token, jwtSecret, (err: any, verified: any) => {
          if (err) {
            // Invalid token, but optional - continue without user.
            resolve(null);
            return;
          }
          resolve(verified as JWTPayload);
        });
      });
    } catch {
      // Optional auth must stay fail-open even if jwt.verify throws synchronously.
      return next();
    }

    if (!decoded) {
      return next();
    }
    if (!isPlainJwtPayload(decoded)) {
      return next();
    }
    const sanitizedDecoded = sanitizeJwtPayload(decoded);
    const decodedUserId = readOptionalStringClaim(
      sanitizedDecoded as unknown as Record<string, unknown>,
      'id'
    );

    if (!decodedUserId) {
      // Optional auth stays non-blocking on malformed token payloads.
      return next();
    }
    if (decodedUserId.length > MAX_AUTH_USER_ID_CHARS) {
      return next();
    }

    try {
      const normalizedDecoded: JWTPayload = { ...sanitizedDecoded, id: decodedUserId };
      // Attach user without revocation check for optional auth.
      await attachUser(normalizedDecoded, req, next, _res);
    } catch {
      // Optional auth must remain non-blocking even if user hydration fails.
      return next();
    }
  }
);

/**
 * Require specific role
 */
export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const requestUser = safeRead(() => req.user, undefined as AuthRequest['user']);
    const normalizedRequiredRoles = roles
      .map((role) => (typeof role === 'string' ? role.trim().toLowerCase() : ''))
      .filter(Boolean);

    if (!requestUser) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (normalizedRequiredRoles.length === 0) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    const effectiveRole =
      normalizeRoleClaim(safeRead(() => req.userRole, undefined)) ||
      normalizeRoleClaim(safeRead(() => requestUser.role, undefined)) ||
      '';
    const fallbackUserRole = normalizeRoleClaim(safeRead(() => requestUser.role, undefined)) || '';
    const isSuperAdmin = safeRead(() => requestUser.isSuperAdmin === true, false);

    const grantedRoles = (
      isSuperAdmin
        ? [effectiveRole, fallbackUserRole, 'SUPERADMIN', 'superadmin']
        : [effectiveRole, fallbackUserRole]
    )
      .map((role) => (typeof role === 'string' ? role.trim().toLowerCase() : ''))
      .filter(Boolean);

    if (!normalizedRequiredRoles.some((role) => grantedRoles.includes(role))) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
};

/**
 * Require super admin
 */
export const requireSuperAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const requestUser = safeRead(() => req.user, undefined as AuthRequest['user']);
  if (!requestUser) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const isSuperAdmin = safeRead(() => requestUser.isSuperAdmin === true, false);

  if (!isSuperAdmin) {
    res.status(403).json({ error: 'Super admin access required' });
    return;
  }

  next();
};

/**
 * Require organization context
 */
export const requireOrganization = (req: AuthRequest, res: Response, next: NextFunction): void => {
  let normalizedOrganizationId = '';
  try {
    normalizedOrganizationId =
      typeof req.organizationId === 'string' ? req.organizationId.trim() : '';
  } catch {
    normalizedOrganizationId = '';
  }
  if (!normalizedOrganizationId) {
    res.status(403).json({ error: 'Organization context required' });
    return;
  }

  try {
    req.organizationId = normalizedOrganizationId;
  } catch {
    res.status(403).json({ error: 'Organization context required' });
    return;
  }
  next();
};

/**
 * Validate that the user still has an active membership in the org from their JWT.
 * Uses in-memory cache (60s TTL) to avoid per-request DB hits.
 */
const _membershipCache = new Map<string, { valid: boolean; ts: number }>();
const MEMBERSHIP_CACHE_TTL_MS = 60_000;
const normalizeMembershipStatus = (value: unknown): string =>
  String(value || '')
    .trim()
    .toUpperCase();
const normalizeContextIdentifier = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';
const buildMembershipCacheKey = (userId: string, orgId: string): string =>
  JSON.stringify([userId, orgId]);

export const validateOrgMembership = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    let userId = '';
    let orgId = '';
    try {
      const requestUser = safeRead(() => req.user, undefined as AuthRequest['user']);
      userId =
        normalizeContextIdentifier(safeRead(() => req.userId, undefined)) ||
        normalizeContextIdentifier(safeRead(() => requestUser?.id, undefined));
      orgId = normalizeContextIdentifier(safeRead(() => req.organizationId, undefined));
    } catch {
      // If context accessors throw, fail-open to preserve middleware contract.
      return next();
    }

    if (!userId || !orgId) {
      return next();
    }
    try {
      req.organizationId = orgId;
    } catch {
      return next();
    }

    // SuperAdmins bypass membership checks only when explicitly true.
    let isSuperAdmin = false;
    try {
      isSuperAdmin = req.user?.isSuperAdmin === true;
    } catch {
      isSuperAdmin = false;
    }
    if (isSuperAdmin) {
      return next();
    }

    const cacheKey = buildMembershipCacheKey(userId, orgId);
    const cached = _membershipCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < MEMBERSHIP_CACHE_TTL_MS) {
      if (!cached.valid) {
        res.status(403).json({
          error: 'You no longer have access to this organization',
          code: 'ORG_MEMBERSHIP_REVOKED',
        });
        return;
      }
      return next();
    }

    try {
      const { dbGet: dbGetFromDeps } = await getDeps();
      const membership = await dbGetFromDeps<{ status: string }>(
        `SELECT status FROM organization_members WHERE user_id = ? AND organization_id = ?`,
        [userId, orgId]
      );

      const valid = !!membership && normalizeMembershipStatus(membership.status) === 'ACTIVE';
      _membershipCache.set(cacheKey, { valid, ts: Date.now() });

      if (!valid) {
        res.status(403).json({
          error: 'You no longer have access to this organization',
          code: 'ORG_MEMBERSHIP_REVOKED',
        });
        return;
      }

      next();
    } catch (error) {
      // On DB error, allow request through (fail-open) to avoid blocking all requests
      logger.warn('[AuthMiddleware] org membership check failed; failing open', {
        code: 'ORG_MEMBERSHIP_LOOKUP_FAIL_OPEN',
        path: safeReadRequestPath(req),
        reason: error instanceof Error ? error.message : 'unknown_error',
      });
      next();
    }
  }
);

/**
 * Require specific permission capability
 */
export const requirePermission = (capability: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const requestUser = safeRead(() => req.user, undefined as AuthRequest['user']);
    const normalizedCapability = typeof capability === 'string' ? capability.trim() : '';

    if (!requestUser) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!normalizedCapability) {
      res.status(403).json({
        error: 'Permission denied',
        required: normalizedCapability,
      });
      return;
    }
    if (normalizedCapability.length > MAX_AUTH_CAPABILITY_CHARS) {
      res.status(403).json({
        error: 'Permission denied',
        code: 'INVALID_CAPABILITY',
      });
      return;
    }
    if (
      AUTH_TOKEN_CONTROL_CHARS.test(normalizedCapability) ||
      AUTH_TOKEN_DISALLOWED_UNICODE.test(normalizedCapability)
    ) {
      res.status(403).json({
        error: 'Permission denied',
        code: 'INVALID_CAPABILITY',
      });
      return;
    }

    let hasPermission = false;
    try {
      hasPermission = req.can?.(normalizedCapability) === true;
    } catch {
      hasPermission = false;
    }

    if (!hasPermission) {
      res.status(403).json({
        error: 'Permission denied',
        required: normalizedCapability,
      });
      return;
    }

    next();
  };
};

// ==========================================
// DEPENDENCY INJECTION (for testing)
// ==========================================

export const setDependencies = (newDeps: Partial<Dependencies>): void => {
  if (!deps) {
    deps = {} as Dependencies;
  }
  deps = { ...deps, ...newDeps };
};

/**
 * Internal helpers exposed for unit testing.
 * Not part of the public middleware API.
 */
export const __private__ = {
  extractToken,
  mapRole,
  normalizePermissionRole,
  getDeps,
  resetRevocationCachesForTests: () => {
    _revokeCache.clear();
    _revokeAllCache.clear();
    _revokeInflight.clear();
    _revokeAllInflight.clear();
  },
  resetMembershipCacheForTests: () => {
    _membershipCache.clear();
  },
  resetDepsForTests: () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deps = undefined as any;
  },
  normalizeMembershipStatus,
  normalizeContextIdentifier,
  buildMembershipCacheKey,
  buildSessionActivityUpdateSql,
  buildRevokeAllLookupSql,
  extractIssuedAtSeconds,
  parseRevokeAllTimestamp,
  readOptionalStringClaim,
  readBooleanTrueClaim,
};

// ==========================================
// DEFAULT EXPORT
// ==========================================

export default verifyToken;

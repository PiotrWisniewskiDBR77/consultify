/**
 * Service Account (PAT) authentication + scope enforcement for the Table
 * Platform REST API — the "Airtable API" gateway for Zapier / Make / scripts.
 *
 * `ServiceAccountService` already mints `tp_sa_*` tokens with scopes + expiry
 * and can `validateToken`, but nothing on the request path ever called it, so
 * a service-account token could not authenticate ANY endpoint (it fell through
 * to `verifyToken`, which requires an interactive user JWT, → 401).
 *
 * These two middlewares close that gap WITHOUT touching the JWT path:
 *
 *   1. `serviceAccountAuth` — runs BEFORE `verifyToken`. If the request carries
 *      an `Authorization: Bearer tp_sa_...` token it validates it (existence,
 *      not-revoked [revocation = row DELETE], not-expired, org-scoped) and
 *      populates the same request context user handlers already rely on
 *      (`userId`, `organizationId`, `user`, `userRole`) plus SA-specific fields
 *      (`isServiceAccount`, `serviceAccountId`, `serviceAccountScopes`). A bad,
 *      expired, or revoked SA token is rejected with 401 here — it never
 *      reaches the JWT layer. If there is NO `tp_sa_` bearer, it is a no-op and
 *      the request proceeds to `verifyToken` exactly as before.
 *
 *   2. `requireServiceAccountScope` — coarse read/write gate. For SA requests it
 *      requires `records:read` on safe methods (GET/HEAD/OPTIONS) and
 *      `records:write` on mutating methods (POST/PATCH/PUT/DELETE); missing
 *      scope → 403. For JWT requests it is a pure pass-through.
 *
 * Org-scoping is enforced downstream for free: `req.userId` is a synthetic
 * `sa:<id>` that is NOT a base creator and NOT in `tp_base_members`, so
 * `PermissionsService.canAccessBase` only grants access when the resolved
 * base's `organization_id` equals the SA's org. Cross-org resources therefore
 * 403 without any special casing here.
 *
 * Role mapping decision (SA rows have NO role column — migration 711 only
 * stores scopes): we derive a SAFE, FAIL-CLOSED base role from scopes —
 *   - has `records:write` → `data_editor` (may write DATA, never SCHEMA)
 *   - otherwise            → `viewer`     (read-only)
 * A service account can thus never reach schema-editing roles even though the
 * legacy org-level fallback would otherwise grant `base_owner`. This derived
 * role is surfaced as `req.userRole` so the Wave-2 field/row-level permission
 * machinery applies to API traffic just like it does for interactive users.
 */

import type { NextFunction, Response } from 'express';

import { serviceAccountService } from '../services/tablePlatform/ServiceAccountService.js';
import logger from '../utils/Logger.js';

import type { AuthRequest } from './auth.middleware.js';

const SERVICE_ACCOUNT_TOKEN_PREFIX = 'tp_sa_';
const MAX_TOKEN_CHARS = 512;

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Scope constants — mirror migration 711 defaults. */
export const RECORDS_READ_SCOPE = 'records:read';
export const RECORDS_WRITE_SCOPE = 'records:write';

/**
 * Extract a `tp_sa_*` bearer token from the Authorization header.
 * Returns null when the header is absent, malformed, oversized, or is not a
 * service-account token (so the JWT path stays untouched).
 */
function extractServiceAccountToken(req: AuthRequest): string | null {
  let raw: unknown;
  try {
    raw = req.headers?.['authorization'];
  } catch {
    return null;
  }
  // Only accept a single string header — arrays/duplicates are ambiguous.
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value || value.length > MAX_TOKEN_CHARS) return null;

  const match = value.match(/^bearer\s+(.+)$/i);
  const candidate = (match ? match[1] : value).trim();
  if (!candidate.startsWith(SERVICE_ACCOUNT_TOKEN_PREFIX)) return null;
  return candidate;
}

/** Fail-closed role derivation from a service account's scopes. */
export function deriveServiceAccountRole(scopes: string[] | undefined): 'data_editor' | 'viewer' {
  const list = Array.isArray(scopes) ? scopes : [];
  return list.includes(RECORDS_WRITE_SCOPE) ? 'data_editor' : 'viewer';
}

/**
 * Middleware: authenticate a `tp_sa_*` service-account token, if present.
 * Must be mounted BEFORE `verifyToken`. No-op (→ next) for non-SA requests.
 */
export function serviceAccountAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = extractServiceAccountToken(req);
  if (!token) {
    // Not a service-account request — leave the JWT path exactly as it was.
    next();
    return;
  }

  serviceAccountService
    .validateToken(token)
    .then((result) => {
      // Invalid / revoked (row DELETE → not found) / expired → 401.
      if (!result.valid || !result.account || !result.organizationId) {
        res.status(401).json({
          error: 'Invalid, expired, or revoked service account token',
          code: 'SERVICE_ACCOUNT_TOKEN_INVALID',
        });
        return;
      }

      const account = result.account as {
        id: string;
        name?: string;
        scopes?: string[];
      };
      const organizationId = result.organizationId;
      const scopes = Array.isArray(account.scopes) ? account.scopes : [];
      const derivedRole = deriveServiceAccountRole(scopes);
      // Synthetic principal id: never a base creator, never a tp_base_members
      // row → canAccessBase() grants access ONLY on org match (org-scoping).
      const principalId = `sa:${account.id}`;

      req.isServiceAccount = true;
      req.serviceAccountId = account.id;
      req.serviceAccountScopes = scopes;
      req.userId = principalId;
      req.organizationId = organizationId;
      req.userRole = derivedRole;
      req.user = {
        id: principalId,
        email: '',
        name: account.name || 'Service Account',
        role: derivedRole,
        organizationId,
        isSuperAdmin: false,
      } as AuthRequest['user'];

      next();
    })
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn('[serviceAccountAuth] validation failed', { error: msg });
      if (!res.headersSent) {
        res.status(401).json({
          error: 'Service account authentication failed',
          code: 'SERVICE_ACCOUNT_AUTH_FAILED',
        });
      }
    });
}

/**
 * Middleware: enforce read/write scope for service-account requests.
 * Pass-through for interactive (JWT) requests.
 */
export function requireServiceAccountScope(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.isServiceAccount) {
    next();
    return;
  }

  const scopes = Array.isArray(req.serviceAccountScopes) ? req.serviceAccountScopes : [];
  const method = String(req.method || '').toUpperCase();
  const requiredScope = READ_METHODS.has(method) ? RECORDS_READ_SCOPE : RECORDS_WRITE_SCOPE;

  if (!scopes.includes(requiredScope)) {
    res.status(403).json({
      error: `Service account token is missing required scope '${requiredScope}'`,
      code: 'SERVICE_ACCOUNT_SCOPE_DENIED',
      requiredScope,
    });
    return;
  }

  next();
}

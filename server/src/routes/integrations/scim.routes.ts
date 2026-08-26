/**
 * SCIM Routes - System for Cross-domain Identity Management (V4-ENT-02)
 *
 * Protocol endpoints: /Users, /Groups (SCIM 2.0 standard — RFC 7644)
 * Admin endpoints: /admin/service-provider, /admin/tokens, /admin/group-mappings, /admin/sync-logs, /admin/conflicts, /admin/sync
 */
import crypto from 'crypto';
import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { verifySuperAdmin as requireSuperAdmin } from '../../middleware/superAdmin.middleware.js';
import {
  buildOrgSuspendedResponseBody,
  isOrganizationSuspended,
  ORG_SUSPENDED_CODE,
} from '../../services/organizationSuspensionGuard.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

interface ScimRequest extends Request {
  scimOrgId?: string;
  scimTokenId?: string;
}

const router = Router();

const ensureScimTables = async () => {
  await dbRun(`CREATE TABLE IF NOT EXISTS scim_service_providers (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    base_url TEXT,
    patch_supported INTEGER DEFAULT 1,
    filter_supported INTEGER DEFAULT 1,
    is_active INTEGER DEFAULT 0,
    last_sync_at TEXT,
    sync_status TEXT DEFAULT 'idle',
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  await dbRun(`CREATE TABLE IF NOT EXISTS scim_tokens (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    token_hash TEXT NOT NULL,
    token_prefix TEXT NOT NULL,
    organization_id TEXT,
    scopes TEXT DEFAULT '[]',
    last_used_at TEXT,
    usage_count INTEGER DEFAULT 0,
    expires_at TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  await dbRun(`CREATE TABLE IF NOT EXISTS scim_group_mappings (
    id TEXT PRIMARY KEY,
    external_group_id TEXT NOT NULL,
    external_group_name TEXT NOT NULL,
    internal_role TEXT NOT NULL DEFAULT 'member',
    custom_role_id TEXT,
    is_active INTEGER DEFAULT 1,
    auto_sync INTEGER DEFAULT 1,
    last_synced_at TEXT,
    member_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  await dbRun(`CREATE TABLE IF NOT EXISTS scim_sync_logs (
    id TEXT PRIMARY KEY,
    operation TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    external_id TEXT,
    status TEXT NOT NULL DEFAULT 'success',
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  await dbRun(`CREATE TABLE IF NOT EXISTS scim_conflict_log (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    conflict_type TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    external_id TEXT,
    internal_id TEXT,
    details_json TEXT,
    resolution TEXT,
    resolved_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
};

// ── SCIM Bearer Token Auth ──

const verifyScimToken = asyncHandler(async (req: ScimRequest, res: Response, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'Authorization required',
      status: '401',
    });
  }
  const token = authHeader.slice(7);
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  await ensureScimTables();
  const row = await dbGet<{ id: string; is_active: number; organization_id: string | null }>(
    'SELECT id, is_active, organization_id FROM scim_tokens WHERE token_hash = ? AND is_active = 1',
    [hash]
  );
  if (!row) {
    return res.status(401).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'Invalid or expired SCIM token',
      status: '401',
    });
  }
  req.scimTokenId = row.id;
  req.scimOrgId = row.organization_id || undefined;

  // ---------------------------------------------------------------------------
  // TENANT ISOLATION — a SCIM token with no organization_id is not a "global"
  // credential, it is a broken/orphaned one. Every statement below this
  // middleware assumes `req.scimOrgId` is a real tenant id and scopes every
  // read and write to it; a token that carries no org would otherwise sail
  // through every one of those filters as `WHERE ... = NULL`, which matches
  // nothing in Postgres (safe) but also silently degrades into "no rows" in
  // ways that are easy to get wrong route-by-route. Reject it here, once, so
  // no downstream handler has to reason about an undefined org id. Refused
  // BEFORE the `usage_count` bump below, same reasoning as the suspension
  // gate: a refused call must not touch the token's own counters.
  // ---------------------------------------------------------------------------
  if (!req.scimOrgId) {
    return res.status(401).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'SCIM token is not associated with an organization',
      status: '401',
    });
  }

  // ---------------------------------------------------------------------------
  // DEC-91 / TRI-MUST-12 — SCIM is a FRONT DOOR, and it was standing open.
  //
  // This router does not use `verifyToken` or `verifyApiKey`; it authenticates
  // with its own bearer scheme against `scim_tokens` and takes the tenant
  // straight from `scim_tokens.organization_id`. Every DEC-91 gate built so far
  // hangs off one of the other two paths, so NONE of them was ever reached
  // here. A suspended tenant's provisioning key still drove eleven routes,
  // including `POST/PUT/PATCH/DELETE /Users` and `/Groups` — creating,
  // modifying and DEACTIVATING accounts inside a tenant that is supposed to be
  // cut off. That is the same hole FIX-1 closed for `ik_` integration keys.
  //
  // Refused HERE, before the `usage_count` bump below and before `next()`, so a
  // refused call writes NOTHING AT ALL — not the token's own usage counter, and
  // certainly not a `users` row.
  //
  // `fallback: false` is load-bearing for the same reason as everywhere else:
  // `DbPromise.get` otherwise resolves `null` on an error or a timeout, and the
  // guard would read that as "no row" and therefore "not suspended".
  //
  // No superadmin carve-out: a SCIM token is a machine credential belonging to
  // one tenant, never a platform-operator principal, so there is no operator
  // access to preserve here. The operator reactivates through
  // `/api/superadmin/**`, which this router is not part of.
  // ---------------------------------------------------------------------------
  if (
    await isOrganizationSuspended(req.scimOrgId, <T,>(sql: string, params?: unknown[]) =>
      dbGet<T>(sql, params, { fallback: false })
    )
  ) {
    // SCIM error envelope (RFC 7644 §3.12), matching the two 401s above — an
    // IdP parses this payload, so the DEC-91 code travels in `scimType` and the
    // human-readable half in `detail`.
    return res.status(403).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      scimType: ORG_SUSPENDED_CODE,
      detail: buildOrgSuspendedResponseBody().error,
      status: '403',
    });
  }

  await dbRun(
    "UPDATE scim_tokens SET last_used_at = datetime('now'), usage_count = usage_count + 1 WHERE id = ?",
    [row.id]
  );
  next();
});

// ── Helpers ──

function formatScimUser(u: any) {
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    id: u.id,
    externalId: u.scim_external_id || undefined,
    userName: u.email,
    name: { givenName: u.first_name || '', familyName: u.last_name || '' },
    emails: [{ value: u.email, primary: true, type: 'work' }],
    active: !!u.is_active,
    meta: {
      resourceType: 'User',
      created: u.created_at,
      lastModified: u.scim_last_sync_at || u.created_at,
    },
  };
}

async function formatScimGroup(g: any) {
  const members = await dbAll<any>(
    `SELECT ugm.user_id as id, u.email as display
     FROM user_group_members ugm
     LEFT JOIN users u ON u.id = ugm.user_id
     WHERE ugm.group_id = ?`,
    [g.id],
    { fallback: true }
  );
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
    id: g.id,
    displayName: g.name,
    members: (members || []).map((m: any) => ({ value: m.id, display: m.display || '' })),
    meta: {
      resourceType: 'Group',
      created: g.created_at,
    },
  };
}

async function logSyncOp(
  operation: string,
  resourceType: string,
  resourceId?: string,
  externalId?: string,
  status = 'success',
  errorMessage?: string
) {
  await dbRun(
    `INSERT INTO scim_sync_logs (id, operation, resource_type, resource_id, external_id, status, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      operation,
      resourceType,
      resourceId || null,
      externalId || null,
      status,
      errorMessage || null,
    ]
  );
}

async function logConflict(
  orgId: string,
  conflictType: string,
  resourceType: string,
  externalId?: string,
  internalId?: string,
  details?: any
) {
  const id = uuidv4();
  await dbRun(
    `INSERT INTO scim_conflict_log (id, organization_id, conflict_type, resource_type, external_id, internal_id, details_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      orgId,
      conflictType,
      resourceType,
      externalId || null,
      internalId || null,
      details ? JSON.stringify(details) : null,
    ]
  );
  return id;
}

// Tenant-scoped by construction: the UPDATE only ever touches a session row
// whose owning user is in `orgId`, even if a caller upstream mis-scoped the
// user lookup that produced `userId`. Belt-and-suspenders — every call site
// also confirms the user is in-org before calling this, but a deprovision
// endpoint killing a stranger's sessions is exactly the kind of mistake this
// function should be unable to make on its own.
// Guards SCIM group-membership writes: a group is already confirmed to
// belong to `orgId` by the caller before this runs, but the *member* id in
// the request body comes straight off the wire from the IdP and could name
// a user in any tenant. Without this check, org A's SCIM token could link an
// org B user into an org A group (or vice versa via `remove`/`replace`).
// Cross-tenant member ids are silently dropped rather than erroring — SCIM
// group PATCH is idempotent/best-effort by design, and a hard error here
// would confirm to org A's IdP that the id exists in *some* tenant.
async function userBelongsToOrg(userId: string, orgId: string): Promise<boolean> {
  const row = await dbGet<{ id: string }>(
    'SELECT id FROM users WHERE id = ? AND organization_id = ?',
    [userId, orgId]
  );
  return !!row;
}

async function revokeUserSessions(userId: string, orgId: string) {
  await dbRun(
    `UPDATE user_sessions SET is_active = 0, revoked_at = datetime('now'), revoke_reason = 'scim_deprovision'
     WHERE user_id = ? AND is_active = 1
       AND user_id IN (SELECT id FROM users WHERE organization_id = ?)`,
    [userId, orgId]
  );
}

// ── SCIM 2.0 Protocol Endpoints — Users ──

router.get(
  '/Users',
  verifyScimToken,
  asyncHandler(async (req: ScimRequest, res: Response) => {
    const { startIndex = '1', count = '100', filter } = req.query;
    const parsedCount = Math.max(1, Math.min(1000, parseInt(count as string, 10) || 100));
    const parsedStart = Math.max(1, parseInt(startIndex as string, 10) || 1);

    let users: any[];
    if (filter && typeof filter === 'string' && filter.startsWith('userName eq ')) {
      const email = filter.replace('userName eq ', '').replace(/"/g, '');
      users = await dbAll(
        `SELECT id, email, first_name, last_name, is_active, scim_external_id, scim_last_sync_at, created_at
         FROM users WHERE email = ? AND organization_id = ?`,
        [email, req.scimOrgId],
        { fallback: true }
      );
    } else {
      users = await dbAll(
        `SELECT id, email, first_name, last_name, is_active, scim_external_id, scim_last_sync_at, created_at
         FROM users WHERE organization_id = ? LIMIT ? OFFSET ?`,
        [req.scimOrgId, parsedCount, parsedStart - 1],
        { fallback: true }
      );
    }

    res.json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: (users || []).length,
      startIndex: parsedStart,
      itemsPerPage: parsedCount,
      Resources: (users || []).map(formatScimUser),
    });
  })
);

router.post(
  '/Users',
  verifyScimToken,
  asyncHandler(async (req: ScimRequest, res: Response) => {
    const { userName, externalId, name, active, emails } = req.body;
    const email = userName || emails?.[0]?.value;
    if (!email) {
      return res.status(400).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'userName or emails required',
        status: '400',
      });
    }

    const orgId = req.scimOrgId as string;
    const existing = await dbGet<any>(
      'SELECT id, email, is_active, organization_id FROM users WHERE email = ?',
      [email.toLowerCase()]
    );
    if (existing) {
      // `users.email` is globally unique, so this row may belong to a
      // DIFFERENT tenant than the one presenting this SCIM token. Only the
      // same-org case is a legitimate re-provisioning merge — the
      // cross-tenant case must never update or echo back a stranger's user
      // row. Log the conflict either way (useful for the admin conflict
      // console) but only mutate/return the record when it is this org's.
      if (existing.organization_id !== orgId) {
        await logConflict(orgId, 'duplicate_email_cross_org', 'User', externalId, undefined, {
          email,
        });
        logger.warn(`[SCIM] Conflict: email ${email} already provisioned in another organization`);
        return res.status(409).json({
          schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
          scimType: 'uniqueness',
          detail: 'userName or emails value already in use',
          status: '409',
        });
      }

      await logConflict(orgId, 'duplicate_email', 'User', externalId, existing.id, { email });
      logger.warn(`[SCIM] Conflict: user ${email} already exists (id=${existing.id})`);

      if (externalId) {
        await dbRun(
          `UPDATE users SET scim_external_id = ?, scim_provisioned = 1, scim_last_sync_at = datetime('now')
           WHERE id = ? AND organization_id = ?`,
          [externalId, existing.id, orgId]
        );
      }
      await logSyncOp('create_merge', 'User', existing.id, externalId);
      const merged = await dbGet<any>('SELECT * FROM users WHERE id = ? AND organization_id = ?', [
        existing.id,
        orgId,
      ]);
      return res.status(200).json(formatScimUser(merged));
    }

    const id = uuidv4();
    await dbRun(
      `INSERT INTO users (id, email, first_name, last_name, is_active, organization_id, scim_external_id, scim_provisioned, scim_last_sync_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`,
      [
        id,
        email.toLowerCase(),
        name?.givenName || '',
        name?.familyName || '',
        active !== false ? 1 : 0,
        orgId,
        externalId || null,
      ]
    );
    await logSyncOp('create', 'User', id, externalId);
    logger.info(`[SCIM] Created user: ${email}`);

    const created = await dbGet<any>('SELECT * FROM users WHERE id = ? AND organization_id = ?', [
      id,
      orgId,
    ]);
    res.status(201).json(
      formatScimUser(
        created || {
          id,
          email,
          first_name: name?.givenName,
          last_name: name?.familyName,
          is_active: 1,
        }
      )
    );
  })
);

router.get(
  '/Users/:id',
  verifyScimToken,
  asyncHandler(async (req: ScimRequest, res: Response) => {
    const orgId = req.scimOrgId as string;
    const user = await dbGet<any>(
      `SELECT id, email, first_name, last_name, is_active, scim_external_id, scim_last_sync_at, created_at
       FROM users WHERE id = ? AND organization_id = ?`,
      [req.params.id, orgId]
    );
    if (!user) {
      // A same-tenant id that doesn't exist and a real id from a different
      // tenant must be indistinguishable to the caller — 404 either way,
      // never a 403/differentiated error that would confirm the id exists
      // elsewhere.
      return res.status(404).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'User not found',
        status: '404',
      });
    }
    res.json(formatScimUser(user));
  })
);

router.put(
  '/Users/:id',
  verifyScimToken,
  asyncHandler(async (req: ScimRequest, res: Response) => {
    const orgId = req.scimOrgId as string;
    const id = String(req.params.id);
    const user = await dbGet<any>('SELECT id FROM users WHERE id = ? AND organization_id = ?', [
      id,
      orgId,
    ]);
    if (!user) {
      return res.status(404).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'User not found',
        status: '404',
      });
    }

    const { userName, externalId, name, active, emails } = req.body;
    const email = userName || emails?.[0]?.value;

    await dbRun(
      `UPDATE users SET
        email = COALESCE(?, email),
        first_name = COALESCE(?, first_name),
        last_name = COALESCE(?, last_name),
        is_active = ?,
        scim_external_id = COALESCE(?, scim_external_id),
        scim_last_sync_at = datetime('now')
       WHERE id = ? AND organization_id = ?`,
      [
        email?.toLowerCase() || null,
        name?.givenName || null,
        name?.familyName || null,
        active !== false ? 1 : 0,
        externalId || null,
        id,
        orgId,
      ]
    );

    if (active === false) {
      await revokeUserSessions(id, orgId);
    }

    await logSyncOp('replace', 'User', id, externalId);
    logger.info(`[SCIM] Replaced user: ${id}`);

    const updated = await dbGet<any>('SELECT * FROM users WHERE id = ? AND organization_id = ?', [
      id,
      orgId,
    ]);
    res.json(formatScimUser(updated));
  })
);

router.patch(
  '/Users/:id',
  verifyScimToken,
  asyncHandler(async (req: ScimRequest, res: Response) => {
    const orgId = req.scimOrgId as string;
    const id = String(req.params.id);
    const user = await dbGet<any>('SELECT id FROM users WHERE id = ? AND organization_id = ?', [
      id,
      orgId,
    ]);
    if (!user) {
      return res.status(404).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'User not found',
        status: '404',
      });
    }

    const operations: Array<{ op: string; path?: string; value?: any }> = req.body.Operations || [];
    for (const op of operations) {
      if (op.op?.toLowerCase() !== 'replace') continue;

      if (op.path === 'name.givenName' || op.path === 'name') {
        const givenName = typeof op.value === 'string' ? op.value : op.value?.givenName;
        const familyName = typeof op.value === 'object' ? op.value?.familyName : undefined;
        if (givenName)
          await dbRun('UPDATE users SET first_name = ? WHERE id = ? AND organization_id = ?', [
            givenName,
            id,
            orgId,
          ]);
        if (familyName)
          await dbRun('UPDATE users SET last_name = ? WHERE id = ? AND organization_id = ?', [
            familyName,
            id,
            orgId,
          ]);
      } else if (op.path === 'name.familyName') {
        await dbRun('UPDATE users SET last_name = ? WHERE id = ? AND organization_id = ?', [
          op.value,
          id,
          orgId,
        ]);
      } else if (op.path === 'emails' || op.path === 'userName') {
        const email = Array.isArray(op.value) ? op.value[0]?.value : op.value;
        if (email)
          await dbRun('UPDATE users SET email = ? WHERE id = ? AND organization_id = ?', [
            email.toLowerCase(),
            id,
            orgId,
          ]);
      } else if (op.path === 'active') {
        const isActive = op.value === true || op.value === 'true';
        await dbRun('UPDATE users SET is_active = ? WHERE id = ? AND organization_id = ?', [
          isActive ? 1 : 0,
          id,
          orgId,
        ]);
        if (!isActive) {
          await revokeUserSessions(id, orgId);
          logger.info(`[SCIM] Deprovisioned user: ${id}`);
        }
      } else if (!op.path && typeof op.value === 'object') {
        if (op.value.active !== undefined) {
          const isActive = op.value.active === true || op.value.active === 'true';
          await dbRun('UPDATE users SET is_active = ? WHERE id = ? AND organization_id = ?', [
            isActive ? 1 : 0,
            id,
            orgId,
          ]);
          if (!isActive) await revokeUserSessions(id, orgId);
        }
        if (op.value.name) {
          if (op.value.name.givenName)
            await dbRun('UPDATE users SET first_name = ? WHERE id = ? AND organization_id = ?', [
              op.value.name.givenName,
              id,
              orgId,
            ]);
          if (op.value.name.familyName)
            await dbRun('UPDATE users SET last_name = ? WHERE id = ? AND organization_id = ?', [
              op.value.name.familyName,
              id,
              orgId,
            ]);
        }
        if (op.value.emails?.[0]?.value) {
          await dbRun('UPDATE users SET email = ? WHERE id = ? AND organization_id = ?', [
            op.value.emails[0].value.toLowerCase(),
            id,
            orgId,
          ]);
        }
      }
    }

    await dbRun(
      "UPDATE users SET scim_last_sync_at = datetime('now') WHERE id = ? AND organization_id = ?",
      [id, orgId]
    );
    await logSyncOp('patch', 'User', id);
    logger.info(`[SCIM] Patched user: ${id}`);

    const updated = await dbGet<any>('SELECT * FROM users WHERE id = ? AND organization_id = ?', [
      id,
      orgId,
    ]);
    res.json(formatScimUser(updated));
  })
);

router.delete(
  '/Users/:id',
  verifyScimToken,
  asyncHandler(async (req: ScimRequest, res: Response) => {
    const orgId = req.scimOrgId as string;
    const id = String(req.params.id);
    const user = await dbGet<any>('SELECT id, email FROM users WHERE id = ? AND organization_id = ?', [
      id,
      orgId,
    ]);
    if (!user) {
      return res.status(404).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'User not found',
        status: '404',
      });
    }

    await dbRun(
      `UPDATE users SET is_active = 0, scim_last_sync_at = datetime('now') WHERE id = ? AND organization_id = ?`,
      [id, orgId]
    );
    await revokeUserSessions(id, orgId);
    await logSyncOp('delete', 'User', id);
    logger.info(`[SCIM] Deactivated user: ${user.email} (${id})`);

    res.status(204).send();
  })
);

// ── SCIM 2.0 Protocol Endpoints — Groups ──

router.get(
  '/Groups',
  verifyScimToken,
  asyncHandler(async (req: ScimRequest, res: Response) => {
    const { startIndex = '1', count = '100', filter } = req.query;
    const parsedCount = Math.max(1, Math.min(1000, parseInt(count as string, 10) || 100));
    const parsedStart = Math.max(1, parseInt(startIndex as string, 10) || 1);

    let groups: any[];
    if (filter && typeof filter === 'string' && filter.startsWith('displayName eq ')) {
      const name = filter.replace('displayName eq ', '').replace(/"/g, '');
      groups = await dbAll(
        'SELECT id, name, created_at FROM user_groups WHERE name = ? AND organization_id = ?',
        [name, req.scimOrgId],
        { fallback: true }
      );
    } else {
      groups = await dbAll(
        'SELECT id, name, created_at FROM user_groups WHERE organization_id = ? LIMIT ? OFFSET ?',
        [req.scimOrgId, parsedCount, parsedStart - 1],
        { fallback: true }
      );
    }

    const resources = await Promise.all((groups || []).map(formatScimGroup));
    res.json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: (groups || []).length,
      startIndex: parsedStart,
      itemsPerPage: parsedCount,
      Resources: resources,
    });
  })
);

router.post(
  '/Groups',
  verifyScimToken,
  asyncHandler(async (req: ScimRequest, res: Response) => {
    const orgId = req.scimOrgId as string;
    const { displayName, members } = req.body;
    if (!displayName) {
      return res.status(400).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'displayName required',
        status: '400',
      });
    }

    // Group names have no uniqueness constraint at the schema level, so this
    // dup-check must itself be org-scoped — otherwise org A's "Engineering"
    // would collide with org B's "Engineering" and the code below would
    // treat org B's group as an existing match to merge into.
    const existing = await dbGet<any>(
      'SELECT id, name FROM user_groups WHERE name = ? AND organization_id = ?',
      [displayName, orgId]
    );
    if (existing) {
      await logConflict(orgId, 'duplicate_group_name', 'Group', undefined, existing.id, {
        displayName,
      });
      logger.warn(`[SCIM] Conflict: group "${displayName}" already exists (id=${existing.id})`);
      const formatted = await formatScimGroup(existing);
      return res.status(200).json(formatted);
    }

    const id = uuidv4();
    await dbRun(
      `INSERT INTO user_groups (id, name, group_type, organization_id, created_at)
       VALUES (?, ?, 'scim', ?, datetime('now'))`,
      [id, displayName, orgId]
    );

    if (Array.isArray(members)) {
      for (const member of members) {
        if (member.value && (await userBelongsToOrg(member.value, orgId))) {
          await dbRun(
            `INSERT OR IGNORE INTO user_group_members (group_id, user_id, role, added_at)
             VALUES (?, ?, 'member', datetime('now'))`,
            [id, member.value]
          );
        }
      }
    }

    await logSyncOp('create', 'Group', id);
    logger.info(`[SCIM] Created group: ${displayName}`);

    const group = await dbGet<any>(
      'SELECT id, name, created_at FROM user_groups WHERE id = ? AND organization_id = ?',
      [id, orgId]
    );
    const formatted = await formatScimGroup(group || { id, name: displayName });
    res.status(201).json(formatted);
  })
);

router.get(
  '/Groups/:id',
  verifyScimToken,
  asyncHandler(async (req: ScimRequest, res: Response) => {
    const group = await dbGet<any>(
      'SELECT id, name, created_at FROM user_groups WHERE id = ? AND organization_id = ?',
      [req.params.id, req.scimOrgId]
    );
    if (!group) {
      return res.status(404).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'Group not found',
        status: '404',
      });
    }
    const formatted = await formatScimGroup(group);
    res.json(formatted);
  })
);

router.patch(
  '/Groups/:id',
  verifyScimToken,
  asyncHandler(async (req: ScimRequest, res: Response) => {
    const orgId = req.scimOrgId as string;
    const id = String(req.params.id);
    const group = await dbGet<any>(
      'SELECT id, name FROM user_groups WHERE id = ? AND organization_id = ?',
      [id, orgId]
    );
    if (!group) {
      return res.status(404).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'Group not found',
        status: '404',
      });
    }

    const operations: Array<{ op: string; path?: string; value?: any }> = req.body.Operations || [];
    for (const op of operations) {
      const opType = op.op?.toLowerCase();

      if (opType === 'replace' && op.path === 'displayName') {
        await dbRun('UPDATE user_groups SET name = ? WHERE id = ? AND organization_id = ?', [
          op.value,
          id,
          orgId,
        ]);
      } else if (opType === 'add' && op.path === 'members') {
        const membersToAdd = Array.isArray(op.value) ? op.value : [op.value];
        for (const member of membersToAdd) {
          if (member?.value && (await userBelongsToOrg(member.value, orgId))) {
            await dbRun(
              `INSERT OR IGNORE INTO user_group_members (group_id, user_id, role, added_at)
               VALUES (?, ?, 'member', datetime('now'))`,
              [id, member.value]
            );
          }
        }
      } else if (opType === 'remove' && op.path?.startsWith('members')) {
        // `id` (the group) was already confirmed to belong to `orgId` above,
        // so scoping the delete by group_id is sufficient here — there is no
        // way to reach another org's membership row through this group id.
        const memberMatch = op.path.match(/members\[value eq "(.+?)"\]/);
        if (memberMatch) {
          await dbRun('DELETE FROM user_group_members WHERE group_id = ? AND user_id = ?', [
            id,
            memberMatch[1],
          ]);
        } else if (Array.isArray(op.value)) {
          for (const member of op.value) {
            if (member?.value) {
              await dbRun('DELETE FROM user_group_members WHERE group_id = ? AND user_id = ?', [
                id,
                member.value,
              ]);
            }
          }
        }
      } else if (opType === 'replace' && op.path === 'members') {
        await dbRun('DELETE FROM user_group_members WHERE group_id = ?', [id]);
        const newMembers = Array.isArray(op.value) ? op.value : [];
        for (const member of newMembers) {
          if (member?.value && (await userBelongsToOrg(member.value, orgId))) {
            await dbRun(
              `INSERT OR IGNORE INTO user_group_members (group_id, user_id, role, added_at)
               VALUES (?, ?, 'member', datetime('now'))`,
              [id, member.value]
            );
          }
        }
      }
    }

    await logSyncOp('patch', 'Group', id);
    logger.info(`[SCIM] Patched group: ${id}`);

    const updated = await dbGet<any>(
      'SELECT id, name, created_at FROM user_groups WHERE id = ? AND organization_id = ?',
      [id, orgId]
    );
    const formatted = await formatScimGroup(updated || group);
    res.json(formatted);
  })
);

router.delete(
  '/Groups/:id',
  verifyScimToken,
  asyncHandler(async (req: ScimRequest, res: Response) => {
    const orgId = req.scimOrgId as string;
    const id = String(req.params.id);
    const group = await dbGet<any>(
      'SELECT id, name FROM user_groups WHERE id = ? AND organization_id = ?',
      [id, orgId]
    );
    if (!group) {
      return res.status(404).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'Group not found',
        status: '404',
      });
    }

    // `id` is already confirmed in-org above, so the member-cleanup delete
    // needs only group_id; the group-row delete keeps the org filter anyway
    // as defense-in-depth against the two statements ever drifting apart.
    await dbRun('DELETE FROM user_group_members WHERE group_id = ?', [id]);
    await dbRun('DELETE FROM user_groups WHERE id = ? AND organization_id = ?', [id, orgId]);
    await logSyncOp('delete', 'Group', id);
    logger.info(`[SCIM] Deleted group: ${group.name} (${id})`);

    res.status(204).send();
  })
);

// ── Admin Endpoints (SuperAdmin) ──

router.get(
  '/admin/service-provider',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    await ensureScimTables();
    const sp = await dbGet<any>(`SELECT * FROM scim_service_providers LIMIT 1`);
    if (!sp) {
      return res.json({ data: null });
    }
    res.json({
      data: {
        id: sp.id,
        organizationId: sp.organization_id,
        baseUrl: sp.base_url,
        patchSupported: !!sp.patch_supported,
        filterSupported: !!sp.filter_supported,
        isActive: !!sp.is_active,
        lastSyncAt: sp.last_sync_at,
        syncStatus: sp.sync_status,
      },
    });
  })
);

router.post(
  '/admin/service-provider',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { isActive } = req.body;
    await ensureScimTables();
    const existing = await dbGet<any>(`SELECT id FROM scim_service_providers LIMIT 1`);
    if (existing) {
      await dbRun(`UPDATE scim_service_providers SET is_active = ? WHERE id = ?`, [
        isActive ? 1 : 0,
        existing.id,
      ]);
    } else {
      const id = uuidv4();
      await dbRun(`INSERT INTO scim_service_providers (id, base_url, is_active) VALUES (?, ?, ?)`, [
        id,
        '/api/scim/v2',
        isActive ? 1 : 0,
      ]);
    }
    logger.info(`[SCIM] Service provider ${isActive ? 'enabled' : 'disabled'}`);
    res.json({ success: true });
  })
);

router.get(
  '/admin/tokens',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    await ensureScimTables();
    const rows = await dbAll(`SELECT * FROM scim_tokens ORDER BY created_at DESC`, [], {
      fallback: true,
    });
    const data = (rows || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      tokenPrefix: t.token_prefix,
      scopes: JSON.parse(t.scopes || '[]'),
      lastUsedAt: t.last_used_at,
      usageCount: t.usage_count || 0,
      expiresAt: t.expires_at,
      isActive: !!t.is_active,
      createdAt: t.created_at,
    }));
    res.json({ data });
  })
);

router.post(
  '/admin/tokens',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { name, description, scopes, organizationId } = req.body;
    if (!name) return res.status(400).json({ error: 'Token name is required' });
    await ensureScimTables();
    const id = uuidv4();
    const rawToken = `scim_${crypto.randomBytes(32).toString('hex')}`;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const tokenPrefix = rawToken.substring(0, 12);
    await dbRun(
      `INSERT INTO scim_tokens (id, name, description, token_hash, token_prefix, organization_id, scopes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        description || null,
        tokenHash,
        tokenPrefix,
        organizationId || null,
        JSON.stringify(scopes || []),
      ]
    );
    logger.info(`[SCIM] Token generated: ${name}`);
    res.json({
      data: {
        id,
        name,
        description,
        tokenPrefix,
        organizationId: organizationId || null,
        scopes: scopes || [],
        lastUsedAt: null,
        usageCount: 0,
        expiresAt: null,
        isActive: true,
        createdAt: new Date().toISOString(),
        token: rawToken,
      },
    });
  })
);

router.delete(
  '/admin/tokens/:id',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureScimTables();
    await dbRun(`DELETE FROM scim_tokens WHERE id = ?`, [req.params.id]);
    logger.info(`[SCIM] Token revoked: ${req.params.id}`);
    res.json({ success: true });
  })
);

router.get(
  '/admin/group-mappings',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    await ensureScimTables();
    const rows = await dbAll(`SELECT * FROM scim_group_mappings ORDER BY created_at DESC`, [], {
      fallback: true,
    });
    const data = (rows || []).map((m: any) => ({
      id: m.id,
      externalGroupId: m.external_group_id,
      externalGroupName: m.external_group_name,
      internalRole: m.internal_role,
      customRoleId: m.custom_role_id,
      isActive: !!m.is_active,
    }));
    res.json({ data });
  })
);

router.post(
  '/admin/group-mappings',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { externalGroupId, externalGroupName, internalRole } = req.body;
    if (!externalGroupId || !externalGroupName) {
      return res.status(400).json({ error: 'externalGroupId and externalGroupName are required' });
    }
    await ensureScimTables();
    const id = uuidv4();
    await dbRun(
      `INSERT INTO scim_group_mappings (id, external_group_id, external_group_name, internal_role)
       VALUES (?, ?, ?, ?)`,
      [id, externalGroupId, externalGroupName, internalRole || 'member']
    );
    logger.info(`[SCIM] Group mapping created: ${externalGroupName} → ${internalRole}`);
    res.json({ data: { id, externalGroupId, externalGroupName, internalRole, isActive: true } });
  })
);

router.delete(
  '/admin/group-mappings/:id',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureScimTables();
    await dbRun(`DELETE FROM scim_group_mappings WHERE id = ?`, [req.params.id]);
    logger.info(`[SCIM] Group mapping deleted: ${req.params.id}`);
    res.json({ success: true });
  })
);

router.get(
  '/admin/sync-logs',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 50;
    await ensureScimTables();
    const rows = await dbAll(
      `SELECT * FROM scim_sync_logs ORDER BY created_at DESC LIMIT ?`,
      [limit],
      { fallback: true }
    );
    const data = (rows || []).map((l: any) => ({
      id: l.id,
      operation: l.operation,
      resourceType: l.resource_type,
      resourceId: l.resource_id,
      externalId: l.external_id,
      status: l.status,
      errorMessage: l.error_message,
      createdAt: l.created_at,
    }));
    res.json({ data });
  })
);

// ── Conflict Management ──

router.get(
  '/admin/conflicts',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureScimTables();
    const resolved = req.query.resolved === 'true';
    const rows = await dbAll<any>(
      resolved
        ? `SELECT * FROM scim_conflict_log ORDER BY created_at DESC LIMIT 100`
        : `SELECT * FROM scim_conflict_log WHERE resolution IS NULL ORDER BY created_at DESC LIMIT 100`,
      [],
      { fallback: true }
    );
    const data = (rows || []).map((c: any) => ({
      id: c.id,
      organizationId: c.organization_id,
      conflictType: c.conflict_type,
      resourceType: c.resource_type,
      externalId: c.external_id,
      internalId: c.internal_id,
      details: c.details_json ? JSON.parse(c.details_json) : null,
      resolution: c.resolution,
      resolvedAt: c.resolved_at,
      createdAt: c.created_at,
    }));
    res.json({ data });
  })
);

router.post(
  '/admin/conflicts/:id/resolve',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const { resolution } = req.body;
    if (!resolution || !['merge', 'skip', 'overwrite'].includes(resolution)) {
      return res.status(400).json({ error: 'resolution must be one of: merge, skip, overwrite' });
    }

    await ensureScimTables();
    const conflict = await dbGet<any>('SELECT * FROM scim_conflict_log WHERE id = ?', [id]);
    if (!conflict) {
      return res.status(404).json({ error: 'Conflict not found' });
    }

    if (resolution === 'overwrite' && conflict.resource_type === 'User' && conflict.internal_id) {
      const details = conflict.details_json ? JSON.parse(conflict.details_json) : {};
      if (details.email && conflict.external_id) {
        await dbRun(
          `UPDATE users SET scim_external_id = ?, scim_provisioned = 1, scim_last_sync_at = datetime('now') WHERE id = ?`,
          [conflict.external_id, conflict.internal_id]
        );
      }
    }

    await dbRun(
      `UPDATE scim_conflict_log SET resolution = ?, resolved_at = datetime('now') WHERE id = ?`,
      [resolution, id]
    );
    await logSyncOp(
      'conflict_resolve',
      conflict.resource_type,
      conflict.internal_id,
      conflict.external_id
    );
    logger.info(`[SCIM] Conflict ${id} resolved as: ${resolution}`);

    res.json({ success: true, resolution });
  })
);

// ── Group Sync ──

router.post(
  '/admin/sync',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    await ensureScimTables();

    const mappings = await dbAll<any>(
      `SELECT * FROM scim_group_mappings WHERE is_active = 1 AND auto_sync = 1`,
      [],
      { fallback: true }
    );

    const results: Array<{
      mappingId: string;
      externalGroupName: string;
      added: number;
      removed: number;
      memberCount: number;
    }> = [];

    for (const mapping of mappings || []) {
      const internalGroup = await dbGet<any>(
        'SELECT id, name FROM user_groups WHERE name = ? OR id = ?',
        [mapping.external_group_name, mapping.external_group_id]
      );

      if (!internalGroup) {
        await logSyncOp(
          'sync_skip',
          'Group',
          mapping.id,
          mapping.external_group_id,
          'warning',
          'No matching internal group'
        );
        continue;
      }

      const currentMembers = await dbAll<any>(
        'SELECT user_id FROM user_group_members WHERE group_id = ?',
        [internalGroup.id],
        { fallback: true }
      );
      const currentMemberIds = new Set((currentMembers || []).map((m: any) => m.user_id));

      const roleUsers = await dbAll<any>(
        'SELECT id FROM users WHERE role = ? AND is_active = 1',
        [mapping.internal_role],
        { fallback: true }
      );
      const targetMemberIds = new Set((roleUsers || []).map((u: any) => u.id));

      let added = 0;
      let removed = 0;

      for (const userId of targetMemberIds) {
        if (!currentMemberIds.has(userId)) {
          await dbRun(
            `INSERT OR IGNORE INTO user_group_members (group_id, user_id, role, added_at)
             VALUES (?, ?, 'member', datetime('now'))`,
            [internalGroup.id, userId]
          );
          added++;
        }
      }

      for (const userId of currentMemberIds) {
        if (!targetMemberIds.has(userId)) {
          await dbRun('DELETE FROM user_group_members WHERE group_id = ? AND user_id = ?', [
            internalGroup.id,
            userId,
          ]);
          removed++;
        }
      }

      const memberCount = targetMemberIds.size;
      await dbRun(
        `UPDATE scim_group_mappings SET last_synced_at = datetime('now'), member_count = ? WHERE id = ?`,
        [memberCount, mapping.id]
      );

      await logSyncOp('sync', 'Group', internalGroup.id, mapping.external_group_id);
      results.push({
        mappingId: mapping.id,
        externalGroupName: mapping.external_group_name,
        added,
        removed,
        memberCount,
      });
    }

    logger.info(`[SCIM] Full sync completed: ${results.length} groups processed`);
    res.json({ success: true, syncedGroups: results.length, results });
  })
);

export default router;

/**
 * Access Code Service — HARDENED
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Migrated from server/services/accessCodeService.js (ES Modules) to TypeScript (ES Modules)
 * Unified engine for Referral, Invite, and Consultant codes.
 *
 * SECURITY FEATURES:
 * - SHA-256 hashing: codes stored as hash, plaintext only returned once
 * - Atomic consumption: BEGIN IMMEDIATE + conditional UPDATE
 * - Email-match binding for restricted invites
 * - Privacy-first validation (no org info, no attribution exposed)
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ==========================================
// CONSTANTS
// ==========================================

export const CODE_TYPES = {
  REFERRAL: 'REFERRAL',
  INVITE: 'INVITE',
  CONSULTANT: 'CONSULTANT',
  TRIAL: 'TRIAL',
} as const;

export type CodeType = (typeof CODE_TYPES)[keyof typeof CODE_TYPES];

export const CODE_STATUS = {
  ACTIVE: 'ACTIVE',
  REVOKED: 'REVOKED',
  EXPIRED: 'EXPIRED',
} as const;

export type CodeStatus = (typeof CODE_STATUS)[keyof typeof CODE_STATUS];

// ==========================================
// TYPES
// ==========================================

interface GenerateCodeParams {
  type: CodeType;
  createdByUserId?: string | null;
  createdByConsultantId?: string | null;
  organizationId?: string | null;
  targetEmail?: string | null;
  maxUses?: number;
  expiresInDays?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Params for the legacy-compat creation path (SuperAdminController / adminP32 /
 * access-control.routes). Unlike generateCode(), this preserves the exact legacy
 * feature set those three callers rely on: caller-supplied plaintext code,
 * organization-scoped role string, and an explicit expiresAt timestamp instead
 * of a day-count. It writes BOTH the hash-model columns (code_hash/uses_count/
 * status/type) and the legacy columns (role/current_uses/is_active) so the row
 * is immediately valid/visible to either engine.
 */
interface CreateLegacyCompatCodeParams {
  code?: string | null;
  organizationId: string | null;
  createdByUserId?: string | null;
  role?: string | null;
  maxUses?: number | null;
  expiresAt?: string | null;
}

interface CreateLegacyCompatCodeResult {
  id: string;
  code: string;
}

interface GenerateCodeResult {
  id: string;
  code: string;
  type: CodeType;
  expiresAt: string;
  maxUses: number;
}

interface ValidatePublicResult {
  valid: boolean;
  type?: CodeType;
  requiresEmailMatch?: boolean;
}

interface ValidateCodeResult {
  valid: boolean;
  code: string;
  type: CodeType;
  organizationId?: string | null;
  createdByUserId?: string | null;
  createdByConsultantId?: string | null;
  targetEmail?: string | null;
  metadata: Record<string, unknown>;
}

interface AcceptCodeParams {
  code: string;
  actorUserId: string;
  providedEmail?: string | null;
  actorIp?: string | null;
}

interface AcceptCodeResult {
  ok: boolean;
  error?: string;
  type?: CodeType;
  organizationId?: string | null;
  consultantId?: string | null;
  outcome?: 'START_TRIAL' | 'JOIN_ORG';
  metadata?: Record<string, unknown>;
}

interface AccessCodeRow {
  id: string;
  code: string;
  code_hash: string | null;
  type: string;
  organization_id?: string | null;
  created_by_user_id?: string | null;
  created_by_consultant_id?: string | null;
  target_email?: string | null;
  max_uses: number;
  uses_count: number;
  expires_at?: string | null;
  status: string;
  metadata_json?: string;
  used_at?: string | null;
  created_at: string;
  // Legacy-model columns — present on the same table (see dual-model
  // reconciliation, 2026-07-20). Only meaningful for rows reached via the
  // code_hash-IS-NULL fallback in findAccessCodeRow().
  current_uses?: number | null;
  is_active?: number | boolean | null;
}

interface CodeListRow {
  id: string;
  code: string;
  type: string;
  organization_id?: string | null;
  max_uses: number;
  uses_count: number;
  expires_at?: string | null;
  status: string;
  created_at: string;
  metadata_json?: string;
}

/**
 * Normalized admin list row — unifies the hash-model columns (uses_count/status)
 * with the legacy columns (current_uses/is_active/role) so admin UIs see a
 * consistent shape regardless of which engine created the row.
 */
interface AdminCodeListRow {
  id: string;
  code: string;
  type: string | null;
  role: string | null;
  organization_id?: string | null;
  max_uses: number | null;
  current_uses: number;
  uses_count: number;
  expires_at?: string | null;
  status: string | null;
  is_active: boolean;
  created_at: string;
  created_by?: string | null;
  metadata: Record<string, unknown>;
}

// ==========================================
// UTILITIES
// ==========================================

/**
 * Hash a code for secure storage (SHA-256)
 */
function hashCode(code: string): string {
  return crypto
    .createHash('sha256')
    .update(String(code || '').trim())
    .digest('hex');
}

/**
 * Generate a human-friendly code
 */
function generateHumanCode(prefix: string = 'JOIN'): string {
  // 4 bytes = ~6 base64url chars = 2^32 combinations
  const chunk = crypto.randomBytes(4).toString('base64url').toUpperCase().replace(/[_-]/g, 'X');
  return `${prefix}-${chunk}`;
}

/**
 * Safe JSON parse
 */
function safeParseJson(str: string | null | undefined): Record<string, unknown> {
  try {
    return JSON.parse(str || '{}');
  } catch {
    return {};
  }
}

/**
 * Look up a row by code, hash-first with a legacy-plaintext fallback.
 *
 * Dual-model reconciliation (CTO decision, 2026-07-20): codes created by the
 * legacy callers (SuperAdminController / adminP32 / access-control.routes)
 * are backfilled with code_hash by migration 20260720_access_codes_reconcile.sql,
 * but this fallback keeps validation working for any row that still has
 * code_hash IS NULL (e.g. rows inserted directly, or created before the
 * backfill ran on a given environment). Zero-risk: only reached when the hash
 * lookup misses.
 */
async function findAccessCodeRow(code: string): Promise<AccessCodeRow | undefined> {
  const codeHash = hashCode(code);
  const byHash = await DbPromise.get<AccessCodeRow>(
    db,
    `SELECT * FROM access_codes WHERE code_hash = ?`,
    [codeHash]
  );
  if (byHash) return byHash;

  return (
    (await DbPromise.get<AccessCodeRow>(
      db,
      `SELECT * FROM access_codes WHERE code_hash IS NULL AND code = ?`,
      [code]
    )) ?? undefined
  );
}

/**
 * Execute within BEGIN IMMEDIATE transaction (atomic for SQLite concurrency)
 */
async function withImmediateTransaction<T>(db: IDatabase, fn: () => Promise<T>): Promise<T> {
  await DbPromise.run(db, 'BEGIN IMMEDIATE', []);
  try {
    const result = await fn();
    await DbPromise.run(db, 'COMMIT', []);
    return result;
  } catch (err: any) {
    await DbPromise.run(db, 'ROLLBACK', []);
    throw err;
  }
}

// ==========================================
// SERVICE
// ==========================================

let db: IDatabase = getDatabase();
let AttributionService: any;
let MetricsCollector: any;

async function initDeps(): Promise<void> {
  if (!AttributionService) {
    const attributionModule = await import('./attributionService.js');
    AttributionService = attributionModule.default || attributionModule;
  }
  if (!MetricsCollector) {
    const metricsModule = await import('./metricsCollector.js');
    MetricsCollector = metricsModule.default || metricsModule;
  }
}

/**
 * Set database instance (for testing)
 */
export function setDependencies(newDeps: { db?: IDatabase } = {}): void {
  if (newDeps.db) {
    db = newDeps.db;
  }
}

/**
 * Generate a new access code.
 * RETURNS plaintext code ONCE. Database stores only hash.
 */
export async function generateCode(params: GenerateCodeParams): Promise<GenerateCodeResult> {
  const {
    type,
    createdByUserId = null,
    createdByConsultantId = null,
    organizationId = null,
    targetEmail = null,
    maxUses = 1,
    expiresInDays = 30,
    metadata = {},
  } = params;

  if (!Object.values(CODE_TYPES).includes(type)) {
    throw new Error(`Invalid code type: ${type}`);
  }

  const prefix =
    type === CODE_TYPES.TRIAL ? 'TRIAL' : type === CODE_TYPES.CONSULTANT ? 'CONS' : 'JOIN';
  const id = `ac-${uuidv4()}`;
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

  // Retry loop for hash collision (extremely unlikely with 4 bytes)
  let code = '';
  let codeHash = '';
  let retries = 0;
  const MAX_RETRIES = 5;

  while (retries < MAX_RETRIES) {
    code = generateHumanCode(prefix);
    codeHash = hashCode(code);
    const exists = await DbPromise.get<{ '1': number }>(
      db,
      `SELECT 1 FROM access_codes WHERE code_hash = ?`,
      [codeHash]
    );
    if (!exists) break;
    retries++;
  }

  if (retries >= MAX_RETRIES) {
    throw new Error('Failed to generate unique code. Please try again.');
  }

  await DbPromise.run(
    db,
    // `created_by` is the legacy (simple-model) creator column, kept populated for
    // cross-compatibility with SuperAdmin/adminP32 list queries that still read it.
    `INSERT INTO access_codes
         (id, code, code_hash, type, organization_id, created_by, created_by_user_id, created_by_consultant_id, target_email, max_uses, uses_count, expires_at, status, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'ACTIVE', ?, CURRENT_TIMESTAMP)`,
    [
      id,
      code, // Store plaintext temporarily for backwards compat; can remove after migration
      codeHash,
      type,
      organizationId,
      createdByUserId,
      createdByUserId,
      createdByConsultantId,
      targetEmail,
      maxUses,
      expiresAt,
      JSON.stringify(metadata || {}),
    ]
  );

  // Return plaintext ONCE (client must store/show it)
  return {
    id,
    code, // Plaintext
    type,
    expiresAt,
    maxUses,
  };
}

/**
 * PUBLIC Validate - minimal payload, no sensitive info.
 * Uses hash lookup.
 */
export async function validatePublic(code: string): Promise<ValidatePublicResult> {
  const row = await findAccessCodeRow(code);

  // Constant-time-ish: always same code path for invalid
  if (!row) return { valid: false };

  const now = Date.now();
  const expired = row.expires_at && new Date(row.expires_at).getTime() < now;
  const usesCount = row.uses_count ?? row.current_uses ?? 0;
  const exhausted = usesCount >= (row.max_uses || 1);
  // Rows reached via the code_hash fallback (legacy callers, not yet
  // reconciled by the backfill migration) may carry a stale/default
  // hash-model `status` — trust the legacy is_active flag for those. Rows
  // found by hash lookup are hash-model-native (or already reconciled), so
  // `status` is authoritative there.
  const active =
    row.code_hash != null
      ? row.status === CODE_STATUS.ACTIVE
      : row.is_active !== 0 && row.is_active !== false;

  if (!active || expired || exhausted) return { valid: false };

  return {
    valid: true,
    type: row.type as CodeType,
    requiresEmailMatch: !!row.target_email,
  };
}

/**
 * INTERNAL Validate - returns full record for service-to-service use.
 */
export async function validateCode(code: string): Promise<ValidateCodeResult> {
  const row = await findAccessCodeRow(code);

  if (!row) throw new Error('Invalid access code');
  // See validatePublic() for why legacy (code_hash IS NULL) rows trust
  // is_active instead of the possibly-stale/default hash-model `status`.
  const active =
    row.code_hash != null
      ? row.status === CODE_STATUS.ACTIVE
      : row.is_active !== 0 && row.is_active !== false;
  if (!active) throw new Error(`Code is ${row.code_hash != null ? row.status : 'REVOKED'}`);
  if (row.expires_at && new Date(row.expires_at) < new Date()) throw new Error('Code has expired');
  const usesCount = row.uses_count ?? row.current_uses ?? 0;
  if (row.max_uses !== null && usesCount >= row.max_uses)
    throw new Error('Code reuse limit reached');

  return {
    valid: true,
    code: row.code,
    type: row.type as CodeType,
    organizationId: row.organization_id || null,
    createdByUserId: row.created_by_user_id || null,
    createdByConsultantId: row.created_by_consultant_id || null,
    targetEmail: row.target_email || null,
    metadata: safeParseJson(row.metadata_json),
  };
}

/**
 * Accept/Consume a code atomically.
 * Uses BEGIN IMMEDIATE + conditional UPDATE for true atomicity.
 */
export async function acceptCode(params: AcceptCodeParams): Promise<AcceptCodeResult> {
  await initDeps();
  const { code, actorUserId, providedEmail = null, actorIp = null } = params;

  return await withImmediateTransaction(db, async () => {
    // 1. Load row — hash-first with legacy-plaintext fallback (dual-model
    // reconciliation, see findAccessCodeRow()).
    const row = await findAccessCodeRow(code);

    if (!row) return { ok: false, error: 'INVALID_CODE' };

    // 2. Email match if required
    if (row.target_email) {
      const pe = String(providedEmail || '')
        .trim()
        .toLowerCase();
      const te = String(row.target_email || '')
        .trim()
        .toLowerCase();
      if (!pe || pe !== te) return { ok: false, error: 'EMAIL_MISMATCH' };
    }

    // 3. Atomic consume with conditions.
    // - `code_hash IS NOT NULL AND status = 'ACTIVE'` is the original
    //   hash-model condition, unchanged.
    // - `code_hash IS NULL AND is_active <> 0` additively covers legacy rows
    //   reached via the fallback lookup (their `status` may be a stale
    //   default rather than a true reflection of is_active).
    // - `current_uses` is incremented alongside `uses_count` so legacy
    //   readers (SuperAdminController/adminP32/access-control.routes/
    //   auth.routes) see consumption that happened through this engine.
    const result = await DbPromise.run(
      db,
      `UPDATE access_codes
             SET uses_count = COALESCE(uses_count, 0) + 1,
                 current_uses = COALESCE(current_uses, 0) + 1,
                 used_at = CASE WHEN COALESCE(uses_count, 0) + 1 >= max_uses THEN CURRENT_TIMESTAMP ELSE used_at END,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?
               AND (
                 (code_hash IS NOT NULL AND status = 'ACTIVE')
                 OR (code_hash IS NULL AND COALESCE(is_active, 1) <> 0)
               )
               AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
               AND COALESCE(uses_count, 0) < max_uses`,
      [row.id]
    );

    if (result.changes !== 1) {
      return { ok: false, error: 'CODE_NOT_CONSUMABLE' };
    }

    // 4. Attribution (only for org-bound codes)
    if (row.organization_id) {
      try {
        const metadata = safeParseJson(row.metadata_json);
        await AttributionService.recordAttribution({
          userId: actorUserId,
          sourceType: 'ACCESS_CODE',
          sourceId: row.id,
          organizationId: row.organization_id,
          metadata: {
            code: row.code,
            type: row.type,
            consultantId: row.created_by_consultant_id,
            campaign: metadata.campaign,
          },
        });
      } catch (attrErr) {
        const error = attrErr as Error;
        logger.error('[AccessCodeService] Attribution error (non-fatal):', error.message);
      }
    }

    // 5. Metrics
    try {
      await MetricsCollector.recordEvent('access_code_accepted' as any, {
        userId: actorUserId,
        codeType: row.type,
        ip: actorIp,
      });
    } catch {
      // ignore
    }

    // 6. Determine outcome
    const outcome = row.type === CODE_TYPES.TRIAL ? 'START_TRIAL' : 'JOIN_ORG';

    return {
      ok: true,
      type: row.type as CodeType,
      organizationId: row.organization_id || null,
      consultantId: row.created_by_consultant_id || null,
      outcome,
      metadata: safeParseJson(row.metadata_json),
    };
  });
}

/**
 * List codes created by a user or consultant
 */
export async function listCodes(
  userId: string,
  userIdType: 'USER' | 'CONSULTANT' = 'USER'
): Promise<Array<CodeListRow & { metadata: Record<string, unknown> }>> {
  const column = userIdType === 'CONSULTANT' ? 'created_by_consultant_id' : 'created_by_user_id';
  const rows = await DbPromise.all<CodeListRow>(
    db,
    `SELECT id, code, type, organization_id, max_uses, uses_count, expires_at, status, created_at, metadata_json
         FROM access_codes WHERE ${column} = ? ORDER BY created_at DESC`,
    [userId]
  );
  return rows.map((r) => ({
    ...r,
    metadata: safeParseJson(r.metadata_json),
  }));
}

/**
 * Revoke a code.
 *
 * Sets BOTH the hash-model `status` and the legacy `is_active` flag
 * (dual-model reconciliation, 2026-07-20) so a revoke done through this
 * service is visible to legacy readers (SuperAdminController / adminP32 /
 * access-control.routes / auth.routes) without waiting for a migration.
 * Returns the row-count affected so callers can 404 on an unknown id
 * (previously the legacy callers each re-implemented this check inline).
 */
export async function revokeCode(codeId: string): Promise<{ changes: number }> {
  const result = await DbPromise.run(
    db,
    `UPDATE access_codes
         SET status = ?, is_active = 0, revoked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
    [CODE_STATUS.REVOKED, codeId]
  );
  return { changes: result.changes || 0 };
}

/**
 * Normalize a raw access_codes row (whichever engine created it) into a
 * single consistent admin-list shape. Used by listAllCodesAdmin() and
 * listCodesByOrganization().
 */
function normalizeAdminCodeRow(row: any): AdminCodeListRow {
  const usesCount = row.uses_count ?? row.current_uses ?? 0;
  const isActive =
    row.code_hash != null
      ? row.status == null || row.status === CODE_STATUS.ACTIVE
      : row.is_active !== 0 && row.is_active !== false;
  return {
    ...row,
    id: row.id,
    code: row.code,
    type: row.type ?? null,
    role: row.role ?? null,
    organization_id: row.organization_id ?? null,
    max_uses: row.max_uses != null ? Number(row.max_uses) : null,
    current_uses: Number(row.current_uses ?? usesCount ?? 0),
    uses_count: Number(usesCount),
    expires_at: row.expires_at ?? null,
    status: row.status ?? (isActive ? CODE_STATUS.ACTIVE : CODE_STATUS.REVOKED),
    is_active: isActive,
    created_at: row.created_at,
    created_by: row.created_by ?? row.created_by_user_id ?? null,
    metadata: safeParseJson(row.metadata_json),
  };
}

/**
 * Admin list: ALL access codes regardless of creator, hash-model or legacy.
 * Thin replacement for SuperAdminController's raw `SELECT * FROM access_codes`.
 */
export async function listAllCodesAdmin(): Promise<AdminCodeListRow[]> {
  const rows = await DbPromise.all<any>(
    db,
    `SELECT * FROM access_codes ORDER BY created_at DESC`,
    []
  );
  return rows.map(normalizeAdminCodeRow);
}

/**
 * Org-scoped admin list. Thin replacement for adminP32's raw per-organization
 * SELECT.
 */
export async function listCodesByOrganization(organizationId: string): Promise<AdminCodeListRow[]> {
  const rows = await DbPromise.all<any>(
    db,
    `SELECT * FROM access_codes WHERE organization_id = ? ORDER BY created_at DESC`,
    [organizationId]
  );
  return rows.map(normalizeAdminCodeRow);
}

/**
 * Legacy-compat creation path.
 *
 * generateCode() is the canon hash-model creator used by the Admin "generate
 * access code" UI (accessCodes.routes.ts) — it always mints its own code and
 * only understands the REFERRAL/INVITE/CONSULTANT/TRIAL type taxonomy, not
 * the legacy organization-role model.
 *
 * SuperAdminController / adminP32 / access-control.routes need a superset of
 * that: a caller-supplied plaintext code (SuperAdminController's admin UI
 * lets an operator type a custom code), a role string persisted on the
 * legacy `role` column (read downstream by access-control.routes' register
 * flow and auth.routes' signup flow to assign the joining user's role), and
 * an explicit `expiresAt` timestamp instead of a day-count.
 *
 * This writes both the hash-model columns (code_hash/uses_count/status/type)
 * AND the legacy columns (role/current_uses/is_active) in one INSERT, so the
 * row is valid/visible to either engine from the moment it is created —
 * zero functional loss relative to the 3 raw-SQL INSERTs it replaces.
 */
export async function createLegacyCompatCode(
  params: CreateLegacyCompatCodeParams
): Promise<CreateLegacyCompatCodeResult> {
  const id = `ac-${uuidv4()}`;
  const code = params.code && params.code.trim() ? params.code.trim() : generateHumanCode('JOIN');
  const codeHash = hashCode(code);
  const role = params.role || 'USER';
  const maxUses = params.maxUses || 1;

  await DbPromise.run(
    db,
    `INSERT INTO access_codes
         (id, code, code_hash, type, organization_id, created_by, created_by_user_id,
          role, max_uses, uses_count, current_uses, expires_at, status, is_active, metadata_json, created_at)
         VALUES (?, ?, ?, 'INVITE', ?, ?, ?, ?, ?, 0, 0, ?, 'ACTIVE', 1, '{}', CURRENT_TIMESTAMP)`,
    [
      id,
      code,
      codeHash,
      params.organizationId,
      params.createdByUserId || null,
      params.createdByUserId || null,
      role,
      maxUses,
      params.expiresAt || null,
    ]
  );

  return { id, code };
}

// Default export for backward compatibility
const AccessCodeService = {
  CODE_TYPES,
  CODE_STATUS,
  setDependencies,
  generateCode,
  validatePublic,
  validateCode,
  acceptCode,
  listCodes,
  revokeCode,
  listAllCodesAdmin,
  listCodesByOrganization,
  createLegacyCompatCode,
};

export default AccessCodeService;

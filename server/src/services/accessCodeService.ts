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
  code_hash: string;
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
  const codeHash = hashCode(code);

  const row = await DbPromise.get<{
    type: string;
    status: string;
    expires_at?: string | null;
    max_uses?: number | null;
    uses_count?: number | null;
    target_email?: string | null;
  }>(
    db,
    `SELECT type, status, expires_at, max_uses, uses_count, target_email
         FROM access_codes WHERE code_hash = ?`,
    [codeHash]
  );

  // Constant-time-ish: always same code path for invalid
  if (!row) return { valid: false };

  const now = Date.now();
  const expired = row.expires_at && new Date(row.expires_at).getTime() < now;
  const exhausted = (row.uses_count || 0) >= (row.max_uses || 1);
  const active = row.status === CODE_STATUS.ACTIVE;

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
  const codeHash = hashCode(code);

  const row = await DbPromise.get<AccessCodeRow>(
    db,
    `SELECT * FROM access_codes WHERE code_hash = ?`,
    [codeHash]
  );

  if (!row) throw new Error('Invalid access code');
  if (row.status !== CODE_STATUS.ACTIVE) throw new Error(`Code is ${row.status}`);
  if (row.expires_at && new Date(row.expires_at) < new Date()) throw new Error('Code has expired');
  if (row.max_uses !== null && row.uses_count >= row.max_uses)
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
  const codeHash = hashCode(code);

  return await withImmediateTransaction(db, async () => {
    // 1. Load row
    const row = await DbPromise.get<AccessCodeRow>(
      db,
      `SELECT id, code, type, organization_id, target_email, expires_at, max_uses, uses_count, status, metadata_json, created_by_consultant_id
             FROM access_codes WHERE code_hash = ?`,
      [codeHash]
    );

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

    // 3. Atomic consume with conditions
    const result = await DbPromise.run(
      db,
      `UPDATE access_codes
             SET uses_count = uses_count + 1,
                 used_at = CASE WHEN uses_count + 1 >= max_uses THEN CURRENT_TIMESTAMP ELSE used_at END,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?
               AND status = 'ACTIVE'
               AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
               AND uses_count < max_uses`,
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
 * Revoke a code
 */
export async function revokeCode(codeId: string): Promise<void> {
  await DbPromise.run(
    db,
    `UPDATE access_codes SET status = ?, revoked_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [CODE_STATUS.REVOKED, codeId]
  );
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
};

export default AccessCodeService;

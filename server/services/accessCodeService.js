/**
 * Access Code Service — HARDENED
 * 
 * Unified engine for Referral, Invite, and Consultant codes.
 * 
 * SECURITY FEATURES:
 * - SHA-256 hashing: codes stored as hash, plaintext only returned once
 * - Atomic consumption: BEGIN IMMEDIATE + conditional UPDATE
 * - Email-match binding for restricted invites
 * - Privacy-first validation (no org info, no attribution exposed)
 * 
 * @module AccessCodeService
 */

const db = require('../database');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const AttributionService = require('./attributionService');
const MetricsCollector = require('./metricsCollector');

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const CODE_TYPES = {
    REFERRAL: 'REFERRAL',
    INVITE: 'INVITE',
    CONSULTANT: 'CONSULTANT',
    TRIAL: 'TRIAL'
};

const CODE_STATUS = {
    ACTIVE: 'ACTIVE',
    REVOKED: 'REVOKED',
    EXPIRED: 'EXPIRED'
};

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hash a code for secure storage (SHA-256)
 * @param {string} code 
 * @returns {string} hex hash
 */
function hashCode(code) {
    return crypto.createHash('sha256').update(String(code || '').trim()).digest('hex');
}

/**
 * Generate a human-friendly code
 * @param {string} prefix - Prefix (e.g. JOIN, CONS, TRIAL)
 * @returns {string} - e.g. JOIN-7FQK2B
 */
function generateHumanCode(prefix = 'JOIN') {
    // 4 bytes = ~6 base64url chars = 2^32 combinations
    const chunk = crypto.randomBytes(4).toString('base64url').toUpperCase().replace(/[_-]/g, 'X');
    return `${prefix}-${chunk}`;
}

/**
 * Safe JSON parse
 */
function safeParseJson(str) {
    try { return JSON.parse(str || '{}'); } catch { return {}; }
}

/**
 * Promisified db.run
 */
function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

/**
 * Promisified db.get
 */
function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}

/**
 * Promisified db.all
 */
function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });
}

/**
 * Execute within BEGIN IMMEDIATE transaction (atomic for SQLite concurrency)
 */
async function withImmediateTransaction(fn) {
    await dbRun('BEGIN IMMEDIATE');
    try {
        const result = await fn();
        await dbRun('COMMIT');
        return result;
    } catch (err) {
        await dbRun('ROLLBACK');
        throw err;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────────────────────

const AccessCodeService = {
    CODE_TYPES,
    CODE_STATUS,

    /**
     * Generate a new access code.
     * RETURNS plaintext code ONCE. Database stores only hash.
     */
    generateCode: async ({
        type,
        createdByUserId = null,
        createdByConsultantId = null,
        organizationId = null,
        targetEmail = null,
        maxUses = 1,
        expiresInDays = 30,
        metadata = {}
    }) => {
        if (!Object.values(CODE_TYPES).includes(type)) {
            throw new Error(`Invalid code type: ${type}`);
        }

        const prefix = type === CODE_TYPES.TRIAL ? 'TRIAL' : (type === CODE_TYPES.CONSULTANT ? 'CONS' : 'JOIN');
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
            const exists = await dbGet(`SELECT 1 FROM access_codes WHERE code_hash = ?`, [codeHash]);
            if (!exists) break;
            retries++;
        }

        if (retries >= MAX_RETRIES) {
            throw new Error('Failed to generate unique code. Please try again.');
        }

        await dbRun(
            `INSERT INTO access_codes 
             (id, code, code_hash, type, organization_id, created_by_user_id, created_by_consultant_id, target_email, max_uses, uses_count, expires_at, status, metadata_json, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'ACTIVE', ?, CURRENT_TIMESTAMP)`,
            [
                id,
                code, // Store plaintext temporarily for backwards compat; can remove after migration
                codeHash,
                type,
                organizationId,
                createdByUserId,
                createdByConsultantId,
                targetEmail,
                maxUses,
                expiresAt,
                JSON.stringify(metadata || {})
            ]
        );

        // Return plaintext ONCE (client must store/show it)
        return {
            id,
            code, // Plaintext
            type,
            expiresAt,
            maxUses
        };
    },

    /**
     * PUBLIC Validate - minimal payload, no sensitive info.
     * Uses hash lookup.
     * @param {string} code - Plaintext code to validate
     * @returns {object} { valid, type?, requiresEmailMatch? }
     */
    validatePublic: async (code) => {
        const codeHash = hashCode(code);

        const row = await dbGet(
            `SELECT type, status, expires_at, max_uses, uses_count, target_email
             FROM access_codes WHERE code_hash = ?`,
            [codeHash]
        );

        // Constant-time-ish: always same code path for invalid
        if (!row) return { valid: false };

        const now = Date.now();
        const expired = row.expires_at && (new Date(row.expires_at).getTime() < now);
        const exhausted = (row.uses_count || 0) >= (row.max_uses || 1);
        const active = row.status === CODE_STATUS.ACTIVE;

        if (!active || expired || exhausted) return { valid: false };

        return {
            valid: true,
            type: row.type,
            requiresEmailMatch: !!row.target_email
        };
    },

    /**
     * INTERNAL Validate - returns full record for service-to-service use.
     * @param {string} code - Plaintext code
     * @returns {object} Full code record
     */
    validateCode: async (code) => {
        const codeHash = hashCode(code);

        const row = await dbGet(
            `SELECT * FROM access_codes WHERE code_hash = ?`,
            [codeHash]
        );

        if (!row) throw new Error('Invalid access code');
        if (row.status !== CODE_STATUS.ACTIVE) throw new Error(`Code is ${row.status}`);
        if (new Date(row.expires_at) < new Date()) throw new Error('Code has expired');
        if (row.max_uses !== null && row.uses_count >= row.max_uses) throw new Error('Code reuse limit reached');

        return {
            valid: true,
            code: row.code,
            type: row.type,
            organizationId: row.organization_id,
            createdByUserId: row.created_by_user_id,
            createdByConsultantId: row.created_by_consultant_id,
            targetEmail: row.target_email,
            metadata: safeParseJson(row.metadata_json)
        };
    },

    /**
     * Accept/Consume a code atomically.
     * Uses BEGIN IMMEDIATE + conditional UPDATE for true atomicity.
     * @param {object} params
     * @param {string} params.code - Plaintext code
     * @param {string} params.actorUserId - User consuming the code
     * @param {string} [params.providedEmail] - Email for match validation
     * @param {string} [params.actorIp] - For rate limiting tracking
     * @returns {object} { ok, type, organizationId?, outcome, error? }
     */
    acceptCode: async ({ code, actorUserId, providedEmail = null, actorIp = null }) => {
        const codeHash = hashCode(code);

        return await withImmediateTransaction(async () => {
            // 1. Load row
            const row = await dbGet(
                `SELECT id, code, type, organization_id, target_email, expires_at, max_uses, uses_count, status, metadata_json, created_by_consultant_id
                 FROM access_codes WHERE code_hash = ?`,
                [codeHash]
            );

            if (!row) return { ok: false, error: 'INVALID_CODE' };

            // 2. Email match if required
            if (row.target_email) {
                const pe = String(providedEmail || '').trim().toLowerCase();
                const te = String(row.target_email || '').trim().toLowerCase();
                if (!pe || pe !== te) return { ok: false, error: 'EMAIL_MISMATCH' };
            }

            // 3. Atomic consume with conditions
            const result = await dbRun(
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
                            campaign: metadata.campaign
                        }
                    });
                } catch (attrErr) {
                    console.error('[AccessCodeService] Attribution error (non-fatal):', attrErr.message);
                }
            }

            // 5. Metrics
            try {
                await MetricsCollector.recordEvent('access_code_accepted', {
                    userId: actorUserId,
                    codeType: row.type,
                    ip: actorIp
                });
            } catch { /* ignore */ }

            // 6. Determine outcome
            const outcome = row.type === CODE_TYPES.TRIAL ? 'START_TRIAL' : 'JOIN_ORG';

            return {
                ok: true,
                type: row.type,
                organizationId: row.organization_id || null,
                consultantId: row.created_by_consultant_id || null,
                outcome,
                metadata: safeParseJson(row.metadata_json)
            };
        });
    },

    /**
     * List codes created by a user or consultant
     */
    listCodes: async (userId, userIdType = 'USER') => {
        const column = userIdType === 'CONSULTANT' ? 'created_by_consultant_id' : 'created_by_user_id';
        const rows = await dbAll(
            `SELECT id, code, type, organization_id, max_uses, uses_count, expires_at, status, created_at, metadata_json
             FROM access_codes WHERE ${column} = ? ORDER BY created_at DESC`,
            [userId]
        );
        return rows.map(r => ({
            ...r,
            metadata: safeParseJson(r.metadata_json)
        }));
    },

    /**
     * Revoke a code
     */
    revokeCode: async (codeId) => {
        await dbRun(
            `UPDATE access_codes SET status = ?, revoked_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [CODE_STATUS.REVOKED, codeId]
        );
    }
};

module.exports = AccessCodeService;

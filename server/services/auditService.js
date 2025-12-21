/**
 * Audit Service (HARDENED)
 * 
 * Provides centralized, structured logging for all critical actions.
 * 
 * Security Features:
 * - sanitizeMetadata: Redacts sensitive fields (tokens, passwords, secrets)
 * - Standard actor types: USER, CONSULTANT, SYSTEM, AI
 * - Fail-silent: Audit failures don't break main flow
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../database');

// Actor Types
const ACTOR_TYPES = {
    USER: 'USER',
    CONSULTANT: 'CONSULTANT',
    SYSTEM: 'SYSTEM',
    AI: 'AI'
};

// Common Action Types
const ACTION_TYPES = {
    // Invites
    INVITE_CREATED: 'INVITE_CREATED',
    INVITE_ACCEPTED: 'INVITE_ACCEPTED',
    INVITE_REVOKED: 'INVITE_REVOKED',

    // Trial & Org Lifecycle
    TRIAL_STARTED: 'TRIAL_STARTED',
    TRIAL_EXPIRED: 'TRIAL_EXPIRED',
    TRIAL_CONVERTED: 'TRIAL_CONVERTED',
    ORG_CREATED: 'ORG_CREATED',
    ORG_ACTIVATED: 'ORG_ACTIVATED',
    ORG_DEACTIVATED: 'ORG_DEACTIVATED',

    // RBAC
    ROLE_CHANGED: 'ROLE_CHANGED',
    PERMISSION_GRANTED: 'PERMISSION_GRANTED',
    PERMISSION_REVOKED: 'PERMISSION_REVOKED',
    MEMBER_ADDED: 'MEMBER_ADDED',
    MEMBER_REMOVED: 'MEMBER_REMOVED',
    CONSULTANT_LINKED: 'CONSULTANT_LINKED',
    CONSULTANT_UNLINKED: 'CONSULTANT_UNLINKED',

    // Tokens
    TOKEN_CREDITED: 'TOKEN_CREDITED',
    TOKEN_DEBITED: 'TOKEN_DEBITED',

    // Initiatives & Tasks
    INITIATIVE_CREATED: 'INITIATIVE_CREATED',
    INITIATIVE_UPDATED: 'INITIATIVE_UPDATED',
    INITIATIVE_DELETED: 'INITIATIVE_DELETED',
    TASK_CREATED: 'TASK_CREATED',
    TASK_UPDATED: 'TASK_UPDATED',
    TASK_DELETED: 'TASK_DELETED',

    // AI
    AI_PROPOSAL_CREATED: 'AI_PROPOSAL_CREATED',
    AI_ACTION_EXECUTED: 'AI_ACTION_EXECUTED',
    AI_ACTION_REJECTED: 'AI_ACTION_REJECTED',

    // Auth
    USER_LOGIN: 'USER_LOGIN',
    USER_LOGOUT: 'USER_LOGOUT',
    USER_REGISTERED: 'USER_REGISTERED',

    // Security
    ACCESS_DENIED: 'ACCESS_DENIED',
    TENANT_HOPPING_ATTEMPT: 'TENANT_HOPPING_ATTEMPT',

    // Generic
    ENTITY_VIEWED: 'ENTITY_VIEWED',
    ENTITY_EXPORTED: 'ENTITY_EXPORTED',

    // Phase E: Onboarding
    ONBOARDING_CONTEXT_SAVED: 'ONBOARDING_CONTEXT_SAVED',
    ONBOARDING_PLAN_GENERATED: 'ONBOARDING_PLAN_GENERATED',
    ONBOARDING_PLAN_ACCEPTED: 'ONBOARDING_PLAN_ACCEPTED'
};

// ============================================
// SECURITY: Sensitive field redaction
// ============================================

const SENSITIVE_KEYS = new Set([
    // Auth & Tokens
    'password', 'passwordHash', 'password_hash',
    'token', 'accessToken', 'access_token',
    'refreshToken', 'refresh_token',
    'jwt', 'jwtToken', 'bearer',
    'authorization', 'auth',

    // Secrets & Keys
    'apiKey', 'api_key', 'apikey',
    'secret', 'secretKey', 'secret_key',
    'clientSecret', 'client_secret',
    'privateKey', 'private_key',
    'encryptionKey', 'encryption_key',

    // Invite & Access Codes
    'inviteCode', 'invite_code',
    'accessCode', 'access_code',
    'verificationCode', 'verification_code',
    'resetToken', 'reset_token',

    // PII (optional redaction)
    'ssn', 'socialSecurityNumber',
    'creditCard', 'credit_card', 'cardNumber', 'card_number',
    'cvv', 'cvc'
]);

/**
 * Recursively sanitize metadata object, redacting sensitive fields.
 * @param {Object|Array|any} obj - Data to sanitize
 * @param {number} depth - Current recursion depth (max 10)
 * @returns {Object|Array|any} Sanitized data
 */
function sanitizeMetadata(obj, depth = 0) {
    if (depth > 10) return '[MAX_DEPTH]';
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeMetadata(item, depth + 1));
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        const keyLower = key.toLowerCase();

        // Check if key is sensitive
        if (SENSITIVE_KEYS.has(key) || SENSITIVE_KEYS.has(keyLower)) {
            sanitized[key] = '[REDACTED]';
        }
        // Recursively sanitize nested objects
        else if (value && typeof value === 'object') {
            sanitized[key] = sanitizeMetadata(value, depth + 1);
        }
        else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}

// ============================================
// Core Logging Functions
// ============================================

/**
 * Log an audit event to the database.
 * 
 * @param {Object} params - Audit event parameters
 * @returns {Promise<Object>} The created audit event result
 */
async function logEvent({
    actorUserId = null,
    actorType = ACTOR_TYPES.USER,
    orgId = null,
    actionType,
    entityType = null,
    entityId = null,
    metadata = {},
    ip = null,
    userAgent = null
}) {
    const id = uuidv4();

    // SECURITY: Always sanitize metadata
    const sanitizedMetadata = sanitizeMetadata(metadata);
    const metadataJson = JSON.stringify(sanitizedMetadata);

    return new Promise((resolve) => {
        db.run(
            `INSERT INTO audit_events 
             (id, actor_user_id, actor_type, org_id, action_type, entity_type, entity_id, metadata_json, ip, user_agent)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, actorUserId, actorType, orgId, actionType, entityType, entityId, metadataJson, ip, userAgent],
            function (err) {
                if (err) {
                    console.error('[AuditService] Failed to log event:', err.message);
                    // Fail-silent: audit failures should not break main flow
                    resolve({ success: false, error: err.message });
                } else {
                    resolve({
                        success: true,
                        id,
                        actionType,
                        entityType,
                        entityId
                    });
                }
            }
        );
    });
}

/**
 * Log from Express request context.
 * Automatically extracts user, org, IP, and user-agent.
 */
async function logFromRequest(req, actionType, entityType, entityId, metadata = {}) {
    // Determine actor type from request context
    let actorType = ACTOR_TYPES.USER;
    if (req.org?.isConsultant) {
        actorType = ACTOR_TYPES.CONSULTANT;
    }

    const actorUserId = req.user?.id || null;
    const orgId = req.org?.id || req.orgContext?.orgId || req.user?.organization_id || null;
    const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || null;
    const userAgent = req.headers['user-agent'] || null;

    return logEvent({
        actorUserId,
        actorType,
        orgId,
        actionType,
        entityType,
        entityId,
        metadata,
        ip,
        userAgent
    });
}

/**
 * Log a SYSTEM event (no user actor).
 */
async function logSystemEvent(actionType, entityType, entityId, orgId = null, metadata = {}) {
    return logEvent({
        actorUserId: null,
        actorType: ACTOR_TYPES.SYSTEM,
        orgId,
        actionType,
        entityType,
        entityId,
        metadata
    });
}

/**
 * Log an AI event.
 */
async function logAIEvent(actionType, entityType, entityId, orgId = null, metadata = {}) {
    return logEvent({
        actorUserId: null,
        actorType: ACTOR_TYPES.AI,
        orgId,
        actionType,
        entityType,
        entityId,
        metadata
    });
}

/**
 * Log a security event (access denied, tenant hopping, etc.)
 */
async function logSecurityEvent(req, actionType, metadata = {}) {
    return logFromRequest(req, actionType, 'SECURITY', null, {
        ...metadata,
        attemptedOrg: req.params?.orgId || req.headers?.['x-org-id'],
        userOrg: req.user?.organization_id,
        path: req.originalUrl,
        method: req.method
    });
}

// ============================================
// Query Functions
// ============================================

/**
 * Query audit events with filters.
 */
async function getEvents({ orgId, actorUserId, actionType, entityType, entityId, limit = 100, offset = 0 }) {
    const conditions = [];
    const params = [];

    if (orgId) {
        conditions.push('org_id = ?');
        params.push(orgId);
    }
    if (actorUserId) {
        conditions.push('actor_user_id = ?');
        params.push(actorUserId);
    }
    if (actionType) {
        conditions.push('action_type = ?');
        params.push(actionType);
    }
    if (entityType) {
        conditions.push('entity_type = ?');
        params.push(entityType);
    }
    if (entityId) {
        conditions.push('entity_id = ?');
        params.push(entityId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return new Promise((resolve, reject) => {
        db.all(
            `SELECT * FROM audit_events ${whereClause} ORDER BY ts DESC LIMIT ? OFFSET ?`,
            [...params, limit, offset],
            (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows.map(row => ({
                        ...row,
                        metadata: JSON.parse(row.metadata_json || '{}')
                    })));
                }
            }
        );
    });
}

module.exports = {
    // Constants
    ACTOR_TYPES,
    ACTION_TYPES,

    // Core functions
    logEvent,
    logFromRequest,
    logSystemEvent,
    logAIEvent,
    logSecurityEvent,
    getEvents,

    // Utility (exported for testing)
    sanitizeMetadata
};

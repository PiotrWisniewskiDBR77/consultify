/**
 * API Key Service
 *
 * Manages API keys for M2M integration:
 * - Key generation and validation
 * - Scope-based permissions
 * - Rate limiting
 * - Usage tracking
 */

// Type declaration for bcrypt
declare module 'bcrypt' {
    export function hash(data: string, saltRounds: number): Promise<string>;
    export function compare(data: string, encrypted: string): Promise<boolean>;
}

import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import db from '../database.js';
import AuditService from './auditService.js';

interface Database {
    get: (sql: string, params: unknown[], callback: (err: Error | null, row: unknown) => void) => void;
    run: (
        sql: string,
        params: unknown[],
        callback: (this: { lastID: number; changes: number }, err: Error | null) => void,
    ) => void;
    all: (sql: string, params: unknown[], callback: (err: Error | null, rows: unknown[]) => void) => void;
}

export interface ApiKeyScopes {
    'read:users': string;
    'write:users': string;
    'delete:users': string;
    'read:organizations': string;
    'write:organizations': string;
    'read:projects': string;
    'write:projects': string;
    'delete:projects': string;
    'read:assessments': string;
    'write:assessments': string;
    'read:initiatives': string;
    'write:initiatives': string;
    'read:tasks': string;
    'write:tasks': string;
    'read:reports': string;
    'export:reports': string;
    'use:ai': string;
    'read:ai_usage': string;
    'admin:billing': string;
    'admin:audit': string;
    'admin:settings': string;
    'manage:webhooks': string;
}

export interface CreateApiKeyData {
    organizationId: string;
    userId?: string | null;
    name: string;
    description?: string;
    scopes?: string[];
    keyType?: 'org' | 'user' | 'service';
    rateLimitPerMinute?: number;
    rateLimitPerDay?: number;
    allowedIps?: string[];
    expiresAt?: string | null;
    createdBy: string;
}

export interface ApiKeyResult {
    id: string;
    key: string;
    keyPrefix: string;
    name: string;
    scopes: string[];
    expiresAt: string | null;
}

export interface ValidatedApiKey {
    id: string;
    organizationId: string;
    userId: string | null;
    name: string;
    keyType: string;
    scopes: string[];
    rateLimitPerMinute: number;
    rateLimitPerDay: number;
    allowedIps: string[];
}

export interface ValidationResult {
    valid: boolean;
    error?: string;
    key?: ValidatedApiKey;
}

export interface RateLimitResult {
    allowed: boolean;
    remaining?: number;
    retryAfter?: number;
}

export interface UsageLogData {
    endpoint: string;
    method: string;
    statusCode: number;
    responseTime: number;
    ip: string;
    userAgent?: string;
    requestsRemaining: number;
    errorCode?: string;
    errorMessage?: string;
}

export interface GetKeysOptions {
    userId?: string;
    includeRevoked?: boolean;
}

export interface ApiKeyRecord {
    id: string;
    organization_id: string;
    user_id: string | null;
    name: string;
    description: string;
    key_prefix: string;
    key_type: string;
    scopes: string[];
    rate_limit_per_minute: number;
    rate_limit_per_day: number;
    allowed_ips: string[];
    last_used_at: string;
    usage_count: number;
    expires_at: string;
    is_active: number;
    created_at: string;
    isActive: boolean;
}

export interface UsageStatistics {
    usage: Array<{
        date: string;
        requests: number;
        avg_response_time: number;
        successful: number;
        failed: number;
    }>;
    totals: {
        total_requests: number;
        avg_response_time: number;
        total_errors: number;
    };
    endpoints: Array<{
        endpoint: string;
        method: string;
        count: number;
    }>;
}

export interface UpdateApiKeyData {
    name?: string;
    description?: string;
    scopes?: string[];
    rateLimitPerMinute?: number;
    rateLimitPerDay?: number;
    allowedIps?: string[];
    expiresAt?: string;
}

export interface ApiKeyServiceInterface {
    getAvailableScopes: () => ApiKeyScopes;
    createKey: (data: CreateApiKeyData) => Promise<ApiKeyResult>;
    validateKey: (plainKey: string) => Promise<ValidationResult>;
    hasScope: (key: ValidatedApiKey, requiredScope: string) => boolean;
    checkRateLimit: (keyId: string, type?: 'minute' | 'day') => Promise<RateLimitResult>;
    logUsage: (keyId: string, data: UsageLogData) => Promise<void>;
    getKeys: (organizationId: string, options?: GetKeysOptions) => Promise<ApiKeyRecord[]>;
    getKeyUsage: (keyId: string, days?: number) => Promise<UsageStatistics>;
    updateKey: (
        keyId: string,
        updates: UpdateApiKeyData,
        updatedBy: string,
    ) => Promise<{ success: boolean; message?: string }>;
    revokeKey: (keyId: string, revokedBy: string, reason?: string | null) => Promise<{ success: boolean }>;
    regenerateKey: (keyId: string, regeneratedBy: string) => Promise<ApiKeyResult>;
}

// Database helpers
function dbGet(sql: string, params: unknown[] = []): Promise<unknown> {
    return new Promise((resolve, reject) => {
        (db as Database).get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbRun(sql: string, params: unknown[] = []): Promise<{ lastID: number; changes: number }> {
    return new Promise((resolve, reject) => {
        (db as Database).run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function dbAll(sql: string, params: unknown[] = []): Promise<unknown[]> {
    return new Promise((resolve, reject) => {
        (db as Database).all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

// Available API scopes
const API_SCOPES: ApiKeyScopes & { [key: string]: string } = {
    // Users
    'read:users': 'Read user information',
    'write:users': 'Create/update users',
    'delete:users': 'Delete users',

    // Organizations
    'read:organizations': 'Read organization data',
    'write:organizations': 'Update organization settings',

    // Projects
    'read:projects': 'Read projects',
    'write:projects': 'Create/update projects',
    'delete:projects': 'Delete projects',

    // Assessments
    'read:assessments': 'Read assessments',
    'write:assessments': 'Create/update assessments',

    // Initiatives
    'read:initiatives': 'Read initiatives',
    'write:initiatives': 'Create/update initiatives',

    // Tasks
    'read:tasks': 'Read tasks',
    'write:tasks': 'Create/update tasks',

    // Reports
    'read:reports': 'Read reports',
    'export:reports': 'Export reports to PDF/Excel',

    // AI
    'use:ai': 'Use AI features',
    'read:ai_usage': 'Read AI usage statistics',

    // Admin
    'admin:billing': 'Access billing data',
    'admin:audit': 'Access audit logs',
    'admin:settings': 'Modify system settings',

    // Webhooks
    'manage:webhooks': 'Create/manage webhooks',
};

const ApiKeyService: ApiKeyServiceInterface = {
    /**
     * Get all available scopes
     */
    getAvailableScopes(): ApiKeyScopes {
        return API_SCOPES;
    },

    /**
     * Generate a new API key
     * Returns the plain key only once - must be shown to user immediately
     */
    async createKey(data: CreateApiKeyData): Promise<ApiKeyResult> {
        const {
            organizationId,
            userId, // null for org-level keys
            name,
            description,
            scopes = [],
            keyType = 'org',
            rateLimitPerMinute = 60,
            rateLimitPerDay = 10000,
            allowedIps = [],
            expiresAt = null,
            createdBy,
        } = data;

        // Validate scopes
        for (const scope of scopes) {
            if (!API_SCOPES[scope]) {
                throw new Error(`Invalid scope: ${scope}`);
            }
        }

        // Generate key
        const keyId = uuidv4();
        const prefix = keyType === 'user' ? 'ck_user_' : keyType === 'service' ? 'ck_svc_' : 'ck_live_';
        const randomPart = crypto.randomBytes(24).toString('base64url');
        const plainKey = `${prefix}${randomPart}`;

        // Hash the key for storage
        const keyHash = await bcrypt.hash(plainKey, 10);
        const keyPrefix = plainKey.substring(0, 12); // Store first 12 chars for identification

        await dbRun(
            `INSERT INTO api_keys (
                id, organization_id, user_id, name, description,
                key_hash, key_prefix, key_type, scopes,
                rate_limit_per_minute, rate_limit_per_day, allowed_ips,
                expires_at, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                keyId,
                organizationId,
                userId,
                name,
                description,
                keyHash,
                keyPrefix,
                keyType,
                JSON.stringify(scopes),
                rateLimitPerMinute,
                rateLimitPerDay,
                JSON.stringify(allowedIps),
                expiresAt,
                createdBy,
            ],
        );

        AuditService.logSystemEvent('API_KEY_CREATED', 'api_key', keyId, organizationId as any, {
            name,
            keyType,
            scopes,
            createdBy,
        });

        // Return plain key only this once
        return {
            id: keyId,
            key: plainKey, // Show this to user - never stored in plain text
            keyPrefix,
            name,
            scopes,
            expiresAt,
        };
    },

    /**
     * Validate an API key and return its details
     */
    async validateKey(plainKey: string): Promise<ValidationResult> {
        if (!plainKey || !plainKey.startsWith('ck_')) {
            return { valid: false, error: 'Invalid key format' };
        }

        const keyPrefix = plainKey.substring(0, 12);

        // Find potential matches by prefix
        const potentialKeys = (await dbAll(`SELECT * FROM api_keys WHERE key_prefix = ? AND is_active = 1`, [keyPrefix])) as Array<Record<string, unknown>>;

        for (const keyRecord of potentialKeys) {
            const match = await bcrypt.compare(plainKey, (keyRecord.key_hash as string));
            if (match) {
                // Check expiration
                if (keyRecord.expires_at && new Date(keyRecord.expires_at as string) < new Date()) {
                    return { valid: false, error: 'Key expired' };
                }

                // Update last used
                await dbRun(
                    `UPDATE api_keys SET last_used_at = datetime('now'), usage_count = usage_count + 1 WHERE id = ?`,
                    [keyRecord.id as string],
                );

                return {
                    valid: true,
                    key: {
                        id: keyRecord.id as string,
                        organizationId: keyRecord.organization_id as string,
                        userId: keyRecord.user_id as string | null,
                        name: keyRecord.name as string,
                        keyType: keyRecord.key_type as string,
                        scopes: JSON.parse((keyRecord.scopes as string) || '[]'),
                        rateLimitPerMinute: keyRecord.rate_limit_per_minute as number,
                        rateLimitPerDay: keyRecord.rate_limit_per_day as number,
                        allowedIps: JSON.parse((keyRecord.allowed_ips as string) || '[]'),
                    },
                };
            }
        }

        return { valid: false, error: 'Invalid key' };
    },

    /**
     * Check if a key has a specific scope
     */
    hasScope(key: ValidatedApiKey, requiredScope: string): boolean {
        return key.scopes.includes(requiredScope) || key.scopes.includes('admin:*');
    },

    /**
     * Check rate limit
     */
    async checkRateLimit(keyId: string, type: 'minute' | 'day' = 'minute'): Promise<RateLimitResult> {
        const now = new Date();
        let windowStart;

        if (type === 'minute') {
            windowStart = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
                now.getHours(),
                now.getMinutes(),
            ).toISOString();
        } else {
            windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        }

        // Get or create rate limit record
        const rateLimit = (await dbGet(
            `SELECT * FROM api_key_rate_limits WHERE api_key_id = ? AND window_start = ? AND window_type = ?`,
            [keyId, windowStart, type],
        )) as Record<string, unknown> | undefined;

        if (!rateLimit) {
            await dbRun(
                `INSERT INTO api_key_rate_limits (id, api_key_id, window_start, window_type, request_count)
                 VALUES (?, ?, ?, ?, 1)`,
                [uuidv4(), keyId, windowStart, type],
            );
            return { allowed: true, remaining: 999 }; // First request in window
        }

        // Get key limits
        const key = (await dbGet(`SELECT rate_limit_per_minute, rate_limit_per_day FROM api_keys WHERE id = ?`, [keyId])) as Record<string, unknown>;
        const limit = (type === 'minute' ? (key.rate_limit_per_minute as number) : (key.rate_limit_per_day as number));

        if ((rateLimit.request_count as number) >= limit) {
            return { allowed: false, remaining: 0, retryAfter: type === 'minute' ? 60 : 86400 };
        }

        // Increment counter
        await dbRun(`UPDATE api_key_rate_limits SET request_count = request_count + 1 WHERE id = ?`, [rateLimit.id as string]);

        return { allowed: true, remaining: limit - (rateLimit.request_count as number) - 1 };
    },

    /**
     * Log API usage
     */
    async logUsage(keyId: string, data: UsageLogData): Promise<void> {
        await dbRun(
            `INSERT INTO api_key_usage (
                id, api_key_id, endpoint, method, status_code, response_time_ms,
                ip_address, user_agent, requests_remaining, error_code, error_message
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                uuidv4(),
                keyId,
                data.endpoint,
                data.method,
                data.statusCode,
                data.responseTime,
                data.ip,
                data.userAgent,
                data.requestsRemaining,
                data.errorCode,
                data.errorMessage,
            ],
        );
    },

    /**
     * Get API keys for organization
     */
    async getKeys(organizationId: string, options: GetKeysOptions = {}): Promise<ApiKeyRecord[]> {
        let query = `SELECT id, organization_id, user_id, name, description, key_prefix, key_type,
                     scopes, rate_limit_per_minute, rate_limit_per_day, allowed_ips,
                     last_used_at, usage_count, expires_at, is_active, created_at
                     FROM api_keys WHERE organization_id = ?`;
        const params = [organizationId];

        if (options.userId) {
            query += ` AND user_id = ?`;
            params.push(options.userId);
        }

        if (!options.includeRevoked) {
            query += ` AND is_active = 1`;
        }

        query += ` ORDER BY created_at DESC`;

        const keys = (await dbAll(query, params)) as Array<Record<string, unknown>>;
        return keys.map((k) => ({
            id: k.id as string,
            organization_id: k.organization_id as string,
            user_id: k.user_id as string | null,
            name: k.name as string,
            description: k.description as string,
            key_prefix: k.key_prefix as string,
            key_type: k.key_type as string,
            scopes: JSON.parse((k.scopes as string) || '[]'),
            rate_limit_per_minute: k.rate_limit_per_minute as number,
            rate_limit_per_day: k.rate_limit_per_day as number,
            allowed_ips: JSON.parse((k.allowed_ips as string) || '[]'),
            last_used_at: k.last_used_at as string,
            usage_count: k.usage_count as number,
            expires_at: k.expires_at as string,
            is_active: k.is_active as number,
            created_at: k.created_at as string,
            isActive: !!k.is_active,
        })) as ApiKeyRecord[];
    },

    /**
     * Get usage statistics for a key
     */
    async getKeyUsage(keyId: string, days: number = 30): Promise<UsageStatistics> {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

        const usage = (await dbAll(
            `SELECT 
                date(created_at) as date,
                COUNT(*) as requests,
                AVG(response_time_ms) as avg_response_time,
                SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END) as successful,
                SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as failed
             FROM api_key_usage 
             WHERE api_key_id = ? AND created_at >= ?
             GROUP BY date(created_at)
             ORDER BY date DESC`,
            [keyId, since],
        )) as Array<{ date: string; requests: number; avg_response_time: number; successful: number; failed: number }>;

        const totals = (await dbGet(
            `SELECT 
                COUNT(*) as total_requests,
                AVG(response_time_ms) as avg_response_time,
                SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as total_errors
             FROM api_key_usage 
             WHERE api_key_id = ? AND created_at >= ?`,
            [keyId, since],
        )) as { total_requests: number; avg_response_time: number; total_errors: number } | null;

        const endpoints = (await dbAll(
            `SELECT endpoint, method, COUNT(*) as count
             FROM api_key_usage 
             WHERE api_key_id = ? AND created_at >= ?
             GROUP BY endpoint, method
             ORDER BY count DESC
             LIMIT 10`,
            [keyId, since],
        )) as Array<{ endpoint: string; method: string; count: number }>;

        return { usage, totals: totals || { total_requests: 0, avg_response_time: 0, total_errors: 0 }, endpoints };
    },

    /**
     * Update API key
     */
    async updateKey(
        keyId: string,
        updates: UpdateApiKeyData,
        updatedBy: string,
    ): Promise<{ success: boolean; message?: string }> {
        const fields = [];
        const params = [];

        if (updates.name !== undefined) {
            fields.push('name = ?');
            params.push(updates.name);
        }

        if (updates.description !== undefined) {
            fields.push('description = ?');
            params.push(updates.description);
        }

        if (updates.scopes !== undefined) {
            // Validate scopes
            for (const scope of updates.scopes) {
                if (!API_SCOPES[scope]) {
                    throw new Error(`Invalid scope: ${scope}`);
                }
            }
            fields.push('scopes = ?');
            params.push(JSON.stringify(updates.scopes));
        }

        if (updates.rateLimitPerMinute !== undefined) {
            fields.push('rate_limit_per_minute = ?');
            params.push(updates.rateLimitPerMinute);
        }

        if (updates.rateLimitPerDay !== undefined) {
            fields.push('rate_limit_per_day = ?');
            params.push(updates.rateLimitPerDay);
        }

        if (updates.allowedIps !== undefined) {
            fields.push('allowed_ips = ?');
            params.push(JSON.stringify(updates.allowedIps));
        }

        if (updates.expiresAt !== undefined) {
            fields.push('expires_at = ?');
            params.push(updates.expiresAt);
        }

        if (fields.length === 0) {
            return { success: true, message: 'No changes' };
        }

        params.push(keyId);

        await dbRun(`UPDATE api_keys SET ${fields.join(', ')} WHERE id = ?`, params);

        const key = (await dbGet(`SELECT organization_id FROM api_keys WHERE id = ?`, [keyId])) as { organization_id: string } | null;
        AuditService.logSystemEvent('API_KEY_UPDATED', 'api_key', keyId, (key?.organization_id as any) || null, {
            updatedFields: Object.keys(updates),
            updatedBy,
        });

        return { success: true };
    },

    /**
     * Revoke an API key
     */
    async revokeKey(keyId: string, revokedBy: string, reason: string | null = null): Promise<{ success: boolean }> {
        const key = (await dbGet(`SELECT organization_id, name FROM api_keys WHERE id = ?`, [keyId])) as { organization_id: string; name: string } | null;
        if (!key) {
            throw new Error('Key not found');
        }

        await dbRun(
            `UPDATE api_keys SET is_active = 0, revoked_at = datetime('now'), revoked_by = ?, revoke_reason = ?
             WHERE id = ?`,
            [revokedBy, reason, keyId],
        );

        AuditService.logSystemEvent('API_KEY_REVOKED', 'api_key', keyId, (key.organization_id as any) || null, {
            name: key.name,
            revokedBy,
            reason,
        });

        return { success: true };
    },

    /**
     * Regenerate an API key (creates new key, revokes old one)
     */
    async regenerateKey(keyId: string, regeneratedBy: string): Promise<ApiKeyResult> {
        const oldKey = (await dbGet(`SELECT * FROM api_keys WHERE id = ?`, [keyId])) as {
            organization_id: string;
            user_id: string | null;
            name: string;
            description: string;
            scopes: string;
            key_type: string;
            rate_limit_per_minute: number;
            rate_limit_per_day: number;
            allowed_ips: string;
            expires_at: string | null;
        } | null;
        if (!oldKey) {
            throw new Error('Key not found');
        }

        // Revoke old key
        await this.revokeKey(keyId, regeneratedBy, 'Regenerated');

        // Create new key with same settings
        return this.createKey({
            organizationId: oldKey.organization_id,
            userId: oldKey.user_id,
            name: oldKey.name,
            description: oldKey.description,
            scopes: JSON.parse(oldKey.scopes || '[]'),
            keyType: oldKey.key_type,
            rateLimitPerMinute: oldKey.rate_limit_per_minute,
            rateLimitPerDay: oldKey.rate_limit_per_day,
            allowedIps: JSON.parse(oldKey.allowed_ips || '[]'),
            expiresAt: oldKey.expires_at,
            createdBy: regeneratedBy,
        });
    },
};

export default ApiKeyService;

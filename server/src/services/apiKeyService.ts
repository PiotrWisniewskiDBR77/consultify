/**
 * API Key Service
 * Enterprise SaaS Architecture - Security & Compliance
 *
 * Manages API keys for programmatic access with:
 * - Secure key generation and hashing
 * - Key rotation with grace periods
 * - Rate limiting per key
 * - Scoped permissions
 * - Audit logging
 *
 * Security:
 * - Keys are hashed (SHA-256) before storage
 * - Only prefix shown after creation (for identification)
 * - Automatic expiration support
 * - IP whitelist support
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import * as DbPromise from '../utils/DbPromise.ts';
import logger from '../utils/Logger.ts';

// ==========================================
// TYPES
// ==========================================

export interface ApiKey {
    id: string;
    organizationId: string;
    name: string;
    keyPrefix: string; // First 8 chars for identification
    keyHash: string;
    permissions: string[];
    ipWhitelist: string[] | null;
    rateLimit: number; // Requests per minute
    expiresAt: Date | null;
    lastUsedAt: Date | null;
    lastUsedIp: string | null;
    rotatedFromId: string | null; // Previous key ID (for rotation tracking)
    status: 'active' | 'rotated' | 'revoked' | 'expired';
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateApiKeyOptions {
    organizationId: string;
    name: string;
    permissions?: string[];
    ipWhitelist?: string[];
    rateLimit?: number;
    expiresInDays?: number;
    createdBy: string;
}

export interface RotateApiKeyOptions {
    keyId: string;
    gracePeriodHours?: number; // How long old key remains valid
    userId: string;
}

interface ApiKeyRow {
    id: string;
    organization_id: string;
    name: string;
    key_prefix: string;
    key_hash: string;
    permissions: string;
    ip_whitelist: string | null;
    rate_limit: number;
    expires_at: string | null;
    last_used_at: string | null;
    last_used_ip: string | null;
    rotated_from_id: string | null;
    status: string;
    created_by: string;
    created_at: string;
    updated_at: string;
}

// ==========================================
// CONSTANTS
// ==========================================

const KEY_PREFIX_LENGTH = 8;
const KEY_LENGTH = 32; // 256 bits
const DEFAULT_RATE_LIMIT = 100; // requests per minute
const DEFAULT_GRACE_PERIOD_HOURS = 24;

// API Key permissions
export const API_KEY_PERMISSIONS = {
    READ_PROJECTS: 'read:projects',
    WRITE_PROJECTS: 'write:projects',
    READ_TASKS: 'read:tasks',
    WRITE_TASKS: 'write:tasks',
    READ_REPORTS: 'read:reports',
    WRITE_REPORTS: 'write:reports',
    AI_EXECUTE: 'ai:execute',
    AI_READ: 'ai:read',
    WEBHOOKS: 'webhooks:manage',
    FULL_ACCESS: 'full:access',
} as const;

// ==========================================
// SERVICE
// ==========================================

class ApiKeyServiceImpl {
    private db: IDatabase | null = null;

    private getDb(): IDatabase {
        if (!this.db) {
            this.db = getDatabase();
        }
        return this.db;
    }

    /**
     * Generate a new API key
     * Returns the full key ONCE - it cannot be retrieved later
     */
    async createKey(options: CreateApiKeyOptions): Promise<{ key: ApiKey; plainTextKey: string }> {
        const db = this.getDb();
        const id = uuidv4();

        // Generate secure random key
        const plainTextKey = this.generateKey();
        const keyPrefix = plainTextKey.substring(0, KEY_PREFIX_LENGTH);
        const keyHash = this.hashKey(plainTextKey);

        const expiresAt = options.expiresInDays
            ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000)
            : null;

        const permissions = options.permissions || [API_KEY_PERMISSIONS.READ_PROJECTS];
        const ipWhitelist = options.ipWhitelist || null;
        const rateLimit = options.rateLimit || DEFAULT_RATE_LIMIT;

        await DbPromise.run(
            db,
            `INSERT INTO api_keys (
                id, organization_id, name, key_prefix, key_hash, permissions,
                ip_whitelist, rate_limit, expires_at, status, created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, datetime('now'), datetime('now'))`,
            [
                id,
                options.organizationId,
                options.name,
                keyPrefix,
                keyHash,
                JSON.stringify(permissions),
                ipWhitelist ? JSON.stringify(ipWhitelist) : null,
                rateLimit,
                expiresAt?.toISOString() || null,
                options.createdBy,
            ],
        );

        const key: ApiKey = {
            id,
            organizationId: options.organizationId,
            name: options.name,
            keyPrefix,
            keyHash,
            permissions,
            ipWhitelist,
            rateLimit,
            expiresAt,
            lastUsedAt: null,
            lastUsedIp: null,
            rotatedFromId: null,
            status: 'active',
            createdBy: options.createdBy,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        logger.info('[ApiKey] Created new API key', {
            id,
            name: options.name,
            organizationId: options.organizationId,
            createdBy: options.createdBy,
        });

        // Return full key ONCE
        return { key, plainTextKey: `ck_${plainTextKey}` }; // ck_ prefix for Consultify Key
    }

    /**
     * Rotate an API key - creates new key and schedules old key expiration
     */
    async rotateKey(options: RotateApiKeyOptions): Promise<{ newKey: ApiKey; plainTextKey: string }> {
        const db = this.getDb();
        const gracePeriodHours = options.gracePeriodHours ?? DEFAULT_GRACE_PERIOD_HOURS;

        // Get existing key
        const existingRow = await DbPromise.get<ApiKeyRow>(
            db,
            `SELECT * FROM api_keys WHERE id = ? AND status = 'active'`,
            [options.keyId],
        );

        if (!existingRow) {
            throw new Error('API key not found or not active');
        }

        // Create new key with same settings
        const { key: newKey, plainTextKey } = await this.createKey({
            organizationId: existingRow.organization_id,
            name: `${existingRow.name} (rotated)`,
            permissions: JSON.parse(existingRow.permissions),
            ipWhitelist: existingRow.ip_whitelist ? JSON.parse(existingRow.ip_whitelist) : undefined,
            rateLimit: existingRow.rate_limit,
            createdBy: options.userId,
        });

        // Update new key to reference old key
        await DbPromise.run(db, `UPDATE api_keys SET rotated_from_id = ?, name = ? WHERE id = ?`, [
            options.keyId,
            existingRow.name,
            newKey.id,
        ]);

        // Mark old key as rotated with grace period
        const graceExpiry = new Date(Date.now() + gracePeriodHours * 60 * 60 * 1000);
        await DbPromise.run(
            db,
            `UPDATE api_keys SET status = 'rotated', expires_at = ?, updated_at = datetime('now') WHERE id = ?`,
            [graceExpiry.toISOString(), options.keyId],
        );

        logger.info('[ApiKey] Rotated API key', {
            oldKeyId: options.keyId,
            newKeyId: newKey.id,
            gracePeriodHours,
            userId: options.userId,
        });

        return { newKey: { ...newKey, name: existingRow.name, rotatedFromId: options.keyId }, plainTextKey };
    }

    /**
     * Validate an API key and return its details
     */
    async validateKey(plainTextKey: string, ip?: string): Promise<ApiKey | null> {
        const db = this.getDb();

        // Remove prefix if present
        const key = plainTextKey.startsWith('ck_') ? plainTextKey.slice(3) : plainTextKey;
        const keyHash = this.hashKey(key);

        const row = await DbPromise.get<ApiKeyRow>(
            db,
            `SELECT * FROM api_keys 
             WHERE key_hash = ? 
             AND status IN ('active', 'rotated')
             AND (expires_at IS NULL OR expires_at > datetime('now'))`,
            [keyHash],
        );

        if (!row) {
            return null;
        }

        // Check IP whitelist
        if (row.ip_whitelist && ip) {
            const whitelist = JSON.parse(row.ip_whitelist) as string[];
            if (!whitelist.includes(ip) && !whitelist.includes('*')) {
                logger.warn('[ApiKey] IP not in whitelist', { keyId: row.id, ip });
                return null;
            }
        }

        // Update last used
        await DbPromise.run(db, `UPDATE api_keys SET last_used_at = datetime('now'), last_used_ip = ? WHERE id = ?`, [
            ip || null,
            row.id,
        ]);

        return this.rowToApiKey(row);
    }

    /**
     * Revoke an API key
     */
    async revokeKey(keyId: string, userId: string): Promise<void> {
        const db = this.getDb();

        await DbPromise.run(db, `UPDATE api_keys SET status = 'revoked', updated_at = datetime('now') WHERE id = ?`, [
            keyId,
        ]);

        logger.info('[ApiKey] Revoked API key', { keyId, userId });
    }

    /**
     * List API keys for an organization (without sensitive data)
     */
    async listKeys(organizationId: string): Promise<Omit<ApiKey, 'keyHash'>[]> {
        const db = this.getDb();

        const rows = await DbPromise.all<ApiKeyRow>(
            db,
            `SELECT * FROM api_keys WHERE organization_id = ? ORDER BY created_at DESC`,
            [organizationId],
        );

        return rows.map((row) => {
            const key = this.rowToApiKey(row);
            const { keyHash: _, ...keyWithoutHash } = key;
            return keyWithoutHash;
        });
    }

    /**
     * Cleanup expired keys
     */
    async cleanupExpiredKeys(): Promise<number> {
        const db = this.getDb();

        const result = await DbPromise.run(
            db,
            `UPDATE api_keys SET status = 'expired' 
             WHERE status IN ('active', 'rotated') 
             AND expires_at IS NOT NULL 
             AND expires_at < datetime('now')`,
            [],
        );

        if (result.changes && result.changes > 0) {
            logger.info('[ApiKey] Expired keys cleaned up', { count: result.changes });
        }

        return result.changes || 0;
    }

    /**
     * Check if a key has specific permission
     */
    hasPermission(key: ApiKey, permission: string): boolean {
        if (key.permissions.includes(API_KEY_PERMISSIONS.FULL_ACCESS)) {
            return true;
        }
        return key.permissions.includes(permission);
    }

    // ==========================================
    // PRIVATE METHODS
    // ==========================================

    private generateKey(): string {
        return crypto.randomBytes(KEY_LENGTH).toString('hex');
    }

    private hashKey(key: string): string {
        return crypto.createHash('sha256').update(key).digest('hex');
    }

    private rowToApiKey(row: ApiKeyRow): ApiKey {
        return {
            id: row.id,
            organizationId: row.organization_id,
            name: row.name,
            keyPrefix: row.key_prefix,
            keyHash: row.key_hash,
            permissions: JSON.parse(row.permissions),
            ipWhitelist: row.ip_whitelist ? JSON.parse(row.ip_whitelist) : null,
            rateLimit: row.rate_limit,
            expiresAt: row.expires_at ? new Date(row.expires_at) : null,
            lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : null,
            lastUsedIp: row.last_used_ip,
            rotatedFromId: row.rotated_from_id,
            status: row.status as ApiKey['status'],
            createdBy: row.created_by,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
        };
    }
}

// ==========================================
// SINGLETON EXPORT
// ==========================================

export const ApiKeyService = new ApiKeyServiceImpl();
export default ApiKeyService;

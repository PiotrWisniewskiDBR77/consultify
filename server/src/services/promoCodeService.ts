/**
 * Promo Code Service
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Migrated from server/services/promoCodeService.js (CommonJS) to TypeScript (ES Modules)
 * Enterprise-grade promotional code management for attribution and discounts.
 * Supports three code types:
 * - DISCOUNT: Applies discount to billing
 * - PARTNER: Attribution only (for partner settlements)
 * - CAMPAIGN: Marketing campaign tracking
 * 
 * Security Features:
 * - Case-insensitive code matching (stored uppercase)
 * - Validity window enforcement
 * - Atomic usage counter increment
 * - Rate limiting handled at route level
 */

import { v4 as uuidv4 } from 'uuid';
import type { IDatabase } from '../database/IDatabase.js';
import { getDatabase } from '../database/Database.js';
import * as DbPromise from '../utils/DbPromise.js';

// ==========================================
// TYPES
// ==========================================

export const PROMO_TYPES = {
    DISCOUNT: 'DISCOUNT',
    PARTNER: 'PARTNER',
    CAMPAIGN: 'CAMPAIGN'
} as const;

export type PromoType = typeof PROMO_TYPES[keyof typeof PROMO_TYPES];

export const DISCOUNT_TYPES = {
    PERCENT: 'PERCENT',
    FIXED: 'FIXED',
    NONE: 'NONE'
} as const;

export type DiscountType = typeof DISCOUNT_TYPES[keyof typeof DISCOUNT_TYPES];

interface ValidatePromoCodeResult {
    valid: boolean;
    reason?: string;
    codeId?: string;
    code?: string;
    type?: PromoType;
    discountType?: DiscountType;
    discountValue?: number | null;
    partnerCode?: string | null;
    metadata?: Record<string, unknown>;
    discountMessage?: string;
}

interface MarkPromoCodeUsedResult {
    success: boolean;
    reason?: string;
    codeId?: string;
    discountType?: DiscountType;
    discountValue?: number | null;
}

interface CreatePromoCodeParams {
    code: string;
    type: PromoType;
    discountType?: DiscountType;
    discountValue?: number | null;
    validFrom: string;
    validUntil?: string | null;
    maxUses?: number | null;
    createdByUserId: string;
    metadata?: Record<string, unknown>;
}

interface PromoCode {
    id: string;
    code: string;
    type: PromoType;
    discountType: DiscountType;
    discountValue: number | null;
    validFrom: string;
    validUntil: string | null;
    maxUses: number | null;
    usedCount: number;
    isActive: boolean;
    createdByUserId: string;
    metadata: Record<string, unknown>;
    createdAt: string;
}

interface ListPromoCodesOptions {
    includeInactive?: boolean;
    type?: PromoType | null;
    limit?: number;
    offset?: number;
}

interface PromoCodeRow {
    id: string;
    code: string;
    type: string;
    discount_type: string;
    discount_value: number | null;
    valid_from: string;
    valid_until: string | null;
    max_uses: number | null;
    used_count: number;
    is_active: number;
    created_by_user_id: string;
    metadata: string;
    created_at: string;
}

interface PromoCodeUsageRow {
    id: string;
    organization_id: string;
    organization_name?: string | null;
    user_id?: string | null;
    user_email?: string | null;
    used_at: string;
}

interface PromoCodeUsageHistory {
    id: string;
    organizationId: string;
    organizationName?: string | null;
    userId?: string | null;
    userEmail?: string | null;
    usedAt: string;
}

// ==========================================
// SERVICE
// ==========================================

let db: IDatabase = getDatabase();

/**
 * Set database instance (for testing)
 */
export function setDependencies(newDeps: { db?: IDatabase } = {}): void {
    if (newDeps.db) {
        db = newDeps.db;
    }
}

/**
 * Validate a promo code without consuming it
 */
export async function validatePromoCode(code: string): Promise<ValidatePromoCodeResult> {
    if (!code || typeof code !== 'string') {
        return { valid: false, reason: 'Invalid promo code format' };
    }

    const normalizedCode = code.trim().toUpperCase();

    try {
        const row = await DbPromise.get<PromoCodeRow>(
            db,
            `SELECT * FROM promo_codes WHERE code = ? AND is_active = 1`,
            [normalizedCode]
        );

        if (!row) {
            return { valid: false, reason: 'Promo code not found' };
        }

        const now = new Date().toISOString();

        // Check validity window
        if (row.valid_from && row.valid_from > now) {
            return { valid: false, reason: 'Promo code is not yet active' };
        }

        if (row.valid_until && row.valid_until < now) {
            return { valid: false, reason: 'Promo code has expired' };
        }

        // Check usage limit
        if (row.max_uses !== null && row.used_count >= row.max_uses) {
            return { valid: false, reason: 'Promo code usage limit reached' };
        }

        // Build response
        const response: ValidatePromoCodeResult = {
            valid: true,
            codeId: row.id,
            code: row.code,
            type: row.type as PromoType,
            discountType: row.discount_type as DiscountType,
            discountValue: row.discount_value,
            partnerCode: row.type === PROMO_TYPES.PARTNER ? row.code : null,
            metadata: JSON.parse(row.metadata || '{}')
        };

        // Add human-readable discount message
        if (row.discount_type === DISCOUNT_TYPES.PERCENT && row.discount_value) {
            response.discountMessage = `-${row.discount_value}%`;
        } else if (row.discount_type === DISCOUNT_TYPES.FIXED && row.discount_value) {
            response.discountMessage = `-$${row.discount_value}`;
        }

        return response;
    } catch (err: unknown) {
        console.error('[PromoCodeService] Validation error:', err);
        throw err;
    }
}

/**
 * Check if a promo code has been used by an organization
 */
export async function hasBeenUsedByOrg(code: string, organizationId: string): Promise<boolean> {
    const normalizedCode = code.trim().toUpperCase();

    const row = await DbPromise.get<{ id: string }>(
        db,
        `SELECT pcu.id FROM promo_code_usage pcu
         JOIN promo_codes pc ON pc.id = pcu.promo_code_id
         WHERE pc.code = ? AND pcu.organization_id = ?`,
        [normalizedCode, organizationId]
    );

    return !!row;
}

/**
 * Mark promo code as used by an organization (atomic increment)
 */
export async function markPromoCodeUsed(
    code: string,
    organizationId: string,
    userId: string | null = null
): Promise<MarkPromoCodeUsedResult> {
    const normalizedCode = code.trim().toUpperCase();

    // First validate the code
    const validation = await validatePromoCode(normalizedCode);
    if (!validation.valid) {
        return { success: false, reason: validation.reason };
    }

    // Check if already used by this org
    const alreadyUsed = await hasBeenUsedByOrg(normalizedCode, organizationId);
    if (alreadyUsed) {
        return { success: false, reason: 'Promo code already used by this organization' };
    }

    // Atomic increment of used_count
    const updateResult = await DbPromise.run(
        db,
        `UPDATE promo_codes SET used_count = used_count + 1 WHERE code = ?`,
        [normalizedCode]
    );

    if (updateResult.changes === 0) {
        return { success: false, reason: 'Promo code not found' };
    }

    // Log usage
    const usageId = uuidv4();
    await DbPromise.run(
        db,
        `INSERT INTO promo_code_usage (id, promo_code_id, organization_id, user_id) VALUES (?, ?, ?, ?)`,
        [usageId, validation.codeId!, organizationId, userId]
    );

    console.log(`[PromoCodeService] Promo code ${normalizedCode} used by org ${organizationId}`);

    return {
        success: true,
        codeId: validation.codeId,
        discountType: validation.discountType,
        discountValue: validation.discountValue
    };
}

/**
 * Create a new promo code (SuperAdmin only)
 */
export async function createPromoCode(params: CreatePromoCodeParams): Promise<PromoCode> {
    const {
        code,
        type,
        discountType = DISCOUNT_TYPES.NONE,
        discountValue = null,
        validFrom,
        validUntil = null,
        maxUses = null,
        createdByUserId,
        metadata = {}
    } = params;

    if (!code || !type || !validFrom) {
        throw new Error('Code, type, and validFrom are required');
    }

    if (!Object.values(PROMO_TYPES).includes(type)) {
        throw new Error(`Invalid promo type: ${type}`);
    }

    if (!Object.values(DISCOUNT_TYPES).includes(discountType)) {
        throw new Error(`Invalid discount type: ${discountType}`);
    }

    const normalizedCode = code.trim().toUpperCase();
    const promoId = uuidv4();

    try {
        await DbPromise.run(
            db,
            `INSERT INTO promo_codes (id, code, type, discount_type, discount_value, valid_from, valid_until, max_uses, created_by_user_id, metadata)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [promoId, normalizedCode, type, discountType, discountValue, validFrom, validUntil, maxUses, createdByUserId, JSON.stringify(metadata)]
        );

        console.log(`[PromoCodeService] Created promo code: ${normalizedCode} (${type})`);

        return {
            id: promoId,
            code: normalizedCode,
            type,
            discountType,
            discountValue,
            validFrom,
            validUntil,
            maxUses,
            usedCount: 0,
            isActive: true,
            createdByUserId,
            metadata,
            createdAt: new Date().toISOString()
        };
    } catch (err: unknown) {
        const error = err as Error;
        if (error.message.includes('UNIQUE constraint')) {
            throw new Error('Promo code already exists');
        }
        console.error('[PromoCodeService] Create error:', err);
        throw err;
    }
}

/**
 * List all promo codes (SuperAdmin only)
 */
export async function listPromoCodes(options: ListPromoCodesOptions = {}): Promise<PromoCode[]> {
    const { includeInactive = false, type = null, limit = 100, offset = 0 } = options;

    let query = `SELECT * FROM promo_codes WHERE 1=1`;
    const params: unknown[] = [];

    if (!includeInactive) {
        query += ` AND is_active = 1`;
    }

    if (type) {
        query += ` AND type = ?`;
        params.push(type);
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const rows = await DbPromise.all<PromoCodeRow>(db, query, params);

    return (rows || []).map(row => ({
        id: row.id,
        code: row.code,
        type: row.type as PromoType,
        discountType: row.discount_type as DiscountType,
        discountValue: row.discount_value,
        validFrom: row.valid_from,
        validUntil: row.valid_until,
        maxUses: row.max_uses,
        usedCount: row.used_count,
        isActive: !!row.is_active,
        createdByUserId: row.created_by_user_id,
        metadata: JSON.parse(row.metadata || '{}'),
        createdAt: row.created_at
    }));
}

/**
 * Deactivate a promo code
 */
export async function deactivatePromoCode(codeId: string): Promise<{ success: boolean }> {
    const result = await DbPromise.run(
        db,
        `UPDATE promo_codes SET is_active = 0 WHERE id = ?`,
        [codeId]
    );

    return { success: result.changes > 0 };
}

/**
 * Get promo code usage history
 */
export async function getUsageHistory(codeId: string): Promise<PromoCodeUsageHistory[]> {
    const rows = await DbPromise.all<PromoCodeUsageRow>(
        db,
        `SELECT pcu.*, o.name as organization_name, u.email as user_email
         FROM promo_code_usage pcu
         LEFT JOIN organizations o ON o.id = pcu.organization_id
         LEFT JOIN users u ON u.id = pcu.user_id
         WHERE pcu.promo_code_id = ?
         ORDER BY pcu.used_at DESC`,
        [codeId]
    );

    return (rows || []).map(row => ({
        id: row.id,
        organizationId: row.organization_id,
        organizationName: row.organization_name || null,
        userId: row.user_id || null,
        userEmail: row.user_email || null,
        usedAt: row.used_at
    }));
}

// Default export for backward compatibility
const PromoCodeService = {
    PROMO_TYPES,
    DISCOUNT_TYPES,
    setDependencies,
    validatePromoCode,
    hasBeenUsedByOrg,
    markPromoCodeUsed,
    createPromoCode,
    listPromoCodes,
    deactivatePromoCode,
    getUsageHistory
};

export default PromoCodeService;

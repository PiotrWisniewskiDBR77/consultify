/**
 * Partner Service
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Manages partner entities for the settlement system.
 * Fully migrated from server/services/partnerService.js
 * 
 * Features:
 * - Referral partners
 * - Resellers
 * - Sales partners
 * - Partner CRUD operations
 */

import { v4 as uuidv4 } from 'uuid';
import type { IDatabase } from '../database/IDatabase.js';
import { getDatabase } from '../database/Database.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export const PARTNER_TYPES = {
    REFERRAL: 'REFERRAL',
    RESELLER: 'RESELLER',
    SALES: 'SALES'
} as const;

export type PartnerType = typeof PARTNER_TYPES[keyof typeof PARTNER_TYPES];

interface Partner {
    id: string;
    name: string;
    partner_type: PartnerType;
    email?: string | null;
    contact_name?: string | null;
    default_revenue_share_percent: number;
    metadata?: string; // JSON string
    is_active: number; // 0 or 1
    created_at: string;
    updated_at: string;
}

interface PartnerCreateParams {
    name: string;
    partnerType: PartnerType;
    email?: string | null;
    contactName?: string | null;
    defaultRevenueSharePercent?: number;
    metadata?: Record<string, unknown>;
}

interface PartnerUpdateParams {
    name?: string;
    email?: string | null;
    contactName?: string | null;
    defaultRevenueSharePercent?: number;
    metadata?: Record<string, unknown>;
    isActive?: boolean;
}

interface PartnerFilters {
    partnerType?: PartnerType;
    isActive?: boolean;
    limit?: number;
    offset?: number;
}

interface PartnerServiceDependencies {
    db?: IDatabase;
}

// ==========================================
// PARTNER SERVICE CLASS
// ==========================================

class PartnerServiceClass {
    private db: IDatabase;

    constructor(deps?: PartnerServiceDependencies) {
        this.db = deps?.db || getDatabase();
    }

    /**
     * Database helper: Get all rows
     */
    private async dbAll<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
        return new Promise((resolve, reject) => {
            this.db.all<T>(sql, params, (err: Error | null, rows: unknown) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    /**
     * Database helper: Get single row
     */
    private async dbGet<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
        return new Promise((resolve, reject) => {
            this.db.get<T>(sql, params, (err: Error | null, row: unknown) => {
                if (err) reject(err);
                else resolve(row || null);
            });
        });
    }

    /**
     * Database helper: Run query
     */
    private async dbRun(sql: string, params: unknown[] = []): Promise<{ lastID?: number; changes: number }> {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (this: { lastID?: number; changes: number }, err: Error | null) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID, changes: this.changes || 0 });
            });
        });
    }

    /**
     * Parse partner row from database
     */
    private parsePartnerRow(row: Partner): Partner & { metadata?: Record<string, unknown>; isActive: boolean } {
        return {
            ...row,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
            isActive: !!row.is_active
        };
    }

    /**
     * Create a new partner
     */
    async createPartner(params: PartnerCreateParams): Promise<Partner & { metadata?: Record<string, unknown>; isActive: boolean; createdAt: string }> {
        const {
            name,
            partnerType,
            email = null,
            contactName = null,
            defaultRevenueSharePercent = 10,
            metadata = {}
        } = params;

        if (!name || !partnerType) {
            throw { errorCode: 'MISSING_REQUIRED', message: 'name and partnerType are required' };
        }

        if (!Object.values(PARTNER_TYPES).includes(partnerType)) {
            throw { errorCode: 'INVALID_PARTNER_TYPE', message: `Invalid partnerType: ${partnerType}` };
        }

        const id = uuidv4();

        await this.dbRun(
            `INSERT INTO partners 
             (id, name, partner_type, email, contact_name, default_revenue_share_percent, metadata)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, name, partnerType, email, contactName, defaultRevenueSharePercent, JSON.stringify(metadata)]
        );

        logger.info(`[PartnerService] Created partner: ${name} (${partnerType})`);

        const createdPartner: Partner & { metadata?: Record<string, unknown>; isActive: boolean; createdAt: string } = {
            id,
            name,
            partner_type: partnerType,
            email,
            contact_name: contactName,
            default_revenue_share_percent: defaultRevenueSharePercent,
            metadata: JSON.stringify(metadata),
            is_active: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            isActive: true,
            createdAt: new Date().toISOString()
        };
        return { ...createdPartner, metadata };
    }

    /**
     * Get partner by ID
     */
    async getPartner(id: string): Promise<(Partner & { metadata?: Record<string, unknown>; isActive: boolean }) | null> {
        const row = await this.dbGet<Partner>(
            `SELECT * FROM partners WHERE id = ?`,
            [id]
        );

        if (!row) return null;

        return this.parsePartnerRow(row);
    }

    /**
     * Get all partners with filters
     */
    async getPartners(filters: PartnerFilters = {}): Promise<Array<Partner & { metadata?: Record<string, unknown>; isActive: boolean }>> {
        let query = 'SELECT * FROM partners WHERE 1=1';
        const params: unknown[] = [];

        if (filters.partnerType) {
            query += ' AND partner_type = ?';
            params.push(filters.partnerType);
        }

        if (filters.isActive !== undefined) {
            query += ' AND is_active = ?';
            params.push(filters.isActive ? 1 : 0);
        }

        query += ' ORDER BY name ASC';

        if (filters.limit) {
            query += ' LIMIT ?';
            params.push(filters.limit);
        }

        if (filters.offset) {
            query += ' OFFSET ?';
            params.push(filters.offset);
        }

        const rows = await this.dbAll<Partner>(query, params);
        return rows.map(row => this.parsePartnerRow(row));
    }

    /**
     * Update partner
     */
    async updatePartner(id: string, updates: PartnerUpdateParams): Promise<Partner & { metadata?: Record<string, unknown>; isActive: boolean } | null> {
        const fields: string[] = [];
        const values: unknown[] = [];

        if (updates.name !== undefined) {
            fields.push('name = ?');
            values.push(updates.name);
        }
        if (updates.email !== undefined) {
            fields.push('email = ?');
            values.push(updates.email);
        }
        if (updates.contactName !== undefined) {
            fields.push('contact_name = ?');
            values.push(updates.contactName);
        }
        if (updates.defaultRevenueSharePercent !== undefined) {
            fields.push('default_revenue_share_percent = ?');
            values.push(updates.defaultRevenueSharePercent);
        }
        if (updates.metadata !== undefined) {
            fields.push('metadata = ?');
            values.push(JSON.stringify(updates.metadata));
        }
        if (updates.isActive !== undefined) {
            fields.push('is_active = ?');
            values.push(updates.isActive ? 1 : 0);
        }

        if (fields.length === 0) {
            return this.getPartner(id);
        }

        fields.push('updated_at = datetime("now")');
        values.push(id);

        await this.dbRun(
            `UPDATE partners SET ${fields.join(', ')} WHERE id = ?`,
            values
        );

        return this.getPartner(id);
    }

    /**
     * Delete partner (soft delete)
     */
    async deletePartner(id: string): Promise<boolean> {
        const result = await this.updatePartner(id, { isActive: false });
        return result !== null;
    }

    /**
     * List all partners (alias for getPartners)
     */
    async listPartners(filters: PartnerFilters = {}): Promise<Array<Partner & { metadata?: Record<string, unknown>; isActive: boolean; createdAt?: string }>> {
        const partners = await this.getPartners(filters);
        return partners.map(p => ({
            ...p,
            createdAt: p.created_at
        }));
    }

    /**
     * Create a partner agreement
     */
    async createAgreement(params: {
        partnerId: string;
        validFrom: string;
        validUntil?: string | null;
        revenueSharePercent: number;
        appliesTo?: string;
        appliesValue?: string | null;
    }): Promise<{
        id: string;
        partnerId: string;
        validFrom: string;
        validUntil: string | null;
        revenueSharePercent: number;
        appliesTo: string;
        appliesValue: string | null;
        createdAt: string;
    }> {
        const {
            partnerId,
            validFrom,
            validUntil = null,
            revenueSharePercent,
            appliesTo = 'GLOBAL',
            appliesValue = null
        } = params;

        if (!partnerId || !validFrom || revenueSharePercent === undefined) {
            throw { errorCode: 'MISSING_REQUIRED', message: 'partnerId, validFrom, and revenueSharePercent are required' };
        }

        const id = uuidv4();

        await this.dbRun(
            `INSERT INTO partner_agreements 
             (id, partner_id, valid_from, valid_until, revenue_share_percent, applies_to, applies_value)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, partnerId, validFrom, validUntil, revenueSharePercent, appliesTo, appliesValue]
        );

        logger.info(`[PartnerService] Created agreement for partner ${partnerId}: ${revenueSharePercent}%`);

        return {
            id,
            partnerId,
            validFrom,
            validUntil,
            revenueSharePercent,
            appliesTo,
            appliesValue,
            createdAt: new Date().toISOString()
        };
    }

    /**
     * Get the active agreement for a partner at a specific date
     */
    async getActiveAgreement(partnerId: string, atDate: string | null = null): Promise<{
        id: string;
        partnerId: string;
        validFrom: string;
        validUntil: string | null;
        revenueSharePercent: number;
        appliesTo: string;
        appliesValue: string | null;
        createdAt: string;
    } | null> {
        const checkDate = atDate || new Date().toISOString();

        const row = await this.dbGet<{
            id: string;
            partner_id: string;
            valid_from: string;
            valid_until: string | null;
            revenue_share_percent: number;
            applies_to: string;
            applies_value: string | null;
            created_at: string;
        }>(
            `SELECT * FROM partner_agreements 
             WHERE partner_id = ?
               AND valid_from <= ?
               AND (valid_until IS NULL OR valid_until >= ?)
             ORDER BY valid_from DESC
             LIMIT 1`,
            [partnerId, checkDate, checkDate]
        );

        if (!row) return null;

        return {
            id: row.id,
            partnerId: row.partner_id,
            validFrom: row.valid_from,
            validUntil: row.valid_until,
            revenueSharePercent: row.revenue_share_percent,
            appliesTo: row.applies_to,
            appliesValue: row.applies_value,
            createdAt: row.created_at
        };
    }

    /**
     * Get all agreements for a partner
     */
    async getAgreements(partnerId: string): Promise<Array<{
        id: string;
        partnerId: string;
        validFrom: string;
        validUntil: string | null;
        revenueSharePercent: number;
        appliesTo: string;
        appliesValue: string | null;
        createdAt: string;
    }>> {
        const rows = await this.dbAll<{
            id: string;
            partner_id: string;
            valid_from: string;
            valid_until: string | null;
            revenue_share_percent: number;
            applies_to: string;
            applies_value: string | null;
            created_at: string;
        }>(
            `SELECT * FROM partner_agreements WHERE partner_id = ? ORDER BY valid_from DESC`,
            [partnerId]
        );

        return rows.map(row => ({
            id: row.id,
            partnerId: row.partner_id,
            validFrom: row.valid_from,
            validUntil: row.valid_until,
            revenueSharePercent: row.revenue_share_percent,
            appliesTo: row.applies_to,
            appliesValue: row.applies_value,
            createdAt: row.created_at
        }));
    }

    /**
     * Get partner by their partner code (for attribution lookups)
     */
    async getByPartnerCode(partnerCode: string): Promise<(Partner & { metadata?: Record<string, unknown>; isActive: boolean }) | null> {
        const row = await this.dbGet<Partner>(
            `SELECT p.* FROM partners p
             JOIN promo_codes pc ON pc.partner_id = p.id
             WHERE pc.code = ?
             LIMIT 1`,
            [partnerCode.toUpperCase()]
        );

        if (!row) return null;

        return this.parsePartnerRow(row);
    }
}

// ==========================================
// EXPORTS
// ==========================================

// Export singleton instance (for backward compatibility)
const partnerService = new PartnerServiceClass();

// Export class for testing
export { PartnerServiceClass };

// Export default instance
export default partnerService;

// Export individual methods for backward compatibility
export const createPartner = (params: PartnerCreateParams) => partnerService.createPartner(params);
export const getPartner = (id: string) => partnerService.getPartner(id);
export const getPartners = (filters?: PartnerFilters) => partnerService.getPartners(filters);
export const listPartners = (filters?: PartnerFilters) => partnerService.listPartners(filters);
export const updatePartner = (id: string, updates: PartnerUpdateParams) => partnerService.updatePartner(id, updates);
export const deletePartner = (id: string) => partnerService.deletePartner(id);
export const createAgreement = (params: { partnerId: string; validFrom: string; validUntil?: string | null; revenueSharePercent: number; appliesTo?: string; appliesValue?: string | null }) => partnerService.createAgreement(params);
export const getActiveAgreement = (partnerId: string, atDate?: string | null) => partnerService.getActiveAgreement(partnerId, atDate);
export const getAgreements = (partnerId: string) => partnerService.getAgreements(partnerId);
export const getByPartnerCode = (partnerCode: string) => partnerService.getByPartnerCode(partnerCode);

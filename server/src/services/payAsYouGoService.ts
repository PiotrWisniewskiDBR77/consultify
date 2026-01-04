/**
 * Pay-as-You-Go Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Handles PAYG usage tracking, cost calculation, and invoice generation
 * Fully migrated to Class-based Async DI pattern
 */

import type { IDatabase } from '../database/IDatabase.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export type UsageType = 'tokens' | 'storage' | 'seats' | 'api_calls';

export interface RecordUsageParams {
    orgId: string;
    usageType: UsageType;
    quantity: number;
    unitPrice: number;
    metadata?: Record<string, unknown>;
    userId?: string | null;
    projectId?: string | null;
}

export interface RecordUsageResult {
    id: string;
    totalCost: number;
}

export interface CurrentPeriodUsageSummary {
    periodStart: string;
    periodEnd: string;
    totalCost: number;
    byType: Record<
        string,
        {
            quantity: number;
            avgUnitPrice: number;
            totalCost: number;
            usageCount: number;
        }
    >;
}

export interface GenerateInvoiceResult {
    invoiced: boolean;
    reason?: string;
    periodStart?: string;
    periodEnd?: string;
    totalCost?: number;
    usageByType?: Record<string, unknown>;
}

export interface CalculateUsageCostResult {
    cost: number;
    unitPrice?: number;
    reason?: string;
}

export interface PayAsYouGoForecast {
    currentCost: number;
    projectedCost: number;
    daysElapsed: number;
    daysInMonth: number;
    usageByType: Record<string, unknown>;
}

interface UsageTypeRow {
    usage_type: string;
    total_quantity: number;
    avg_unit_price: number;
    total_cost: number;
    usage_count: number;
}

interface BillingModelRow {
    billing_model?: string;
    seat_price_monthly?: number;
    plan_seat_price?: number;
}

interface MarginRow {
    base_cost_per_1k?: number;
    margin_percent?: number;
}

export interface PayAsYouGoServiceDependencies {
    db: IDatabase;
    uuidv4: () => string;
}

// ==========================================
// SERVICE IMPLEMENTATION
// ==========================================

class PayAsYouGoServiceClass {
    #deps: PayAsYouGoServiceDependencies | null = null;
    #initialized = false;
    #initPromise: Promise<void> | null = null;

    constructor() {
        // Dependencies initialized lazily
    }

    async #initDeps(): Promise<void> {
        if (this.#initialized) return;
        if (this.#initPromise) return this.#initPromise;

        this.#initPromise = (async () => {
            try {
                const { getDatabase } = await import('../database/Database.js');
                const { v4: uuidv4 } = await import('uuid');

                const db = getDatabase();

                this.#deps = {
                    db,
                    uuidv4,
                };

                this.#initialized = true;
            } catch (error: unknown) {
                logger.error('Failed to initialize PayAsYouGoService dependencies:', error);
                throw error;
            } finally {
                this.#initPromise = null;
            }
        })();

        return this.#initPromise;
    }

    async #getDeps(): Promise<PayAsYouGoServiceDependencies> {
        await this.#initDeps();
        if (!this.#deps) throw new Error('PayAsYouGoService dependencies not initialized');
        return this.#deps;
    }

    async setDependencies(newDeps: Partial<PayAsYouGoServiceDependencies>): Promise<void> {
        await this.#initDeps();
        if (this.#deps) {
            this.#deps = { ...this.#deps, ...newDeps };
        }
    }

    /**
     * Record usage for PAYG billing
     */
    async recordUsage(params: RecordUsageParams): Promise<RecordUsageResult> {
        const deps = await this.#getDeps();
        const { orgId, usageType, quantity, unitPrice, metadata = {}, userId = null, projectId = null } = params;

        if (!['tokens', 'storage', 'seats', 'api_calls'].includes(usageType)) {
            throw new Error(`Invalid usage type: ${usageType}`);
        }

        const now = new Date();
        const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        const totalCost = quantity * unitPrice;
        const id = `payg-${deps.uuidv4()}`;

        await DbPromise.run(
            deps.db,
            `INSERT INTO pay_as_you_go_usage(
                id, organization_id, user_id, project_id, usage_type, quantity,
                unit_price, total_cost, billing_period_start, billing_period_end, metadata
            ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                orgId,
                userId,
                projectId,
                usageType,
                quantity,
                unitPrice,
                totalCost,
                periodStart.toISOString(),
                periodEnd.toISOString(),
                JSON.stringify(metadata),
            ],
        );

        return { id, totalCost };
    }

    /**
     * Get current period usage
     */
    async getCurrentPeriodUsage(
        orgId: string,
        periodStart: Date | null = null,
        periodEnd: Date | null = null,
    ): Promise<CurrentPeriodUsageSummary> {
        const deps = await this.#getDeps();
        const now = new Date();
        const start = periodStart || new Date(now.getFullYear(), now.getMonth(), 1);
        const end = periodEnd || new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        const rows = await DbPromise.all<UsageTypeRow>(
            deps.db,
            `SELECT 
                usage_type,
                SUM(quantity) as total_quantity,
                AVG(unit_price) as avg_unit_price,
                SUM(total_cost) as total_cost,
                COUNT(*) as usage_count
             FROM pay_as_you_go_usage
             WHERE organization_id = ?
               AND billing_period_start >= ?
               AND billing_period_end <= ?
               AND invoiced = 0
             GROUP BY usage_type`,
            [orgId, start.toISOString(), end.toISOString()],
        );

        const summary: CurrentPeriodUsageSummary = {
            periodStart: start.toISOString(),
            periodEnd: end.toISOString(),
            totalCost: 0,
            byType: {},
        };

        rows.forEach((row) => {
            summary.byType[row.usage_type] = {
                quantity: row.total_quantity,
                avgUnitPrice: row.avg_unit_price,
                totalCost: row.total_cost,
                usageCount: row.usage_count,
            };
            summary.totalCost += row.total_cost || 0;
        });

        return summary;
    }

    /**
     * Generate PAYG invoice (mark usage as invoiced)
     */
    async generatePayAsYouGoInvoice(orgId: string, periodStart: Date, periodEnd: Date): Promise<GenerateInvoiceResult> {
        const deps = await this.#getDeps();
        const usage = await this.getCurrentPeriodUsage(orgId, periodStart, periodEnd);

        if (usage.totalCost === 0) {
            return { invoiced: false, reason: 'No usage to invoice' };
        }

        // Mark all usage records as invoiced
        await DbPromise.run(
            deps.db,
            `UPDATE pay_as_you_go_usage
             SET invoiced = 1
             WHERE organization_id = ?
               AND billing_period_start >= ?
               AND billing_period_end <= ?
               AND invoiced = 0`,
            [orgId, periodStart.toISOString(), periodEnd.toISOString()],
        );

        return {
            invoiced: true,
            periodStart: periodStart.toISOString(),
            periodEnd: periodEnd.toISOString(),
            totalCost: usage.totalCost,
            usageByType: usage.byType,
        };
    }

    /**
     * Calculate usage cost
     */
    async calculateUsageCost(orgId: string, usageType: UsageType, quantity: number): Promise<CalculateUsageCostResult> {
        const deps = await this.#getDeps();
        // Get billing model and pricing from organization
        const row = await DbPromise.get<BillingModelRow>(
            deps.db,
            `SELECT os.billing_model, os.seat_price_monthly, sp.seat_price_monthly as plan_seat_price
             FROM organization_seats os
             LEFT JOIN organization_billing ob ON os.organization_id = ob.organization_id
             LEFT JOIN subscription_plans sp ON ob.subscription_plan_id = sp.id
             WHERE os.organization_id = ?`,
            [orgId],
        );

        const billingModel = row?.billing_model || 'subscription';
        if (billingModel === 'subscription') {
            return { cost: 0, reason: 'Subscription model - no PAYG cost' };
        }

        // Get unit price based on usage type
        let unitPrice = 0;
        switch (usageType) {
            case 'tokens':
                // Get token pricing from billing_margins
                const marginRow = await DbPromise.get<MarginRow>(
                    deps.db,
                    `SELECT base_cost_per_1k, margin_percent FROM billing_margins WHERE source_type = 'platform' AND is_active = 1`,
                    [],
                );
                const baseCost = marginRow?.base_cost_per_1k || 0.03;
                const margin = marginRow?.margin_percent || 30;
                unitPrice = (baseCost * (1 + margin / 100)) / 1000; // per token
                return { cost: quantity * unitPrice, unitPrice };
            case 'storage':
                // Storage pricing (per GB/month)
                unitPrice = 0.1; // $0.10 per GB/month
                return { cost: quantity * unitPrice, unitPrice };
            case 'seats':
                unitPrice = row?.seat_price_monthly || row?.plan_seat_price || 0;
                return { cost: quantity * unitPrice, unitPrice };
            case 'api_calls':
                unitPrice = 0.001; // $0.001 per API call
                return { cost: quantity * unitPrice, unitPrice };
            default:
                throw new Error(`Unknown usage type: ${usageType}`);
        }
    }

    /**
     * Check PAYG limits before usage
     */
    async checkPayAsYouGoLimits(
        _orgId: string,
        _usageType: UsageType,
        _quantity: number,
    ): Promise<{ allowed: boolean }> {
        // For now, PAYG has no hard limits (can be extended with budget checks)
        return { allowed: true };
    }

    /**
     * Get PAYG forecast (projected costs for current period)
     */
    async getPayAsYouGoForecast(orgId: string): Promise<PayAsYouGoForecast> {
        const now = new Date();
        const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        const daysElapsed = now.getDate();
        const daysInMonth = periodEnd.getDate();

        const usage = await this.getCurrentPeriodUsage(orgId, periodStart, periodEnd);
        const projectedCost = usage.totalCost * (daysInMonth / daysElapsed);

        return {
            currentCost: usage.totalCost,
            projectedCost,
            daysElapsed,
            daysInMonth,
            usageByType: usage.byType,
        };
    }
}

// Create singleton instance
const payAsYouGoServiceInstance = new PayAsYouGoServiceClass();

// Export individual functions for backward compatibility
export const setDependencies = (newDeps: Partial<PayAsYouGoServiceDependencies>) =>
    payAsYouGoServiceInstance.setDependencies(newDeps);
export const recordUsage = (params: RecordUsageParams) => payAsYouGoServiceInstance.recordUsage(params);
export const getCurrentPeriodUsage = (orgId: string, periodStart: Date | null = null, periodEnd: Date | null = null) =>
    payAsYouGoServiceInstance.getCurrentPeriodUsage(orgId, periodStart, periodEnd);
export const generatePayAsYouGoInvoice = (orgId: string, periodStart: Date, periodEnd: Date) =>
    payAsYouGoServiceInstance.generatePayAsYouGoInvoice(orgId, periodStart, periodEnd);
export const calculateUsageCost = (orgId: string, usageType: UsageType, quantity: number) =>
    payAsYouGoServiceInstance.calculateUsageCost(orgId, usageType, quantity);
export const checkPayAsYouGoLimits = (orgId: string, usageType: UsageType, quantity: number) =>
    payAsYouGoServiceInstance.checkPayAsYouGoLimits(orgId, usageType, quantity);
export const getPayAsYouGoForecast = (orgId: string) => payAsYouGoServiceInstance.getPayAsYouGoForecast(orgId);

// Default export for backward compatibility
const PayAsYouGoService = {
    setDependencies,
    recordUsage,
    getCurrentPeriodUsage,
    generatePayAsYouGoInvoice,
    calculateUsageCost,
    checkPayAsYouGoLimits,
    getPayAsYouGoForecast,
};

export default PayAsYouGoService;

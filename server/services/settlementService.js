/**
 * Settlement Service
 * 
 * Core settlement engine for partner revenue sharing.
 * 
 * Key operations:
 * - Create settlement periods
 * - Calculate partner settlements from attribution data
 * - Lock periods (immutable after lock)
 * - Generate partner reports
 * 
 * CRITICAL: Settlement data is IMMUTABLE after period is LOCKED.
 * Corrections require new adjustment entries in a future period.
 * 
 * @module settlementService
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const AttributionService = require('./attributionService');
const PartnerService = require('./partnerService');
const MetricsCollector = require('./metricsCollector');

const PERIOD_STATUS = {
    OPEN: 'OPEN',
    CALCULATED: 'CALCULATED',
    LOCKED: 'LOCKED'
};

const ENTRY_TYPES = {
    NORMAL: 'NORMAL',
    ADJUSTMENT: 'ADJUSTMENT'
};

const SettlementService = {
    PERIOD_STATUS,
    ENTRY_TYPES,

    /**
     * Create a new settlement period
     * @param {Object} params - Period parameters
     * @param {string} params.periodStart - Period start date (ISO string)
     * @param {string} params.periodEnd - Period end date (ISO string)
     * @returns {Promise<Object>} Created period
     */
    async createPeriod(params) {
        const { periodStart, periodEnd } = params;

        if (!periodStart || !periodEnd) {
            throw { errorCode: 'MISSING_REQUIRED', message: 'periodStart and periodEnd are required' };
        }

        if (periodEnd <= periodStart) {
            throw { errorCode: 'INVALID_DATE_RANGE', message: 'periodEnd must be after periodStart' };
        }

        // Check for overlapping periods
        const overlap = await this.checkOverlappingPeriod(periodStart, periodEnd);
        if (overlap) {
            throw {
                errorCode: 'PERIOD_OVERLAP',
                message: `Period overlaps with existing period: ${overlap.id}`
            };
        }

        // Check only one OPEN period at a time
        const openPeriod = await this.getOpenPeriod();
        if (openPeriod) {
            throw {
                errorCode: 'OPEN_PERIOD_EXISTS',
                message: `An open period already exists: ${openPeriod.id}. Calculate or lock it first.`
            };
        }

        const id = uuidv4();

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO settlement_periods 
                 (id, period_start, period_end, status)
                 VALUES (?, ?, ?, ?)`,
                [id, periodStart, periodEnd, PERIOD_STATUS.OPEN],
                function (err) {
                    if (err) {
                        console.error('[SettlementService] Create period error:', err);
                        return reject(err);
                    }

                    console.log(`[SettlementService] Created period: ${periodStart} to ${periodEnd}`);
                    resolve({
                        id,
                        periodStart,
                        periodEnd,
                        status: PERIOD_STATUS.OPEN,
                        totalRevenue: 0,
                        totalSettlements: 0,
                        partnerCount: 0,
                        createdAt: new Date().toISOString()
                    });
                }
            );
        });
    },

    /**
     * Check for overlapping periods
     * @param {string} start - Start date
     * @param {string} end - End date
     * @returns {Promise<Object|null>}
     */
    async checkOverlappingPeriod(start, end) {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM settlement_periods 
                 WHERE (period_start <= ? AND period_end >= ?)
                    OR (period_start <= ? AND period_end >= ?)
                    OR (period_start >= ? AND period_end <= ?)`,
                [end, start, start, start, start, end],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row || null);
                }
            );
        });
    },

    /**
     * Get the current open period
     * @returns {Promise<Object|null>}
     */
    async getOpenPeriod() {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM settlement_periods WHERE status = ? LIMIT 1`,
                [PERIOD_STATUS.OPEN],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return resolve(null);

                    resolve({
                        id: row.id,
                        periodStart: row.period_start,
                        periodEnd: row.period_end,
                        status: row.status,
                        totalRevenue: row.total_revenue,
                        totalSettlements: row.total_settlements,
                        partnerCount: row.partner_count,
                        createdAt: row.created_at
                    });
                }
            );
        });
    },

    /**
     * Get period by ID
     * @param {string} periodId - Period ID
     * @returns {Promise<Object|null>}
     */
    async getPeriod(periodId) {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT sp.*, u1.email as calculated_by_email, u2.email as locked_by_email
                 FROM settlement_periods sp
                 LEFT JOIN users u1 ON sp.calculated_by = u1.id
                 LEFT JOIN users u2 ON sp.locked_by = u2.id
                 WHERE sp.id = ?`,
                [periodId],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return resolve(null);

                    resolve({
                        id: row.id,
                        periodStart: row.period_start,
                        periodEnd: row.period_end,
                        status: row.status,
                        calculatedAt: row.calculated_at,
                        calculatedBy: row.calculated_by,
                        calculatedByEmail: row.calculated_by_email,
                        lockedAt: row.locked_at,
                        lockedBy: row.locked_by,
                        lockedByEmail: row.locked_by_email,
                        totalRevenue: row.total_revenue,
                        totalSettlements: row.total_settlements,
                        partnerCount: row.partner_count,
                        createdAt: row.created_at
                    });
                }
            );
        });
    },

    /**
     * List settlement periods
     * @param {Object} options - Query options
     * @returns {Promise<Array>}
     */
    async listPeriods(options = {}) {
        const { status, limit = 50, offset = 0 } = options;

        let sql = `SELECT * FROM settlement_periods WHERE 1=1`;
        const params = [];

        if (status) {
            sql += ` AND status = ?`;
            params.push(status);
        }

        sql += ` ORDER BY period_start DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) return reject(err);

                resolve((rows || []).map(row => ({
                    id: row.id,
                    periodStart: row.period_start,
                    periodEnd: row.period_end,
                    status: row.status,
                    totalRevenue: row.total_revenue,
                    totalSettlements: row.total_settlements,
                    partnerCount: row.partner_count,
                    calculatedAt: row.calculated_at,
                    lockedAt: row.locked_at,
                    createdAt: row.created_at
                })));
            });
        });
    },

    /**
     * Calculate settlements for a period (CORE LOGIC)
     * 
     * Rules:
     * 1. Only OPEN periods can be calculated
     * 2. Finds all attribution events with partner_code in the period
     * 3. For each attribution, finds the valid agreement at that time
     * 4. Calculates settlement_amount = revenue_amount × revenue_share_percent / 100
     * 5. Inserts immutable settlement rows
     * 6. Updates period status to CALCULATED
     * 
     * @param {string} periodId - Period ID
     * @param {string} calculatedByUserId - User performing calculation
     * @returns {Promise<Object>} Calculation result
     */
    async calculateSettlements(periodId, calculatedByUserId) {
        const period = await this.getPeriod(periodId);

        if (!period) {
            throw { errorCode: 'NOT_FOUND', message: 'Settlement period not found' };
        }

        if (period.status === PERIOD_STATUS.LOCKED) {
            throw {
                errorCode: 'PERIOD_LOCKED',
                message: 'Cannot recalculate a locked period. Locked periods are immutable.'
            };
        }

        // If recalculating, clear existing settlements first
        if (period.status === PERIOD_STATUS.CALCULATED) {
            await this.clearPeriodSettlements(periodId);
        }

        // Get attribution events with partner codes in this period
        const attributions = await AttributionService.exportAttribution({
            startDate: period.periodStart,
            endDate: period.periodEnd,
            partnerCode: undefined // Get all with partners
        });

        // Filter to only those with partner codes
        const partnerAttributions = attributions.filter(a => a.partnerCode);

        console.log(`[SettlementService] Found ${partnerAttributions.length} partner attributions in period`);

        let totalRevenue = 0;
        let totalSettlements = 0;
        const partnerIds = new Set();
        const settlements = [];

        for (const attribution of partnerAttributions) {
            // Find partner by code
            const partner = await PartnerService.getByPartnerCode(attribution.partnerCode);

            if (!partner) {
                console.warn(`[SettlementService] No partner found for code: ${attribution.partnerCode}`);
                continue;
            }

            if (!partner.isActive) {
                console.warn(`[SettlementService] Partner ${partner.id} is inactive, skipping`);
                continue;
            }

            // Get active agreement at attribution time
            const agreement = await PartnerService.getActiveAgreement(partner.id, attribution.attributedAt);

            // Use agreement rate or partner default
            const revenueSharePercent = agreement
                ? agreement.revenueSharePercent
                : partner.defaultRevenueSharePercent;

            // Get revenue amount from attribution or organization billing
            // For now, we use the revenue_amount from attribution (if populated)
            // In production, this would fetch from payments/subscriptions
            const revenueAmount = await this.getRevenueForAttribution(attribution);

            if (revenueAmount <= 0) {
                continue; // No revenue to share
            }

            const settlementAmount = revenueAmount * (revenueSharePercent / 100);

            const settlement = {
                id: uuidv4(),
                settlementPeriodId: periodId,
                partnerId: partner.id,
                organizationId: attribution.organizationId,
                sourceAttributionId: attribution.eventId,
                revenueAmount,
                revenueSharePercent,
                settlementAmount,
                currency: 'USD',
                agreementId: agreement?.id || null,
                metadata: {
                    calculationTimestamp: new Date().toISOString(),
                    rateSource: agreement ? 'agreement' : 'default',
                    partnerCode: attribution.partnerCode,
                    attributedAt: attribution.attributedAt
                }
            };

            settlements.push(settlement);
            totalRevenue += revenueAmount;
            totalSettlements += settlementAmount;
            partnerIds.add(partner.id);
        }

        // Insert all settlements
        for (const settlement of settlements) {
            await this.insertSettlement(settlement);
        }

        // Update period status and totals
        await this.updatePeriodStatus(periodId, {
            status: PERIOD_STATUS.CALCULATED,
            calculatedAt: new Date().toISOString(),
            calculatedBy: calculatedByUserId,
            totalRevenue,
            totalSettlements,
            partnerCount: partnerIds.size
        });

        console.log(`[SettlementService] Calculated ${settlements.length} settlements for period ${periodId}`);

        // Step 7: Record metrics event for conversion intelligence
        try {
            await MetricsCollector.recordEvent(MetricsCollector.EVENT_TYPES.SETTLEMENT_GENERATED, {
                userId: calculatedByUserId,
                source: MetricsCollector.SOURCE_TYPES.PARTNER,
                context: {
                    periodId,
                    periodStart: period.periodStart,
                    periodEnd: period.periodEnd,
                    settlementCount: settlements.length,
                    partnerCount: partnerIds.size,
                    totalRevenue,
                    totalSettlements
                }
            });
        } catch (metricsErr) {
            console.warn('[SettlementService] Metrics recording failed:', metricsErr);
        }

        return {
            periodId,
            status: PERIOD_STATUS.CALCULATED,
            settlementCount: settlements.length,
            partnerCount: partnerIds.size,
            totalRevenue,
            totalSettlements,
            calculatedAt: new Date().toISOString()
        };
    },

    /**
     * Get revenue amount for an attribution event
     * In production, this would query billing/payments data
     * @param {Object} attribution - Attribution event
     * @returns {Promise<number>}
     */
    async getRevenueForAttribution(attribution) {
        // Check if revenue_amount is already in attribution metadata
        if (attribution.metadata?.revenueAmount) {
            return attribution.metadata.revenueAmount;
        }

        // Query organization's paid status and get first payment
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT ob.*, sp.price_monthly
                 FROM organization_billing ob
                 JOIN subscription_plans sp ON ob.subscription_plan_id = sp.id
                 WHERE ob.organization_id = ? AND ob.status = 'active'`,
                [attribution.organizationId],
                (err, row) => {
                    if (err) return reject(err);
                    // Return monthly subscription value if found
                    resolve(row?.price_monthly || 0);
                }
            );
        });
    },

    /**
     * Insert a settlement row (immutable)
     * @param {Object} settlement - Settlement data
     * @returns {Promise<void>}
     */
    async insertSettlement(settlement) {
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO partner_settlements 
                 (id, settlement_period_id, partner_id, organization_id, source_attribution_id,
                  revenue_amount, revenue_share_percent, settlement_amount, currency, agreement_id,
                  entry_type, adjusts_settlement_id, adjustment_reason, metadata)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    settlement.id,
                    settlement.settlementPeriodId,
                    settlement.partnerId,
                    settlement.organizationId,
                    settlement.sourceAttributionId,
                    settlement.revenueAmount,
                    settlement.revenueSharePercent,
                    settlement.settlementAmount,
                    settlement.currency,
                    settlement.agreementId,
                    settlement.entryType || ENTRY_TYPES.NORMAL,
                    settlement.adjustsSettlementId || null,
                    settlement.adjustmentReason || null,
                    JSON.stringify(settlement.metadata)
                ],
                (err) => {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });
    },

    /**
     * Create an adjustment entry (for corrections without modifying history)
     * 
     * CRITICAL: Adjustments must be in a NEW period, not the original period.
     * The original settlement remains immutable.
     * 
     * @param {Object} params - Adjustment parameters
     * @param {string} params.originalSettlementId - ID of settlement being corrected
     * @param {string} params.periodId - Period ID for the adjustment (must be OPEN or CALCULATED)
     * @param {number} params.adjustmentAmount - Positive or negative adjustment
     * @param {string} params.reason - Required reason for adjustment
     * @param {string} params.createdByUserId - User creating the adjustment
     * @returns {Promise<Object>} Created adjustment entry
     */
    async createAdjustment(params) {
        const { originalSettlementId, periodId, adjustmentAmount, reason, createdByUserId } = params;

        if (!originalSettlementId || !periodId || adjustmentAmount === undefined || !reason) {
            throw {
                errorCode: 'MISSING_REQUIRED',
                statusCode: 400,
                message: 'originalSettlementId, periodId, adjustmentAmount, and reason are required'
            };
        }

        // Get original settlement
        const original = await new Promise((resolve, reject) => {
            db.get(
                `SELECT ps.*, sp.period_start as original_period_start
                 FROM partner_settlements ps
                 JOIN settlement_periods sp ON ps.settlement_period_id = sp.id
                 WHERE ps.id = ?`,
                [originalSettlementId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });

        if (!original) {
            throw { errorCode: 'NOT_FOUND', statusCode: 404, message: 'Original settlement not found' };
        }

        // Verify target period is not LOCKED
        const period = await this.getPeriod(periodId);
        if (!period) {
            throw { errorCode: 'NOT_FOUND', statusCode: 404, message: 'Target period not found' };
        }

        if (period.status === PERIOD_STATUS.LOCKED) {
            throw {
                errorCode: 'PERIOD_LOCKED',
                statusCode: 409,
                message: 'Cannot create adjustment in a locked period'
            };
        }

        // Cannot adjust in same period as original
        if (original.settlement_period_id === periodId) {
            throw {
                errorCode: 'SAME_PERIOD',
                statusCode: 400,
                message: 'Adjustments must be in a different period than the original settlement'
            };
        }

        const adjustment = {
            id: uuidv4(),
            settlementPeriodId: periodId,
            partnerId: original.partner_id,
            organizationId: original.organization_id,
            sourceAttributionId: original.source_attribution_id,
            revenueAmount: adjustmentAmount > 0 ? adjustmentAmount : 0,
            revenueSharePercent: original.revenue_share_percent,
            settlementAmount: adjustmentAmount,
            currency: original.currency,
            agreementId: original.agreement_id,
            entryType: ENTRY_TYPES.ADJUSTMENT,
            adjustsSettlementId: originalSettlementId,
            adjustmentReason: reason,
            metadata: {
                createdAt: new Date().toISOString(),
                createdBy: createdByUserId,
                originalPeriodStart: original.original_period_start,
                originalSettlementAmount: original.settlement_amount
            }
        };

        await this.insertSettlement(adjustment);

        console.log(`[SettlementService] Created adjustment ${adjustment.id} for settlement ${originalSettlementId}`);

        return adjustment;
    },

    /**
     * Clear settlements for a period (only for recalculation of OPEN/CALCULATED periods)
     * @param {string} periodId - Period ID
     * @returns {Promise<void>}
     */
    async clearPeriodSettlements(periodId) {
        const period = await this.getPeriod(periodId);

        if (period.status === PERIOD_STATUS.LOCKED) {
            throw { errorCode: 'PERIOD_LOCKED', message: 'Cannot clear settlements from locked period' };
        }

        return new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM partner_settlements WHERE settlement_period_id = ?`,
                [periodId],
                (err) => {
                    if (err) return reject(err);
                    console.log(`[SettlementService] Cleared settlements for period ${periodId}`);
                    resolve();
                }
            );
        });
    },

    /**
     * Update period status and totals
     * @param {string} periodId - Period ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<void>}
     */
    async updatePeriodStatus(periodId, updates) {
        const fields = [];
        const params = [];

        if (updates.status) {
            fields.push('status = ?');
            params.push(updates.status);
        }
        if (updates.calculatedAt) {
            fields.push('calculated_at = ?');
            params.push(updates.calculatedAt);
        }
        if (updates.calculatedBy) {
            fields.push('calculated_by = ?');
            params.push(updates.calculatedBy);
        }
        if (updates.lockedAt) {
            fields.push('locked_at = ?');
            params.push(updates.lockedAt);
        }
        if (updates.lockedBy) {
            fields.push('locked_by = ?');
            params.push(updates.lockedBy);
        }
        if (updates.totalRevenue !== undefined) {
            fields.push('total_revenue = ?');
            params.push(updates.totalRevenue);
        }
        if (updates.totalSettlements !== undefined) {
            fields.push('total_settlements = ?');
            params.push(updates.totalSettlements);
        }
        if (updates.partnerCount !== undefined) {
            fields.push('partner_count = ?');
            params.push(updates.partnerCount);
        }

        params.push(periodId);

        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE settlement_periods SET ${fields.join(', ')} WHERE id = ?`,
                params,
                (err) => {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });
    },

    /**
     * Lock a settlement period (makes it immutable)
     * 
     * Rules:
     * 1. Only CALCULATED periods can be locked
     * 2. After locking, no recalculation or modification is allowed
     * 
     * @param {string} periodId - Period ID
     * @param {string} lockedByUserId - User locking the period
     * @returns {Promise<Object>}
     */
    async lockPeriod(periodId, lockedByUserId) {
        const period = await this.getPeriod(periodId);

        if (!period) {
            throw { errorCode: 'NOT_FOUND', message: 'Settlement period not found' };
        }

        if (period.status === PERIOD_STATUS.OPEN) {
            throw {
                errorCode: 'NOT_CALCULATED',
                message: 'Period must be calculated before locking. Run calculateSettlements first.'
            };
        }

        if (period.status === PERIOD_STATUS.LOCKED) {
            // Idempotent - already locked
            return {
                periodId,
                status: PERIOD_STATUS.LOCKED,
                alreadyLocked: true,
                lockedAt: period.lockedAt,
                lockedBy: period.lockedBy
            };
        }

        const lockedAt = new Date().toISOString();

        await this.updatePeriodStatus(periodId, {
            status: PERIOD_STATUS.LOCKED,
            lockedAt,
            lockedBy: lockedByUserId
        });

        console.log(`[SettlementService] Locked period ${periodId} by user ${lockedByUserId}`);

        return {
            periodId,
            status: PERIOD_STATUS.LOCKED,
            alreadyLocked: false,
            lockedAt,
            lockedBy: lockedByUserId
        };
    },

    /**
     * Get settlements for a period
     * @param {string} periodId - Period ID
     * @returns {Promise<Array>}
     */
    async getPeriodSettlements(periodId) {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT ps.*, p.name as partner_name, o.name as organization_name
                 FROM partner_settlements ps
                 JOIN partners p ON ps.partner_id = p.id
                 JOIN organizations o ON ps.organization_id = o.id
                 WHERE ps.settlement_period_id = ?
                 ORDER BY p.name, ps.created_at`,
                [periodId],
                (err, rows) => {
                    if (err) return reject(err);

                    resolve((rows || []).map(row => ({
                        id: row.id,
                        settlementPeriodId: row.settlement_period_id,
                        partnerId: row.partner_id,
                        partnerName: row.partner_name,
                        organizationId: row.organization_id,
                        organizationName: row.organization_name,
                        sourceAttributionId: row.source_attribution_id,
                        revenueAmount: row.revenue_amount,
                        revenueSharePercent: row.revenue_share_percent,
                        settlementAmount: row.settlement_amount,
                        currency: row.currency,
                        agreementId: row.agreement_id,
                        metadata: JSON.parse(row.metadata || '{}'),
                        createdAt: row.created_at
                    })));
                }
            );
        });
    },

    /**
     * Get partner report for a specific period
     * @param {string} partnerId - Partner ID
     * @param {string} periodId - Period ID
     * @returns {Promise<Object>}
     */
    async getPartnerReport(partnerId, periodId) {
        const period = await this.getPeriod(periodId);
        if (!period) {
            throw { errorCode: 'NOT_FOUND', message: 'Settlement period not found' };
        }

        const partner = await PartnerService.getPartner(partnerId);
        if (!partner) {
            throw { errorCode: 'NOT_FOUND', message: 'Partner not found' };
        }

        const settlements = await new Promise((resolve, reject) => {
            db.all(
                `SELECT ps.*, o.name as organization_name
                 FROM partner_settlements ps
                 JOIN organizations o ON ps.organization_id = o.id
                 WHERE ps.settlement_period_id = ? AND ps.partner_id = ?
                 ORDER BY ps.created_at`,
                [periodId, partnerId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });

        const totalRevenue = settlements.reduce((sum, s) => sum + s.revenue_amount, 0);
        const totalSettlement = settlements.reduce((sum, s) => sum + s.settlement_amount, 0);

        return {
            partner: {
                id: partner.id,
                name: partner.name,
                partnerType: partner.partnerType
            },
            period: {
                id: period.id,
                periodStart: period.periodStart,
                periodEnd: period.periodEnd,
                status: period.status
            },
            summary: {
                organizationCount: new Set(settlements.map(s => s.organization_id)).size,
                settlementCount: settlements.length,
                totalRevenue,
                totalSettlement,
                currency: 'USD'
            },
            settlements: settlements.map(row => ({
                id: row.id,
                organizationId: row.organization_id,
                organizationName: row.organization_name,
                revenueAmount: row.revenue_amount,
                revenueSharePercent: row.revenue_share_percent,
                settlementAmount: row.settlement_amount,
                metadata: JSON.parse(row.metadata || '{}'),
                createdAt: row.created_at
            }))
        };
    },

    /**
     * Get all settlements for a partner across all periods
     * @param {string} partnerId - Partner ID
     * @returns {Promise<Array>}
     */
    async getPartnerSettlements(partnerId) {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT ps.*, sp.period_start, sp.period_end, sp.status as period_status, o.name as organization_name
                 FROM partner_settlements ps
                 JOIN settlement_periods sp ON ps.settlement_period_id = sp.id
                 JOIN organizations o ON ps.organization_id = o.id
                 WHERE ps.partner_id = ?
                 ORDER BY sp.period_start DESC, ps.created_at`,
                [partnerId],
                (err, rows) => {
                    if (err) return reject(err);

                    resolve((rows || []).map(row => ({
                        id: row.id,
                        periodId: row.settlement_period_id,
                        periodStart: row.period_start,
                        periodEnd: row.period_end,
                        periodStatus: row.period_status,
                        organizationId: row.organization_id,
                        organizationName: row.organization_name,
                        revenueAmount: row.revenue_amount,
                        revenueSharePercent: row.revenue_share_percent,
                        settlementAmount: row.settlement_amount,
                        currency: row.currency,
                        createdAt: row.created_at
                    })));
                }
            );
        });
    },

    /**
     * Export settlements for a period
     * @param {string} periodId - Period ID
     * @param {string} format - 'json' or 'csv'
     * @returns {Promise<Object>}
     */
    async exportSettlements(periodId, format = 'json') {
        const period = await this.getPeriod(periodId);
        if (!period) {
            throw { errorCode: 'NOT_FOUND', message: 'Settlement period not found' };
        }

        const settlements = await this.getPeriodSettlements(periodId);

        if (format === 'csv') {
            // CFO-ready columns
            const headers = [
                'period_start', 'period_end',
                'partner_name', 'partner_id',
                'organization_id',
                'source_attribution_id',
                'revenue_amount', 'currency',
                'revenue_share_percent',
                'settlement_amount',
                'agreement_id',
                'entry_type',
                'created_at'
            ];

            const escapeCSV = (val) => {
                if (val === null || val === undefined) return '';
                const str = String(val);
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            };

            const rows = settlements.map(s => [
                escapeCSV(period.periodStart),
                escapeCSV(period.periodEnd),
                escapeCSV(s.partnerName),
                escapeCSV(s.partnerId),
                escapeCSV(s.organizationId),
                escapeCSV(s.sourceAttributionId),
                s.revenueAmount,
                escapeCSV(s.currency),
                s.revenueSharePercent,
                s.settlementAmount,
                escapeCSV(s.agreementId),
                escapeCSV(s.metadata?.entryType || 'NORMAL'),
                escapeCSV(s.createdAt)
            ]);

            const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

            return {
                format: 'csv',
                filename: `settlements_${period.periodStart}_to_${period.periodEnd}.csv`,
                content: csvContent
            };
        }

        return {
            format: 'json',
            period,
            settlements,
            exportedAt: new Date().toISOString()
        };
    }
};

module.exports = SettlementService;

/**
 * Settlement Routes
 * 
 * API endpoints for settlement period management.
 * SuperAdmin only - settlement calculation and period locking.
 * 
 * HTTP Status Codes:
 * - 409: Period conflicts (OVERLAP, LOCKED, INVALID_STATUS)
 * - 400: Validation errors
 * - 404: Not found
 */

const express = require('express');
const router = express.Router();
const SettlementService = require('../services/settlementService');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// All routes require SUPERADMIN
router.use(authMiddleware);
router.use(requireRole(['SUPERADMIN']));

/**
 * Create a new settlement period
 * POST /api/settlements/periods
 */
router.post('/periods', async (req, res) => {
    try {
        const { periodStart, periodEnd } = req.body;

        const period = await SettlementService.createPeriod({
            periodStart,
            periodEnd
        });

        res.status(201).json({
            success: true,
            period
        });
    } catch (error) {
        console.error('[Settlements] Create period error:', error);

        // 409 for conflicts
        const statusCode = ['PERIOD_OVERLAP', 'OPEN_PERIOD_EXISTS'].includes(error.errorCode) ? 409 :
            ['MISSING_REQUIRED', 'INVALID_DATE_RANGE'].includes(error.errorCode) ? 400 : 500;

        res.status(statusCode).json({
            error: true,
            message: error.message || 'Failed to create settlement period',
            errorCode: error.errorCode
        });
    }
});

/**
 * List settlement periods
 * GET /api/settlements/periods
 */
router.get('/periods', async (req, res) => {
    try {
        const { status, limit, offset } = req.query;

        const periods = await SettlementService.listPeriods({
            status,
            limit: limit ? parseInt(limit) : undefined,
            offset: offset ? parseInt(offset) : undefined
        });

        res.json({
            success: true,
            periods,
            count: periods.length
        });
    } catch (error) {
        console.error('[Settlements] List periods error:', error);
        res.status(500).json({
            error: true,
            message: error.message || 'Failed to list settlement periods'
        });
    }
});

/**
 * Get settlement period by ID
 * GET /api/settlements/periods/:id
 */
router.get('/periods/:id', async (req, res) => {
    try {
        const period = await SettlementService.getPeriod(req.params.id);

        if (!period) {
            return res.status(404).json({
                error: true,
                message: 'Settlement period not found'
            });
        }

        res.json({
            success: true,
            period
        });
    } catch (error) {
        console.error('[Settlements] Get period error:', error);
        res.status(500).json({
            error: true,
            message: error.message || 'Failed to get settlement period'
        });
    }
});

/**
 * Calculate settlements for a period
 * POST /api/settlements/periods/:id/calculate
 * 
 * Returns 409 if period is LOCKED
 */
router.post('/periods/:id/calculate', async (req, res) => {
    try {
        const result = await SettlementService.calculateSettlements(
            req.params.id,
            req.user.id
        );

        res.json({
            success: true,
            result
        });
    } catch (error) {
        console.error('[Settlements] Calculate error:', error);

        // 409 for PERIOD_LOCKED
        const statusCode = ['PERIOD_LOCKED'].includes(error.errorCode) ? 409 :
            ['NOT_FOUND'].includes(error.errorCode) ? 404 : 500;

        res.status(statusCode).json({
            error: true,
            message: error.message || 'Failed to calculate settlements',
            errorCode: error.errorCode
        });
    }
});

/**
 * Lock a settlement period (makes it immutable)
 * POST /api/settlements/periods/:id/lock
 * 
 * Returns 409 if period is not CALCULATED
 */
router.post('/periods/:id/lock', async (req, res) => {
    try {
        const result = await SettlementService.lockPeriod(
            req.params.id,
            req.user.id
        );

        res.json({
            success: true,
            result
        });
    } catch (error) {
        console.error('[Settlements] Lock error:', error);

        // 409 for invalid status
        const statusCode = ['NOT_CALCULATED'].includes(error.errorCode) ? 409 :
            ['NOT_FOUND'].includes(error.errorCode) ? 404 : 500;

        res.status(statusCode).json({
            error: true,
            message: error.message || 'Failed to lock settlement period',
            errorCode: error.errorCode
        });
    }
});

/**
 * Get settlements for a period
 * GET /api/settlements/periods/:id/settlements
 */
router.get('/periods/:id/settlements', async (req, res) => {
    try {
        const settlements = await SettlementService.getPeriodSettlements(req.params.id);

        res.json({
            success: true,
            settlements,
            count: settlements.length
        });
    } catch (error) {
        console.error('[Settlements] Get settlements error:', error);
        res.status(500).json({
            error: true,
            message: error.message || 'Failed to get settlements'
        });
    }
});

/**
 * Export settlements for a period (CFO-ready format)
 * GET /api/settlements/periods/:id/export?format=csv|json
 */
router.get('/periods/:id/export', async (req, res) => {
    try {
        const { format = 'json' } = req.query;
        const result = await SettlementService.exportSettlements(req.params.id, format);

        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
            return res.send(result.content);
        }

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('[Settlements] Export error:', error);
        res.status(error.errorCode === 'NOT_FOUND' ? 404 : 500).json({
            error: true,
            message: error.message || 'Failed to export settlements',
            errorCode: error.errorCode
        });
    }
});

/**
 * Create an adjustment entry for corrections
 * POST /api/settlements/adjustments
 * 
 * Body: {
 *   originalSettlementId: string,
 *   periodId: string (must be OPEN or CALCULATED, different from original),
 *   adjustmentAmount: number (positive or negative),
 *   reason: string (required)
 * }
 */
router.post('/adjustments', async (req, res) => {
    try {
        const { originalSettlementId, periodId, adjustmentAmount, reason } = req.body;

        const adjustment = await SettlementService.createAdjustment({
            originalSettlementId,
            periodId,
            adjustmentAmount,
            reason,
            createdByUserId: req.user.id
        });

        res.status(201).json({
            success: true,
            adjustment
        });
    } catch (error) {
        console.error('[Settlements] Create adjustment error:', error);

        const statusCode = error.statusCode ||
            (['PERIOD_LOCKED', 'SAME_PERIOD'].includes(error.errorCode) ? 409 :
                ['MISSING_REQUIRED'].includes(error.errorCode) ? 400 :
                    ['NOT_FOUND'].includes(error.errorCode) ? 404 : 500);

        res.status(statusCode).json({
            error: true,
            message: error.message || 'Failed to create adjustment',
            errorCode: error.errorCode
        });
    }
});

module.exports = router;


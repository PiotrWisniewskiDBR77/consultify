/**
 * Partner Routes
 * 
 * API endpoints for partner management and settlement reports.
 * 
 * Admin routes:
 * - CRUD for partners
 * - Agreement management
 * 
 * Partner routes (read-only):
 * - View own settlements
 */

const express = require('express');
const router = express.Router();
const PartnerService = require('../services/partnerService');
const SettlementService = require('../services/settlementService');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// ==========================================
// ADMIN ROUTES (SUPERADMIN OR ADMIN)
// ==========================================

/**
 * Create a new partner
 * POST /api/partners
 */
router.post('/', authMiddleware, requireRole(['SUPERADMIN', 'ADMIN']), async (req, res) => {
    try {
        const { name, partnerType, email, contactName, defaultRevenueSharePercent, metadata } = req.body;

        const partner = await PartnerService.createPartner({
            name,
            partnerType,
            email,
            contactName,
            defaultRevenueSharePercent,
            metadata
        });

        res.status(201).json({
            success: true,
            partner
        });
    } catch (error) {
        console.error('[Partners] Create error:', error);
        res.status(error.errorCode === 'MISSING_REQUIRED' ? 400 : 500).json({
            error: true,
            message: error.message || 'Failed to create partner',
            errorCode: error.errorCode
        });
    }
});

/**
 * List all partners
 * GET /api/partners
 */
router.get('/', authMiddleware, requireRole(['SUPERADMIN', 'ADMIN']), async (req, res) => {
    try {
        const { partnerType, isActive, limit, offset } = req.query;

        const partners = await PartnerService.listPartners({
            partnerType,
            isActive: isActive !== undefined ? isActive === 'true' : undefined,
            limit: limit ? parseInt(limit) : undefined,
            offset: offset ? parseInt(offset) : undefined
        });

        res.json({
            success: true,
            partners,
            count: partners.length
        });
    } catch (error) {
        console.error('[Partners] List error:', error);
        res.status(500).json({
            error: true,
            message: error.message || 'Failed to list partners'
        });
    }
});

/**
 * Get partner by ID
 * GET /api/partners/:id
 */
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const partner = await PartnerService.getPartner(req.params.id);

        if (!partner) {
            return res.status(404).json({
                error: true,
                message: 'Partner not found'
            });
        }

        res.json({
            success: true,
            partner
        });
    } catch (error) {
        console.error('[Partners] Get error:', error);
        res.status(500).json({
            error: true,
            message: error.message || 'Failed to get partner'
        });
    }
});

/**
 * Update partner
 * PUT /api/partners/:id
 */
router.put('/:id', authMiddleware, requireRole(['SUPERADMIN', 'ADMIN']), async (req, res) => {
    try {
        const partner = await PartnerService.updatePartner(req.params.id, req.body);

        res.json({
            success: true,
            partner
        });
    } catch (error) {
        console.error('[Partners] Update error:', error);
        res.status(error.errorCode === 'NOT_FOUND' ? 404 : 500).json({
            error: true,
            message: error.message || 'Failed to update partner',
            errorCode: error.errorCode
        });
    }
});

/**
 * Create partner agreement
 * POST /api/partners/:id/agreements
 */
router.post('/:id/agreements', authMiddleware, requireRole(['SUPERADMIN', 'ADMIN']), async (req, res) => {
    try {
        const { validFrom, validUntil, revenueSharePercent, appliesTo, appliesValue } = req.body;

        const agreement = await PartnerService.createAgreement({
            partnerId: req.params.id,
            validFrom,
            validUntil,
            revenueSharePercent,
            appliesTo,
            appliesValue
        });

        res.status(201).json({
            success: true,
            agreement
        });
    } catch (error) {
        console.error('[Partners] Create agreement error:', error);
        res.status(error.errorCode === 'MISSING_REQUIRED' ? 400 : 500).json({
            error: true,
            message: error.message || 'Failed to create agreement',
            errorCode: error.errorCode
        });
    }
});

/**
 * Get partner agreements
 * GET /api/partners/:id/agreements
 */
router.get('/:id/agreements', authMiddleware, async (req, res) => {
    try {
        const agreements = await PartnerService.getAgreements(req.params.id);

        res.json({
            success: true,
            agreements
        });
    } catch (error) {
        console.error('[Partners] Get agreements error:', error);
        res.status(500).json({
            error: true,
            message: error.message || 'Failed to get agreements'
        });
    }
});

// ==========================================
// PARTNER SETTLEMENT ROUTES (READ-ONLY)
// ==========================================

/**
 * Get all settlements for a partner
 * GET /api/partners/:id/settlements
 */
router.get('/:id/settlements', authMiddleware, async (req, res) => {
    try {
        // TODO: Add permission check - partner can only see own settlements
        const settlements = await SettlementService.getPartnerSettlements(req.params.id);

        res.json({
            success: true,
            settlements,
            count: settlements.length
        });
    } catch (error) {
        console.error('[Partners] Get settlements error:', error);
        res.status(500).json({
            error: true,
            message: error.message || 'Failed to get settlements'
        });
    }
});

/**
 * Get partner report for a specific period
 * GET /api/partners/:id/settlements/:periodId
 */
router.get('/:id/settlements/:periodId', authMiddleware, async (req, res) => {
    try {
        // TODO: Add permission check - partner can only see own settlements
        const report = await SettlementService.getPartnerReport(req.params.id, req.params.periodId);

        res.json({
            success: true,
            report
        });
    } catch (error) {
        console.error('[Partners] Get partner report error:', error);
        res.status(error.errorCode === 'NOT_FOUND' ? 404 : 500).json({
            error: true,
            message: error.message || 'Failed to get partner report',
            errorCode: error.errorCode
        });
    }
});

module.exports = router;

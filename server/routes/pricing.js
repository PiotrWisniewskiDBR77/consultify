/**
 * Pricing Routes
 * API endpoints for subscription pricing from legal-metadata.json
 */

import express from 'express';
const router = express.Router();
import * as pricingServiceModule from '../services/pricingService.js';
const pricingService = pricingServiceModule.default || pricingServiceModule;
import authMiddleware from '../middleware/authMiddleware.js';

/**
 * GET /api/pricing/plans
 * Get all subscription plans (public endpoint)
 */
router.get('/plans', async (req, res) => {
    try {
        const plans = pricingService.getFormattedPlans();
        const currency = pricingService.getCurrency();
        
        res.json({ 
            success: true,
            currency,
            plans 
        });
    } catch (error) {
        console.error('[Pricing] Get plans error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to load pricing plans' 
        });
    }
});

/**
 * GET /api/pricing/plans/:planId
 * Get specific plan details
 */
router.get('/plans/:planId', async (req, res) => {
    try {
        const plan = pricingService.getPlanById(req.params.planId);
        
        if (!plan) {
            return res.status(404).json({ 
                success: false,
                error: 'Plan not found' 
            });
        }
        
        res.json({ 
            success: true,
            plan: pricingService.formatPlanForApi(plan)
        });
    } catch (error) {
        console.error('[Pricing] Get plan error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to load plan details' 
        });
    }
});

/**
 * GET /api/pricing/trial
 * Get trial configuration
 */
router.get('/trial', async (req, res) => {
    try {
        const trial = pricingService.getTrialConfig();
        
        res.json({ 
            success: true,
            trial: {
                durationDays: trial.durationDays,
                planLevel: trial.planLevel,
                aiCredits: trial.aiCredits,
                seats: trial.seats,
                creditCardRequired: trial.creditCardRequired,
                autoConvert: trial.autoConvert
            }
        });
    } catch (error) {
        console.error('[Pricing] Get trial config error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to load trial configuration' 
        });
    }
});

/**
 * GET /api/pricing/page
 * Get full pricing page data (for frontend pricing display)
 */
router.get('/page', async (req, res) => {
    try {
        const pageData = pricingService.getPricingPageData();
        res.json({ 
            success: true,
            ...pageData 
        });
    } catch (error) {
        console.error('[Pricing] Get page data error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to load pricing page data' 
        });
    }
});

/**
 * GET /api/pricing/company
 * Get company information for legal displays
 */
router.get('/company', async (req, res) => {
    try {
        const company = pricingService.getCompanyInfo();
        const contacts = pricingService.getContactEmails();
        
        res.json({ 
            success: true,
            company,
            contacts
        });
    } catch (error) {
        console.error('[Pricing] Get company info error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to load company information' 
        });
    }
});

/**
 * POST /api/pricing/sync
 * Sync pricing to database (admin only)
 * Requires superadmin role
 */
router.post('/sync', authMiddleware, async (req, res) => {
    try {
        // Check if user is superadmin
        if (!req.user?.is_superadmin) {
            return res.status(403).json({ 
                success: false,
                error: 'Superadmin access required' 
            });
        }
        
        const results = await pricingService.syncPricingToDatabase();
        
        res.json({ 
            success: true,
            message: 'Pricing synced to database',
            results 
        });
    } catch (error) {
        console.error('[Pricing] Sync error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to sync pricing to database' 
        });
    }
});

/**
 * GET /api/pricing/metadata
 * Get full legal metadata (admin only, for debugging)
 */
router.get('/metadata', authMiddleware, async (req, res) => {
    try {
        // Check if user is superadmin
        if (!req.user?.is_superadmin) {
            return res.status(403).json({ 
                success: false,
                error: 'Superadmin access required' 
            });
        }
        
        const metadata = pricingService.getFullMetadata();
        
        res.json({ 
            success: true,
            metadata 
        });
    } catch (error) {
        console.error('[Pricing] Get metadata error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to load metadata' 
        });
    }
});

export default router;












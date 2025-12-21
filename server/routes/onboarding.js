/**
 * Onboarding Routes (HARDENED)
 * 
 * Phase E: Guided First Value endpoints with:
 * - Org context middleware (strictWrite)
 * - RBAC guards (requireOrgAccess)
 * - Audit logging
 * - Rate limiting (per-org)
 */

const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/authenticate');
const orgContextMiddleware = require('../middleware/orgContextMiddleware');
const { requireOrgAccess } = require('../middleware/rbac');
const OnboardingService = require('../services/onboardingService');
const auditService = require('../services/auditService');
const { getAsync } = require('../db/sqliteAsync');
const db = require('../database');

// Apply auth + org context to all routes
router.use(authenticate);
router.use(orgContextMiddleware({ strictWrite: true, required: true }));

// ============================================
// RATE LIMITING HELPER (per-org, for /generate-plan)
// ============================================

const GENERATE_RATE_LIMIT = 5; // max per hour for TRIAL
const GENERATE_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

async function checkGenerateRateLimit(orgId, orgType) {
    if (orgType !== 'TRIAL') return true; // No limit for paid orgs

    const result = await getAsync(db,
        `SELECT COUNT(*) as cnt FROM audit_events 
         WHERE org_id = ? 
           AND action_type = 'ONBOARDING_PLAN_GENERATED' 
           AND ts > datetime('now', '-1 hour')`,
        [orgId]
    );

    return (result?.cnt || 0) < GENERATE_RATE_LIMIT;
}

// ============================================
// ROUTES
// ============================================

/**
 * GET /status - Get onboarding status (read-only, all roles)
 */
router.get('/status',
    requireOrgAccess({ roles: ['OWNER', 'ADMIN', 'MEMBER'], consultantPermissions: ['can_view'] }),
    async (req, res) => {
        try {
            const result = await OnboardingService.getStatus(req.org.id);
            res.json(result);
        } catch (err) {
            console.error('Get Status Error:', err);
            res.status(err.statusCode || 500).json({ error: err.message });
        }
    }
);

/**
 * GET /plan - Get current plan snapshot (without regenerating)
 */
router.get('/plan',
    requireOrgAccess({ roles: ['OWNER', 'ADMIN', 'MEMBER'], consultantPermissions: ['can_view'] }),
    async (req, res) => {
        try {
            const result = await OnboardingService.getPlanSnapshot(req.org.id);
            res.json(result);
        } catch (err) {
            console.error('Get Plan Error:', err);
            res.status(err.statusCode || 500).json({ error: err.message });
        }
    }
);

/**
 * POST /context - Save transformation context
 * Requires OWNER/ADMIN/MEMBER. Consultants with can_comment allowed.
 */
router.post('/context',
    requireOrgAccess({ roles: ['OWNER', 'ADMIN', 'MEMBER'], consultantPermissions: ['can_comment'] }),
    async (req, res) => {
        try {
            const result = await OnboardingService.saveContext(req.org.id, req.body);

            await auditService.logFromRequest(req, 'ONBOARDING_CONTEXT_SAVED', 'ORGANIZATION', req.org.id, {
                fieldsProvided: Object.keys(req.body || {})
            });

            res.json(result);
        } catch (err) {
            console.error('Save Context Error:', err);
            res.status(err.statusCode || 500).json({ error: err.message });
        }
    }
);

/**
 * POST /generate-plan - Generate AI plan (rate-limited for TRIAL)
 * Requires OWNER/ADMIN/MEMBER. Consultants can view but this is a write operation.
 */
router.post('/generate-plan',
    requireOrgAccess({ roles: ['OWNER', 'ADMIN', 'MEMBER'], consultantPermissions: ['can_view'] }),
    async (req, res) => {
        try {
            // Rate limit check for TRIAL orgs
            const allowed = await checkGenerateRateLimit(req.org.id, req.org.organization_type);
            if (!allowed) {
                return res.status(429).json({
                    error: 'Rate limit exceeded. Max 5 plan generations per hour for Trial accounts.',
                    code: 'RATE_LIMIT_EXCEEDED'
                });
            }

            const result = await OnboardingService.generatePlan(req.org.id, req.user.id);

            await auditService.logFromRequest(req, 'ONBOARDING_PLAN_GENERATED', 'ORGANIZATION', req.org.id, {
                planVersion: result.planVersion,
                stepsCount: result.plan?.steps?.length || 0,
                initiativesCount: result.plan?.suggested_initiatives?.length || 0
            });

            res.json(result);
        } catch (err) {
            console.error('Generate Plan Error:', err);
            res.status(err.statusCode || 500).json({ error: err.message });
        }
    }
);

/**
 * POST /accept-plan - Accept plan and create initiatives
 * WRITE operation. Requires OWNER/ADMIN. Consultants blocked unless full scope.
 */
router.post('/accept-plan',
    requireOrgAccess({ roles: ['OWNER', 'ADMIN'], consultantPermissions: ['can_create_initiatives'] }),
    async (req, res) => {
        try {
            const { acceptedInitiativeIds, idempotencyKey } = req.body || {};

            const result = await OnboardingService.acceptPlan(req.org.id, req.user.id, {
                acceptedInitiativeIds,
                idempotencyKey
            });

            // Only log if not idempotent re-request
            if (!result.idempotent) {
                await auditService.logFromRequest(req, 'ONBOARDING_PLAN_ACCEPTED', 'ORGANIZATION', req.org.id, {
                    createdCount: result.createdCount,
                    idempotencyKey
                });
            }

            res.json(result);
        } catch (err) {
            console.error('Accept Plan Error:', err);
            res.status(err.statusCode || 500).json({ error: err.message });
        }
    }
);

module.exports = router;

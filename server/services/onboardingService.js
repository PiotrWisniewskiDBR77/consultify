/**
 * Onboarding Service (HARDENED)
 * 
 * Handles Phase E: Guided First Value flow with:
 * - Context validation and size limits
 * - Plan snapshot persistence and versioning
 * - Idempotent accept with transaction safety
 * - Integration with audit logging
 */

const db = require('../database');
const AiService = require('./aiService');
const { v4: uuidv4 } = require('uuid');
const { runAsync, getAsync, withTransaction } = require('../db/sqliteAsync');

// ============================================
// VALIDATION
// ============================================

const MAX_CONTEXT_SIZE_BYTES = 8 * 1024; // 8KB

/**
 * Validate transformation context.
 * @throws Error with statusCode 400 on validation failure.
 */
function validateContext(input) {
    const ctx = input || {};

    // Required fields
    const role = String(ctx.role || '').trim().slice(0, 64);
    const problems = String(ctx.problems || '').trim().slice(0, 500);

    if (!role) {
        const err = new Error('Missing required field: role');
        err.statusCode = 400;
        throw err;
    }
    if (!problems) {
        const err = new Error('Missing required field: problems');
        err.statusCode = 400;
        throw err;
    }

    // Optional fields
    const normalized = {
        role,
        problems,
        industry: String(ctx.industry || '').trim().slice(0, 64),
        urgency: String(ctx.urgency || 'Normal').trim().slice(0, 32),
        targets: String(ctx.targets || '').trim().slice(0, 256)
    };

    // Size check
    const size = Buffer.byteLength(JSON.stringify(normalized), 'utf8');
    if (size > MAX_CONTEXT_SIZE_BYTES) {
        const err = new Error('Context too large (max 8KB)');
        err.statusCode = 400;
        throw err;
    }

    return normalized;
}

// ============================================
// SERVICE
// ============================================

const OnboardingService = {

    /**
     * Save or Update Onboarding Context (with validation).
     */
    saveContext: async (organizationId, rawContext) => {
        const ctx = validateContext(rawContext);

        await runAsync(db,
            `UPDATE organizations 
             SET transformation_context = ?, onboarding_status = 'IN_PROGRESS' 
             WHERE id = ?`,
            [JSON.stringify(ctx), organizationId]
        );

        return { success: true, status: 'IN_PROGRESS' };
    },

    /**
     * Generate First Value Plan via AI.
     * Persists plan snapshot and increments version.
     */
    generatePlan: async (organizationId, userId) => {
        // 1. Fetch org + context
        const org = await getAsync(db,
            `SELECT transformation_context, onboarding_plan_version, onboarding_status,
                    organization_type, token_balance
             FROM organizations WHERE id = ?`,
            [organizationId]
        );

        if (!org) {
            const err = new Error('Organization not found');
            err.statusCode = 404;
            throw err;
        }

        if (!org.transformation_context || org.transformation_context === '{}') {
            const err = new Error('No transformation context saved. Complete context form first.');
            err.statusCode = 400;
            throw err;
        }

        const context = JSON.parse(org.transformation_context);

        // 2. Call AI Service
        const plan = await AiService.generateFirstValuePlan(context, userId);

        // 3. Validate plan structure
        if (!plan || typeof plan !== 'object') {
            const err = new Error('AI returned invalid plan');
            err.statusCode = 502;
            throw err;
        }

        // Ensure minimal structure
        if (!Array.isArray(plan.steps)) plan.steps = [];
        if (!Array.isArray(plan.suggested_initiatives)) plan.suggested_initiatives = [];

        // Assign stable IDs to initiatives for selection
        plan.suggested_initiatives = plan.suggested_initiatives.map((init, idx) => ({
            id: `init-${idx}`,
            ...init
        }));

        // 4. Persist snapshot + increment version
        const nextVersion = (org.onboarding_plan_version || 0) + 1;

        // Generate stable planId for Phase E->F linkage (Fix Pack 1)
        const planId = `onbplan-${organizationId}-v${nextVersion}`;
        plan.planId = planId;

        await runAsync(db,
            `UPDATE organizations 
             SET onboarding_plan_snapshot = ?, 
                 onboarding_plan_version = ?, 
                 onboarding_status = 'GENERATED'
             WHERE id = ?`,
            [JSON.stringify(plan), nextVersion, organizationId]
        );

        return { plan, planVersion: nextVersion, planId };
    },

    /**
     * Get current plan snapshot (for reload without regenerating).
     */
    getPlanSnapshot: async (organizationId) => {
        const org = await getAsync(db,
            `SELECT onboarding_plan_snapshot, onboarding_plan_version, onboarding_status
             FROM organizations WHERE id = ?`,
            [organizationId]
        );

        if (!org || !org.onboarding_plan_snapshot) {
            return { plan: null, status: org?.onboarding_status || 'NOT_STARTED' };
        }

        return {
            plan: JSON.parse(org.onboarding_plan_snapshot),
            planVersion: org.onboarding_plan_version,
            status: org.onboarding_status
        };
    },

    /**
     * Accept Plan & Create Real Initiatives (IDEMPOTENT + TRANSACTIONAL).
     */
    acceptPlan: async (organizationId, userId, { acceptedInitiativeIds = null, idempotencyKey = null } = {}) => {
        const key = String(idempotencyKey || `acc-${uuidv4()}`);

        return await withTransaction(db, async () => {
            // 1. Check idempotency
            const org = await getAsync(db,
                `SELECT onboarding_plan_snapshot, onboarding_status, onboarding_accept_idempotency_key
                 FROM organizations WHERE id = ?`,
                [organizationId]
            );

            if (!org) {
                const err = new Error('Organization not found');
                err.statusCode = 404;
                throw err;
            }

            // Idempotency: already accepted with same key
            if (org.onboarding_accept_idempotency_key === key) {
                return { success: true, idempotent: true, createdCount: 0 };
            }

            // Prevent re-acceptance
            if (org.onboarding_status === 'ACCEPTED') {
                const err = new Error('Plan already accepted');
                err.statusCode = 409;
                throw err;
            }

            if (!org.onboarding_plan_snapshot) {
                const err = new Error('No plan generated. Generate a plan first.');
                err.statusCode = 400;
                throw err;
            }

            const plan = JSON.parse(org.onboarding_plan_snapshot);
            const allInitiatives = plan.suggested_initiatives || [];

            // 2. Filter if specific IDs provided
            const toCreate = acceptedInitiativeIds && acceptedInitiativeIds.length > 0
                ? allInitiatives.filter(i => acceptedInitiativeIds.includes(i.id))
                : allInitiatives;

            // 3. Create initiatives with Phase E->F linkage (Fix Pack 1)
            const planId = plan.planId || `onbplan-${organizationId}-unknown`;
            let createdCount = 0;
            for (const init of toCreate) {
                const newId = `init-${uuidv4()}`;
                await runAsync(db,
                    `INSERT INTO initiatives (
                        id, organization_id, name, summary, hypothesis,
                        status, priority, created_at, owner_business_id, created_from, created_from_plan_id
                    ) VALUES (?, ?, ?, ?, ?, 'DRAFT', 'HIGH', CURRENT_TIMESTAMP, ?, 'AI_ONBOARDING', ?)`,
                    [
                        newId,
                        organizationId,
                        String(init.title || '').slice(0, 200),
                        String(init.summary || '').slice(0, 2000),
                        String(init.hypothesis || '').slice(0, 500),
                        userId,
                        planId
                    ]
                );
                createdCount++;
            }

            // 4. Mark as accepted
            await runAsync(db,
                `UPDATE organizations 
                 SET onboarding_status = 'ACCEPTED',
                     onboarding_accepted_at = CURRENT_TIMESTAMP,
                     onboarding_accept_idempotency_key = ?
                 WHERE id = ?`,
                [key, organizationId]
            );

            return { success: true, idempotent: false, createdCount };
        });
    },

    /**
     * Get onboarding status for an organization.
     */
    getStatus: async (organizationId) => {
        const org = await getAsync(db,
            `SELECT onboarding_status, onboarding_plan_version, onboarding_accepted_at
             FROM organizations WHERE id = ?`,
            [organizationId]
        );

        return {
            status: org?.onboarding_status || 'NOT_STARTED',
            planVersion: org?.onboarding_plan_version || 0,
            acceptedAt: org?.onboarding_accepted_at || null
        };
    }
};

module.exports = OnboardingService;

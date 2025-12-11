const db = require('../database');

/**
 * Plan Limits Configuration
 */
const PLAN_LIMITS = {
    free: {
        max_projects: 1,
        max_storage_mb: 100,
        can_use_advanced_models: 0, // 0 = false
        max_members: 1
    },
    pro: {
        max_projects: 10,
        max_storage_mb: 5000,
        can_use_advanced_models: 1,
        max_members: 5
    },
    enterprise: {
        max_projects: 9999,
        max_storage_mb: 100000,
        can_use_advanced_models: 1,
        max_members: 9999
    }
};

/**
 * Middleware to check plan limits
 * Usage: router.post('/projects', checkPlanLimit('max_projects'), createProject);
 * 
 * @param {string} limitKey - Key to check in PLAN_LIMITS (e.g., 'max_projects')
 */
const checkPlanLimit = (limitKey) => {
    return async (req, res, next) => {
        try {
            const orgId = req.user?.organizationId;
            if (!orgId) return res.status(403).json({ error: 'No organization found' });

            // 1. Get Organization Plan
            const org = await new Promise((resolve, reject) => {
                db.get('SELECT plan, status FROM organizations WHERE id = ?', [orgId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (!org) return res.status(404).json({ error: 'Organization not found' });

            // Allow trial as pro
            const plan = (org.status === 'trial') ? 'pro' : (org.plan || 'free');
            const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
            const limitValue = limits[limitKey];

            if (limitValue === undefined) {
                // Limit not defined for this plan? Allow or Log warning.
                console.warn(`Limit key ${limitKey} not found for plan ${plan}`);
                return next();
            }

            // 2. Check current usage
            let currentCount = 0;

            if (limitKey === 'max_projects') {
                const result = await new Promise((resolve, reject) => {
                    db.get('SELECT COUNT(*) as count FROM projects WHERE organization_id = ? AND status != "archived"', [orgId], (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    });
                });
                currentCount = result.count;
            } else if (limitKey === 'max_members') {
                const result = await new Promise((resolve, reject) => {
                    db.get('SELECT COUNT(*) as count FROM users WHERE organization_id = ?', [orgId], (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    });
                });
                currentCount = result.count;
            }
            // Add other checks (storage, models) here as needed

            // 3. Enforce
            if (currentCount >= limitValue) {
                return res.status(403).json({
                    error: `Plan limit reached: ${limitKey}. Current: ${currentCount}, Limit: ${limitValue}. Upgrade to Pro/Enterprise for more.`
                });
            }

            next();
        } catch (error) {
            console.error('Plan limit check error:', error);
            res.status(500).json({ error: 'Failed to verify plan limits' });
        }
    };
};

module.exports = { checkPlanLimit, PLAN_LIMITS };

/**
 * Trial Entry Guard Middleware
 * 
 * Blocks organization-requiring actions for users in TRIAL_ENTRY status.
 * Users in Trial Entry can talk to AI and explore methodology, but cannot:
 * - Create initiatives
 * - Invite team members
 * - Upload data
 * - Generate reports
 * - Access dashboard features
 * 
 * @module trialEntryGuard
 */

const db = require('../database');

/**
 * List of blocked routes for Trial Entry users
 */
const BLOCKED_ROUTES = [
    // Initiative creation/modification
    { method: 'POST', path: /^\/api\/initiatives/ },
    { method: 'PUT', path: /^\/api\/initiatives/ },
    { method: 'DELETE', path: /^\/api\/initiatives/ },

    // Team invitations
    { method: 'POST', path: /^\/api\/organizations\/.*\/invite/ },
    { method: 'POST', path: /^\/api\/invitations/ },

    // Data upload
    { method: 'POST', path: /^\/api\/upload/ },
    { method: 'POST', path: /^\/api\/ingestion/ },

    // Report generation
    { method: 'POST', path: /^\/api\/reports/ },
    { method: 'GET', path: /^\/api\/reports\/.*\/export/ },

    // Roadmap creation
    { method: 'POST', path: /^\/api\/roadmap/ },

    // Assessment submission (can view demo, not submit real)
    { method: 'POST', path: /^\/api\/assessment\/submit/ },

    // AI memory write (allowed to chat, not persist)
    { method: 'POST', path: /^\/api\/ai\/memory/ },
    { method: 'POST', path: /^\/api\/knowledge/ }
];

/**
 * Check if user is in Trial Entry status
 */
async function isTrialEntryUser(userId) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT user_status FROM users WHERE id = ?`,
            [userId],
            (err, row) => {
                if (err) return reject(err);
                resolve(row?.user_status === 'TRIAL_ENTRY');
            }
        );
    });
}

/**
 * Check if route is blocked for Trial Entry users
 */
function isBlockedRoute(method, path) {
    return BLOCKED_ROUTES.some(route =>
        route.method === method && route.path.test(path)
    );
}

/**
 * Trial Entry Guard Middleware
 * 
 * Must be used AFTER auth middleware.
 */
const trialEntryGuard = async (req, res, next) => {
    try {
        // Skip if no user (auth middleware not applied or failed)
        if (!req.user?.id) {
            return next();
        }

        // Check if user is in Trial Entry
        const isTrialEntry = await isTrialEntryUser(req.user.id);

        if (!isTrialEntry) {
            return next();
        }

        // Attach flag for downstream use
        req.isTrialEntry = true;

        // Check if this route is blocked
        if (isBlockedRoute(req.method, req.path)) {
            return res.status(403).json({
                error: 'TRIAL_ENTRY_RESTRICTION',
                message: 'Ta funkcja nie jest dostępna w Trial Entry. Załóż organizację, aby kontynuować.',
                messageEn: 'This feature is not available in Trial Entry. Create an organization to continue.',
                cta: {
                    label: 'Załóż organizację',
                    path: '/trial/create-org'
                }
            });
        }

        next();
    } catch (error) {
        console.error('[TrialEntryGuard] Error:', error);
        next(error);
    }
};

/**
 * Middleware to require organization context
 * Use on routes that absolutely need an organization
 */
const requireOrgContext = async (req, res, next) => {
    if (req.isTrialEntry) {
        return res.status(403).json({
            error: 'ORG_REQUIRED',
            message: 'Ta funkcja wymaga organizacji. Jesteś w fazie Trial Entry.',
            cta: {
                label: 'Załóż organizację',
                path: '/trial/create-org'
            }
        });
    }

    if (!req.user?.organization_id) {
        return res.status(403).json({
            error: 'ORG_REQUIRED',
            message: 'Brak kontekstu organizacji.'
        });
    }

    next();
};

module.exports = {
    trialEntryGuard,
    requireOrgContext,
    isTrialEntryUser,
    BLOCKED_ROUTES
};

/**
 * Legal Compliance Middleware
 * Enforces legal document acceptance requirements.
 * 
 * Blocks API requests if user has pending required acceptances.
 * Returns HTTP 451 (Unavailable For Legal Reasons) with pending docs list.
 * 
 * Exempted routes:
 * - /api/legal/* (needed to check/accept documents)
 * - /api/auth/* (login/register flow)
 * - /api/health (health checks)
 */

const LegalService = require('../services/legalService');

// Routes exempt from legal compliance check
const EXEMPT_ROUTES = [
    '/api/legal',
    '/api/auth',
    '/api/health'
];

/**
 * Check if route is exempt from legal compliance
 * @param {string} path - Request path
 * @returns {boolean} True if exempt
 */
const isExemptRoute = (path) => {
    return EXEMPT_ROUTES.some(route => path.startsWith(route));
};

/**
 * Legal Compliance Middleware Factory
 * Returns middleware that checks user's legal acceptance status
 */
const legalComplianceMiddleware = async (req, res, next) => {
    try {
        // Skip if not authenticated (auth routes handle their own flow)
        if (!req.user) {
            return next();
        }

        // Skip exempt routes
        if (isExemptRoute(req.originalUrl)) {
            return next();
        }

        // Check pending acceptances
        const pending = await LegalService.checkPendingAcceptances(
            req.user.id,
            req.user.organizationId,
            req.user.role
        );

        // If no pending acceptances, continue
        if (!pending.hasAnyPending) {
            return next();
        }

        // User has pending acceptances - block with 451
        return res.status(451).json({
            error: 'Legal acceptance required',
            code: 'LEGAL_ACCEPTANCE_REQUIRED',
            pending: {
                requiredDocs: pending.required.map(doc => ({
                    docType: doc.doc_type,
                    version: doc.version,
                    title: doc.title
                })),
                dpaPending: pending.dpaPending,
                isOrgAdmin: pending.isOrgAdmin,
                message: pending.dpaPending && pending.isOrgAdmin
                    ? 'Organization DPA acceptance required'
                    : 'Please accept the updated legal documents to continue'
            }
        });

    } catch (err) {
        console.error('[LegalCompliance] Error:', err);
        // On error, allow request to proceed but log the issue
        // We don't want legal check failures to completely block the app
        next();
    }
};

module.exports = legalComplianceMiddleware;

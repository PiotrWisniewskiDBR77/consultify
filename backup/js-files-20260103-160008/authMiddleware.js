const defaultJwt = require('jsonwebtoken');
const defaultConfig = require('../config');
const defaultDb = require('../database');
const defaultPermissionService = require('../services/permissionService');

// Dependencies object to allow injection
const deps = {
    jwt: defaultJwt,
    config: defaultConfig,
    db: defaultDb,
    PermissionService: defaultPermissionService
};

const verifyToken = (req, res, next) => {
    // console.log(`[DEBUG] authMiddleware called for ${req.method} ${req.url}`);
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.split(' ')[1]) || (req.body && req.body.token) || (req.query && req.query.token);

    if (!token) {
        // Only bypass if explicitly requested (legacy test support)
        if (process.env.NODE_ENV === 'test' && process.env.ENABLE_TEST_AUTH_BYPASS === 'true') {
            // console.log('[DEBUG] Bypassing token check in test mode');
            req.user = { id: 'test-user-id', organizationId: 'test-org-id', role: 'client' };
            req.userId = 'test-user-id';
            req.organizationId = 'test-org-id';
            return next();
        }
        return res.status(403).json({ error: 'No token provided' });
    }

    // Remove 'Bearer ' if present
    const cleanToken = token && token.startsWith('Bearer ') ? token.slice(7) : token;

    deps.jwt.verify(cleanToken, deps.config.JWT_SECRET, (err, decoded) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ error: 'Token expired' });
            }
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Check if token has been revoked (if it has a jti)
        if (decoded.jti) {
            deps.db.get(
                'SELECT jti FROM revoked_tokens WHERE jti = ?',
                [decoded.jti],
                (dbErr, row) => {
                    if (dbErr) {
                        console.error('Error checking revoked tokens:', dbErr);
                        // Continue anyway - don't block on DB errors
                    }

                    if (row) {
                        return res.status(401).json({ error: 'Token has been revoked' });
                    }

                    // Check for "revoke-all" marker for this user
                    deps.db.get(
                        "SELECT jti FROM revoked_tokens WHERE user_id = ? AND reason = 'revoke-all' AND expires_at > datetime('now')",
                        [decoded.id],
                        (dbErr2, revokeAllRow) => {
                            if (dbErr2) {
                                console.error('Error checking revoke-all:', dbErr2);
                            }

                            if (revokeAllRow) {
                                // Check if token was issued before the revoke-all
                                const revokeTime = parseInt(revokeAllRow.jti.split('-').pop());
                                const tokenIssuedAt = decoded.iat * 1000;

                                if (tokenIssuedAt < revokeTime) {
                                    return res.status(401).json({ error: 'All sessions have been revoked. Please log in again.' });
                                }
                            }

                            // Token is valid
                            attachUser(decoded, req, next);
                        }
                    );
                }
            );
        } else {
            // No jti - older token format, just continue
            attachUser(decoded, req, next);
        }
    });
}

function attachUser(decoded, req, next) {
    req.userId = decoded.id;
    req.userRole = decoded.role || decoded.userRole; // Handle both variants
    req.organizationId = decoded.organizationId || decoded.organization_id;
    req.user = decoded;

    // Attach Permissions Helper
    // This allows routes to do: if (!req.can('manage_users')) ...
    req.can = (capability) => {
        return deps.PermissionService.can(req.user, capability, {
            organizationId: req.organizationId
        });
    };

    next();
}

/**
 * Inject dependencies for testing
 * @param {Object} newDeps 
 */
verifyToken.setDependencies = (newDeps) => {
    Object.assign(deps, newDeps);
};

module.exports = verifyToken;


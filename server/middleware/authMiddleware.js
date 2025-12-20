const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../database');

function verifyToken(req, res, next) {
    const token = req.headers['x-access-token'] || req.headers['authorization'];

    if (!token) {
        return res.status(403).json({ error: 'No token provided' });
    }

    // Remove 'Bearer ' if present
    const cleanToken = token && token.startsWith('Bearer ') ? token.slice(7) : token;

    jwt.verify(cleanToken, config.JWT_SECRET, (err, decoded) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ error: 'Token expired' });
            }
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Check if token has been revoked (if it has a jti)
        if (decoded.jti) {
            db.get(
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
                    db.get(
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

const PermissionService = require('../services/permissionService');

function attachUser(decoded, req, next) {
    req.userId = decoded.id;
    req.userRole = decoded.role || decoded.userRole; // Handle both variants
    req.organizationId = decoded.organizationId || decoded.organization_id;
    req.user = decoded;

    // Attach Permissions Helper
    // This allows routes to do: if (!req.can('manage_users')) ...
    req.can = (capability) => {
        return PermissionService.can(req.user, capability, {
            organizationId: req.organizationId
        });
    };

    next();
}

module.exports = verifyToken;


import defaultJwt from 'jsonwebtoken';
import config from '../config.js';
const JWT_SECRET = config.JWT_SECRET;
import { getDatabase } from '../src/database/index.js';
const defaultDb = getDatabase();

// Dependencies object to allow injection
const deps = {
    jwt: defaultJwt,
    db: defaultDb
};

const verifySuperAdmin = (req, res, next) => {
    const headers = req.headers || {};
    const token = headers['authorization'];
    if (!token) return res.status(403).json({ error: 'No token provided' });

    deps.jwt.verify(token.split(' ')[1], JWT_SECRET, async (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Unauthorized' });

        // Check role from token first
        let userRole = decoded.role;

        // If role is not SUPERADMIN, check database as fallback (in case role was changed)
        if (userRole !== 'SUPERADMIN' && userRole !== 'SUPER_ADMIN') {
            console.log(`[SuperAdmin Middleware] Initial role check failed for: ${userRole}`);
            try {
                const user = await new Promise((resolve, reject) => {
                    deps.db.get('SELECT role FROM users WHERE id = ?', [decoded.id], (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    });
                });

                if (user && (user.role === 'SUPERADMIN' || user.role === 'SUPER_ADMIN')) {
                    // Role was changed in database, update decoded token
                    console.log('[SuperAdmin Middleware] Role promoted via DB check');
                    userRole = user.role;
                    decoded.role = user.role;
                } else {
                    console.log('[SuperAdmin Middleware] DB check validated non-superadmin role:', user?.role);
                }
            } catch (dbErr) {
                console.error('[SuperAdmin Middleware] Database check error:', dbErr);
                // Continue with token role if DB check fails
            }
        }

        if (userRole !== 'SUPERADMIN' && userRole !== 'SUPER_ADMIN') {
            console.log(`[SuperAdmin Middleware] Access Denied. Role: ${userRole}`);
            return res.status(403).json({ error: 'Requires Super Admin privileges' });
        }

        req.userId = decoded.id;
        req.userRole = userRole;
        req.organizationId = decoded.organizationId || decoded.organization_id;
        req.user = decoded;
        next();
    });
};

/**
 * Inject dependencies for testing
 * @param {Object} newDeps 
 */
verifySuperAdmin.setDependencies = (newDeps) => {
    Object.assign(deps, newDeps);
};

export default verifySuperAdmin;

const defaultJwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey_change_this_in_production';

// Dependencies object to allow injection
const deps = {
    jwt: defaultJwt
};

const verifySuperAdmin = (req, res, next) => {
    const headers = req.headers || {};
    const token = headers['authorization'];
    if (!token) return res.status(403).json({ error: 'No token provided' });

    deps.jwt.verify(token.split(' ')[1], JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Unauthorized' });

        if (decoded.role !== 'SUPERADMIN' && decoded.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Requires Super Admin privileges' });
        }

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

module.exports = verifySuperAdmin;

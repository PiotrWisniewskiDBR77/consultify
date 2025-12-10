const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey_change_this_in_production';

const verifySuperAdmin = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({ error: 'No token provided' });

    jwt.verify(token.split(' ')[1], JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Unauthorized' });

        if (decoded.role !== 'SUPERADMIN' && decoded.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Requires Super Admin privileges' });
        }

        req.user = decoded;
        next();
    });
};

module.exports = verifySuperAdmin;

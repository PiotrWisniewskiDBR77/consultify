const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey_change_this_in_production';

function verifyToken(req, res, next) {
    const token = req.headers['x-access-token'] || req.headers['authorization'];

    if (!token) {
        return res.status(403).json({ error: 'No token provided' });
    }

    // Remove 'Bearer ' if present
    const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;

    jwt.verify(cleanToken, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Unauthorized' });
        req.userId = decoded.id;
        req.userRole = decoded.role;
        req.user = decoded; // Added for organizationId access
        next();
    });
}

module.exports = verifyToken;

import { describe, it, expect, vi, beforeEach } from 'vitest';
import verifySuperAdmin from '../../../../server/middleware/superAdminMiddleware.js';
import jwt from 'jsonwebtoken';

// No mocking of jsonwebtoken! Use real one.
const TEST_SECRET = 'supersecretkey_change_this_in_production';
process.env.JWT_SECRET = TEST_SECRET;

describe('SuperAdminMiddleware', () => {
    let req, res, next;

    beforeEach(() => {
        req = {
            headers: {},
            user: {}
        };
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn()
        };
        next = vi.fn();
        vi.clearAllMocks();
    });

    const generateToken = (role) => {
        return jwt.sign({ role, id: 1 }, TEST_SECRET, { expiresIn: '1h' });
    };

    it('should call next() if user is superadmin', () => {
        const token = generateToken('SUPERADMIN');
        req.headers['authorization'] = `Bearer ${token}`;

        verifySuperAdmin(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('should return 403 if user is admin (not super)', () => {
        const token = generateToken('ADMIN');
        req.headers['authorization'] = `Bearer ${token}`;

        verifySuperAdmin(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Requires Super Admin privileges' }));
    });

    it('should return 401 if token is invalid (bad signature)', () => {
        const token = jwt.sign({ role: 'SUPERADMIN' }, 'wrong_secret');
        req.headers['authorization'] = `Bearer ${token}`;

        verifySuperAdmin(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
    });
});

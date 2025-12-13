import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyAdmin } from '../../../../server/middleware/adminMiddleware.js';
import jwt from 'jsonwebtoken';

// No mocking of jsonwebtoken! Use real one.
const TEST_SECRET = 'supersecretkey_change_this_in_production'; // Matches default in middleware
process.env.JWT_SECRET = TEST_SECRET;

describe('AdminMiddleware', () => {
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
    });

    const generateToken = (role) => {
        return jwt.sign({ role, id: 1 }, TEST_SECRET, { expiresIn: '1h' });
    };

    it('should call next() if user is admin', () => {
        const token = generateToken('ADMIN');
        req.headers['authorization'] = `Bearer ${token}`;

        verifyAdmin(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('should call next() if user is superadmin', () => {
        const token = generateToken('SUPERADMIN');
        req.headers['authorization'] = `Bearer ${token}`;

        verifyAdmin(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('should return 403 if user is not admin', () => {
        const token = generateToken('USER');
        req.headers['authorization'] = `Bearer ${token}`;

        verifyAdmin(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Admin privileges required' }));
    });

    it('should return 401 if verify failed (bad signature)', () => {
        const token = jwt.sign({ role: 'ADMIN' }, 'wrong_secret');
        req.headers['authorization'] = `Bearer ${token}`;

        verifyAdmin(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
    });
});

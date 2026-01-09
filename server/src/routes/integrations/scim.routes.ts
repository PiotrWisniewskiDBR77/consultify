/**
 * SCIM Routes (lightweight storage + mock responses)
 * Stores SCIM tokens in DB, keeps placeholder Users/Groups to avoid 501.
 */

import { v4 as uuidv4 } from 'uuid';
import { Router } from 'express';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();
const SCIM_BASE = `${process.env.API_BASE_URL || 'http://localhost:3000/api'}/scim/v2`;

// Base info for UI (endpoints, auth)
router.get(
    '/info',
    verifyToken,
    asyncHandler(async (_req: AuthRequest, res) => {
        return res.json({
            baseUrl: SCIM_BASE,
            usersEndpoint: '/Users',
            groupsEndpoint: '/Groups',
            auth: 'Bearer Token',
            patchSupported: true,
        });
    }),
);

// Tokens list
router.get(
    '/tokens',
    verifyToken,
    asyncHandler(async (_req: AuthRequest, res) => {
        const { all: dbAll } = await import('../../utils/DbPromise.js');
        const tokens = await dbAll(`SELECT * FROM scim_tokens ORDER BY created_at DESC`, []);
        return res.json({ tokens });
    }),
);

// Create token
router.post(
    '/tokens',
    verifyToken,
    asyncHandler(async (_req: AuthRequest, res) => {
        const id = uuidv4();
        const token = `scim_${uuidv4()}`;
        const { run: dbRun } = await import('../../utils/DbPromise.js');
        await dbRun(`INSERT INTO scim_tokens (id, token, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)`, [id, token]);
        return res.json({ success: true, id, token });
    }),
);

// Delete token
router.delete(
    '/tokens/:id',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res) => {
        const { id } = req.params;
        const { run: dbRun } = await import('../../utils/DbPromise.js');
        await dbRun(`DELETE FROM scim_tokens WHERE id = ?`, [id]);
        return res.json({ success: true });
    }),
);

// Placeholder for SCIM Users/Groups endpoints (not full SCIM spec, just to avoid 501)
router.get(
    '/v2/Users',
    verifyToken,
    asyncHandler(async (_req: AuthRequest, res) => {
        return res.json({ Resources: [], totalResults: 0 });
    }),
);

router.get(
    '/v2/Groups',
    verifyToken,
    asyncHandler(async (_req: AuthRequest, res) => {
        return res.json({ Resources: [], totalResults: 0 });
    }),
);

export default router;

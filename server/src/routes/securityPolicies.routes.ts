/**
 * Security Policies Routes (Mock)
 * Minimal endpoints to keep UI working.
 */

import { Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

let policies = [
  {
    id: 'password-policy',
    name: 'Password Policy',
    category: 'Authentication',
    settings: { minLength: 12, requireUppercase: true, requireNumber: true, requireSpecial: true },
    enabled: true,
    last_updated: new Date().toISOString(),
  },
  {
    id: 'session-timeout',
    name: 'Session Timeout',
    category: 'Session',
    settings: { timeoutMinutes: 30, extendOnActivity: true },
    enabled: true,
    last_updated: new Date().toISOString(),
  },
  {
    id: 'mfa-required',
    name: 'MFA Required',
    category: 'Authentication',
    settings: { required: true, methods: ['totp', 'webauthn'] },
    enabled: true,
    last_updated: new Date().toISOString(),
  },
  {
    id: 'ip-allowlist',
    name: 'IP Allowlist (Admin)',
    category: 'Network',
    settings: { enabled: true, cidr: ['192.168.0.0/24', '10.0.0.0/24'] },
    enabled: true,
    last_updated: new Date().toISOString(),
  },
];

router.get(
  '/',
  verifyToken,
  asyncHandler(async (_req: AuthRequest, res) => {
    return res.json({ policies });
  })
);

router.put(
  '/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res) => {
    const { id } = req.params;
    const idx = policies.findIndex((p) => p.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Policy not found' });
    policies[idx] = { ...policies[idx], ...req.body, last_updated: new Date().toISOString() };
    return res.json({ success: true });
  })
);

export default router;

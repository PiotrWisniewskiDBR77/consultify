/**
 * Consultants Routes
 * API endpoints for consultant profile management
 */
import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

const router = Router();
interface AuthRequest extends Request {
  user?: { id: string; organizationId: string };
}

router.get(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const consultants = await dbAll(
      `
    SELECT c.id, c.specialization, c.hourly_rate, c.availability, c.rating,
           u.first_name, u.last_name, u.email
    FROM consultants c JOIN users u ON c.user_id = u.id
    WHERE c.organization_id = ? ORDER BY c.rating DESC
  `,
      [orgId]
    );
    res.json(consultants || []);
  })
);

router.get(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const consultant = await dbGet(
      `
    SELECT c.*, u.first_name, u.last_name, u.email
    FROM consultants c JOIN users u ON c.user_id = u.id WHERE c.id = ?
  `,
      [req.params.id]
    );
    if (!consultant) return res.status(404).json({ error: 'Not found' });
    res.json(consultant);
  })
);

router.post(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const { userId, specialization, hourlyRate, availability } = req.body;
    const id = uuidv4();
    await dbRun(
      `
    INSERT INTO consultants (id, organization_id, user_id, specialization, hourly_rate, availability, rating, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'))
  `,
      [id, orgId, userId, specialization || '', hourlyRate || 0, availability || 'available']
    );
    res.status(201).json({ success: true, id });
  })
);

router.put(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { specialization, hourlyRate, availability, bio } = req.body;
    const updates: string[] = [];
    const params: any[] = [];
    if (specialization) {
      updates.push('specialization = ?');
      params.push(specialization);
    }
    if (hourlyRate) {
      updates.push('hourly_rate = ?');
      params.push(hourlyRate);
    }
    if (availability) {
      updates.push('availability = ?');
      params.push(availability);
    }
    if (bio) {
      updates.push('bio = ?');
      params.push(bio);
    }
    if (!updates.length) return res.status(400).json({ error: 'No updates' });
    params.push(req.params.id);
    await dbRun(`UPDATE consultants SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ success: true });
  })
);

export default router;

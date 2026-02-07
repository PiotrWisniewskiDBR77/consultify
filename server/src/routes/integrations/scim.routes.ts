/**
 * SCIM Routes - System for Cross-domain Identity Management
 */
import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/Logger.js';

const router = Router();

// SCIM 2.0 Users endpoint
router.get('/Users', asyncHandler(async (req: Request, res: Response) => {
  const { filter, startIndex = '1', count = '100' } = req.query;
  const users = await dbAll(`SELECT id, email, first_name, last_name, is_active FROM users LIMIT ? OFFSET ?`,
    [parseInt(count as string), parseInt(startIndex as string) - 1]);
  res.json({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: (users || []).length,
    startIndex: parseInt(startIndex as string),
    itemsPerPage: parseInt(count as string),
    Resources: (users || []).map((u: any) => ({
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      id: u.id, userName: u.email, active: !!u.is_active,
      name: { givenName: u.first_name, familyName: u.last_name },
    }))
  });
}));

router.post('/Users', asyncHandler(async (req: Request, res: Response) => {
  const { userName, name, active } = req.body;
  if (!userName) return res.status(400).json({ error: 'userName required' });
  const id = uuidv4();
  await dbRun(`INSERT INTO users (id, email, first_name, last_name, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    [id, userName, name?.givenName || '', name?.familyName || '', active !== false ? 1 : 0]);
  logger.info(`[SCIM] Created user: ${userName}`);
  res.status(201).json({ schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'], id, userName });
}));

router.get('/Groups', asyncHandler(async (_req: Request, res: Response) => {
  const groups = await dbAll('SELECT id, name FROM groups LIMIT 100');
  res.json({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: (groups || []).length,
    Resources: (groups || []).map((g: any) => ({
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
      id: g.id, displayName: g.name
    }))
  });
}));

export default router;

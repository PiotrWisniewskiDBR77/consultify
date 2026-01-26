/**
 * Dashboard Routes
 * Provides dashboard widgets and stats endpoints
 */

import { Request, Response, Router } from 'express';

const router = Router();

/**
 * GET /api/dashboard
 * Get dashboard overview with widgets and stats
 */
router.get('/', (req: Request, res: Response) => {
  res.json({ success: true, data: { widgets: [], stats: {} } });
});

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics
 */
router.get('/stats', (req: Request, res: Response) => {
  res.json({ success: true, data: { users: 0, projects: 0, tasks: 0 } });
});

export default router;

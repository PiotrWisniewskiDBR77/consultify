import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../middleware/auth.middleware.js';
import { runDeterministicForOrganization } from '../jobs/workSignalProducerJob.js';
import { readSignalFeed } from '../services/signals/signalReadModel.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { queryAll, queryOne } from '../utils/queryHelpers.js';

const router = Router();
const db = { query: queryAll };

const identity = (req: AuthRequest) => ({
  userId: String(req.userId || req.user?.id || ''),
  organizationId: String(req.organizationId || req.user?.organizationId || ''),
  roles: [String(req.userRole || req.user?.role || '')],
});

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const auth = identity(req);
    if (!auth.userId || !auth.organizationId)
      return res.status(401).json({ error: 'Unauthorized' });
    const result = await readSignalFeed({
      db,
      ...auth,
      locale: String(req.headers['accept-language'] || 'pl'),
      limit: Number(req.query.limit) || 50,
      projectId: req.query.projectId ? String(req.query.projectId) : undefined,
      domain: req.query.domain ? String(req.query.domain) : undefined,
      origin: req.query.origin ? String(req.query.origin) : undefined,
      severityMin: req.query.severityMin ? String(req.query.severityMin) : undefined,
      cursor: req.query.cursor ? String(req.query.cursor) : undefined,
      can: req.can,
    });
    return res.status(200).json(result);
  })
);

router.post(
  '/refresh',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const auth = identity(req);
    if (!auth.userId || !auth.organizationId)
      return res.status(401).json({ error: 'Unauthorized' });
    if (req.body?.organizationId && String(req.body.organizationId) !== auth.organizationId) {
      return res.status(400).json({ error: 'ORGANIZATION_MISMATCH' });
    }
    const last = await queryOne<{ started_at: string }>(
      `SELECT started_at FROM work_signal_runs
        WHERE organization_id = ? AND kind = 'DETERMINISTIC'
        ORDER BY started_at DESC LIMIT 1`,
      [auth.organizationId]
    );
    if (last) {
      const retryAfterSeconds = Math.ceil(
        60 - (Date.now() - new Date(last.started_at).getTime()) / 1000
      );
      if (retryAfterSeconds > 0)
        return res.status(429).json({ error: 'THROTTLED', retryAfterSeconds });
    }
    const result = await runDeterministicForOrganization({
      organizationId: auth.organizationId,
      trigger: 'ON_DEMAND',
    });
    return res
      .status(200)
      .json({ producerEnabled: result.status !== 'SKIPPED_DISABLED', run: result });
  })
);

export default router;

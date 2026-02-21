/**
 * Webhooks Routes - API endpoints for incoming webhook handlers
 */
import { Request, Response, Router } from 'express';

import { verifyAdmin } from '../../middleware/admin.middleware.js';
import { verifyToken } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import stripeWebhookRoutes from '../webhooks/stripe.routes.js';

const router = Router();
interface AuthRequest extends Request {
  user?: { id: string; organizationId: string };
}

// Canonical Stripe webhook handler (signature-verified + idempotent).
router.use(stripeWebhookRoutes);

// GitHub webhook
router.post(
  '/github',
  asyncHandler(async (req: Request, res: Response) => {
    const event = req.headers['x-github-event'] as string;
    logger.info(`[Webhook] GitHub event: ${event}`);
    await dbRun(
      `INSERT INTO webhook_events (id, provider, event_type, payload, processed, created_at)
    VALUES (?, 'github', ?, ?, 0, datetime('now'))`,
      [req.headers['x-github-delivery'] || 'unknown', event || 'unknown', JSON.stringify(req.body)]
    );
    res.json({ received: true });
  })
);

// Generic webhook receiver
router.post(
  '/:provider',
  asyncHandler(async (req: Request, res: Response) => {
    const { provider } = req.params;
    logger.info(`[Webhook] ${provider} event received`);
    await dbRun(
      `INSERT INTO webhook_events (id, provider, event_type, payload, processed, created_at)
    VALUES (?, ?, 'generic', ?, 0, datetime('now'))`,
      [Date.now().toString(), provider, JSON.stringify(req.body)]
    );
    res.json({ received: true });
  })
);

router.get(
  '/events',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const events = await dbAll(`SELECT id, provider, event_type, processed, created_at
    FROM webhook_events ORDER BY created_at DESC LIMIT 100`);
    res.json(events || []);
  })
);

export default router;

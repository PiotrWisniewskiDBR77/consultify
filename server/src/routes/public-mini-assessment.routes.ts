/**
 * Public Mini Assessment Routes (T0xx)
 *
 * Placeholder router used by Gateway wiring and tests.
 * The real public mini-assessment flow is not implemented yet.
 */
import { Router } from 'express';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true });
});

// Placeholder endpoint for public links (e.g. /api/public/mini-assessment/:token)
router.get('/:token', (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Public mini assessment is not implemented',
    token: req.params.token,
  });
});

export default router;

import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.status(503).json({ status: 'stub', module: 'A1 Affiliate/Ecosystem' });
});

export default router;

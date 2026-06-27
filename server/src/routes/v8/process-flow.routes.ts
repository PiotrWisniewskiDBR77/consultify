import { Router } from 'express';

const router = Router();

router.get('/contract', (_req, res) => {
  res.status(503).json({ status: 'stub', module: 'M07 Process Flow' });
});

export default router;

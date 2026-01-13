import { Router } from 'express';
const router = Router();

router.get('/', (req, res) => res.json({ success: true, data: [] }));
router.get('/:id', (req, res) => res.json({ success: true, data: null }));
router.post('/', (req, res) => res.json({ success: true, data: req.body }));
router.put('/:id', (req, res) => res.json({ success: true, data: req.body }));
router.delete('/:id', (req, res) => res.json({ success: true }));

export default router;

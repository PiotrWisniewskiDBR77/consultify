/**
 * PMO Roles Routes
 * PMO role and permission management
 */
import { Router } from 'express';
import logger from '../../utils/Logger.js';

const router = Router();

// PMO Roles routes - use specific paths, NOT catch-all

router.get('/pmo-roles', (req, res) => {
    res.json([
        { id: 'project-manager', name: 'Project Manager', permissions: ['view', 'edit'] },
        { id: 'stakeholder', name: 'Stakeholder', permissions: ['view'] },
        { id: 'portfolio-manager', name: 'Portfolio Manager', permissions: ['view', 'edit', 'approve'] }
    ]);
});

router.get('/pmo-roles/:id', (req, res) => {
    res.status(404).json({ error: 'Role not found' });
});

export default router;

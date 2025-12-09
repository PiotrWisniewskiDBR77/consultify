const express = require('express');
const router = express.Router();
const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const verifyToken = require('../middleware/authMiddleware');

router.use(verifyToken);

// GET Projects (Scoped to Organization)
router.get('/', (req, res) => {
    const orgId = req.user.organizationId;

    // Optional: Filter by user assignment? For now, allow all users in org to see projects.
    const sql = `
        SELECT p.*, u.first_name as owner_first_name, u.last_name as owner_last_name 
        FROM projects p
        LEFT JOIN users u ON p.owner_id = u.id
        WHERE p.organization_id = ?
        ORDER BY p.created_at DESC
    `;

    db.all(sql, [orgId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// CREATE Project
router.post('/', (req, res) => {
    const orgId = req.user.organizationId;
    const { name, ownerId } = req.body;

    if (!name) return res.status(400).json({ error: 'Project name is required' });

    const id = uuidv4();
    const owner = ownerId || req.user.id; // Default to creator if not specified

    const sql = `INSERT INTO projects (id, organization_id, name, status, owner_id) VALUES (?, ?, ?, ?, ?)`;

    db.run(sql, [id, orgId, name, 'active', owner], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id, name, status: 'active', ownerId: owner });
    });
});

// DELETE Project
router.delete('/:id', (req, res) => {
    const orgId = req.user.organizationId;
    const { id } = req.params;

    // Ensure deleting only own org's project
    const sql = `DELETE FROM projects WHERE id = ? AND organization_id = ?`;

    db.run(sql, [id, orgId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Project not found or access denied' });
        res.json({ message: 'Project deleted' });
    });
});

module.exports = router;

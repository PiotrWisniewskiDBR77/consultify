const express = require('express');
const router = express.Router();
const db = require('../database');
const verifySuperAdmin = require('../middleware/superAdminMiddleware');

router.use(verifySuperAdmin);

// GET All Organizations with Stats
router.get('/organizations', (req, res) => {
    const sql = `
        SELECT 
            o.id, o.name, o.plan, o.status, o.created_at,
            COUNT(u.id) as user_count
        FROM organizations o
        LEFT JOIN users u ON o.id = u.organization_id
        GROUP BY o.id
        ORDER BY o.created_at DESC
    `;

    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// UPDATE Organization (Plan / Status)
router.put('/organizations/:id', (req, res) => {
    const { id } = req.params;
    const { plan, status } = req.body;

    // Validate inputs
    const validPlans = ['free', 'pro', 'enterprise'];
    const validStatuses = ['active', 'blocked', 'trial'];

    if (plan && !validPlans.includes(plan)) return res.status(400).json({ error: 'Invalid plan' });
    if (status && !validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const sql = `UPDATE organizations SET plan = COALESCE(?, plan), status = COALESCE(?, status) WHERE id = ?`;

    db.run(sql, [plan, status, id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Organization not found' });
        res.json({ message: 'Organization updated' });
    });
});

// DELETE Organization (Hard or Soft?) -> Let's do Soft Delete by ensuring status 'archived' or similar, 
// strictly speaking user asked for delete option. Let's do DELETE users first then Org database constrained?
// For simpler prototype: Just delete org and CASCADE users? SQLite doesn't default cascade without pragma.
// Let's manually delete users then org for safety.
router.delete('/organizations/:id', (req, res) => {
    const { id } = req.params;

    // Prevent deleting System Org
    if (id === 'org-dbr77-system') return res.status(403).json({ error: 'Cannot delete System Organization' });

    db.serialize(() => {
        db.run('DELETE FROM users WHERE organization_id = ?', [id]);
        db.run('DELETE FROM organizations WHERE id = ?', [id], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Organization and its users deleted' });
        });
    });
});

module.exports = router;

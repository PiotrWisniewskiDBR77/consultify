const express = require('express');
const router = express.Router();
const db = require('../database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const verifyToken = require('../middleware/authMiddleware');

router.use(verifyToken);

// GET ALL USERS (Scoped to Organization)
router.get('/', (req, res) => {
    // SuperAdmin sees all? Or we keep strict tenant separation even for him unless impersonating.
    // For now: Admin sees own org users.

    db.all('SELECT id, email, first_name, last_name, role, status, last_login FROM users WHERE organization_id = ?', [req.user.organizationId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        const users = rows.map(u => ({
            id: u.id,
            firstName: u.first_name,
            lastName: u.last_name,
            email: u.email,
            role: u.role,
            status: u.status,
            lastLogin: u.last_login
        }));
        res.json(users);
    });
});

// ADD USER (To Organization)
router.post('/', (req, res) => {
    const { firstName, lastName, email, role, status, password } = req.body;
    const organizationId = req.user.organizationId; // FROM TOKEN

    const finalPassword = password || 'welcome123';
    const hashedPassword = bcrypt.hashSync(finalPassword, 8);
    const id = uuidv4();

    const sql = `INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`;

    db.run(sql, [id, organizationId, email, hashedPassword, firstName, lastName, role || 'USER', status || 'active'], function (err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: 'Email already exists' });
            }
            return res.status(500).json({ error: err.message });
        }
        res.json({ id, email, firstName, lastName, role, status });
    });
});

// UPDATE USER
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { firstName, lastName, email, role, status } = req.body;
    const organizationId = req.user.organizationId;

    // Ensure we only update user in OUR org
    const sql = `UPDATE users SET first_name = ?, last_name = ?, email = ?, role = ?, status = ? WHERE id = ? AND organization_id = ?`;

    db.run(sql, [firstName, lastName, email, role, status, id, organizationId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'User not found or access denied' });
        res.json({ message: 'Updated successfully' });
    });
});

// DELETE USER
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    db.run('DELETE FROM users WHERE id = ? AND organization_id = ?', [id, organizationId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'User not found or access denied' });
        res.json({ message: 'Deleted successfully' });
    });
});

module.exports = router;

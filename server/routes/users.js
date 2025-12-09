const express = require('express');
const router = express.Router();
const db = require('../database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// Middleware to check auth (simplified)
const verifyToken = require('../middleware/authMiddleware'); // Will create this next

// GET ALL USERS
router.get('/', (req, res) => {
    db.all('SELECT id, email, first_name, last_name, role, company_name, status, access_level, last_login FROM users', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        const users = rows.map(u => ({
            id: u.id,
            firstName: u.first_name,
            lastName: u.last_name,
            email: u.email,
            role: u.role,
            companyName: u.company_name,
            status: u.status,
            accessLevel: u.access_level,
            lastLogin: u.last_login
        }));
        res.json(users);
    });
});

// ADD USER (ADMIN)
router.post('/', (req, res) => {
    const { firstName, lastName, email, companyName, role, status, accessLevel, password } = req.body;

    // Default password if not provided by admin
    const finalPassword = password || 'welcome123';
    const hashedPassword = bcrypt.hashSync(finalPassword, 8);
    const id = uuidv4();

    const sql = `INSERT INTO users (id, email, password, first_name, last_name, role, company_name, status, access_level, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`;

    db.run(sql, [id, email, hashedPassword, firstName, lastName, role || 'USER', companyName, status || 'active', accessLevel || 'free'], function (err) {
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
    const { firstName, lastName, email, companyName, role, status } = req.body;

    const sql = `UPDATE users SET first_name = ?, last_name = ?, email = ?, company_name = ?, role = ?, status = ? WHERE id = ?`;

    db.run(sql, [firstName, lastName, email, companyName, role, status, id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Updated successfully' });
    });
});

// DELETE USER
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM users WHERE id = ?', [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Deleted successfully' });
    });
});

module.exports = router;

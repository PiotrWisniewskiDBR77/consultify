const express = require('express');
const router = express.Router();
const db = require('../database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey_change_this_in_production';

// LOGIN
router.post('/login', (req, res) => {
    const { email, password } = req.body;

    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const passwordIsValid = bcrypt.compareSync(password, user.password);
        if (!passwordIsValid) return res.status(401).json({ error: 'Invalid password' });

        // Update Last Login
        db.run('UPDATE users SET last_login = datetime("now") WHERE id = ?', [user.id]);

        db.get('SELECT * FROM organizations WHERE id = ?', [user.organization_id], (err, org) => {
            if (err) return res.status(500).json({ error: 'Server error' });
            if (!org) return res.status(404).json({ error: 'Organization not found' });

            // Check if organization is blocked
            if (org.status === 'blocked' && user.role !== 'SUPERADMIN') {
                return res.status(403).json({ error: 'Your organization has been blocked. Contact support.' });
            }

            const token = jwt.sign({
                id: user.id,
                email: user.email,
                role: user.role,
                organizationId: user.organization_id
            }, JWT_SECRET, { expiresIn: '24h' });

            const safeUser = {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                status: user.status,
                organizationId: user.organization_id,
                companyName: org.name
            };

            res.json({ user: safeUser, token });
        });
    });
});

// REGISTER (New Company)
router.post('/register', (req, res) => {
    const { email, password, firstName, lastName, companyName } = req.body;

    // Check if user exists
    db.get('SELECT id FROM users WHERE email = ?', [email], (err, row) => {
        if (row) return res.status(400).json({ error: 'Email already in use' });

        const orgId = uuidv4();
        const userId = uuidv4();
        const hashedPassword = bcrypt.hashSync(password, 8);

        // 1. Create Organization
        const insertOrg = db.prepare(`INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`);
        insertOrg.run(orgId, companyName || 'My Company', 'free', 'active', (err) => {
            if (err) {
                console.error('Register Org Error:', err);
                return res.status(500).json({ error: 'Failed to create organization' });
            }
            insertOrg.finalize();

            // 2. Create Admin User for that Org
            const insertUser = db.prepare(`INSERT INTO users (id, organization_id, email, password, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?, ?)`);
            insertUser.run(userId, orgId, email, hashedPassword, firstName, lastName, 'ADMIN', (err) => {
                if (err) {
                    console.error('Register User Error:', err);
                    return res.status(500).json({ error: 'Failed to create user' });
                }
                insertUser.finalize();

                const token = jwt.sign({
                    id: userId,
                    email: email,
                    role: 'ADMIN',
                    organizationId: orgId
                }, JWT_SECRET, { expiresIn: '24h' });

                res.json({
                    user: {
                        id: userId, email, firstName, lastName, role: 'ADMIN',
                        companyName: companyName, organizationId: orgId
                    },
                    token
                });
            });
        });
    });
});

module.exports = router;

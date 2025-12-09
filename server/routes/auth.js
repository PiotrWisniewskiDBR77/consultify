const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const { v4: uuidv4 } = require('uuid');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// REGISTER
router.post('/register', (req, res) => {
    const { firstName, lastName, email, password, companyName, role, phone, accessLevel } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    const hashedPassword = bcrypt.hashSync(password, 8);
    const id = uuidv4();
    // Default role CEO if not provided, unless admin panel sends it
    const userRole = role || 'CEO';
    const userAccess = accessLevel || 'free';

    const sql = `INSERT INTO users (id, email, password, first_name, last_name, role, company_name, status, access_level, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`;

    db.run(sql, [id, email, hashedPassword, firstName, lastName, userRole, companyName, 'active', userAccess], function (err) {
        if (err) {
            console.error(err);
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: 'Email already exists' });
            }
            return res.status(500).json({ error: 'Database error' });
        }

        const token = jwt.sign({ id: id, email: email, role: userRole }, JWT_SECRET, { expiresIn: '24h' });

        // Return user without password
        const user = {
            id, firstName, lastName, email, companyName, role: userRole, status: 'active', accessLevel: userAccess, isAuthenticated: true
        };

        res.json({ user, token });
    });
});

// LOGIN
router.post('/login', (req, res) => {
    const { email, password } = req.body;

    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const passwordIsValid = bcrypt.compareSync(password, user.password);
        if (!passwordIsValid) {
            return res.status(401).json({ token: null, error: 'Invalid password' });
        }

        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

        // Update last login
        db.run('UPDATE users SET last_login = datetime("now") WHERE id = ?', [user.id]);

        const safeUser = {
            id: user.id,
            firstName: user.first_name,
            lastName: user.last_name,
            email: user.email,
            companyName: user.company_name,
            role: user.role,
            status: user.status,
            accessLevel: user.access_level,
            isAuthenticated: true,
            lastLogin: new Date().toISOString()
        };

        res.json({ user: safeUser, token });
    });
});

module.exports = router;

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

    db.all('SELECT id, email, first_name, last_name, role, status, avatar_url, last_login, timezone, units FROM users WHERE organization_id = ?', [req.user.organizationId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        const users = rows.map(u => ({
            id: u.id,
            firstName: u.first_name,
            lastName: u.last_name,
            email: u.email,
            role: u.role,
            status: u.status,
            avatarUrl: u.avatar_url,
            lastLogin: u.last_login,
            timezone: u.timezone,
            avatarUrl: u.avatar_url,
            lastLogin: u.last_login,
            timezone: u.timezone,
            units: u.units,
            aiConfig: u.ai_config ? JSON.parse(u.ai_config) : {}
        }));
        res.json(users);
    });
});

// Configure Multer for Avatar Uploads
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../uploads/avatars');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Use user ID + timestamp + extension to avoid collisions and cache issues
        const ext = path.extname(file.originalname);
        cb(null, `${req.params.id}-${Date.now()}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only images are allowed'));
    }
});

// UPLOAD AVATAR
router.post('/:id/avatar', upload.single('avatar'), (req, res) => {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    // Construct public URL (relative to server root / assigned static path)
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    // Update User Record
    // Security: Ensure user belongs to organization
    const sql = `UPDATE users SET avatar_url = ? WHERE id = ? AND organization_id = ?`;

    db.run(sql, [avatarUrl, id, organizationId], function (err) {
        if (err) {
            // Try to delete uploaded file if db update fails? 
            // fs.unlinkSync(req.file.path); 
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) return res.status(404).json({ error: 'User not found or access denied' });

        res.json({ message: 'Avatar uploaded successfully', avatarUrl });
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
    const { firstName, lastName, email, role, status, timezone, units, aiConfig } = req.body;
    const organizationId = req.user.organizationId;

    // Build dynamic query to avoid overwriting with nulls if partial update
    // But for simplicity in this project, we often do full updates or use specific handlers.
    // Let's assume frontend sends what it wants to update, or we handle the specific field additions.

    // If aiConfig is present, include it.
    let sql = `UPDATE users SET first_name = ?, last_name = ?, email = ?, role = ?, status = ?, timezone = ?, units = ?`;
    const params = [firstName, lastName, email, role, status, timezone, units];

    if (aiConfig !== undefined) {
        sql += `, ai_config = ?`;
        params.push(JSON.stringify(aiConfig));
    }

    sql += ` WHERE id = ? AND organization_id = ?`;
    params.push(id, organizationId);

    db.run(sql, params, function (err) {
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

const express = require('express');
const router = express.Router();
const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const verifyToken = require('../middleware/authMiddleware');
const { verifyAdmin } = require('../middleware/adminMiddleware');

router.use(verifyToken);

// ==========================================
// GET ALL TEAMS (For organization)
// ==========================================
router.get('/', (req, res) => {
    const orgId = req.user.organizationId;

    const sql = `
        SELECT 
            t.*,
            l.first_name as lead_first_name,
            l.last_name as lead_last_name,
            l.avatar_url as lead_avatar,
            (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as member_count
        FROM teams t
        LEFT JOIN users l ON t.lead_id = l.id
        WHERE t.organization_id = ?
        ORDER BY t.name ASC
    `;

    db.all(sql, [orgId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        const teams = rows.map(t => ({
            id: t.id,
            organizationId: t.organization_id,
            name: t.name,
            description: t.description,
            leadId: t.lead_id,
            lead: t.lead_id ? {
                id: t.lead_id,
                firstName: t.lead_first_name,
                lastName: t.lead_last_name,
                avatarUrl: t.lead_avatar
            } : null,
            memberCount: t.member_count,
            createdAt: t.created_at
        }));

        res.json(teams);
    });
});

// ==========================================
// GET SINGLE TEAM WITH MEMBERS
// ==========================================
router.get('/:id', (req, res) => {
    const { id } = req.params;
    const orgId = req.user.organizationId;

    const teamSql = `
        SELECT t.*, l.first_name as lead_first_name, l.last_name as lead_last_name, l.avatar_url as lead_avatar
        FROM teams t
        LEFT JOIN users l ON t.lead_id = l.id
        WHERE t.id = ? AND t.organization_id = ?
    `;

    db.get(teamSql, [id, orgId], (err, team) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!team) return res.status(404).json({ error: 'Team not found' });

        // Get members
        const membersSql = `
            SELECT tm.*, u.first_name, u.last_name, u.email, u.avatar_url
            FROM team_members tm
            JOIN users u ON tm.user_id = u.id
            WHERE tm.team_id = ?
        `;

        db.all(membersSql, [id], (err, members) => {
            if (err) return res.status(500).json({ error: err.message });

            res.json({
                id: team.id,
                organizationId: team.organization_id,
                name: team.name,
                description: team.description,
                leadId: team.lead_id,
                lead: team.lead_id ? {
                    id: team.lead_id,
                    firstName: team.lead_first_name,
                    lastName: team.lead_last_name,
                    avatarUrl: team.lead_avatar
                } : null,
                createdAt: team.created_at,
                members: members.map(m => ({
                    userId: m.user_id,
                    user: {
                        id: m.user_id,
                        firstName: m.first_name,
                        lastName: m.last_name,
                        email: m.email,
                        avatarUrl: m.avatar_url
                    },
                    role: m.role,
                    joinedAt: m.joined_at
                }))
            });
        });
    });
});

// ==========================================
// CREATE TEAM (Admin only)
// ==========================================
router.post('/', verifyAdmin, (req, res) => {
    const orgId = req.user.organizationId;
    const { name, description, leadId } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Team name is required' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    const sql = `INSERT INTO teams (id, organization_id, name, description, lead_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`;

    db.run(sql, [id, orgId, name, description || null, leadId || null, now], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        // If leadId provided, also add them as a team member with 'lead' role
        if (leadId) {
            db.run(
                `INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)`,
                [id, leadId, 'lead', now]
            );
        }

        res.json({
            id,
            organizationId: orgId,
            name,
            description,
            leadId,
            createdAt: now
        });
    });
});

// ==========================================
// UPDATE TEAM (Admin only)
// ==========================================
router.put('/:id', verifyAdmin, (req, res) => {
    const { id } = req.params;
    const orgId = req.user.organizationId;
    const { name, description, leadId } = req.body;

    const sql = `
        UPDATE teams SET
            name = COALESCE(?, name),
            description = COALESCE(?, description),
            lead_id = COALESCE(?, lead_id)
        WHERE id = ? AND organization_id = ?
    `;

    db.run(sql, [name, description, leadId, id, orgId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Team not found' });
        res.json({ message: 'Team updated' });
    });
});

// ==========================================
// DELETE TEAM (Admin only)
// ==========================================
router.delete('/:id', verifyAdmin, (req, res) => {
    const { id } = req.params;
    const orgId = req.user.organizationId;

    // Delete team members first
    db.run('DELETE FROM team_members WHERE team_id = ?', [id]);

    // Delete team
    db.run('DELETE FROM teams WHERE id = ? AND organization_id = ?', [id, orgId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Team not found' });
        res.json({ message: 'Team deleted' });
    });
});

// ==========================================
// ADD MEMBER TO TEAM (Admin only)
// ==========================================
router.post('/:id/members', verifyAdmin, (req, res) => {
    const { id } = req.params;
    const orgId = req.user.organizationId;
    const { userId, role = 'member' } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
    }

    // Verify team exists and belongs to org
    db.get('SELECT id FROM teams WHERE id = ? AND organization_id = ?', [id, orgId], (err, team) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!team) return res.status(404).json({ error: 'Team not found' });

        // Verify user exists and belongs to same org
        db.get('SELECT id FROM users WHERE id = ? AND organization_id = ?', [userId, orgId], (err, user) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!user) return res.status(404).json({ error: 'User not found in organization' });

            const now = new Date().toISOString();

            db.run(
                `INSERT OR REPLACE INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)`,
                [id, userId, role, now],
                function (err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ message: 'Member added to team' });
                }
            );
        });
    });
});

// ==========================================
// REMOVE MEMBER FROM TEAM (Admin only)
// ==========================================
router.delete('/:id/members/:userId', verifyAdmin, (req, res) => {
    const { id, userId } = req.params;
    const orgId = req.user.organizationId;

    // Verify team exists and belongs to org
    db.get('SELECT id FROM teams WHERE id = ? AND organization_id = ?', [id, orgId], (err, team) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!team) return res.status(404).json({ error: 'Team not found' });

        db.run('DELETE FROM team_members WHERE team_id = ? AND user_id = ?', [id, userId], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Member not in team' });
            res.json({ message: 'Member removed from team' });
        });
    });
});

module.exports = router;

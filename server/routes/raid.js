/**
 * RAID Log Routes
 * 
 * Routes for managing Risks, Assumptions, Issues, and Dependencies
 */

import express from 'express';
const router = express.Router();
import { getDatabase } from '../database/Database.js';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';
import verifyToken from '../middleware/authMiddleware.js';
const { asyncHandler } = require('../utils/errorHandler');
const queryHelpers = require('../utils/queryHelpers');

router.use(verifyToken);

// ==========================================
// GET RAID ITEMS
// ==========================================
router.get('/', asyncHandler(async (req, res) => {
    const orgId = req.user.organizationId;
    const { initiativeId, type, status } = req.query;

    let sql = `
        SELECT r.*, 
            u.first_name as owner_first_name, u.last_name as owner_last_name,
            i.title as initiative_name
        FROM raid_items r
        LEFT JOIN users u ON r.owner_id = u.id
        LEFT JOIN initiatives i ON r.initiative_id = i.id
        WHERE r.organization_id = ?
    `;
    const params = [orgId];

    if (initiativeId) {
        sql += ` AND r.initiative_id = ?`;
        params.push(initiativeId);
    }

    if (type) {
        sql += ` AND r.type = ?`;
        params.push(type);
    }

    if (status) {
        sql += ` AND r.status = ?`;
        params.push(status);
    }

    sql += ` ORDER BY r.created_at DESC`;

    try {
        const rows = await queryHelpers.queryAll(sql, params);

        const items = rows.map(r => ({
            id: r.id,
            type: r.type,
            title: r.title,
            description: r.description,
            status: r.status,
            probability: r.probability,
            impact: r.impact,
            mitigationPlan: r.mitigation_plan,
            owner: r.owner_id ? {
                id: r.owner_id,
                firstName: r.owner_first_name,
                lastName: r.owner_last_name
            } : null,
            dueDate: r.due_date,
            initiativeId: r.initiative_id,
            initiativeName: r.initiative_name,
            linkedItems: r.linked_items ? JSON.parse(r.linked_items) : [],
            createdAt: r.created_at,
            updatedAt: r.updated_at
        }));

        res.json({ items, total: items.length });
    } catch (error) {
        if (error.message && error.message.includes('no such table')) {
            return res.json({ items: [], total: 0 });
        }
        throw error;
    }
}));

// ==========================================
// CREATE RAID ITEM
// ==========================================
router.post('/', asyncHandler(async (req, res) => {
    const orgId = req.user.organizationId;
    const userId = req.user.id;
    const {
        type,
        title,
        description,
        initiativeId,
        probability,
        impact,
        mitigationPlan,
        ownerId,
        dueDate,
        linkedItems
    } = req.body;

    if (!type || !title) {
        return res.status(400).json({ error: 'Type and title are required' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    // Ensure table exists
    await db.runAsync(`
        CREATE TABLE IF NOT EXISTS raid_items (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            initiative_id TEXT,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'OPEN',
            probability TEXT,
            impact TEXT,
            mitigation_plan TEXT,
            owner_id TEXT,
            due_date TEXT,
            linked_items TEXT,
            created_at TEXT,
            updated_at TEXT
        )
    `);

    await db.runAsync(`
        INSERT INTO raid_items (
            id, organization_id, initiative_id, type, title, description, 
            status, probability, impact, mitigation_plan, owner_id, due_date, 
            linked_items, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        id, orgId, initiativeId || null, type, title, description || null,
        'OPEN', probability || null, impact || null, mitigationPlan || null,
        ownerId || userId, dueDate || null,
        linkedItems ? JSON.stringify(linkedItems) : null,
        now, now
    ]);

    res.status(201).json({
        id,
        type,
        title,
        description,
        status: 'OPEN',
        probability,
        impact,
        mitigationPlan,
        initiativeId,
        createdAt: now
    });
}));

// ==========================================
// UPDATE RAID ITEM
// ==========================================
router.patch('/:id', asyncHandler(async (req, res) => {
    const orgId = req.user.organizationId;
    const { id } = req.params;
    const updates = req.body;

    // Verify ownership
    const existing = await queryHelpers.queryOne(
        `SELECT id FROM raid_items WHERE id = ? AND organization_id = ?`,
        [id, orgId]
    );

    if (!existing) {
        return res.status(404).json({ error: 'RAID item not found' });
    }

    const allowedFields = [
        'title', 'description', 'status', 'probability', 'impact',
        'mitigation_plan', 'owner_id', 'due_date', 'linked_items'
    ];

    const setClauses = [];
    const params = [];

    for (const [key, value] of Object.entries(updates)) {
        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        if (allowedFields.includes(snakeKey)) {
            setClauses.push(`${snakeKey} = ?`);
            params.push(key === 'linkedItems' ? JSON.stringify(value) : value);
        }
    }

    if (setClauses.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
    }

    setClauses.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    await db.runAsync(
        `UPDATE raid_items SET ${setClauses.join(', ')} WHERE id = ?`,
        params
    );

    res.json({ success: true, message: 'RAID item updated' });
}));

// ==========================================
// DELETE RAID ITEM
// ==========================================
router.delete('/:id', asyncHandler(async (req, res) => {
    const orgId = req.user.organizationId;
    const { id } = req.params;

    const result = await db.runAsync(
        `DELETE FROM raid_items WHERE id = ? AND organization_id = ?`,
        [id, orgId]
    );

    if (result.changes === 0) {
        return res.status(404).json({ error: 'RAID item not found' });
    }

    res.json({ success: true, message: 'RAID item deleted' });
}));

// ==========================================
// GET RAID SUMMARY (for dashboard)
// ==========================================
router.get('/summary', asyncHandler(async (req, res) => {
    const orgId = req.user.organizationId;
    const { initiativeId } = req.query;

    let whereClause = 'WHERE r.organization_id = ?';
    const params = [orgId];

    if (initiativeId) {
        whereClause += ' AND r.initiative_id = ?';
        params.push(initiativeId);
    }

    try {
        const countsSql = `
            SELECT 
                type,
                status,
                COUNT(*) as count
            FROM raid_items r
            ${whereClause}
            GROUP BY type, status
        `;

        const counts = await queryHelpers.queryAll(countsSql, params);

        // High priority items
        const highPrioritySql = `
            SELECT COUNT(*) as count
            FROM raid_items r
            ${whereClause}
            AND r.status = 'OPEN'
            AND (r.impact = 'HIGH' OR r.impact = 'CRITICAL' OR r.probability = 'HIGH')
        `;

        const highPriority = await queryHelpers.queryOne(highPrioritySql, params);

        // Overdue items
        const overdueSql = `
            SELECT COUNT(*) as count
            FROM raid_items r
            ${whereClause}
            AND r.status = 'OPEN'
            AND r.due_date < date('now')
        `;

        const overdue = await queryHelpers.queryOne(overdueSql, params);

        res.json({
            counts,
            highPriorityCount: highPriority?.count || 0,
            overdueCount: overdue?.count || 0
        });
    } catch (error) {
        if (error.message && error.message.includes('no such table')) {
            return res.json({ counts: [], highPriorityCount: 0, overdueCount: 0 });
        }
        throw error;
    }
}));

export default router;




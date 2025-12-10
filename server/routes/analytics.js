const express = require('express');
const router = express.Router();
const db = require('../database');
const verifyToken = require('../middleware/authMiddleware');

router.use(verifyToken);

// ==========================================
// LEADERSHIP DASHBOARD ANALYTICS
// ==========================================

// 1. Initiative Health
router.get('/health', (req, res) => {
    const orgId = req.user.organizationId;

    const sql = `
        SELECT 
            status,
            COUNT(*) as count,
            SUM(cost_capex + cost_opex) as total_investment,
            SUM(expected_roi) as total_roi
        FROM initiatives 
        WHERE organization_id = ?
        GROUP BY status
    `;

    db.all(sql, [orgId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        // Also get Tasks overdue count
        const taskSql = `
            SELECT COUNT(*) as overdue_count 
            FROM tasks 
            WHERE organization_id = ? 
            AND status != 'done' 
            AND due_date < DATE('now')
        `;

        db.get(taskSql, [orgId], (err, taskRow) => {
            res.json({
                initiativesByStatus: rows,
                overdueTasks: taskRow ? taskRow.overdue_count : 0
            });
        });
    });
});

// 2. People & Performance
router.get('/performance', (req, res) => {
    const orgId = req.user.organizationId;

    // Simple metric: Tasks completed vs Total tasks per user
    const sql = `
        SELECT 
            u.id, u.first_name, u.last_name, u.avatar_url,
            COUNT(t.id) as total_tasks,
            SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as completed_tasks,
            SUM(CASE WHEN t.due_date < DATE('now') AND t.status != 'done' THEN 1 ELSE 0 END) as overdue_tasks
        FROM users u
        LEFT JOIN tasks t ON u.id = t.assignee_id
        WHERE u.organization_id = ?
        GROUP BY u.id
    `;

    db.all(sql, [orgId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 3. Economic Impact
router.get('/economics', (req, res) => {
    const orgId = req.user.organizationId;

    // Sum of Initiatives ROI and Budget
    const sql = `
        SELECT 
            SUM(cost_capex) as total_capex,
            SUM(cost_opex) as total_opex,
            SUM(expected_roi) as expected_benefit,
            SUM(cost_capex + cost_opex) as total_cost
        FROM initiatives 
        WHERE organization_id = ?
    `;

    db.get(sql, [orgId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        // Also get actual spend from Tasks
        const spendSql = `
            SELECT SUM(budget_spent) as actual_spend
            FROM tasks
            WHERE organization_id = ?
        `;

        db.get(spendSql, [orgId], (err, spendRow) => {
            res.json({
                ...row,
                actualSpend: spendRow ? spendRow.actual_spend : 0
            });
        });
    });
});

module.exports = router;

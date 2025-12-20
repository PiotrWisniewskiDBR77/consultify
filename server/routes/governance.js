const express = require('express');
const router = express.Router();
const GovernanceService = require('../services/governanceService');
const db = require('../database');
const { v4: uuidv4 } = require('uuid');

// GET /api/governance/change-requests?projectId=XXX
router.get('/change-requests', async (req, res) => {
    const { projectId } = req.query;

    if (!req.can('view_audit_log')) {
        return res.status(403).json({ error: 'Permission denied' });
    }

    const sql = projectId
        ? `SELECT * FROM change_requests WHERE project_id = ? ORDER BY created_at DESC`
        : `SELECT * FROM change_requests ORDER BY created_at DESC`;

    db.all(sql, projectId ? [projectId] : [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// GET /api/governance/change-requests/:id
router.get('/change-requests/:id', (req, res) => {
    db.get(`SELECT * FROM change_requests WHERE id = ?`, [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Not found' });
        res.json(row);
    });
});

// POST /api/governance/change-requests
router.post('/change-requests', async (req, res) => {
    if (!req.can('approve_changes')) {
        return res.status(403).json({ error: 'Permission denied: Cannot create Change Requests' });
    }

    try {
        const cr = await GovernanceService.createChangeRequest({
            ...req.body,
            createdBy: req.userId
        });
        res.status(201).json(cr);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/governance/change-requests/:id/decide
router.patch('/change-requests/:id/decide', async (req, res) => {
    if (!req.can('approve_changes')) {
        return res.status(403).json({ error: 'Permission denied: Cannot approve/reject CRs' });
    }

    const { status, reason } = req.body; // APPROVED | REJECTED
    if (!['APPROVED', 'REJECTED'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    try {
        const result = await GovernanceService.decideChangeRequest(
            req.params.id, status, req.userId, reason
        );
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/governance/policies?scopeId=XXX
router.get('/policies', (req, res) => {
    const { scopeId } = req.query;
    const sql = scopeId
        ? `SELECT * FROM governance_policies WHERE scope_id = ?`
        : `SELECT * FROM governance_policies`;

    db.all(sql, scopeId ? [scopeId] : [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// PUT /api/governance/policies/:scopeId
router.put('/policies/:scopeId', (req, res) => {
    if (!req.can('manage_ai_policy')) {
        return res.status(403).json({ error: 'Permission denied' });
    }

    const { scopeType, requireCrFor, approvalThresholdCost, aiMode, allowedAiActions } = req.body;
    const id = uuidv4();

    const sql = `INSERT OR REPLACE INTO governance_policies 
        (id, scope_id, scope_type, require_cr_for, approval_threshold_cost, ai_mode, allowed_ai_actions, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;

    db.run(sql, [
        id, req.params.scopeId, scopeType,
        JSON.stringify(requireCrFor || ['SCOPE', 'BUDGET']),
        approvalThresholdCost || 10000,
        aiMode || 'ADVISORY',
        JSON.stringify(allowedAiActions || [])
    ], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id, scopeId: req.params.scopeId, success: true });
    });
});

module.exports = router;

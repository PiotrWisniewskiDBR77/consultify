const AiService = require('../services/aiService');
const express = require('express');
const router = express.Router();
const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const verifyToken = require('../middleware/authMiddleware');

router.use(verifyToken);

// ==========================================
// GET INITIATIVES
// ==========================================
router.get('/', (req, res) => {
    const orgId = req.user.organizationId;

    const sql = `
        SELECT i.*, 
            ob.first_name as ob_first_name, ob.last_name as ob_last_name, ob.avatar_url as ob_avatar,
            oe.first_name as oe_first_name, oe.last_name as oe_last_name, oe.avatar_url as oe_avatar,
            s.first_name as sp_first_name, s.last_name as sp_last_name, s.avatar_url as sp_avatar
        FROM initiatives i
        LEFT JOIN users ob ON i.owner_business_id = ob.id
        LEFT JOIN users oe ON i.owner_execution_id = oe.id
        LEFT JOIN users s ON i.sponsor_id = s.id
        WHERE i.organization_id = ?
        ORDER BY i.created_at DESC
    `;

    db.all(sql, [orgId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        const initiatives = rows.map(i => ({
            id: i.id,
            organizationId: i.organization_id,
            projectId: i.project_id,
            name: i.name,
            axis: i.axis,
            area: i.area,
            summary: i.summary,
            hypothesis: i.hypothesis,
            status: i.status,
            currentStage: i.current_stage,
            businessValue: i.business_value,
            competenciesRequired: i.competencies_required ? JSON.parse(i.competencies_required) : [],
            marketContext: i.market_context,
            costCapex: i.cost_capex,
            costOpex: i.cost_opex,
            expectedRoi: i.expected_roi,
            socialImpact: i.social_impact,
            startDate: i.start_date,
            pilotEndDate: i.pilot_end_date,
            startDate: i.start_date,
            pilotEndDate: i.pilot_end_date,
            endDate: i.end_date,

            // New Professional Card Fields
            problemStatement: i.problem_statement,
            deliverables: i.deliverables ? JSON.parse(i.deliverables) : [],
            successCriteria: i.success_criteria ? JSON.parse(i.success_criteria) : [],
            scopeIn: i.scope_in ? JSON.parse(i.scope_in) : [],
            scopeOut: i.scope_out ? JSON.parse(i.scope_out) : [],
            keyRisks: i.key_risks ? JSON.parse(i.key_risks) : [],

            ownerBusiness: i.owner_business_id ? {
                id: i.owner_business_id,
                firstName: i.ob_first_name,
                lastName: i.ob_last_name,
                avatarUrl: i.ob_avatar
            } : null,
            ownerExecution: i.owner_execution_id ? {
                id: i.owner_execution_id,
                firstName: i.oe_first_name,
                lastName: i.oe_last_name,
                avatarUrl: i.oe_avatar
            } : null,
            sponsor: i.sponsor_id ? {
                id: i.sponsor_id,
                firstName: i.sp_first_name,
                lastName: i.sp_last_name,
                avatarUrl: i.sp_avatar
            } : null,

            createdAt: i.created_at,
            updatedAt: i.updated_at
        }));

        res.json(initiatives);
    });
});

// ==========================================
// GET SINGLE INITIATIVE
// ==========================================
router.get('/:id', (req, res) => {
    const orgId = req.user.organizationId;
    const { id } = req.params;

    const sql = `SELECT * FROM initiatives WHERE id = ? AND organization_id = ?`;

    db.get(sql, [id, orgId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Initiative not found' });

        // Return structured object (simplified for brevity, similar map as above)
        // For detailed view, we might want to fetch stats like task counts
        res.json(row);
    });
});

// ==========================================
// CREATE INITIATIVE
// ==========================================
router.post('/', (req, res) => {
    const orgId = req.user.organizationId;
    const {
        name, axis, area, summary, hypothesis,
        businessValue, competenciesRequired,
        costCapex, costOpex, expectedRoi, socialImpact,
        ownerBusinessId, ownerExecutionId, sponsorId,

        startDate, pilotEndDate, endDate,
        // New Fields
        problemStatement, deliverables, successCriteria, scopeIn, scopeOut, keyRisks
    } = req.body;

    if (!name) return res.status(400).json({ error: 'Name is required' });

    const id = uuidv4();
    const now = new Date().toISOString();

    const sql = `
        INSERT INTO initiatives (
            id, organization_id, name, axis, area, summary, hypothesis,
            business_value, competencies_required,
            cost_capex, cost_opex, expected_roi, social_impact,
            owner_business_id, owner_execution_id, sponsor_id,
            start_date, pilot_end_date, end_date,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(sql, [
        id, orgId, name, axis, area, summary, hypothesis,
        businessValue, JSON.stringify(competenciesRequired || []),
        costCapex, costOpex, expectedRoi, socialImpact,
        ownerBusinessId, ownerExecutionId, sponsorId,
        startDate, pilotEndDate, endDate,
        now, now
    ], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id, name, message: 'Initiative created' });
    });
});

// ==========================================
// UPDATE INITIATIVE
// ==========================================
// ==========================================

// ... (existing helper setup if any, but currently none needed)

// ==========================================
// UPDATE INITIATIVE
// ==========================================
router.put('/:id', (req, res) => {
    const orgId = req.user.organizationId;
    const { id } = req.params;
    const body = req.body;

    const allowedFields = [
        'name', 'axis', 'area', 'summary', 'hypothesis',
        'status', 'current_stage', 'business_value', 'competencies_required',
        'cost_capex', 'cost_opex', 'expected_roi', 'social_impact',
        'start_date', 'pilot_end_date', 'end_date',
        'owner_business_id', 'owner_execution_id', 'sponsor_id',
        'start_date', 'pilot_end_date', 'end_date',
        'owner_business_id', 'owner_execution_id', 'sponsor_id',
        'market_context',
        'problem_statement', 'deliverables', 'success_criteria', 'scope_in', 'scope_out', 'key_risks'
    ];

    const updates = [];
    const params = [];

    allowedFields.forEach(field => {
        // camelCase check for body keys
        const bodyKey = field.replace(/_([a-z])/g, (g) => g[1].toUpperCase());

        if (body[bodyKey] !== undefined) {
            // Handle JSON fields
            if (['competencies_required', 'deliverables', 'success_criteria', 'scope_in', 'scope_out', 'key_risks'].includes(field)) {
                updates.push(`${field} = ?`);
                params.push(JSON.stringify(body[bodyKey]));
            } else {
                updates.push(`${field} = ?`);
                params.push(body[bodyKey]);
            }
        }
    });

    updates.push(`updated_at = ? `);
    params.push(new Date().toISOString());

    if (updates.length === 0) return res.json({ message: 'No changes' });

    params.push(id);
    params.push(orgId);

    const sql = `UPDATE initiatives SET ${updates.join(', ')} WHERE id = ? AND organization_id = ? `;

    db.run(sql, params, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Initiative updated' });
    });
});

// ==========================================
// SUGGEST TASKS (AI)
// ==========================================
router.post('/:id/tasks/suggest', (req, res) => {
    const orgId = req.user.organizationId;
    const { id } = req.params;

    // 1. Get Initiative
    const sql = `SELECT * FROM initiatives WHERE id = ? AND organization_id = ? `;
    db.get(sql, [id, orgId], async (err, initiative) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!initiative) return res.status(404).json({ error: 'Initiative not found' });

        try {
            // 2. Call AI Service
            // Convert DB keys to camelCase if needed, or AiService handles it.
            // AiService expects { name, summary, hypothesis, axis }
            const tasks = await AiService.suggestTasks({
                name: initiative.name,
                summary: initiative.summary,
                hypothesis: initiative.hypothesis,
                axis: initiative.axis
            });

            res.json(tasks);
        } catch (aiError) {
            console.error("AI Error:", aiError);
            res.status(500).json({ error: 'Failed to generate suggestions' });
        }
    });
});


// ==========================================
// VALIDATE INITIATIVE (AI)
// ==========================================
router.post('/:id/validate', (req, res) => {
    const orgId = req.user.organizationId;
    const { id } = req.params;

    const sql = `SELECT * FROM initiatives WHERE id = ? AND organization_id = ? `;
    db.get(sql, [id, orgId], async (err, initiative) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!initiative) return res.status(404).json({ error: 'Initiative not found' });

        try {
            const validationResult = await AiService.validateInitiative({
                name: initiative.name,
                hypothesis: initiative.hypothesis,
                businessValue: initiative.business_value,
                costCapex: initiative.cost_capex,
                expectedRoi: initiative.expected_roi
            });
            res.json(validationResult);
        } catch (error) {
            console.error("Validation failed", error);
            res.status(500).json({ error: 'Validation failed' });
        }
    });
});

// ==========================================
// ENRICH INITIATIVE (Web Research)
// ==========================================
router.post('/:id/enrich', (req, res) => {
    const orgId = req.user.organizationId;
    const { id } = req.params;

    const sql = `SELECT * FROM initiatives WHERE id = ? AND organization_id = ? `;
    db.get(sql, [id, orgId], async (err, initiative) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!initiative) return res.status(404).json({ error: 'Initiative not found' });

        try {
            const marketContext = await AiService.enrichInitiative({
                name: initiative.name,
                axis: initiative.axis,
                area: initiative.area,
                summary: initiative.summary
            });

            // Update DB
            const updateSql = `UPDATE initiatives SET market_context = ? WHERE id = ? `;
            db.run(updateSql, [marketContext, id], (err) => {
                if (err) {
                    console.error("Failed to save enrichment", err);
                    return res.status(500).json({ error: "Failed to save data" });
                }
                res.json({ marketContext });
            });

        } catch (error) {
            console.error("Enrichment failed", error);
            res.status(500).json({ error: 'Enrichment failed' });
        }
    });
});

module.exports = router;

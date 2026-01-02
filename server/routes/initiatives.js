// AI Service - Using unified pipeline with fallback to legacy service
const { suggestTasks, validateInitiative, enrichInitiative } = require('../services/ai/aiPipeline');
// Legacy AiService kept for backward compatibility (deprecated)
const AiService = require('../services/aiService');
const AccessPolicyService = require('../services/accessPolicyService');
const InitiativeStatusService = require('../services/initiativeStatusService');
const StatusMachine = require('../services/statusMachine');
const NotificationService = require('../services/notificationService');
const DecisionTriggerService = require('../services/decisionTriggerService');
const express = require('express');
const router = express.Router();
const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const verifyToken = require('../middleware/authMiddleware');
const { asyncHandler } = require('../utils/errorHandler');
const queryHelpers = require('../utils/queryHelpers');

router.use(verifyToken);

// ==========================================
// SAFE JSON PARSING HELPER
// Prevents crashes when JSON fields contain invalid data
// ==========================================
const safeJsonParse = (str, defaultValue = []) => {
    if (!str || str === '' || str === 'null' || str === 'undefined') {
        return defaultValue;
    }
    try {
        const parsed = JSON.parse(str);
        return parsed || defaultValue;
    } catch (e) {
        console.warn('[initiatives] Failed to parse JSON:', str?.substring?.(0, 100));
        return defaultValue;
    }
};

// ==========================================
// GET INITIATIVES
// REFACTORED: Uses asyncHandler and queryHelpers
// ==========================================
router.get('/', asyncHandler(async (req, res) => {
    const orgId = req.user.organizationId;

    // Simplified SQL - sponsor_id doesn't exist in initiatives table
    const sql = `
        SELECT i.*, 
            ob.first_name as ob_first_name, ob.last_name as ob_last_name, ob.avatar_url as ob_avatar,
            oe.first_name as oe_first_name, oe.last_name as oe_last_name, oe.avatar_url as oe_avatar
        FROM initiatives i
        LEFT JOIN users ob ON i.owner_business_id = ob.id
        LEFT JOIN users oe ON i.owner_execution_id = oe.id
        WHERE i.organization_id = ?
        ORDER BY i.created_at DESC
    `;

    try {
        const rows = await queryHelpers.queryAll(sql, [orgId]);

        const initiatives = rows.map(i => ({
            id: i.id,
            organizationId: i.organization_id,
            projectId: i.project_id,
            name: i.title,
            axis: i.axis,
            area: i.area,
            summary: i.summary,
            hypothesis: i.hypothesis,
            status: i.status,
            progress: i.progress || 0,
            currentStage: i.current_stage,
            businessValue: i.business_value,
            costCapex: i.cost_capex,
            costOpex: i.cost_opex,
            expectedRoi: i.expected_roi,
            valueDriver: i.value_driver,
            confidenceLevel: i.confidence_level,
            valueTiming: i.value_timing,
            plannedStartDate: i.planned_start_date,
            plannedEndDate: i.planned_end_date,
            actualStartDate: i.actual_start_date,
            actualEndDate: i.actual_end_date,

            // Professional Card Fields (using safe JSON parsing)
            problemStatement: i.problem_statement,
            deliverables: safeJsonParse(i.deliverables, []),
            successCriteria: safeJsonParse(i.success_criteria, []),
            scopeIn: safeJsonParse(i.scope_in, []),
            scopeOut: safeJsonParse(i.scope_out, []),
            keyRisks: safeJsonParse(i.key_risks, []),

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

            createdAt: i.created_at,
            description: i.description
        }));

        res.json({ initiatives, total: initiatives.length });
    } catch (error) {
        // If table doesn't exist, return empty array
        if (error.message && error.message.includes('no such table')) {
            console.warn('[Initiatives API] initiatives table not found, returning empty list');
            return res.json({ initiatives: [], total: 0 });
        }
        res.status(500).json({ error: error.message });
    }
}));

// ==========================================
// GET SINGLE INITIATIVE (with full details)
// ==========================================
router.get('/:id', asyncHandler(async (req, res) => {
    const orgId = req.user.organizationId;
    const { id } = req.params;

    const sql = `
        SELECT i.*, 
            ob.first_name as ob_first_name, ob.last_name as ob_last_name, ob.email as ob_email, ob.avatar_url as ob_avatar,
            oe.first_name as oe_first_name, oe.last_name as oe_last_name, oe.email as oe_email, oe.avatar_url as oe_avatar,
            a.name as assessment_name
        FROM initiatives i
        LEFT JOIN users ob ON i.owner_business_id = ob.id
        LEFT JOIN users oe ON i.owner_execution_id = oe.id
        LEFT JOIN assessments a ON i.source_assessment_id = a.id
        WHERE i.id = ? AND i.organization_id = ?
    `;

    try {
        const i = await queryHelpers.queryOne(sql, [id, orgId]);
        if (!i) {
            return res.status(404).json({ error: 'Initiative not found' });
        }

        // Get task count for this initiative
        let taskCount = 0;
        try {
            const taskResult = await queryHelpers.queryOne(
                `SELECT COUNT(*) as count FROM tasks WHERE initiative_id = ?`,
                [id]
            );
            taskCount = taskResult?.count || 0;
        } catch (e) {
            // Tasks table might not exist
        }

        // Return structured object with all details
        const initiative = {
            id: i.id,
            organizationId: i.organization_id,
            projectId: i.project_id,
            name: i.title,
            axis: i.axis,
            area: i.area,
            summary: i.summary,
            description: i.description,
            hypothesis: i.hypothesis,
            status: i.status,
            progress: i.progress || 0,
            currentStage: i.current_stage,

            // Financial metrics
            businessValue: i.business_value,
            costCapex: i.cost_capex,
            costOpex: i.cost_opex,
            expectedRoi: i.expected_roi,
            valueDriver: i.value_driver,
            confidenceLevel: i.confidence_level,
            valueTiming: i.value_timing,

            // Dates
            plannedStartDate: i.planned_start_date || i.start_date,
            plannedEndDate: i.planned_end_date || i.end_date,
            actualStartDate: i.actual_start_date,
            actualEndDate: i.actual_end_date,
            pilotEndDate: i.pilot_end_date,

            // Professional Card Fields (using safe JSON parsing to prevent crashes)
            problemStatement: i.problem_statement,
            deliverables: safeJsonParse(i.deliverables, []),
            successCriteria: safeJsonParse(i.success_criteria, []),
            scopeIn: safeJsonParse(i.scope_in, []),
            scopeOut: safeJsonParse(i.scope_out, []),
            keyRisks: safeJsonParse(i.key_risks, []),
            competenciesRequired: safeJsonParse(i.competencies_required, []),

            // Market context
            marketContext: i.market_context,
            socialImpact: i.social_impact,

            // Owners
            ownerBusiness: i.owner_business_id ? {
                id: i.owner_business_id,
                firstName: i.ob_first_name,
                lastName: i.ob_last_name,
                email: i.ob_email,
                avatarUrl: i.ob_avatar
            } : null,
            ownerExecution: i.owner_execution_id ? {
                id: i.owner_execution_id,
                firstName: i.oe_first_name,
                lastName: i.oe_last_name,
                email: i.oe_email,
                avatarUrl: i.oe_avatar
            } : null,

            // Source
            sourceAssessmentId: i.source_assessment_id,
            assessmentName: i.assessment_name,
            createdFrom: i.created_from,

            // Stats
            taskCount,

            createdAt: i.created_at,
            updatedAt: i.updated_at
        };

        res.json(initiative);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}));

// ==========================================
// CREATE INITIATIVE
// REFACTORED: Uses asyncHandler and queryHelpers
// ==========================================
router.post('/', asyncHandler(async (req, res) => {
    const orgId = req.user.organizationId;
    const {
        name, axis, area, summary, hypothesis,
        businessValue, competenciesRequired,
        costCapex, costOpex, expectedRoi, socialImpact,
        valueDriver, confidenceLevel, valueTiming,
        ownerBusinessId, ownerExecutionId, sponsorId,

        startDate, pilotEndDate, endDate,
        // New Fields
        problemStatement, deliverables, successCriteria, scopeIn, scopeOut, keyRisks,
        // Phase E->F Linkage (Fix Pack 1)
        createdFrom, createdFromPlanId
    } = req.body;

    if (!name) return res.status(400).json({ error: 'Name is required' });

    // Validate createdFromPlanId length (optional but recommended)
    if (createdFromPlanId && String(createdFromPlanId).length > 100) {
        return res.status(400).json({ error: 'createdFromPlanId too long' });
    }

    // CHECK ACCESS POLICY
    const accessCheck = await AccessPolicyService.checkAccess(orgId, 'create_initiative');
    if (!accessCheck.allowed) {
        return res.status(403).json({ error: accessCheck.reason, errorCode: accessCheck.errorCode });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    const sql = `
        INSERT INTO initiatives (
            id, organization_id, title, axis, area, summary, hypothesis,
            business_value, competencies_required,
            cost_capex, cost_opex, expected_roi, social_impact,
            value_driver, confidence_level, value_timing,
            owner_business_id, owner_execution_id, sponsor_id,
            start_date, pilot_end_date, end_date,
            problem_statement, deliverables, success_criteria, scope_in, scope_out, key_risks,
            created_from, created_from_plan_id,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
        id,
        orgId,
        name,
        axis ?? null,
        area ?? null,
        summary ?? null,
        hypothesis ?? null,
        businessValue ?? null,
        JSON.stringify(competenciesRequired || []),
        costCapex ?? null,
        costOpex ?? null,
        expectedRoi ?? null,
        socialImpact ?? null,
        valueDriver ?? null,
        confidenceLevel ?? null,
        valueTiming ?? null,
        ownerBusinessId ?? null,
        ownerExecutionId ?? null,
        sponsorId ?? null,
        startDate ?? null,
        pilotEndDate ?? null,
        endDate ?? null,
        problemStatement ?? null,
        JSON.stringify(deliverables || []),
        JSON.stringify(successCriteria || []),
        JSON.stringify(scopeIn || []),
        JSON.stringify(scopeOut || []),
        JSON.stringify(keyRisks || []),
        createdFrom ?? 'MANUAL',
        createdFromPlanId ?? null,
        now,
        now
    ];

    await queryHelpers.queryRun(sql, params);

    // Track Usage (fire and forget)
    AccessPolicyService.incrementUsage(orgId, 'initiatives').catch(console.error);

    res.json({ id, name, message: 'Initiative created' });
}));


// ==========================================
// UPDATE INITIATIVE
// ==========================================
// ==========================================

// ... (existing helper setup if any, but currently none needed)

// ==========================================
// UPDATE INITIATIVE
// REFACTORED: Uses asyncHandler and queryHelpers
// ==========================================
router.put('/:id', asyncHandler(async (req, res) => {
    const orgId = req.user.organizationId;
    const { id } = req.params;
    const body = req.body;

    const allowedFields = [
        'name', 'axis', 'area', 'summary', 'hypothesis',
        'status', 'current_stage', 'business_value', 'competencies_required',
        'cost_capex', 'cost_opex', 'expected_roi', 'social_impact',
        'value_driver', 'confidence_level', 'value_timing',
        'start_date', 'pilot_end_date', 'end_date',
        'owner_business_id', 'owner_execution_id', 'sponsor_id',
        'market_context',
        'problem_statement', 'deliverables', 'success_criteria', 'scope_in', 'scope_out', 'key_risks',
        // Task 8
        'strategic_fit', 'attachments', 'change_log', 'target_state', 'decision_readiness_breakdown',
        'applicant_one_liner', 'strategic_intent', 'decision_to_make', 'decision_owner_id'
    ];

    const updates = [];
    const params = [];

    allowedFields.forEach(field => {
        // camelCase check for body keys
        const bodyKey = field.replace(/_([a-z])/g, (g) => g[1].toUpperCase());

        // Map 'name' in body to 'title' in DB
        let dbField = field;
        if (field === 'name') dbField = 'title';

        if (body[bodyKey] !== undefined) {
            // Handle JSON fields
            if (['competencies_required', 'deliverables', 'success_criteria', 'scope_in', 'scope_out', 'key_risks',
                'strategic_fit', 'attachments', 'change_log', 'target_state', 'decision_readiness_breakdown'].includes(field)) {
                updates.push(`${dbField} = ?`);
                params.push(JSON.stringify(body[bodyKey]));
            } else {
                updates.push(`${dbField} = ?`);
                params.push(body[bodyKey]);
            }
        }
    });

    updates.push(`updated_at = ?`);
    params.push(new Date().toISOString());

    if (updates.length === 0) return res.json({ message: 'No changes' });

    params.push(id);
    params.push(orgId);

    const sql = `UPDATE initiatives SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`;

    await queryHelpers.queryRun(sql, params);

    // Update charter completeness after any update
    await InitiativeStatusService.updateCompleteness(id, orgId);

    res.json({ message: 'Initiative updated' });
}));

// ==========================================
// STATUS TRANSITION (PATCH /api/initiatives/:id/status)
// Core endpoint for initiative lifecycle management
// ==========================================
router.patch('/:id/status', asyncHandler(async (req, res) => {
    const orgId = req.user.organizationId;
    const userId = req.user.id;
    const { id } = req.params;
    const { status: newStatus, reason, comment } = req.body;

    if (!newStatus) {
        return res.status(400).json({ error: 'New status is required' });
    }

    // Validate that newStatus is a valid initiative status
    if (!Object.values(StatusMachine.INITIATIVE_STATUSES).includes(newStatus)) {
        return res.status(400).json({
            error: 'Invalid status',
            validStatuses: Object.values(StatusMachine.INITIATIVE_STATUSES)
        });
    }

    // Perform transition with validation
    const result = await InitiativeStatusService.transitionStatus(
        id,
        orgId,
        userId,
        newStatus,
        { reason, comment }
    );

    if (!result.success) {
        return res.status(400).json({ error: result.error });
    }

    // Send notification for module transitions
    if (result.initiative.moduleTransition?.crossesModule) {
        try {
            await NotificationService.createNotification({
                type: 'INITIATIVE_STATUS_CHANGE',
                title: `Initiative moved to ${result.initiative.moduleTransition.toModule}`,
                message: `Initiative status changed from ${result.initiative.previousStatus} to ${result.initiative.status}`,
                initiativeId: id,
                organizationId: orgId,
                createdBy: userId
            });
        } catch (e) {
            console.warn('[Initiatives] Failed to send notification:', e.message);
        }
    }

    // Trigger decision creation for key transitions
    const previousStatus = result.initiative.previousStatus;
    try {
        const initiativeData = {
            id,
            project_id: result.initiative.projectId,
            name: result.initiative.name,
            priority: result.initiative.priority
        };

        const decision = await DecisionTriggerService.onInitiativeStatusChange(
            initiativeData,
            previousStatus,
            newStatus,
            userId
        );

        if (decision) {
            console.log(`[Initiatives] Auto-created decision: ${decision.id} for initiative ${id}`);
        }
    } catch (triggerErr) {
        console.warn('[Initiatives] Failed to trigger decision:', triggerErr.message);
        // Don't fail the status change if decision trigger fails
    }

    res.json({
        success: true,
        message: `Status changed to ${newStatus}`,
        initiative: result.initiative
    });
}));

// ==========================================
// GET ALLOWED TRANSITIONS
// Returns valid next statuses for current initiative
// ==========================================
router.get('/:id/transitions', asyncHandler(async (req, res) => {
    const orgId = req.user.organizationId;
    const { id } = req.params;

    // Get initiative with context
    const initiative = await InitiativeStatusService.getInitiativeWithContext(id, orgId);

    if (!initiative) {
        return res.status(404).json({ error: 'Initiative not found' });
    }

    const currentStatus = initiative.status || 'DRAFT';
    const allowedTransitions = InitiativeStatusService.getAllowedTransitions(currentStatus);

    res.json({
        currentStatus,
        currentModule: StatusMachine.getInitiativeModule(currentStatus),
        charterCompleteness: initiative.charterCompleteness,
        taskStats: initiative.taskStats,
        allowedTransitions
    });
}));

// ==========================================
// GET STATUS HISTORY
// Returns audit trail of status changes
// ==========================================
router.get('/:id/status-history', asyncHandler(async (req, res) => {
    const orgId = req.user.organizationId;
    const { id } = req.params;

    // Verify access
    const initiative = await queryHelpers.queryOne(
        `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
        [id, orgId]
    );

    if (!initiative) {
        return res.status(404).json({ error: 'Initiative not found' });
    }

    const history = await InitiativeStatusService.getStatusHistory(id);
    res.json({ history });
}));

// ==========================================
// GET INITIATIVES BY STATUS (filtered view)
// Supports module-based filtering
// ==========================================
router.get('/by-status/:status', asyncHandler(async (req, res) => {
    const orgId = req.user.organizationId;
    const { status } = req.params;
    const { projectId, locationId } = req.query;

    let sql = `
        SELECT i.*, 
            ob.first_name as ob_first_name, ob.last_name as ob_last_name, ob.avatar_url as ob_avatar,
            oe.first_name as oe_first_name, oe.last_name as oe_last_name, oe.avatar_url as oe_avatar,
            p.name as project_name,
            l.name as location_name
        FROM initiatives i
        LEFT JOIN users ob ON i.owner_business_id = ob.id
        LEFT JOIN users oe ON i.owner_execution_id = oe.id
        LEFT JOIN projects p ON i.project_id = p.id
        LEFT JOIN locations l ON i.location_id = l.id
        WHERE i.organization_id = ?
    `;

    const params = [orgId];

    // Handle multiple statuses (comma-separated)
    const statuses = status.split(',').map(s => s.trim().toUpperCase());
    sql += ` AND i.status IN (${statuses.map(() => '?').join(',')})`;
    params.push(...statuses);

    if (projectId) {
        sql += ` AND i.project_id = ?`;
        params.push(projectId);
    }

    if (locationId) {
        sql += ` AND i.location_id = ?`;
        params.push(locationId);
    }

    sql += ` ORDER BY i.updated_at DESC`;

    try {
        const rows = await queryHelpers.queryAll(sql, params);

        const initiatives = rows.map(i => ({
            id: i.id,
            organizationId: i.organization_id,
            projectId: i.project_id,
            projectName: i.project_name,
            locationId: i.location_id,
            locationName: i.location_name,
            name: i.title,
            axis: i.axis,
            area: i.area,
            summary: i.summary,
            status: i.status,
            progress: i.progress || 0,
            charterCompleteness: i.charter_completeness || 0,
            businessValue: i.business_value,
            costCapex: i.cost_capex,
            costOpex: i.cost_opex,
            expectedRoi: i.expected_roi,
            plannedStartDate: i.planned_start_date,
            plannedEndDate: i.planned_end_date,
            targetQuarter: i.target_quarter,
            blockedReason: i.blocked_reason,
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
            createdAt: i.created_at,
            updatedAt: i.updated_at
        }));

        res.json({ initiatives, total: initiatives.length });
    } catch (error) {
        if (error.message?.includes('no such table')) {
            return res.json({ initiatives: [], total: 0 });
        }
        throw error;
    }
}));

// ==========================================
// TRANSFER TO ROADMAP
// ==========================================
router.post('/:id/transfer-to-roadmap', asyncHandler(async (req, res) => {
    const orgId = req.user.organizationId;
    const { id } = req.params;
    const { quarter, priority, notes } = req.body;

    if (!quarter) {
        return res.status(400).json({ error: 'Quarter is required' });
    }

    // Check if initiative exists and is approved
    const checkSql = `SELECT * FROM initiatives WHERE id = ? AND organization_id = ?`;
    const initiative = await queryHelpers.queryOne(checkSql, [id, orgId]);

    if (!initiative) {
        return res.status(404).json({ error: 'Initiative not found' });
    }

    if (initiative.status !== 'APPROVED') {
        return res.status(400).json({ error: 'Only approved initiatives can be transferred to roadmap' });
    }

    // Parse quarter to get start date
    const [year, q] = quarter.split('-Q');
    const quarterStartMonth = (parseInt(q) - 1) * 3;
    const plannedStartDate = new Date(parseInt(year), quarterStartMonth, 1).toISOString();
    const plannedEndDate = new Date(parseInt(year), quarterStartMonth + 3, 0).toISOString();

    const now = new Date().toISOString();

    const updateSql = `
        UPDATE initiatives SET 
            status = 'PLANNED',
            priority = ?,
            roadmap_notes = ?,
            planned_start_date = ?,
            planned_end_date = ?,
            target_quarter = ?,
            updated_at = ?
        WHERE id = ? AND organization_id = ?
    `;

    await queryHelpers.queryRun(updateSql, [
        priority || 'MEDIUM',
        notes || null,
        plannedStartDate,
        plannedEndDate,
        quarter,
        now,
        id,
        orgId
    ]);

    res.json({
        success: true,
        message: 'Initiative transferred to roadmap',
        id,
        status: 'PLANNED',
        quarter,
        plannedStartDate,
        plannedEndDate
    });
}));

// ==========================================
// SUGGEST TASKS (AI)
// REFACTORED: Uses asyncHandler and queryHelpers
// ==========================================
router.post('/:id/tasks/suggest', asyncHandler(async (req, res) => {
    const orgId = req.user.organizationId;
    const { id } = req.params;

    // 1. Get Initiative
    const sql = `SELECT * FROM initiatives WHERE id = ? AND organization_id = ?`;
    const initiative = await queryHelpers.queryOne(sql, [id, orgId]);

    if (!initiative) {
        return res.status(404).json({ error: 'Initiative not found' });
    }

    try {
        // 2. Call AI Pipeline (unified pipeline with enterprise features)
        // Uses capability-based routing with automatic fallback
        const tasks = await suggestTasks({
            name: initiative.name,
            summary: initiative.summary,
            hypothesis: initiative.hypothesis,
            axis: initiative.axis
        }, req.user.id, orgId);

        res.json(tasks);
    } catch (aiError) {
        console.error("AI Error:", aiError);
        res.status(500).json({ error: 'Failed to generate suggestions' });
    }
}));


// ==========================================
// VALIDATE INITIATIVE (AI)
// REFACTORED: Uses asyncHandler and queryHelpers
// ==========================================
router.post('/:id/validate', asyncHandler(async (req, res) => {
    const orgId = req.user.organizationId;
    const { id } = req.params;

    const sql = `SELECT * FROM initiatives WHERE id = ? AND organization_id = ?`;
    const initiative = await queryHelpers.queryOne(sql, [id, orgId]);

    if (!initiative) {
        return res.status(404).json({ error: 'Initiative not found' });
    }

    try {
        // Use unified AI pipeline with quality validation
        const validationResult = await validateInitiative({
            name: initiative.name,
            hypothesis: initiative.hypothesis,
            businessValue: initiative.business_value,
            costCapex: initiative.cost_capex,
            expectedRoi: initiative.expected_roi
        }, req.user.id, orgId);
        res.json(validationResult);
    } catch (error) {
        console.error("Validation failed", error);
        res.status(500).json({ error: 'Validation failed' });
    }
}));

// ==========================================
// ENRICH INITIATIVE (Web Research)
// REFACTORED: Uses asyncHandler and queryHelpers
// ==========================================
router.post('/:id/enrich', asyncHandler(async (req, res) => {
    const orgId = req.user.organizationId;
    const { id } = req.params;

    const sql = `SELECT * FROM initiatives WHERE id = ? AND organization_id = ?`;
    const initiative = await queryHelpers.queryOne(sql, [id, orgId]);

    if (!initiative) {
        return res.status(404).json({ error: 'Initiative not found' });
    }

    try {
        // Use unified AI pipeline with web research integration
        const marketContext = await enrichInitiative({
            name: initiative.name,
            axis: initiative.axis,
            area: initiative.area,
            summary: initiative.summary
        }, req.user.id, orgId);

        // Update DB
        const updateSql = `UPDATE initiatives SET market_context = ? WHERE id = ?`;
        await queryHelpers.queryRun(updateSql, [JSON.stringify(marketContext), id]);

        res.json({ marketContext });
    } catch (error) {
        console.error("Enrichment failed", error);
        res.status(500).json({ error: 'Enrichment failed' });
    }
}));

// ==========================================
// KPI MANAGEMENT
// For Benefits Tracking module
// ==========================================

// GET KPIs for initiative
router.get('/:id/kpis', asyncHandler(async (req, res) => {
    const orgId = req.user.organizationId;
    const { id } = req.params;

    // Verify initiative access
    const initiative = await queryHelpers.queryOne(
        `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
        [id, orgId]
    );

    if (!initiative) {
        return res.status(404).json({ error: 'Initiative not found' });
    }

    try {
        const kpis = await queryHelpers.queryAll(`
            SELECT k.*, 
                (SELECT value FROM kpi_measurements WHERE kpi_id = k.id ORDER BY measured_at DESC LIMIT 1) as latest_value,
                (SELECT measured_at FROM kpi_measurements WHERE kpi_id = k.id ORDER BY measured_at DESC LIMIT 1) as latest_measurement_date
            FROM initiative_kpis k
            WHERE k.initiative_id = ?
            ORDER BY k.is_primary DESC, k.sort_order ASC
        `, [id]);

        res.json({
            kpis: kpis.map(k => ({
                id: k.id,
                name: k.name,
                description: k.description,
                targetValue: k.target_value,
                unit: k.unit,
                measurementFrequency: k.measurement_frequency,
                alertThreshold: k.alert_threshold,
                alertDirection: k.alert_direction,
                isPrimary: !!k.is_primary,
                sortOrder: k.sort_order,
                latestValue: k.latest_value,
                latestMeasurementDate: k.latest_measurement_date,
                isOnTarget: k.alert_direction === 'BELOW'
                    ? (k.latest_value || 0) >= (k.alert_threshold || 0)
                    : (k.latest_value || 0) <= (k.alert_threshold || 0),
                createdAt: k.created_at
            }))
        });
    } catch (error) {
        if (error.message?.includes('no such table')) {
            return res.json({ kpis: [] });
        }
        throw error;
    }
}));

// CREATE KPI for initiative
router.post('/:id/kpis', asyncHandler(async (req, res) => {
    const orgId = req.user.organizationId;
    const { id } = req.params;
    const {
        name, description, targetValue, unit,
        measurementFrequency, alertThreshold, alertDirection, isPrimary
    } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'KPI name is required' });
    }

    // Verify initiative access
    const initiative = await queryHelpers.queryOne(
        `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
        [id, orgId]
    );

    if (!initiative) {
        return res.status(404).json({ error: 'Initiative not found' });
    }

    const kpiId = uuidv4();
    const now = new Date().toISOString();

    // Get next sort order
    const lastKpi = await queryHelpers.queryOne(
        `SELECT MAX(sort_order) as max_order FROM initiative_kpis WHERE initiative_id = ?`,
        [id]
    );
    const sortOrder = (lastKpi?.max_order || 0) + 1;

    await queryHelpers.queryRun(`
        INSERT INTO initiative_kpis 
        (id, initiative_id, name, description, target_value, unit, measurement_frequency, 
         alert_threshold, alert_direction, is_primary, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        kpiId, id, name, description || null, targetValue || null, unit || null,
        measurementFrequency || 'MONTHLY', alertThreshold || null,
        alertDirection || 'BELOW', isPrimary ? 1 : 0, sortOrder, now, now
    ]);

    res.json({
        id: kpiId,
        name,
        message: 'KPI created successfully'
    });
}));

// UPDATE KPI
router.put('/:id/kpis/:kpiId', asyncHandler(async (req, res) => {
    const orgId = req.user.organizationId;
    const { id, kpiId } = req.params;
    const body = req.body;

    // Verify access
    const initiative = await queryHelpers.queryOne(
        `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
        [id, orgId]
    );

    if (!initiative) {
        return res.status(404).json({ error: 'Initiative not found' });
    }

    const updates = [];
    const params = [];

    const allowedFields = [
        'name', 'description', 'target_value', 'unit',
        'measurement_frequency', 'alert_threshold', 'alert_direction', 'is_primary', 'sort_order'
    ];

    allowedFields.forEach(field => {
        const bodyKey = field.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
        if (body[bodyKey] !== undefined) {
            updates.push(`${field} = ?`);
            params.push(field === 'is_primary' ? (body[bodyKey] ? 1 : 0) : body[bodyKey]);
        }
    });

    if (updates.length === 0) {
        return res.json({ message: 'No changes' });
    }

    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(kpiId);
    params.push(id);

    await queryHelpers.queryRun(
        `UPDATE initiative_kpis SET ${updates.join(', ')} WHERE id = ? AND initiative_id = ?`,
        params
    );

    res.json({ message: 'KPI updated' });
}));

// DELETE KPI
router.delete('/:id/kpis/:kpiId', asyncHandler(async (req, res) => {
    const orgId = req.user.organizationId;
    const { id, kpiId } = req.params;

    // Verify access
    const initiative = await queryHelpers.queryOne(
        `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
        [id, orgId]
    );

    if (!initiative) {
        return res.status(404).json({ error: 'Initiative not found' });
    }

    await queryHelpers.queryRun(
        `DELETE FROM initiative_kpis WHERE id = ? AND initiative_id = ?`,
        [kpiId, id]
    );

    res.json({ message: 'KPI deleted' });
}));

// ADD KPI MEASUREMENT
router.post('/:id/kpis/:kpiId/measurements', asyncHandler(async (req, res) => {
    const orgId = req.user.organizationId;
    const userId = req.user.id;
    const { id, kpiId } = req.params;
    const { value, measuredAt, notes, explanation, actionItems } = req.body;

    if (value === undefined || value === null) {
        return res.status(400).json({ error: 'Value is required' });
    }

    // Verify access
    const initiative = await queryHelpers.queryOne(
        `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
        [id, orgId]
    );

    if (!initiative) {
        return res.status(404).json({ error: 'Initiative not found' });
    }

    // Verify KPI exists
    const kpi = await queryHelpers.queryOne(
        `SELECT id FROM initiative_kpis WHERE id = ? AND initiative_id = ?`,
        [kpiId, id]
    );

    if (!kpi) {
        return res.status(404).json({ error: 'KPI not found' });
    }

    const measurementId = uuidv4();
    const now = new Date().toISOString();

    await queryHelpers.queryRun(`
        INSERT INTO kpi_measurements 
        (id, kpi_id, value, measured_at, notes, explanation, action_items, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        measurementId, kpiId, value,
        measuredAt || now, notes || null, explanation || null,
        actionItems ? JSON.stringify(actionItems) : null,
        userId, now
    ]);

    res.json({
        id: measurementId,
        message: 'Measurement recorded'
    });
}));

// GET KPI MEASUREMENTS (history)
router.get('/:id/kpis/:kpiId/measurements', asyncHandler(async (req, res) => {
    const orgId = req.user.organizationId;
    const { id, kpiId } = req.params;
    const { limit = 50 } = req.query;

    // Verify access
    const initiative = await queryHelpers.queryOne(
        `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
        [id, orgId]
    );

    if (!initiative) {
        return res.status(404).json({ error: 'Initiative not found' });
    }

    const measurements = await queryHelpers.queryAll(`
        SELECT m.*, u.first_name, u.last_name
        FROM kpi_measurements m
        LEFT JOIN users u ON m.created_by = u.id
        WHERE m.kpi_id = ?
        ORDER BY m.measured_at DESC
        LIMIT ?
    `, [kpiId, parseInt(limit)]);

    res.json({
        measurements: measurements.map(m => ({
            id: m.id,
            value: m.value,
            measuredAt: m.measured_at,
            notes: m.notes,
            explanation: m.explanation,
            actionItems: m.action_items ? safeJsonParse(m.action_items, []) : [],
            createdBy: m.created_by ? {
                id: m.created_by,
                firstName: m.first_name,
                lastName: m.last_name
            } : null,
            createdAt: m.created_at
        }))
    });
}));

// ==========================================
// PORTFOLIO VIEW ENDPOINTS
// ==========================================

const PortfolioService = require('../services/portfolioService');

/**
 * GET /api/initiatives/portfolio
 * Get aggregated portfolio data with roadmap information
 */
router.get('/portfolio', asyncHandler(async (req, res) => {
    const orgId = req.user.organizationId;
    const { projectId, status, priority, owner, quarter, search } = req.query;

    const filters = {
        projectId,
        status: status ? (Array.isArray(status) ? status : [status]) : undefined,
        priority: priority ? (Array.isArray(priority) ? priority : [priority]) : undefined,
        owner,
        quarter,
        search
    };

    const [initiatives, stats] = await Promise.all([
        PortfolioService.getPortfolioData(orgId, filters),
        PortfolioService.getPortfolioStats(orgId, projectId)
    ]);

    res.json({
        initiatives,
        stats
    });
}));

/**
 * GET /api/initiatives/portfolio/stats
 * Get portfolio statistics only
 */
router.get('/portfolio/stats', asyncHandler(async (req, res) => {
    const orgId = req.user.organizationId;
    const { projectId } = req.query;

    const stats = await PortfolioService.getPortfolioStats(orgId, projectId);
    res.json(stats);
}));

/**
 * GET /api/initiatives/portfolio/dependencies
 * Get initiative dependencies for timeline view
 */
router.get('/portfolio/dependencies', asyncHandler(async (req, res) => {
    const orgId = req.user.organizationId;
    const { projectId } = req.query;

    const dependencies = await PortfolioService.getInitiativeDependencies(orgId, projectId);
    res.json({ dependencies });
}));

/**
 * GET /api/initiatives/portfolio/waves/:projectId
 * Get roadmap waves for a project
 */
router.get('/portfolio/waves/:projectId', asyncHandler(async (req, res) => {
    const waves = await PortfolioService.getRoadmapWaves(req.params.projectId);
    res.json({ waves });
}));

/**
 * PATCH /api/initiatives/:id/quick-update
 * Quick inline update for portfolio view
 */
router.patch('/:id/quick-update', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const userId = req.user.id;

    await PortfolioService.quickUpdate(id, updates, userId);
    res.json({ success: true });
}));

/**
 * POST /api/initiatives/bulk-status
 * Bulk status update for multiple initiatives
 */
router.post('/bulk-status', asyncHandler(async (req, res) => {
    const { initiativeIds, status, reason } = req.body;
    const userId = req.user.id;

    if (!initiativeIds || !Array.isArray(initiativeIds) || initiativeIds.length === 0) {
        return res.status(400).json({ error: 'Initiative IDs required' });
    }

    if (!status) {
        return res.status(400).json({ error: 'Status required' });
    }

    const result = await PortfolioService.bulkUpdateStatus(initiativeIds, status, reason, userId);
    res.json(result);
}));

/**
 * POST /api/initiatives/reorder
 * Reorder initiatives (for drag-drop in timeline)
 */
router.post('/reorder', asyncHandler(async (req, res) => {
    const { initiativeIds } = req.body;

    if (!initiativeIds || !Array.isArray(initiativeIds)) {
        return res.status(400).json({ error: 'Initiative IDs array required' });
    }

    const result = await PortfolioService.reorderInitiatives(initiativeIds, initiativeIds);
    res.json(result);
}));

module.exports = router;

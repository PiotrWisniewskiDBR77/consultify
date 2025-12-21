const express = require('express');
const router = express.Router();
const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const verifyToken = require('../middleware/authMiddleware');
const { asyncHandler } = require('../utils/errorHandler');
const queryHelpers = require('../utils/queryHelpers');

router.use(verifyToken);

// GET Projects (Scoped to Organization)
// REFACTORED: Uses asyncHandler and queryHelpers
router.get('/', asyncHandler(async (req, res) => {
    const orgId = req.user.organizationId;

    // Optional: Filter by user assignment? For now, allow all users in org to see projects.
    const sql = `
        SELECT p.*, u.first_name as owner_first_name, u.last_name as owner_last_name 
        FROM projects p
        LEFT JOIN users u ON p.owner_id = u.id
        WHERE p.organization_id = ?
        ORDER BY p.created_at DESC
    `;

    const rows = await queryHelpers.queryAll(sql, [orgId]);
    res.json(rows);
}));

const { checkPlanLimit } = require('../middleware/planLimits');

// CREATE Project
// REFACTORED: Uses asyncHandler and queryHelpers
router.post('/', checkPlanLimit('max_projects'), asyncHandler(async (req, res) => {
    const orgId = req.user.organizationId;
    const { name, ownerId } = req.body;

    if (!name) return res.status(400).json({ error: 'Project name is required' });

    const id = uuidv4();
    const owner = ownerId || req.user.id; // Default to creator if not specified

    const sql = `INSERT INTO projects (id, organization_id, name, status, owner_id) VALUES (?, ?, ?, ?, ?)`;

    await queryHelpers.queryRun(sql, [id, orgId, name, 'active', owner]);
    res.json({ id, name, status: 'active', ownerId: owner });
}));

// DELETE Project
// REFACTORED: Uses asyncHandler and queryHelpers
router.delete('/:id', asyncHandler(async (req, res) => {
    const orgId = req.user.organizationId;
    const { id } = req.params;

    // Ensure deleting only own org's project
    const sql = `DELETE FROM projects WHERE id = ? AND organization_id = ?`;

    const result = await queryHelpers.queryRun(sql, [id, orgId]);
    if (result.changes === 0) {
        return res.status(404).json({ error: 'Project not found or access denied' });
    }
    res.json({ message: 'Project deleted' });
}));

// ==========================================
// MED-04b: Project Notification Settings API
// ==========================================

// GET Notification Settings for Project
// REFACTORED: Uses asyncHandler and queryHelpers
router.get('/:id/notification-settings', asyncHandler(async (req, res) => {
    const { id } = req.params;

    const row = await queryHelpers.queryOne(`SELECT * FROM project_notification_settings WHERE project_id = ?`, [id]);

    // Return default settings if none exist
    if (!row) {
        return res.json({
            project_id: id,
            task_overdue_enabled: true,
            task_due_today_enabled: true,
            blocker_detected_enabled: true,
            gate_ready_enabled: true,
            decision_required_enabled: true,
            escalation_enabled: true,
            escalation_days: 3,
            email_notifications: false,
            in_app_notifications: true
        });
    }

    res.json(row);
}));

// PUT (Upsert) Notification Settings for Project
// REFACTORED: Uses asyncHandler and queryHelpers
router.put('/:id/notification-settings', asyncHandler(async (req, res) => {
    const { id: projectId } = req.params;
    const {
        task_overdue_enabled = 1,
        task_due_today_enabled = 1,
        blocker_detected_enabled = 1,
        gate_ready_enabled = 1,
        decision_required_enabled = 1,
        escalation_enabled = 1,
        escalation_days = 3,
        email_notifications = 0,
        in_app_notifications = 1
    } = req.body;

    const settingsId = uuidv4();

    // Upsert using REPLACE
    const sql = `
        INSERT OR REPLACE INTO project_notification_settings 
        (id, project_id, task_overdue_enabled, task_due_today_enabled, blocker_detected_enabled,
         gate_ready_enabled, decision_required_enabled, escalation_enabled, escalation_days,
         email_notifications, in_app_notifications, updated_at)
        VALUES (
            COALESCE((SELECT id FROM project_notification_settings WHERE project_id = ?), ?),
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
        )
    `;

    await queryHelpers.queryRun(sql, [
        projectId, settingsId, projectId,
        task_overdue_enabled ? 1 : 0,
        task_due_today_enabled ? 1 : 0,
        blocker_detected_enabled ? 1 : 0,
        gate_ready_enabled ? 1 : 0,
        decision_required_enabled ? 1 : 0,
        escalation_enabled ? 1 : 0,
        escalation_days,
        email_notifications ? 1 : 0,
        in_app_notifications ? 1 : 0
    ]);
    
    res.json({ success: true, message: 'Notification settings saved' });
}));

// ==========================================
// AI Roles Model: Project AI Governance API
// ==========================================

const AIRoleGuard = require('../services/aiRoleGuard');
const AIAuditLogger = require('../services/aiAuditLogger');

// GET AI Role for a project
// REFACTORED: Uses asyncHandler
router.get('/:id/ai-role', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const roleConfig = await AIRoleGuard.getRoleConfig(id);

    res.json({
        projectId: id,
        aiRole: roleConfig.activeRole,
        capabilities: roleConfig.capabilities,
        description: roleConfig.roleDescription,
        roleHierarchy: roleConfig.roleHierarchy
    });
}));

// PUT (Update) AI Role for a project - Admin only
// REFACTORED: Uses asyncHandler
router.put('/:id/ai-role', asyncHandler(async (req, res) => {
    const { id: projectId } = req.params;
    const { aiRole, justification } = req.body;
    const userId = req.user.id;
    const orgId = req.user.organizationId;

    // Validate role
    const validRoles = ['ADVISOR', 'MANAGER', 'OPERATOR'];
    if (!validRoles.includes(aiRole)) {
        return res.status(400).json({
            error: `Invalid AI role: ${aiRole}. Must be one of: ${validRoles.join(', ')}`
        });
    }

    // Check admin permission (basic check - should be enhanced with proper RBAC)
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN') {
        return res.status(403).json({
            error: 'Only admins can change project AI role'
        });
    }

    // Get current role for audit
    const currentRole = await AIRoleGuard.getProjectRole(projectId);

    // Update the role
    await AIRoleGuard.setProjectRole(projectId, aiRole, userId);

    // Audit the change
    await AIAuditLogger.logInteraction({
        userId,
        organizationId: orgId,
        projectId,
        actionType: 'AI_ROLE_CHANGE',
        actionDescription: `AI role changed from ${currentRole} to ${aiRole}`,
        aiRole: 'SYSTEM',
        policyLevel: 'ADMIN',
        aiProjectRole: aiRole,
        justification: justification || 'Admin action'
    });

    // Get updated config
    const roleConfig = await AIRoleGuard.getRoleConfig(projectId);

    res.json({
        success: true,
        projectId,
        previousRole: currentRole,
        newRole: aiRole,
        capabilities: roleConfig.capabilities,
        description: roleConfig.roleDescription
    });
}));

// ==========================================
// Regulatory Mode: Strict Compliance API
// ==========================================

const RegulatoryModeGuard = require('../services/regulatoryModeGuard');

// GET Regulatory Mode status for a project
// REFACTORED: Uses asyncHandler
router.get('/:id/regulatory-mode', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const status = await RegulatoryModeGuard.getStatus(id);

    res.json({
        projectId: id,
        ...status
    });
}));

// PUT (Update) Regulatory Mode for a project - Admin only
// REFACTORED: Uses asyncHandler
router.put('/:id/regulatory-mode', asyncHandler(async (req, res) => {
    const { id: projectId } = req.params;
    const { enabled, justification } = req.body;
    const userId = req.user.id;
    const orgId = req.user.organizationId;

    // Check admin permission
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN') {
        return res.status(403).json({
            error: 'Only admins can change Regulatory Mode settings'
        });
    }

    // Validate input
    if (typeof enabled !== 'boolean') {
        return res.status(400).json({
            error: 'enabled must be a boolean value'
        });
    }

    // Get current status for audit
    const currentStatus = await RegulatoryModeGuard.isEnabled(projectId);

    // Update the setting
    const result = await RegulatoryModeGuard.setEnabled(projectId, enabled);

    if (!result.success) {
        return res.status(404).json({ error: 'Project not found' });
    }

    // Audit the change
    await AIAuditLogger.logInteraction({
        userId,
        organizationId: orgId,
        projectId,
        actionType: 'REGULATORY_MODE_CHANGE',
        actionDescription: `Regulatory Mode ${enabled ? 'enabled' : 'disabled'}`,
        contextSnapshot: {
            previousValue: currentStatus,
            newValue: enabled,
            justification: justification || 'Admin action'
        },
        aiRole: 'SYSTEM',
        policyLevel: 'ADMIN'
    });

    // Get updated status
    const newStatus = await RegulatoryModeGuard.getStatus(projectId);

    res.json({
        success: true,
        projectId,
        previousEnabled: currentStatus,
        ...newStatus,
        message: enabled
            ? 'Regulatory Mode enabled. AI is now in advisory-only mode.'
            : 'Regulatory Mode disabled. AI can operate with normal permissions.'
    });
}));

module.exports = router;

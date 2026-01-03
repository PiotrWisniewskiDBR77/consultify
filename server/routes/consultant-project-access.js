/**
 * Consultant Project Access Routes
 * 
 * Manages consultant access to specific projects without consuming organization seats
 * 
 * Features:
 * - Project-specific consultant invitations
 * - Access code generation for free seats
 * - Permission management
 * - Multi-project assignment
 */

import express from 'express';
const router = express.Router();
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/Database.js';
const db = getDatabase();
import authMiddleware from '../middleware/authMiddleware.js';
const crypto = require('crypto');

// Helper functions
const run = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(query, params, function (err) {
            if (err) reject(err);
            else resolve({ changes: this.changes, lastID: this.lastID });
        });
    });
};

const get = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const all = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
};

// Generate a unique access code
const generateAccessCode = () => {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = 'CONS-';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

// Default permissions for consultants (all false initially)
const DEFAULT_CONSULTANT_PERMISSIONS = {
    canViewProject: false,
    canViewTasks: false,
    canViewInitiatives: false,
    canViewDecisions: false,
    canViewFinancials: false,
    canCreateTasks: false,
    canAssignTasks: false,
    canUpdateTasks: false,
    canDeleteTasks: false,
    canCreateInitiatives: false,
    canUpdateInitiatives: false,
    canDeleteInitiatives: false,
    canRequestDecisions: false,
    canApproveDecisions: false,
    canSubmitChangeRequests: false,
    canApproveChangeRequests: false,
    canManageTeam: false,
    canManageWorkstreams: false,
    canConfigureProject: false,
    canEscalate: false,
    canReceiveEscalations: false,
    canComment: false,
    canUseAI: false
};

router.use(authMiddleware);

// =====================================================
// CONSULTANT ACCESS MANAGEMENT
// =====================================================

/**
 * GET /api/consultant-project-access
 * List all consultants with their project access for organization
 */
router.get('/', async (req, res) => {
    try {
        const orgId = req.user.organizationId;
        if (!orgId) {
            return res.status(400).json({ error: 'Organization context required' });
        }

        // Get all consultants with their project access
        const consultants = await all(`
            SELECT DISTINCT
                u.id as consultant_id,
                u.email,
                u.first_name,
                u.last_name,
                u.avatar_url,
                u.created_at as user_created_at
            FROM consultant_project_access cpa
            JOIN users u ON cpa.consultant_user_id = u.id
            WHERE cpa.organization_id = ?
            GROUP BY u.id
        `, [orgId]);

        // For each consultant, get their project access
        const result = await Promise.all(consultants.map(async (consultant) => {
            const projects = await all(`
                SELECT 
                    cpa.id as access_id,
                    cpa.project_id,
                    p.name as project_name,
                    cpa.status,
                    cpa.permissions,
                    cpa.invited_at,
                    cpa.accepted_at,
                    cpa.access_code
                FROM consultant_project_access cpa
                JOIN projects p ON cpa.project_id = p.id
                WHERE cpa.consultant_user_id = ? AND cpa.organization_id = ?
            `, [consultant.consultant_id, orgId]);

            return {
                ...consultant,
                firstName: consultant.first_name,
                lastName: consultant.last_name,
                avatarUrl: consultant.avatar_url,
                projects: projects.map(p => ({
                    ...p,
                    projectName: p.project_name,
                    permissions: p.permissions ? JSON.parse(p.permissions) : DEFAULT_CONSULTANT_PERMISSIONS
                }))
            };
        }));

        res.json(result);
    } catch (error) {
        console.error('[Consultant Access] Error listing consultants:', error);
        res.status(500).json({ error: 'Failed to list consultants' });
    }
});

/**
 * GET /api/consultant-project-access/projects
 * List all projects available for consultant assignment
 */
router.get('/projects', async (req, res) => {
    try {
        const orgId = req.user.organizationId;
        if (!orgId) {
            return res.status(400).json({ error: 'Organization context required' });
        }

        const projects = await all(`
            SELECT id, name, status, created_at
            FROM projects
            WHERE organization_id = ? AND is_archived = 0
            ORDER BY name ASC
        `, [orgId]);

        res.json(projects);
    } catch (error) {
        console.error('[Consultant Access] Error listing projects:', error);
        res.status(500).json({ error: 'Failed to list projects' });
    }
});

/**
 * POST /api/consultant-project-access/invite
 * Invite a consultant to a project
 */
router.post('/invite', async (req, res) => {
    try {
        const orgId = req.user.organizationId;
        if (!orgId) {
            return res.status(400).json({ error: 'Organization context required' });
        }

        const { email, projectId, permissions, accessCode, generateCode } = req.body;

        if (!email || !projectId) {
            return res.status(400).json({ error: 'Email and project ID are required' });
        }

        // Check if project exists and belongs to org
        const project = await get(
            'SELECT id, name FROM projects WHERE id = ? AND organization_id = ?',
            [projectId, orgId]
        );

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Check if user exists or create a placeholder
        let consultant = await get('SELECT id, email FROM users WHERE email = ?', [email.toLowerCase()]);

        if (!consultant) {
            // Create a pending consultant user (will be activated when they accept)
            const consultantId = uuidv4();
            await run(`
                INSERT INTO users (id, email, role, status, organization_id, created_at)
                VALUES (?, ?, 'CONSULTANT', 'pending', NULL, datetime('now'))
            `, [consultantId, email.toLowerCase()]);
            consultant = { id: consultantId, email: email.toLowerCase() };
        }

        // Check if already has access to this project
        const existingAccess = await get(
            'SELECT id FROM consultant_project_access WHERE consultant_user_id = ? AND project_id = ?',
            [consultant.id, projectId]
        );

        if (existingAccess) {
            return res.status(400).json({ error: 'Consultant already has access to this project' });
        }

        // Generate or validate access code
        let finalAccessCode = accessCode;
        if (generateCode) {
            finalAccessCode = generateAccessCode();
            // Store the code
            await run(`
                INSERT INTO consultant_access_codes (id, code, organization_id, created_by_user_id, max_uses, grants_free_seat)
                VALUES (?, ?, ?, ?, 1, 1)
            `, [uuidv4(), finalAccessCode, orgId, req.user.id]);
        } else if (accessCode) {
            // Validate existing code
            const codeRecord = await get(
                'SELECT * FROM consultant_access_codes WHERE code = ? AND organization_id = ? AND status = ?',
                [accessCode, orgId, 'ACTIVE']
            );
            if (!codeRecord) {
                return res.status(400).json({ error: 'Invalid access code' });
            }
            if (codeRecord.uses_count >= codeRecord.max_uses) {
                return res.status(400).json({ error: 'Access code has been exhausted' });
            }
        }

        // Create access record
        const accessId = uuidv4();
        const permissionsJson = JSON.stringify(permissions || DEFAULT_CONSULTANT_PERMISSIONS);

        await run(`
            INSERT INTO consultant_project_access 
            (id, consultant_user_id, project_id, organization_id, invited_by_user_id, access_code, permissions, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')
        `, [accessId, consultant.id, projectId, orgId, req.user.id, finalAccessCode, permissionsJson]);

        // Create an invitation record for email sending
        const inviteToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(inviteToken).digest('hex');

        await run(`
            INSERT INTO invitations (id, email, organization_id, project_id, role, invitation_type, token, token_hash, invited_by, status, created_at, expires_at)
            VALUES (?, ?, ?, ?, 'CONSULTANT', 'CONSULTANT', NULL, ?, ?, 'pending', datetime('now'), datetime('now', '+30 days'))
        `, [uuidv4(), email.toLowerCase(), orgId, projectId, tokenHash, req.user.id]);

        res.status(201).json({
            id: accessId,
            consultantId: consultant.id,
            email: consultant.email,
            projectId,
            projectName: project.name,
            accessCode: finalAccessCode,
            status: 'PENDING',
            permissions: permissions || DEFAULT_CONSULTANT_PERMISSIONS
        });
    } catch (error) {
        console.error('[Consultant Access] Error inviting consultant:', error);
        res.status(500).json({ error: 'Failed to invite consultant', message: error.message });
    }
});

/**
 * POST /api/consultant-project-access/:consultantId/add-project
 * Add existing consultant to another project
 */
router.post('/:consultantId/add-project', async (req, res) => {
    try {
        const orgId = req.user.organizationId;
        const { consultantId } = req.params;
        const { projectId, permissions, accessCode } = req.body;

        if (!orgId) {
            return res.status(400).json({ error: 'Organization context required' });
        }

        if (!projectId) {
            return res.status(400).json({ error: 'Project ID is required' });
        }

        // Verify consultant exists and has access to at least one project in this org
        const existingAccess = await get(`
            SELECT consultant_user_id FROM consultant_project_access 
            WHERE consultant_user_id = ? AND organization_id = ?
            LIMIT 1
        `, [consultantId, orgId]);

        if (!existingAccess) {
            return res.status(404).json({ error: 'Consultant not found in organization' });
        }

        // Check project exists
        const project = await get(
            'SELECT id, name FROM projects WHERE id = ? AND organization_id = ?',
            [projectId, orgId]
        );

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Check not already assigned
        const alreadyAssigned = await get(
            'SELECT id FROM consultant_project_access WHERE consultant_user_id = ? AND project_id = ?',
            [consultantId, projectId]
        );

        if (alreadyAssigned) {
            return res.status(400).json({ error: 'Consultant already has access to this project' });
        }

        // Create access
        const accessId = uuidv4();
        const permissionsJson = JSON.stringify(permissions || DEFAULT_CONSULTANT_PERMISSIONS);

        await run(`
            INSERT INTO consultant_project_access 
            (id, consultant_user_id, project_id, organization_id, invited_by_user_id, access_code, permissions, status, accepted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', datetime('now'))
        `, [accessId, consultantId, projectId, orgId, req.user.id, accessCode, permissionsJson]);

        res.status(201).json({
            id: accessId,
            consultantId,
            projectId,
            projectName: project.name,
            status: 'ACTIVE',
            permissions: permissions || DEFAULT_CONSULTANT_PERMISSIONS
        });
    } catch (error) {
        console.error('[Consultant Access] Error adding project:', error);
        res.status(500).json({ error: 'Failed to add project access' });
    }
});

/**
 * PUT /api/consultant-project-access/:accessId/permissions
 * Update permissions for a consultant's project access
 */
router.put('/:accessId/permissions', async (req, res) => {
    try {
        const orgId = req.user.organizationId;
        const { accessId } = req.params;
        const { permissions } = req.body;

        if (!orgId) {
            return res.status(400).json({ error: 'Organization context required' });
        }

        // Verify access record exists and belongs to org
        const access = await get(
            'SELECT * FROM consultant_project_access WHERE id = ? AND organization_id = ?',
            [accessId, orgId]
        );

        if (!access) {
            return res.status(404).json({ error: 'Access record not found' });
        }

        await run(
            'UPDATE consultant_project_access SET permissions = ?, updated_at = datetime(\'now\') WHERE id = ?',
            [JSON.stringify(permissions), accessId]
        );

        res.json({ success: true, permissions });
    } catch (error) {
        console.error('[Consultant Access] Error updating permissions:', error);
        res.status(500).json({ error: 'Failed to update permissions' });
    }
});

/**
 * DELETE /api/consultant-project-access/:accessId
 * Revoke consultant's access to a project
 */
router.delete('/:accessId', async (req, res) => {
    try {
        const orgId = req.user.organizationId;
        const { accessId } = req.params;

        if (!orgId) {
            return res.status(400).json({ error: 'Organization context required' });
        }

        const access = await get(
            'SELECT * FROM consultant_project_access WHERE id = ? AND organization_id = ?',
            [accessId, orgId]
        );

        if (!access) {
            return res.status(404).json({ error: 'Access record not found' });
        }

        await run(
            'UPDATE consultant_project_access SET status = \'REVOKED\', updated_at = datetime(\'now\') WHERE id = ?',
            [accessId]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('[Consultant Access] Error revoking access:', error);
        res.status(500).json({ error: 'Failed to revoke access' });
    }
});

/**
 * DELETE /api/consultant-project-access/consultant/:consultantId
 * Remove consultant from organization entirely
 */
router.delete('/consultant/:consultantId', async (req, res) => {
    try {
        const orgId = req.user.organizationId;
        const { consultantId } = req.params;

        if (!orgId) {
            return res.status(400).json({ error: 'Organization context required' });
        }

        await run(
            'UPDATE consultant_project_access SET status = \'REVOKED\', updated_at = datetime(\'now\') WHERE consultant_user_id = ? AND organization_id = ?',
            [consultantId, orgId]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('[Consultant Access] Error removing consultant:', error);
        res.status(500).json({ error: 'Failed to remove consultant' });
    }
});

// =====================================================
// ACCESS CODE MANAGEMENT
// =====================================================

/**
 * GET /api/consultant-project-access/codes
 * List all access codes for organization
 */
router.get('/codes', async (req, res) => {
    try {
        const orgId = req.user.organizationId;
        if (!orgId) {
            return res.status(400).json({ error: 'Organization context required' });
        }

        const codes = await all(`
            SELECT 
                cac.*,
                u.email as created_by_email,
                u.first_name as created_by_first_name,
                u.last_name as created_by_last_name
            FROM consultant_access_codes cac
            LEFT JOIN users u ON cac.created_by_user_id = u.id
            WHERE cac.organization_id = ?
            ORDER BY cac.created_at DESC
        `, [orgId]);

        res.json(codes);
    } catch (error) {
        console.error('[Consultant Access] Error listing codes:', error);
        res.status(500).json({ error: 'Failed to list access codes' });
    }
});

/**
 * POST /api/consultant-project-access/codes
 * Generate a new access code
 */
router.post('/codes', async (req, res) => {
    try {
        const orgId = req.user.organizationId;
        if (!orgId) {
            return res.status(400).json({ error: 'Organization context required' });
        }

        const { maxUses = 10, expiresInDays = 30, grantsFreeSeats = true } = req.body;

        const code = generateAccessCode();
        const codeId = uuidv4();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);

        await run(`
            INSERT INTO consultant_access_codes 
            (id, code, organization_id, created_by_user_id, max_uses, grants_free_seat, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [codeId, code, orgId, req.user.id, maxUses, grantsFreeSeats ? 1 : 0, expiresAt.toISOString()]);

        res.status(201).json({
            id: codeId,
            code,
            maxUses,
            usesCount: 0,
            grantsFreeSeats,
            expiresAt: expiresAt.toISOString(),
            status: 'ACTIVE'
        });
    } catch (error) {
        console.error('[Consultant Access] Error generating code:', error);
        res.status(500).json({ error: 'Failed to generate access code' });
    }
});

/**
 * DELETE /api/consultant-project-access/codes/:codeId
 * Revoke an access code
 */
router.delete('/codes/:codeId', async (req, res) => {
    try {
        const orgId = req.user.organizationId;
        const { codeId } = req.params;

        if (!orgId) {
            return res.status(400).json({ error: 'Organization context required' });
        }

        await run(
            'UPDATE consultant_access_codes SET status = \'REVOKED\' WHERE id = ? AND organization_id = ?',
            [codeId, orgId]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('[Consultant Access] Error revoking code:', error);
        res.status(500).json({ error: 'Failed to revoke code' });
    }
});

// =====================================================
// PERMISSION DEFINITIONS
// =====================================================

/**
 * GET /api/consultant-project-access/permission-definitions
 * Get list of all available permissions with descriptions
 */
router.get('/permission-definitions', (req, res) => {
    const definitions = [
        { key: 'canViewProject', label: 'View Project', description: 'See project overview and details', category: 'View' },
        { key: 'canViewTasks', label: 'View Tasks', description: 'See tasks and task board', category: 'View' },
        { key: 'canViewInitiatives', label: 'View Initiatives', description: 'See initiatives and roadmap', category: 'View' },
        { key: 'canViewDecisions', label: 'View Decisions', description: 'See decision log and history', category: 'View' },
        { key: 'canViewFinancials', label: 'View Financials', description: 'See budget and financial data', category: 'View' },
        { key: 'canCreateTasks', label: 'Create Tasks', description: 'Add new tasks', category: 'Tasks' },
        { key: 'canAssignTasks', label: 'Assign Tasks', description: 'Assign tasks to team members', category: 'Tasks' },
        { key: 'canUpdateTasks', label: 'Update Tasks', description: 'Edit task details and status', category: 'Tasks' },
        { key: 'canDeleteTasks', label: 'Delete Tasks', description: 'Remove tasks', category: 'Tasks' },
        { key: 'canCreateInitiatives', label: 'Create Initiatives', description: 'Add new initiatives', category: 'Initiatives' },
        { key: 'canUpdateInitiatives', label: 'Update Initiatives', description: 'Edit initiative details', category: 'Initiatives' },
        { key: 'canDeleteInitiatives', label: 'Delete Initiatives', description: 'Remove initiatives', category: 'Initiatives' },
        { key: 'canRequestDecisions', label: 'Request Decisions', description: 'Submit decision requests', category: 'Decisions' },
        { key: 'canApproveDecisions', label: 'Approve Decisions', description: 'Approve or reject decisions', category: 'Decisions' },
        { key: 'canSubmitChangeRequests', label: 'Submit Change Requests', description: 'Create change requests', category: 'Changes' },
        { key: 'canApproveChangeRequests', label: 'Approve Change Requests', description: 'Approve or reject changes', category: 'Changes' },
        { key: 'canComment', label: 'Add Comments', description: 'Comment on items', category: 'Collaboration' },
        { key: 'canUseAI', label: 'Use AI Features', description: 'Access AI assistant and insights', category: 'AI' },
        { key: 'canEscalate', label: 'Escalate Issues', description: 'Escalate items to management', category: 'Governance' },
        { key: 'canReceiveEscalations', label: 'Receive Escalations', description: 'Be notified of escalations', category: 'Governance' }
    ];

    res.json(definitions);
});

export default router;


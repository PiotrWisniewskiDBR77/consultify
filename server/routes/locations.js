import express from 'express';
const router = express.Router();
import auth from '../middleware/authMiddleware.js';
const { requireRole } = require('../middleware/rbac');
import { getDatabase } from '../database/Database.js';
const db = getDatabase();
const FacilityUserService = import('facilityUserService.js');

/**
 * CRIT-04: Locations API
 * Provides location data for filtering tasks and initiatives
 * Extended with facility user management endpoints
 */

// GET /api/locations - Get locations for filtering
router.get('/', auth, async (req, res) => {
    try {
        const organizationId = req.user.organizationId || req.user.organization_id;

        if (!organizationId) {
            // Return default locations if no organization
            return res.json([
                { id: 'hq', name: 'Headquarters' },
                { id: 'remote', name: 'Remote' }
            ]);
        }

        // Get organization facilities as locations
        const facilities = await new Promise((resolve, reject) => {
            db.all(
                `SELECT id, name, location as country FROM organization_facilities 
                 WHERE organization_id = ?`,
                [organizationId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        // If no facilities, return default locations
        if (facilities.length === 0) {
            return res.json([
                { id: 'hq', name: 'Headquarters' },
                { id: 'remote', name: 'Remote' }
            ]);
        }

        res.json(facilities);
    } catch (error) {
        console.error('Error fetching locations:', error);
        res.status(500).json({ error: 'Failed to fetch locations' });
    }
});

// GET /api/locations/project/:projectId - Get locations for a specific project
router.get('/project/:projectId', auth, async (req, res) => {
    try {
        const { projectId } = req.params;

        // Get project organization to fetch facilities
        const project = await new Promise((resolve, reject) => {
            db.get(
                `SELECT organization_id FROM projects WHERE id = ?`,
                [projectId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const facilities = await new Promise((resolve, reject) => {
            db.all(
                `SELECT id, name, location as country FROM organization_facilities 
                 WHERE organization_id = ?`,
                [project.organization_id],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        if (facilities.length === 0) {
            return res.json([
                { id: 'hq', name: 'Headquarters' },
                { id: 'remote', name: 'Remote' }
            ]);
        }

        res.json(facilities);
    } catch (error) {
        console.error('Error fetching project locations:', error);
        res.status(500).json({ error: 'Failed to fetch locations' });
    }
});

// ============================================
// FACILITY USERS ENDPOINTS
// ============================================

/**
 * GET /api/facilities/:facilityId/users
 * Get all users assigned to a facility
 */
router.get('/facilities/:facilityId/users', auth, async (req, res) => {
    try {
        const { facilityId } = req.params;
        const { role, assignmentType } = req.query;

        const users = await FacilityUserService.getFacilityUsers(facilityId, {
            role,
            assignmentType
        });

        res.json(users);
    } catch (error) {
        console.error('Error fetching facility users:', error);
        res.status(500).json({ error: 'Failed to fetch facility users' });
    }
});

/**
 * POST /api/facilities/:facilityId/users
 * Assign user to a facility
 * Requires ADMIN role
 */
router.post('/facilities/:facilityId/users', auth, requireRole(['ADMIN', 'SUPERADMIN']), async (req, res) => {
    try {
        const { facilityId } = req.params;
        const {
            userId,
            role,
            assignmentType,
            canViewAllTasks,
            canManageUsers,
            canEditFacility,
            validUntil,
            notes
        } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        const assignment = await FacilityUserService.assignUserToFacility(userId, facilityId, {
            role,
            assignmentType,
            canViewAllTasks,
            canManageUsers,
            canEditFacility,
            validUntil,
            notes,
            assignedBy: req.user.id
        });

        res.status(201).json({
            success: true,
            message: 'User assigned to facility successfully',
            assignment
        });
    } catch (error) {
        console.error('Error assigning user to facility:', error);

        if (error.message.includes('not found')) {
            return res.status(404).json({ error: error.message });
        }
        if (error.message.includes('same organization')) {
            return res.status(400).json({ error: error.message });
        }

        res.status(500).json({ error: 'Failed to assign user to facility' });
    }
});

/**
 * PUT /api/facilities/:facilityId/users/:userId
 * Update user's facility assignment
 */
router.put('/facilities/:facilityId/users/:userId', auth, requireRole(['ADMIN', 'SUPERADMIN']), async (req, res) => {
    try {
        const { facilityId, userId } = req.params;
        const updates = req.body;

        const assignment = await FacilityUserService.updateAssignment(userId, facilityId, updates);

        res.json({
            success: true,
            message: 'Assignment updated successfully',
            assignment
        });
    } catch (error) {
        console.error('Error updating facility assignment:', error);

        if (error.message.includes('not found')) {
            return res.status(404).json({ error: error.message });
        }

        res.status(500).json({ error: 'Failed to update assignment' });
    }
});

/**
 * DELETE /api/facilities/:facilityId/users/:userId
 * Remove user from facility
 */
router.delete('/facilities/:facilityId/users/:userId', auth, requireRole(['ADMIN', 'SUPERADMIN']), async (req, res) => {
    try {
        const { facilityId, userId } = req.params;

        await FacilityUserService.removeUserFromFacility(userId, facilityId, req.user.id);

        res.json({
            success: true,
            message: 'User removed from facility successfully'
        });
    } catch (error) {
        console.error('Error removing user from facility:', error);

        if (error.message.includes('not found') || error.message.includes('not assigned')) {
            return res.status(404).json({ error: error.message });
        }

        res.status(500).json({ error: 'Failed to remove user from facility' });
    }
});

/**
 * GET /api/facilities/:facilityId/stats
 * Get facility assignment statistics
 */
router.get('/facilities/:facilityId/stats', auth, async (req, res) => {
    try {
        const { facilityId } = req.params;
        const stats = await FacilityUserService.getFacilityStats(facilityId);
        res.json(stats);
    } catch (error) {
        console.error('Error fetching facility stats:', error);
        res.status(500).json({ error: 'Failed to fetch facility statistics' });
    }
});

/**
 * POST /api/facilities/:facilityId/users/bulk
 * Bulk assign users to facility
 */
router.post('/facilities/:facilityId/users/bulk', auth, requireRole(['ADMIN', 'SUPERADMIN']), async (req, res) => {
    try {
        const { facilityId } = req.params;
        const { assignments } = req.body;

        if (!assignments || !Array.isArray(assignments)) {
            return res.status(400).json({ error: 'Assignments array is required' });
        }

        const results = await FacilityUserService.bulkAssignUsers(facilityId, assignments, req.user.id);

        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        res.json({
            success: true,
            message: `${successful} users assigned, ${failed} failed`,
            results
        });
    } catch (error) {
        console.error('Error bulk assigning users:', error);
        res.status(500).json({ error: 'Failed to bulk assign users' });
    }
});

// ============================================
// USER FACILITIES ENDPOINTS
// ============================================

/**
 * GET /api/users/:userId/facilities
 * Get all facilities a user is assigned to
 */
router.get('/users/:userId/facilities', auth, async (req, res) => {
    try {
        const { userId } = req.params;
        const organizationId = req.user.organizationId || req.user.organization_id;

        // Users can only see their own facilities unless admin
        if (userId !== req.user.id && !['ADMIN', 'SUPERADMIN'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Not authorized to view other user\'s facilities' });
        }

        const facilities = await FacilityUserService.getUserFacilities(userId, organizationId);
        res.json(facilities);
    } catch (error) {
        console.error('Error fetching user facilities:', error);
        res.status(500).json({ error: 'Failed to fetch user facilities' });
    }
});

/**
 * GET /api/me/facilities
 * Get current user's facility assignments
 */
router.get('/me/facilities', auth, async (req, res) => {
    try {
        const organizationId = req.user.organizationId || req.user.organization_id;
        const facilities = await FacilityUserService.getUserFacilities(req.user.id, organizationId);
        res.json(facilities);
    } catch (error) {
        console.error('Error fetching my facilities:', error);
        res.status(500).json({ error: 'Failed to fetch facilities' });
    }
});

/**
 * GET /api/me/primary-facility
 * Get current user's primary facility
 */
router.get('/me/primary-facility', auth, async (req, res) => {
    try {
        const facility = await FacilityUserService.getUserPrimaryFacility(req.user.id);
        res.json(facility);
    } catch (error) {
        console.error('Error fetching primary facility:', error);
        res.status(500).json({ error: 'Failed to fetch primary facility' });
    }
});

export default router;

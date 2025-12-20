const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const db = require('../database');

/**
 * CRIT-04: Locations API
 * Provides location data for filtering tasks and initiatives
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

module.exports = router;

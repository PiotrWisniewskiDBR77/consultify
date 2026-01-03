/**
 * Multi-Framework Assessment API Routes
 * 
 * REST API for managing assessments across all frameworks:
 * - SIRI (Smart Industry Readiness Index)
 * - ADMA (Advanced Digital Maturity Assessment)
 * - CMMI (Capability Maturity Model Integration)
 * - LEAN (DBR77 Lean 4.0)
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
const router = express.Router();

// Middleware
import authenticateToken from '../middleware/authMiddleware.js';
const { assessmentRBAC } = require('../middleware/assessmentRBAC');

// Services
import { getDatabase } from '../database/Database.js';
const db = getDatabase();
const { calculateFrameworkScore } = import('frameworkScoreCalculators.js');
const multiFrameworkAuditService = import('multiFrameworkAuditService.js');

// Valid frameworks
const VALID_FRAMEWORKS = ['SIRI', 'ADMA', 'CMMI', 'LEAN'];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Validate framework parameter
 */
function validateFramework(req, res, next) {
    const framework = req.params.framework || req.query.framework || req.body.framework;
    if (framework && !VALID_FRAMEWORKS.includes(framework.toUpperCase())) {
        return res.status(400).json({
            error: 'Invalid framework',
            validFrameworks: VALID_FRAMEWORKS,
        });
    }
    req.framework = framework?.toUpperCase();
    next();
}

// ============================================
// ROUTES
// ============================================

/**
 * GET /api/mf-assessments/:projectId/all
 * 
 * List all assessments for a project across all frameworks
 */
router.get('/:projectId/all', authenticateToken, async (req, res) => {
    try {
        const { projectId } = req.params;
        const { status, framework } = req.query;

        let query = `
            SELECT 
                mfa.*,
                u.first_name || ' ' || u.last_name AS created_by_name,
                (SELECT COUNT(*) FROM multi_framework_assessment_reviewers r WHERE r.assessment_id = mfa.id) AS reviewer_count,
                (SELECT COUNT(*) FROM multi_framework_assessment_reviewers r WHERE r.assessment_id = mfa.id AND r.status = 'COMPLETED') AS completed_reviews
            FROM multi_framework_assessments mfa
            LEFT JOIN users u ON mfa.created_by = u.id
            WHERE mfa.project_id = $1
        `;
        const params = [projectId];
        let paramIndex = 2;

        if (status) {
            query += ` AND mfa.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (framework && VALID_FRAMEWORKS.includes(framework.toUpperCase())) {
            query += ` AND mfa.framework = $${paramIndex}`;
            params.push(framework.toUpperCase());
            paramIndex++;
        }

        query += ' ORDER BY mfa.updated_at DESC';

        const result = await db.query(query, params);

        // Group by framework
        const grouped = {
            SIRI: [],
            ADMA: [],
            CMMI: [],
            LEAN: [],
        };

        result.rows.forEach(row => {
            if (grouped[row.framework]) {
                grouped[row.framework].push(row);
            }
        });

        res.json({
            success: true,
            assessments: result.rows,
            byFramework: grouped,
            total: result.rows.length,
        });
    } catch (error) {
        console.error('[MF-Assessment] List error:', error);
        res.status(500).json({ error: 'Failed to list assessments' });
    }
});

/**
 * GET /api/mf-assessments/:projectId/:framework
 * 
 * List assessments for a specific framework in a project
 */
router.get('/:projectId/:framework', authenticateToken, validateFramework, async (req, res) => {
    try {
        const { projectId } = req.params;
        const framework = req.framework;

        const result = await db.query(`
            SELECT 
                mfa.*,
                u.first_name || ' ' || u.last_name AS created_by_name
            FROM multi_framework_assessments mfa
            LEFT JOIN users u ON mfa.created_by = u.id
            WHERE mfa.project_id = $1 AND mfa.framework = $2
            ORDER BY mfa.updated_at DESC
        `, [projectId, framework]);

        res.json({
            success: true,
            framework,
            assessments: result.rows,
            total: result.rows.length,
        });
    } catch (error) {
        console.error('[MF-Assessment] List by framework error:', error);
        res.status(500).json({ error: 'Failed to list assessments' });
    }
});

/**
 * POST /api/mf-assessments/:projectId/:framework
 * 
 * Create a new assessment
 */
router.post('/:projectId/:framework', authenticateToken, validateFramework, async (req, res) => {
    try {
        const { projectId } = req.params;
        const framework = req.framework;
        const { name, organizationId, data = {}, importSource } = req.body;
        const userId = req.user.id;

        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        // Check for duplicate name
        const existing = await db.query(
            'SELECT id FROM multi_framework_assessments WHERE project_id = $1 AND framework = $2 AND name = $3',
            [projectId, framework, name]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({
                error: 'Assessment with this name already exists',
                existingId: existing.rows[0].id,
            });
        }

        // Calculate initial score if data provided
        let overallScore = null;
        let categoryScores = {};
        if (Object.keys(data).length > 0) {
            const scoreResult = calculateFrameworkScore(framework, data);
            overallScore = scoreResult.overall;
            categoryScores = scoreResult.categories;
        }

        const id = uuidv4();
        const result = await db.query(`
            INSERT INTO multi_framework_assessments (
                id, project_id, organization_id, framework, name, data,
                overall_score, category_scores, import_source,
                created_by, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
            RETURNING *
        `, [
            id,
            projectId,
            organizationId || req.user.organization_id,
            framework,
            name,
            JSON.stringify(data),
            overallScore,
            JSON.stringify(categoryScores),
            importSource ? JSON.stringify(importSource) : null,
            userId,
        ]);

        // Log audit entry
        await multiFrameworkAuditService?.logAction?.({
            assessmentId: id,
            framework,
            action: 'CREATE',
            actorId: userId,
            newData: data,
        });

        res.status(201).json({
            success: true,
            id: result.rows[0].id,
            framework,
            name,
            status: 'DRAFT',
            version: 1,
            created_at: result.rows[0].created_at,
        });
    } catch (error) {
        console.error('[MF-Assessment] Create error:', error);
        res.status(500).json({ error: 'Failed to create assessment' });
    }
});

/**
 * GET /api/mf-assessments/:id
 * 
 * Get a single assessment by ID
 */
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(`
            SELECT 
                mfa.*,
                u.first_name || ' ' || u.last_name AS created_by_name,
                au.first_name || ' ' || au.last_name AS approved_by_name
            FROM multi_framework_assessments mfa
            LEFT JOIN users u ON mfa.created_by = u.id
            LEFT JOIN users au ON mfa.approved_by = au.id
            WHERE mfa.id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Assessment not found' });
        }

        const assessment = result.rows[0];

        // Get reviewers
        const reviewers = await db.query(`
            SELECT 
                r.*,
                u.first_name || ' ' || u.last_name AS reviewer_name,
                u.email AS reviewer_email
            FROM multi_framework_assessment_reviewers r
            LEFT JOIN users u ON r.reviewer_id = u.id
            WHERE r.assessment_id = $1
        `, [id]);

        // Get comments
        const comments = await db.query(`
            SELECT 
                c.*,
                u.first_name || ' ' || u.last_name AS author_name
            FROM multi_framework_assessment_comments c
            LEFT JOIN users u ON c.author_id = u.id
            WHERE c.assessment_id = $1
            ORDER BY c.created_at DESC
        `, [id]);

        res.json({
            success: true,
            ...assessment,
            reviewers: reviewers.rows,
            comments: comments.rows,
        });
    } catch (error) {
        console.error('[MF-Assessment] Get error:', error);
        res.status(500).json({ error: 'Failed to get assessment' });
    }
});

/**
 * PUT /api/mf-assessments/:id
 * 
 * Update an assessment
 */
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { data, name, status } = req.body;
        const userId = req.user.id;

        // Get current assessment
        const current = await db.query(
            'SELECT * FROM multi_framework_assessments WHERE id = $1',
            [id]
        );

        if (current.rows.length === 0) {
            return res.status(404).json({ error: 'Assessment not found' });
        }

        const currentAssessment = current.rows[0];

        // Check if assessment is editable
        if (['APPROVED', 'ARCHIVED'].includes(currentAssessment.status)) {
            return res.status(403).json({
                error: 'Cannot edit approved or archived assessment',
            });
        }

        // Calculate new scores if data updated
        let overallScore = currentAssessment.overall_score;
        let categoryScores = currentAssessment.category_scores;
        if (data) {
            const scoreResult = calculateFrameworkScore(currentAssessment.framework, data);
            overallScore = scoreResult.overall;
            categoryScores = scoreResult.categories;
        }

        // Save version history
        await db.query(`
            INSERT INTO multi_framework_assessment_versions (
                assessment_id, version, data, overall_score, category_scores,
                change_summary, created_by, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, [
            id,
            currentAssessment.version,
            JSON.stringify(currentAssessment.data),
            currentAssessment.overall_score,
            JSON.stringify(currentAssessment.category_scores),
            'Auto-saved before update',
            userId,
        ]);

        // Update assessment
        const result = await db.query(`
            UPDATE multi_framework_assessments
            SET 
                data = COALESCE($1, data),
                name = COALESCE($2, name),
                status = COALESCE($3, status),
                overall_score = $4,
                category_scores = $5,
                version = version + 1,
                updated_at = NOW(),
                updated_by = $6
            WHERE id = $7
            RETURNING *
        `, [
            data ? JSON.stringify(data) : null,
            name,
            status,
            overallScore,
            JSON.stringify(categoryScores),
            userId,
            id,
        ]);

        // Log audit entry
        await multiFrameworkAuditService?.logAction?.({
            assessmentId: id,
            framework: currentAssessment.framework,
            action: 'UPDATE',
            actorId: userId,
            oldData: currentAssessment.data,
            newData: data || currentAssessment.data,
        });

        res.json({
            success: true,
            id,
            version: result.rows[0].version,
            overall_score: overallScore,
            category_scores: categoryScores,
            updated_at: result.rows[0].updated_at,
        });
    } catch (error) {
        console.error('[MF-Assessment] Update error:', error);
        res.status(500).json({ error: 'Failed to update assessment' });
    }
});

/**
 * DELETE /api/mf-assessments/:id
 * 
 * Delete an assessment
 */
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Get assessment before deletion
        const current = await db.query(
            'SELECT * FROM multi_framework_assessments WHERE id = $1',
            [id]
        );

        if (current.rows.length === 0) {
            return res.status(404).json({ error: 'Assessment not found' });
        }

        const assessment = current.rows[0];

        // Check permissions
        if (assessment.created_by !== userId && !req.user.is_admin) {
            return res.status(403).json({ error: 'Not authorized to delete this assessment' });
        }

        // Soft delete: mark as archived
        await db.query(
            'UPDATE multi_framework_assessments SET status = $1, updated_at = NOW() WHERE id = $2',
            ['ARCHIVED', id]
        );

        // Log audit
        await multiFrameworkAuditService?.logAction?.({
            assessmentId: id,
            framework: assessment.framework,
            action: 'DELETE',
            actorId: userId,
            oldData: assessment.data,
        });

        res.json({ success: true, message: 'Assessment archived' });
    } catch (error) {
        console.error('[MF-Assessment] Delete error:', error);
        res.status(500).json({ error: 'Failed to delete assessment' });
    }
});

/**
 * POST /api/mf-assessments/:id/duplicate
 * 
 * Duplicate an assessment
 */
router.post('/:id/duplicate', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        const userId = req.user.id;

        // Get source assessment
        const source = await db.query(
            'SELECT * FROM multi_framework_assessments WHERE id = $1',
            [id]
        );

        if (source.rows.length === 0) {
            return res.status(404).json({ error: 'Source assessment not found' });
        }

        const sourceAssessment = source.rows[0];
        const newName = name || `${sourceAssessment.name} (Copy)`;

        const newId = uuidv4();
        const result = await db.query(`
            INSERT INTO multi_framework_assessments (
                id, project_id, organization_id, framework, name, data,
                overall_score, category_scores, created_by, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
            RETURNING *
        `, [
            newId,
            sourceAssessment.project_id,
            sourceAssessment.organization_id,
            sourceAssessment.framework,
            newName,
            JSON.stringify(sourceAssessment.data),
            sourceAssessment.overall_score,
            JSON.stringify(sourceAssessment.category_scores),
            userId,
        ]);

        res.status(201).json({
            success: true,
            id: newId,
            name: newName,
            sourceId: id,
        });
    } catch (error) {
        console.error('[MF-Assessment] Duplicate error:', error);
        res.status(500).json({ error: 'Failed to duplicate assessment' });
    }
});

/**
 * GET /api/mf-assessments/:id/versions
 * 
 * Get version history for an assessment
 */
router.get('/:id/versions', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(`
            SELECT 
                v.*,
                u.first_name || ' ' || u.last_name AS created_by_name
            FROM multi_framework_assessment_versions v
            LEFT JOIN users u ON v.created_by = u.id
            WHERE v.assessment_id = $1
            ORDER BY v.version DESC
        `, [id]);

        res.json({
            success: true,
            versions: result.rows,
        });
    } catch (error) {
        console.error('[MF-Assessment] Get versions error:', error);
        res.status(500).json({ error: 'Failed to get versions' });
    }
});

/**
 * POST /api/mf-assessments/:id/restore/:version
 * 
 * Restore a specific version
 */
router.post('/:id/restore/:version', authenticateToken, async (req, res) => {
    try {
        const { id, version } = req.params;
        const userId = req.user.id;

        // Get version data
        const versionData = await db.query(
            'SELECT * FROM multi_framework_assessment_versions WHERE assessment_id = $1 AND version = $2',
            [id, parseInt(version)]
        );

        if (versionData.rows.length === 0) {
            return res.status(404).json({ error: 'Version not found' });
        }

        const versionInfo = versionData.rows[0];

        // Get current assessment
        const current = await db.query(
            'SELECT * FROM multi_framework_assessments WHERE id = $1',
            [id]
        );

        // Save current state as new version
        await db.query(`
            INSERT INTO multi_framework_assessment_versions (
                assessment_id, version, data, overall_score, category_scores,
                change_summary, created_by, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, [
            id,
            current.rows[0].version,
            JSON.stringify(current.rows[0].data),
            current.rows[0].overall_score,
            JSON.stringify(current.rows[0].category_scores),
            `Saved before restoring version ${version}`,
            userId,
        ]);

        // Restore version
        await db.query(`
            UPDATE multi_framework_assessments
            SET 
                data = $1,
                overall_score = $2,
                category_scores = $3,
                version = version + 1,
                updated_at = NOW(),
                updated_by = $4
            WHERE id = $5
        `, [
            JSON.stringify(versionInfo.data),
            versionInfo.overall_score,
            JSON.stringify(versionInfo.category_scores),
            userId,
            id,
        ]);

        res.json({
            success: true,
            restoredVersion: parseInt(version),
            message: `Restored to version ${version}`,
        });
    } catch (error) {
        console.error('[MF-Assessment] Restore error:', error);
        res.status(500).json({ error: 'Failed to restore version' });
    }
});

/**
 * POST /api/mf-assessments/:id/comments
 * 
 * Add a comment to an assessment
 */
router.post('/:id/comments', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { content, targetDimension, targetArea, parentId } = req.body;
        const userId = req.user.id;

        if (!content) {
            return res.status(400).json({ error: 'Content is required' });
        }

        const result = await db.query(`
            INSERT INTO multi_framework_assessment_comments (
                assessment_id, author_id, content, target_dimension, target_area, parent_id, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
            RETURNING *
        `, [id, userId, content, targetDimension, targetArea, parentId]);

        res.status(201).json({
            success: true,
            comment: result.rows[0],
        });
    } catch (error) {
        console.error('[MF-Assessment] Add comment error:', error);
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

/**
 * GET /api/mf-assessments/:id/comments
 * 
 * Get comments for an assessment
 */
router.get('/:id/comments', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(`
            SELECT 
                c.*,
                u.first_name || ' ' || u.last_name AS author_name,
                u.avatar_url AS author_avatar
            FROM multi_framework_assessment_comments c
            LEFT JOIN users u ON c.author_id = u.id
            WHERE c.assessment_id = $1
            ORDER BY c.created_at ASC
        `, [id]);

        res.json({
            success: true,
            comments: result.rows,
        });
    } catch (error) {
        console.error('[MF-Assessment] Get comments error:', error);
        res.status(500).json({ error: 'Failed to get comments' });
    }
});

export default router;









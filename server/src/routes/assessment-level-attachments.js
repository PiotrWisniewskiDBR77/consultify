/**
 * Assessment Level Attachments API
 * 
 * Handles file attachments for specific maturity levels in assessments.
 * Allows uploading evidence documents, screenshots, reports, etc.
 */

import express from 'express';
const router = express.Router();
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import db from '../database.js';
import verifyToken from '../middleware/authMiddleware.js';

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const orgId = req.user?.organizationId || 'unknown';
        const uploadDir = path.join(__dirname, '../../uploads/assessments/levels', orgId);
        
        // Create directory if it doesn't exist
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
    fileFilter: (req, file, cb) => {
        // Allow common document and image types
        const allowedTypes = /pdf|doc|docx|xls|xlsx|ppt|pptx|png|jpg|jpeg|gif|webp|csv|txt|json/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        
        if (extname) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Allowed: PDF, Word, Excel, PowerPoint, images, CSV, TXT, JSON'));
        }
    }
});

/**
 * POST /api/assessment-level-attachments
 * Upload attachment for a specific assessment level
 */
router.post('/', verifyToken, upload.single('file'), async (req, res) => {
    try {
        const { assessmentId, axisId, areaId, levelNumber, attachmentType, description } = req.body;
        const userId = req.user.id;
        const organizationId = req.user.organizationId;

        // Validate required fields
        if (!assessmentId || !axisId || !levelNumber) {
            return res.status(400).json({ 
                error: 'Missing required fields: assessmentId, axisId, levelNumber' 
            });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const attachmentId = uuidv4();
        const now = new Date().toISOString();

        const sql = `
            INSERT INTO assessment_level_attachments (
                id, assessment_id, axis_id, area_id, level_number,
                attachment_type, file_name, file_path, file_size, mime_type,
                description, uploaded_by, organization_id, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.run(sql, [
            attachmentId,
            assessmentId,
            axisId,
            areaId || null,
            parseInt(levelNumber),
            attachmentType || 'EVIDENCE',
            req.file.originalname,
            req.file.path,
            req.file.size,
            req.file.mimetype,
            description || null,
            userId,
            organizationId,
            now,
            now
        ], function(err) {
            if (err) {
                console.error('[Level Attachments] Create error:', err);
                return res.status(500).json({ error: 'Failed to save attachment' });
            }

            res.status(201).json({
                id: attachmentId,
                assessmentId,
                axisId,
                areaId,
                levelNumber: parseInt(levelNumber),
                attachmentType: attachmentType || 'EVIDENCE',
                fileName: req.file.originalname,
                fileSize: req.file.size,
                mimeType: req.file.mimetype,
                description,
                createdAt: now
            });
        });
    } catch (error) {
        console.error('[Level Attachments] Upload error:', error);
        res.status(500).json({ error: 'Failed to upload attachment' });
    }
});

/**
 * GET /api/assessment-level-attachments/:assessmentId
 * Get all attachments for an assessment
 */
router.get('/:assessmentId', verifyToken, async (req, res) => {
    try {
        const { assessmentId } = req.params;
        const { axisId, areaId, levelNumber } = req.query;
        const organizationId = req.user.organizationId;

        let sql = `
            SELECT 
                id, assessment_id, axis_id, area_id, level_number,
                attachment_type, file_name, file_size, mime_type,
                description, uploaded_by, ai_analysis, ai_suggested_score,
                ai_confidence, created_at, updated_at
            FROM assessment_level_attachments
            WHERE assessment_id = ? AND organization_id = ?
        `;
        const params = [assessmentId, organizationId];

        // Optional filters
        if (axisId) {
            sql += ' AND axis_id = ?';
            params.push(axisId);
        }
        if (areaId) {
            sql += ' AND area_id = ?';
            params.push(areaId);
        }
        if (levelNumber) {
            sql += ' AND level_number = ?';
            params.push(parseInt(levelNumber));
        }

        sql += ' ORDER BY created_at DESC';

        db.all(sql, params, (err, rows) => {
            if (err) {
                console.error('[Level Attachments] List error:', err);
                return res.status(500).json({ error: 'Failed to fetch attachments' });
            }

            // Group by axis and level for easier frontend consumption
            const grouped = {};
            (rows || []).forEach(row => {
                const key = `${row.axis_id}:${row.area_id || 'general'}:${row.level_number}`;
                if (!grouped[key]) {
                    grouped[key] = {
                        axisId: row.axis_id,
                        areaId: row.area_id,
                        levelNumber: row.level_number,
                        attachments: []
                    };
                }
                grouped[key].attachments.push({
                    id: row.id,
                    attachmentType: row.attachment_type,
                    fileName: row.file_name,
                    fileSize: row.file_size,
                    mimeType: row.mime_type,
                    description: row.description,
                    aiAnalysis: row.ai_analysis ? JSON.parse(row.ai_analysis) : null,
                    aiSuggestedScore: row.ai_suggested_score,
                    aiConfidence: row.ai_confidence,
                    createdAt: row.created_at
                });
            });

            res.json({
                attachments: rows || [],
                grouped: Object.values(grouped),
                total: (rows || []).length
            });
        });
    } catch (error) {
        console.error('[Level Attachments] Fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch attachments' });
    }
});

/**
 * GET /api/assessment-level-attachments/download/:id
 * Download a specific attachment
 */
router.get('/download/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.user.organizationId;

        db.get(
            `SELECT file_path, file_name, mime_type FROM assessment_level_attachments 
             WHERE id = ? AND organization_id = ?`,
            [id, organizationId],
            (err, row) => {
                if (err) {
                    console.error('[Level Attachments] Download error:', err);
                    return res.status(500).json({ error: 'Failed to fetch attachment' });
                }

                if (!row) {
                    return res.status(404).json({ error: 'Attachment not found' });
                }

                // Check if file exists
                if (!fs.existsSync(row.file_path)) {
                    return res.status(404).json({ error: 'File not found on disk' });
                }

                res.setHeader('Content-Type', row.mime_type || 'application/octet-stream');
                res.setHeader('Content-Disposition', `attachment; filename="${row.file_name}"`);
                
                const fileStream = fs.createReadStream(row.file_path);
                fileStream.pipe(res);
            }
        );
    } catch (error) {
        console.error('[Level Attachments] Download error:', error);
        res.status(500).json({ error: 'Failed to download attachment' });
    }
});

/**
 * DELETE /api/assessment-level-attachments/:id
 * Delete a specific attachment
 */
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.user.organizationId;

        // First get the file path to delete the actual file
        db.get(
            `SELECT file_path FROM assessment_level_attachments 
             WHERE id = ? AND organization_id = ?`,
            [id, organizationId],
            (err, row) => {
                if (err) {
                    console.error('[Level Attachments] Delete fetch error:', err);
                    return res.status(500).json({ error: 'Failed to delete attachment' });
                }

                if (!row) {
                    return res.status(404).json({ error: 'Attachment not found' });
                }

                // Delete from database
                db.run(
                    `DELETE FROM assessment_level_attachments WHERE id = ? AND organization_id = ?`,
                    [id, organizationId],
                    function(deleteErr) {
                        if (deleteErr) {
                            console.error('[Level Attachments] Delete DB error:', deleteErr);
                            return res.status(500).json({ error: 'Failed to delete attachment' });
                        }

                        // Try to delete the actual file (don't fail if file doesn't exist)
                        try {
                            if (fs.existsSync(row.file_path)) {
                                fs.unlinkSync(row.file_path);
                            }
                        } catch (fsErr) {
                            console.warn('[Level Attachments] Could not delete file:', fsErr.message);
                        }

                        res.status(204).send();
                    }
                );
            }
        );
    } catch (error) {
        console.error('[Level Attachments] Delete error:', error);
        res.status(500).json({ error: 'Failed to delete attachment' });
    }
});

/**
 * PUT /api/assessment-level-attachments/:id/description
 * Update attachment description
 */
router.put('/:id/description', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { description } = req.body;
        const organizationId = req.user.organizationId;

        db.run(
            `UPDATE assessment_level_attachments 
             SET description = ?, updated_at = datetime('now')
             WHERE id = ? AND organization_id = ?`,
            [description, id, organizationId],
            function(err) {
                if (err) {
                    console.error('[Level Attachments] Update error:', err);
                    return res.status(500).json({ error: 'Failed to update attachment' });
                }

                if (this.changes === 0) {
                    return res.status(404).json({ error: 'Attachment not found' });
                }

                res.json({ id, description, updated: true });
            }
        );
    } catch (error) {
        console.error('[Level Attachments] Update error:', error);
        res.status(500).json({ error: 'Failed to update attachment' });
    }
});

/**
 * GET /api/assessment-level-attachments/level/:assessmentId/:axisId/:levelNumber
 * Get attachments for a specific level (shortcut endpoint)
 */
router.get('/level/:assessmentId/:axisId/:levelNumber', verifyToken, async (req, res) => {
    try {
        const { assessmentId, axisId, levelNumber } = req.params;
        const { areaId } = req.query;
        const organizationId = req.user.organizationId;

        let sql = `
            SELECT 
                id, attachment_type, file_name, file_size, mime_type,
                description, ai_analysis, ai_suggested_score, ai_confidence, created_at
            FROM assessment_level_attachments
            WHERE assessment_id = ? AND axis_id = ? AND level_number = ? AND organization_id = ?
        `;
        const params = [assessmentId, axisId, parseInt(levelNumber), organizationId];

        if (areaId) {
            sql += ' AND area_id = ?';
            params.push(areaId);
        }

        sql += ' ORDER BY created_at DESC';

        db.all(sql, params, (err, rows) => {
            if (err) {
                console.error('[Level Attachments] Level fetch error:', err);
                return res.status(500).json({ error: 'Failed to fetch attachments' });
            }

            res.json({
                axisId,
                levelNumber: parseInt(levelNumber),
                areaId: areaId || null,
                attachments: (rows || []).map(row => ({
                    id: row.id,
                    attachmentType: row.attachment_type,
                    fileName: row.file_name,
                    fileSize: row.file_size,
                    mimeType: row.mime_type,
                    description: row.description,
                    aiAnalysis: row.ai_analysis ? JSON.parse(row.ai_analysis) : null,
                    aiSuggestedScore: row.ai_suggested_score,
                    aiConfidence: row.ai_confidence,
                    createdAt: row.created_at
                })),
                count: (rows || []).length
            });
        });
    } catch (error) {
        console.error('[Level Attachments] Level fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch attachments' });
    }
});

export default router;


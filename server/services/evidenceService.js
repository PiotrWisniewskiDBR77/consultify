/**
 * Evidence Service
 * 
 * Manages evidence attachments for digitization assessment scores.
 * Supports documents, links, screenshots, and notes.
 * 
 * Enterprise Features:
 * - File upload handling
 * - Evidence verification workflow
 * - Categorization and tagging
 * - Audit trail
 */

import fs from 'fs/promises'; // Changed to fs/promises to maintain async fs operations
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import db from '../database.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// Upload directory configuration
const UPLOAD_DIR = path.join(__dirname, '../../uploads/evidence');
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_EXTENSIONS = [
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.txt', '.csv', '.json',
    '.png', '.jpg', '.jpeg', '.gif', '.webp',
    '.zip', '.rar'
];

const EvidenceService = {
    // ============================================
    // Evidence CRUD Operations
    // ============================================

    /**
     * Add evidence to a score
     * @param {string} scoreId - The axis score ID
     * @param {Object} data - Evidence data
     * @param {string} userId - User adding evidence
     * @returns {Promise<Object>} - Created evidence
     */
    addEvidence: async (scoreId, data, userId) => {
        const {
            evidenceType,
            title,
            content,
            category
        } = data;

        const id = uuidv4();
        const now = new Date().toISOString();

        const sql = `
            INSERT INTO digitization_evidence (
                id, score_id, evidence_type, title, content,
                category, uploaded_by, uploaded_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await db.run(sql, [
            id,
            scoreId,
            evidenceType || 'note',
            title,
            content || null,
            category || null,
            userId,
            now,
            now
        ]);

        return EvidenceService.getEvidence(id);
    },

    /**
     * Upload file as evidence
     * @param {string} scoreId - The axis score ID
     * @param {Object} file - Multer file object
     * @param {Object} metadata - Additional metadata
     * @param {string} userId - User uploading
     * @returns {Promise<Object>} - Created evidence
     */
    uploadEvidenceFile: async (scoreId, file, metadata = {}, userId) => {
        // Validate file extension
        const ext = path.extname(file.originalname).toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            throw new Error(`File type ${ext} is not allowed`);
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            throw new Error('File size exceeds maximum allowed (25MB)');
        }

        // Ensure upload directory exists
        await fs.mkdir(UPLOAD_DIR, { recursive: true });

        // Generate unique filename
        const uniqueFilename = `${uuidv4()}_${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const filePath = path.join(UPLOAD_DIR, uniqueFilename);
        const relativePath = `/uploads/evidence/${uniqueFilename}`;

        // Move file to permanent location
        await fs.rename(file.path, filePath);

        const id = uuidv4();
        const now = new Date().toISOString();

        const sql = `
            INSERT INTO digitization_evidence (
                id, score_id, evidence_type, title, content,
                file_path, file_size, mime_type,
                category, uploaded_by, uploaded_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await db.run(sql, [
            id,
            scoreId,
            'document',
            metadata.title || file.originalname,
            metadata.description || null,
            relativePath,
            file.size,
            file.mimetype,
            metadata.category || null,
            userId,
            now,
            now
        ]);

        return EvidenceService.getEvidence(id);
    },

    /**
     * Get evidence by ID
     */
    getEvidence: async (evidenceId) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT e.*, u.first_name || ' ' || u.last_name as uploaded_by_name
                 FROM digitization_evidence e
                 LEFT JOIN users u ON e.uploaded_by = u.id
                 WHERE e.id = ?`,
                [evidenceId],
                (err, evidence) => {
                    if (err) reject(err);
                    else resolve(evidence);
                }
            );
        });
    },

    /**
     * Get all evidence for a score
     */
    getEvidenceForScore: async (scoreId, options = {}) => {
        const { category, verified } = options;

        let sql = `
            SELECT e.*, u.first_name || ' ' || u.last_name as uploaded_by_name
            FROM digitization_evidence e
            LEFT JOIN users u ON e.uploaded_by = u.id
            WHERE e.score_id = ?
        `;
        const params = [scoreId];

        if (category) {
            sql += ' AND e.category = ?';
            params.push(category);
        }

        if (verified !== undefined) {
            sql += ' AND e.is_verified = ?';
            params.push(verified ? 1 : 0);
        }

        sql += ' ORDER BY e.uploaded_at DESC';

        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    },

    /**
     * Get all evidence for an analysis
     */
    getEvidenceForAnalysis: async (analysisId) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT e.*, 
                        s.axis_id, s.area_id, s.area_code,
                        u.first_name || ' ' || u.last_name as uploaded_by_name
                 FROM digitization_evidence e
                 JOIN digitization_axis_scores s ON e.score_id = s.id
                 LEFT JOIN users u ON e.uploaded_by = u.id
                 WHERE s.analysis_id = ?
                 ORDER BY s.axis_id, s.area_id, e.uploaded_at DESC`,
                [analysisId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });
    },

    /**
     * Update evidence metadata
     */
    updateEvidence: async (evidenceId, updates) => {
        const allowedFields = ['title', 'content', 'category'];
        const updateParts = [];
        const params = [];

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                updateParts.push(`${key} = ?`);
                params.push(value);
            }
        }

        if (updateParts.length === 0) {
            return EvidenceService.getEvidence(evidenceId);
        }

        updateParts.push('updated_at = ?');
        params.push(new Date().toISOString());
        params.push(evidenceId);

        await db.run(
            `UPDATE digitization_evidence 
             SET ${updateParts.join(', ')}
             WHERE id = ?`,
            params
        );

        return EvidenceService.getEvidence(evidenceId);
    },

    /**
     * Delete evidence
     */
    deleteEvidence: async (evidenceId) => {
        const evidence = await EvidenceService.getEvidence(evidenceId);
        if (!evidence) {
            throw new Error('Evidence not found');
        }

        // Delete file if exists
        if (evidence.file_path) {
            try {
                const fullPath = path.join(__dirname, '../..', evidence.file_path);
                await fs.unlink(fullPath);
            } catch (err) {
                console.warn('[EvidenceService] Failed to delete file:', err.message);
            }
        }

        await db.run(
            `DELETE FROM digitization_evidence WHERE id = ?`,
            [evidenceId]
        );

        return true;
    },

    // ============================================
    // Evidence Verification Workflow
    // ============================================

    /**
     * Mark evidence as verified
     */
    verifyEvidence: async (evidenceId, userId) => {
        const now = new Date().toISOString();

        await db.run(
            `UPDATE digitization_evidence 
             SET is_verified = 1, verified_by = ?, verified_at = ?, updated_at = ?
             WHERE id = ?`,
            [userId, now, now, evidenceId]
        );

        return EvidenceService.getEvidence(evidenceId);
    },

    /**
     * Remove verification from evidence
     */
    unverifyEvidence: async (evidenceId) => {
        await db.run(
            `UPDATE digitization_evidence 
             SET is_verified = 0, verified_by = NULL, verified_at = NULL, updated_at = ?
             WHERE id = ?`,
            [new Date().toISOString(), evidenceId]
        );

        return EvidenceService.getEvidence(evidenceId);
    },

    /**
     * Get verification statistics for an analysis
     */
    getVerificationStats: async (analysisId) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN e.is_verified = 1 THEN 1 ELSE 0 END) as verified,
                    SUM(CASE WHEN e.is_verified = 0 OR e.is_verified IS NULL THEN 1 ELSE 0 END) as unverified,
                    COUNT(DISTINCT e.score_id) as scores_with_evidence
                 FROM digitization_evidence e
                 JOIN digitization_axis_scores s ON e.score_id = s.id
                 WHERE s.analysis_id = ?`,
                [analysisId],
                (err, stats) => {
                    if (err) reject(err);
                    else resolve(stats || { total: 0, verified: 0, unverified: 0, scores_with_evidence: 0 });
                }
            );
        });
    },

    // ============================================
    // Evidence Categories
    // ============================================

    /**
     * Get available evidence categories
     */
    getCategories: () => {
        return [
            { id: 'policy', name: 'Policy Document', nameEn: 'Policy Document' },
            { id: 'procedure', name: 'Procedura', nameEn: 'Procedure' },
            { id: 'screenshot', name: 'Zrzut ekranu', nameEn: 'Screenshot' },
            { id: 'interview', name: 'Notatka z wywiadu', nameEn: 'Interview Notes' },
            { id: 'audit', name: 'Raport audytu', nameEn: 'Audit Report' },
            { id: 'metric', name: 'Metryka/KPI', nameEn: 'Metric/KPI' },
            { id: 'training', name: 'Materiał szkoleniowy', nameEn: 'Training Material' },
            { id: 'contract', name: 'Umowa/Kontrakt', nameEn: 'Contract' },
            { id: 'certification', name: 'Certyfikat', nameEn: 'Certification' },
            { id: 'other', name: 'Inne', nameEn: 'Other' }
        ];
    },

    // ============================================
    // Bulk Operations
    // ============================================

    /**
     * Delete all evidence for a score
     */
    deleteEvidenceForScore: async (scoreId) => {
        // Get all evidence to delete files
        const evidence = await EvidenceService.getEvidenceForScore(scoreId);

        // Delete files
        for (const e of evidence) {
            if (e.file_path) {
                try {
                    const fullPath = path.join(__dirname, '../..', e.file_path);
                    await fs.unlink(fullPath);
                } catch (err) {
                    console.warn('[EvidenceService] Failed to delete file:', err.message);
                }
            }
        }

        await db.run(
            `DELETE FROM digitization_evidence WHERE score_id = ?`,
            [scoreId]
        );

        return evidence.length;
    },

    /**
     * Copy evidence to another score (for duplication)
     */
    copyEvidenceToScore: async (fromScoreId, toScoreId, userId) => {
        const evidence = await EvidenceService.getEvidenceForScore(fromScoreId);
        const copied = [];

        for (const e of evidence) {
            // For notes/links, just copy metadata
            if (!e.file_path) {
                const newEvidence = await EvidenceService.addEvidence(toScoreId, {
                    evidenceType: e.evidence_type,
                    title: e.title,
                    content: e.content,
                    category: e.category
                }, userId);
                copied.push(newEvidence);
            }
            // For files, we copy the reference (files are shared)
            else {
                const id = uuidv4();
                const now = new Date().toISOString();

                await db.run(
                    `INSERT INTO digitization_evidence (
                        id, score_id, evidence_type, title, content,
                        file_path, file_size, mime_type,
                        category, uploaded_by, uploaded_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        id,
                        toScoreId,
                        e.evidence_type,
                        e.title,
                        e.content,
                        e.file_path, // Same file path
                        e.file_size,
                        e.mime_type,
                        e.category,
                        userId,
                        now,
                        now
                    ]
                );

                copied.push(await EvidenceService.getEvidence(id));
            }
        }

        return copied;
    },

    // ============================================
    // Evidence Count Helpers
    // ============================================

    /**
     * Get evidence count per score for an analysis
     */
    getEvidenceCountsForAnalysis: async (analysisId) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT 
                    s.axis_id,
                    s.area_id,
                    s.id as score_id,
                    COUNT(e.id) as evidence_count,
                    SUM(CASE WHEN e.is_verified = 1 THEN 1 ELSE 0 END) as verified_count
                 FROM digitization_axis_scores s
                 LEFT JOIN digitization_evidence e ON s.id = e.score_id
                 WHERE s.analysis_id = ?
                 GROUP BY s.id`,
                [analysisId],
                (err, rows) => {
                    if (err) reject(err);
                    else {
                        // Convert to map for easy lookup
                        const counts = {};
                        for (const row of rows || []) {
                            counts[`${row.axis_id}:${row.area_id}`] = {
                                scoreId: row.score_id,
                                evidenceCount: row.evidence_count || 0,
                                verifiedCount: row.verified_count || 0
                            };
                        }
                        resolve(counts);
                    }
                }
            );
        });
    }
};

export default EvidenceService;


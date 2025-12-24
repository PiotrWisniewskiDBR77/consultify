/**
 * External Assessment Service
 * 
 * Manages external digital transformation framework assessments (SIRI, ADMA, CMMI).
 * Handles file upload, framework-specific parsing, score normalization, and DRD mapping.
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const PDFParserService = require('./pdfParserService');

class ExternalAssessmentService {
    /**
     * Framework-to-DRD axis mapping
     * Maps external framework dimensions to DRD axes
     */
    static FRAMEWORK_MAPPINGS = {
        SIRI: {
            'Process Digitalization': 'digitalProducts',
            'Automation': 'digitalProducts',
            'Integration': 'dataManagement',
            'Interoperability': 'dataManagement',
            'Smart Manufacturing': 'processes',
            'Industrial Internet': 'digitalProducts',
            'Strategy': 'businessModels',
            'Governance': 'culture',
            'Skills & People': 'culture'
        },
        ADMA: {
            'Digital Infrastructure': 'digitalProducts',
            'Digital Literacy': 'culture',
            'Digital Innovation': 'businessModels',
            'Digital Government': 'processes',
            'Digital Business': 'businessModels',
            'Cybersecurity': 'cybersecurity',
            'Data Governance': 'dataManagement',
            'Digital Trust': 'cybersecurity'
        }
    };

    /**
     * Upload and process external assessment
     * @param {Object} params - Upload parameters
     * @returns {Promise<Object>} Created assessment
     */
    static async uploadAssessment({
        organizationId,
        projectId,
        frameworkType,
        frameworkVersion,
        assessmentDate,
        filePath,
        fileName,
        fileSize,
        uploadMethod,
        userId
    }) {
        try {
            const assessmentId = uuidv4();

            // Initial insert with 'uploaded' status
            const sql = `
                INSERT INTO external_digital_assessments (
                    id, organization_id, project_id,
                    framework_type, framework_version, assessment_date,
                    file_path, file_name, file_size, upload_method,
                    raw_scores_json, processing_status,
                    uploaded_by, uploaded_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'uploaded', ?, datetime('now'))
            `;

            await new Promise((resolve, reject) => {
                db.run(sql, [
                    assessmentId,
                    organizationId,
                    projectId || null,
                    frameworkType,
                    frameworkVersion || null,
                    assessmentDate || null,
                    filePath,
                    fileName,
                    fileSize,
                    uploadMethod,
                    '{}', // Empty scores initially
                    userId
                ], function (err) {
                    if (err) return reject(err);
                    resolve();
                });
            });

            //Start async processing (if PDF)
            if (uploadMethod === 'PDF_PARSE') {
                this.processAssessmentFile(assessmentId, filePath, frameworkType).catch(err => {
                    console.error('[ExternalAssessment] Processing error:', err.message);
                    this.updateProcessingStatus(assessmentId, 'error', err.message);
                });
            }

            return {
                id: assessmentId,
                processing_status: 'uploaded'
            };
        } catch (error) {
            console.error('[ExternalAssessment] Upload error:', error);
            throw error;
        }
    }

    /**
     * Process assessment file (async)
     * @param {string} assessmentId - Assessment ID
     * @param {string} filePath - Path to PDF file
     * @param {string} frameworkType - Framework type
     */
    static async processAssessmentFile(assessmentId, filePath, frameworkType) {
        try {
            // Update status to 'processing'
            await this.updateProcessingStatus(assessmentId, 'processing');

            // Extract text from PDF
            const pdfText = await PDFParserService.extractText(filePath);

            // Parse framework-specific data
            let rawScores = {};
            if (frameworkType === 'SIRI') {
                const parsed = PDFParserService.parseSIRI(pdfText);
                rawScores = parsed.scores;
            } else if (frameworkType === 'ADMA') {
                const parsed = PDFParserService.parseADMA(pdfText);
                rawScores = parsed.scores;
            }

            // Normalize scores to DRD 1-7 scale
            const normalizedScores = this.normalizeScores(rawScores, frameworkType);

            // Map to DRD axes
            const drdMapping = this.mapToDRDAxes(rawScores, frameworkType);

            // Calculate mapping confidence
            const confidence = this.calculateMappingConfidence(rawScores);

            // Update database
            await this.updateAssessmentScores(assessmentId, {
                rawScores,
                normalizedScores,
                drdMapping,
                confidence
            });

            console.log(`[ExternalAssessment] Processing complete: ${assessmentId}`);
        } catch (error) {
            console.error('[ExternalAssessment] Processing error:', error.message);
            await this.updateProcessingStatus(assessmentId, 'error', error.message);
            throw error;
        }
    }

    /**
     * Normalize scores from framework scale to DRD 1-7 scale
     * @param {Object} rawScores - Framework-specific scores
     * @param {string} frameworkType - Framework type
     * @returns {Object} Normalized scores (1-7 scale)
     */
    static normalizeScores(rawScores, frameworkType) {
        const normalized = {};

        // Most frameworks use 1-5 scale, DRD uses 1-7
        Object.keys(rawScores).forEach(dimension => {
            const rawScore = rawScores[dimension];
            // Linear interpolation: (raw - 1) / 4 * 6 + 1
            normalized[dimension] = Math.round(((rawScore - 1) / 4 * 6 + 1) * 10) / 10;
        });

        return normalized;
    }

    /**
     * Map framework dimensions to DRD axes
     * @param {Object} rawScores - Framework scores
     * @param {string} frameworkType - Framework type
     * @returns {Object} DRD axis mapping
     */
    static mapToDRDAxes(rawScores, frameworkType) {
        const mapping = this.FRAMEWORK_MAPPINGS[frameworkType] || {};
        const drdScores = {};

        Object.keys(rawScores).forEach(dimension => {
            const drdAxis = mapping[dimension];
            if (drdAxis) {
                if (!drdScores[drdAxis]) {
                    drdScores[drdAxis] = [];
                }
                // Normalize to 1-7 scale
                const normalizedScore = Math.round(((rawScores[dimension] - 1) / 4 * 6 + 1) * 10) / 10;
                drdScores[drdAxis].push(normalizedScore);
            }
        });

        // Average scores for each DRD axis
        const averagedScores = {};
        Object.keys(drdScores).forEach(axis => {
            const scores = drdScores[axis];
            averagedScores[axis] = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
        });

        return averagedScores;
    }

    /**
     * Calculate mapping confidence
     * @param {Object} rawScores - Framework scores
     * @returns {number} Confidence score (0-1)
     */
    static calculateMappingConfidence(rawScores) {
        // Simple heuristic: more dimensions = higher confidence
        const dimensionCount = Object.keys(rawScores).length;

        if (dimensionCount >= 8) return 0.95;
        if (dimensionCount >= 5) return 0.85;
        if (dimensionCount >= 3) return 0.70;
        return 0.50;
    }

    /**
     * Update processing status
     * @param {string} assessmentId - Assessment ID
     * @param {string} status - New status
     * @param {string} error - Error message (optional)
     */
    static async updateProcessingStatus(assessmentId, status, error = null) {
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE external_digital_assessments
                SET processing_status = ?, processing_error = ?
                WHERE id = ?
            `;

            db.run(sql, [status, error, assessmentId], function (err) {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    /**
     * Update assessment scores after processing
     * @param {string} assessmentId - Assessment ID
     * @param {Object} data - Score data
     */
    static async updateAssessmentScores(assessmentId, { rawScores, normalizedScores, drdMapping, confidence }) {
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE external_digital_assessments
                SET raw_scores_json = ?,
                    normalized_scores_json = ?,
                    drd_axis_mapping = ?,
                    mapping_confidence = ?,
                    processing_status = 'mapped'
                WHERE id = ?
            `;

            db.run(sql, [
                JSON.stringify(rawScores),
                JSON.stringify(normalizedScores),
                JSON.stringify(drdMapping),
                confidence,
                assessmentId
            ], function (err) {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    /**
     * Get assessment by ID
     * @param {string} assessmentId - Assessment ID
     * @param {string} organizationId - Organization ID
     * @returns {Promise<Object>} Assessment data
     */
    static async getAssessment(assessmentId, organizationId) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM external_digital_assessments WHERE id = ? AND organization_id = ?`;

            db.get(sql, [assessmentId, organizationId], (err, row) => {
                if (err) return reject(err);
                if (!row) return reject(new Error('Assessment not found'));

                // Parse JSON fields
                row.raw_scores_json = JSON.parse(row.raw_scores_json || '{}');
                row.normalized_scores_json = JSON.parse(row.normalized_scores_json || '{}');
                row.drd_axis_mapping = JSON.parse(row.drd_axis_mapping || '{}');
                row.inconsistencies = JSON.parse(row.inconsistencies || '[]');

                resolve(row);
            });
        });
    }

    /**
     * Detect inconsistencies with DRD assessment
     * @param {string} organizationId - Organization ID
     * @param {string} projectId - Project ID
     * @param {Object} externalAssessment - External assessment data
     * @returns {Array} Detected inconsistencies
     */
    static async detectInconsistencies(organizationId, projectId, externalAssessment) {
        // TODO: Compare with DRD assessment for same project
        // For now, return empty array
        return [];
    }
}

module.exports = ExternalAssessmentService;

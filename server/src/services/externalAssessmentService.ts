import { v4 as uuidv4 } from 'uuid';

import DbPromise from '../utils/DbPromise.ts';
import logger from '../utils/Logger.ts';
import PDFParserService from './pdfParserService.js';

/**
 * External Assessment Service
 *
 * Manages external digital transformation framework assessments (SIRI, ADMA, CMMI).
 * Handles file upload, framework-specific parsing, score normalization, and DRD mapping.
 */
class ExternalAssessmentService {
    private db: any;

    constructor() {
        // Dependencies will be injected or imported
    }

    setDependencies(deps: { db: any }) {
        this.db = deps.db;
    }

    /**
     * Framework-to-DRD axis mapping
     * Maps external framework dimensions to DRD axes
     */
    static FRAMEWORK_MAPPINGS: Record<string, Record<string, string>> = {
        SIRI: {
            'Process Digitalization': 'digitalProducts',
            Automation: 'digitalProducts',
            Integration: 'dataManagement',
            Interoperability: 'dataManagement',
            'Smart Manufacturing': 'processes',
            'Industrial Internet': 'digitalProducts',
            Strategy: 'businessModels',
            Governance: 'culture',
            'Skills & People': 'culture',
        },
        ADMA: {
            'Digital Infrastructure': 'digitalProducts',
            'Digital Literacy': 'culture',
            'Digital Innovation': 'businessModels',
            'Digital Government': 'processes',
            'Digital Business': 'businessModels',
            Cybersecurity: 'cybersecurity',
            'Data Governance': 'dataManagement',
            'Digital Trust': 'cybersecurity',
        },
    };

    /**
     * Upload and process external assessment
     */
    async uploadAssessment({
        organizationId,
        projectId,
        frameworkType,
        frameworkVersion,
        assessmentDate,
        filePath,
        fileName,
        fileSize,
        uploadMethod,
        userId,
    }: any) {
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

            await DbPromise.run(this.db, sql, [
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
                userId,
            ]);

            // Start async processing (if PDF)
            if (uploadMethod === 'PDF_PARSE') {
                this.processAssessmentFile(assessmentId, filePath, frameworkType).catch((err: Error | null) => {
                    logger.error('[ExternalAssessment] Processing error:', err.message);
                    this.updateProcessingStatus(assessmentId, 'error', err.message);
                });
            }

            return {
                id: assessmentId,
                processing_status: 'uploaded',
            };
        } catch (error) {
            logger.error('[ExternalAssessment] Upload error:', error);
            throw error;
        }
    }

    /**
     * Process assessment file (async)
     */
    async processAssessmentFile(assessmentId: string, filePath: string, frameworkType: string) {
        try {
            // Update status to 'processing'
            await this.updateProcessingStatus(assessmentId, 'processing');

            // Extract text from PDF
            const pdfText = await PDFParserService.extractText(filePath);

            // Parse framework-specific data
            let rawScores: any = {};
            if (frameworkType === 'SIRI') {
                const parsed = await PDFParserService.parseSIRI(pdfText);
                rawScores = parsed.scores;
            } else if (frameworkType === 'ADMA') {
                const parsed = await PDFParserService.parseADMA(pdfText);
                rawScores = parsed.scores;
            }

            // Normalize scores to DRD 1-7 scale
            const normalizedScores = ExternalAssessmentService.normalizeScores(rawScores, frameworkType);

            // Map to DRD axes
            const drdMapping = ExternalAssessmentService.mapToDRDAxes(rawScores, frameworkType);

            // Calculate mapping confidence
            const confidence = ExternalAssessmentService.calculateMappingConfidence(rawScores);

            // Update database
            await this.updateAssessmentScores(assessmentId, {
                rawScores,
                normalizedScores,
                drdMapping,
                confidence,
            });

            logger.info(`[ExternalAssessment] Processing complete: ${assessmentId}`);
        } catch (error: any) {
            logger.error('[ExternalAssessment] Processing error:', error.message);
            await this.updateProcessingStatus(assessmentId, 'error', error.message);
            throw error;
        }
    }

    /**
     * Normalize scores from framework scale to DRD 1-7 scale
     */
    static normalizeScores(rawScores: any, frameworkType: string) {
        const normalized: any = {};

        // Most frameworks use 1-5 scale, DRD uses 1-7
        Object.keys(rawScores).forEach((dimension) => {
            const rawScore = rawScores[dimension];
            // Linear interpolation: (raw - 1) / 4 * 6 + 1
            normalized[dimension] = Math.round((((rawScore - 1) / 4) * 6 + 1) * 10) / 10;
        });

        return normalized;
    }

    // Helper for test compatibility
    static normalizeScore(score: number, min: number, max: number): number {
        // Map [min, max] to [1, 7]
        // (score - min) / (max - min) * 6 + 1
        return Math.round((((score - min) / (max - min)) * 6 + 1) * 10) / 10;
    }

    static mapSIRIToDRD(scores: any) {
        // Re-use mapToDRDAxes for SIRI
        return ExternalAssessmentService.mapToDRDAxes(scores, 'SIRI');
    }

    /**
     * Map framework dimensions to DRD axes
     */
    static mapToDRDAxes(rawScores: any, frameworkType: string) {
        const mapping = ExternalAssessmentService.FRAMEWORK_MAPPINGS[frameworkType] || {};
        const drdScores: any = {};

        Object.keys(rawScores).forEach((dimension) => {
            const drdAxis = mapping[dimension];
            if (drdAxis) {
                if (!drdScores[drdAxis]) {
                    drdScores[drdAxis] = [];
                }
                // Normalize to 1-7 scale
                const normalizedScore = Math.round((((rawScores[dimension] - 1) / 4) * 6 + 1) * 10) / 10;
                drdScores[drdAxis].push(normalizedScore);
            }
        });

        // Average scores for each DRD axis
        const averagedScores: any = {};
        Object.keys(drdScores).forEach((axis) => {
            const scores = drdScores[axis];
            averagedScores[axis] =
                Math.round((scores.reduce((a: number, b: number) => a + b, 0) / scores.length) * 10) / 10;
        });

        return averagedScores;
    }

    /**
     * Calculate mapping confidence
     */
    static calculateMappingConfidence(rawScores: any, normalizedScores?: any, frameworkType?: string) {
        // Simple heuristic: more dimensions = higher confidence
        const dimensionCount = Object.keys(rawScores).length;

        if (dimensionCount >= 8) return 0.95;
        if (dimensionCount >= 5) return 0.85;
        if (dimensionCount >= 3) return 0.7;
        return 0.5;
    }

    /**
     * Update processing status
     */
    async updateProcessingStatus(assessmentId: string, status: string, error: string | null = null) {
        const sql = `
            UPDATE external_digital_assessments
            SET processing_status = ?, processing_error = ?
            WHERE id = ?
        `;
        await DbPromise.run(this.db, sql, [status, error, assessmentId]);
    }

    /**
     * Update assessment scores after processing
     */
    async updateAssessmentScores(assessmentId: string, { rawScores, normalizedScores, drdMapping, confidence }: any) {
        const sql = `
            UPDATE external_digital_assessments
            SET raw_scores_json = ?,
                normalized_scores_json = ?,
                drd_axis_mapping = ?,
                mapping_confidence = ?,
                processing_status = 'mapped'
            WHERE id = ?
        `;

        await DbPromise.run(this.db, sql, [
            JSON.stringify(rawScores),
            JSON.stringify(normalizedScores),
            JSON.stringify(drdMapping),
            confidence,
            assessmentId,
        ]);
    }

    /**
     * Get assessment by ID
     */
    async getAssessment(assessmentId: string, organizationId: string) {
        const sql = `SELECT * FROM external_digital_assessments WHERE id = ? AND organization_id = ?`;

        const row: any = await DbPromise.get(this.db, sql, [assessmentId, organizationId]);
        if (!row) throw new Error('Assessment not found');

        // Parse JSON fields
        row.raw_scores_json = JSON.parse(row.raw_scores_json || '{}');
        row.normalized_scores_json = JSON.parse(row.normalized_scores_json || '{}');
        row.drd_axis_mapping = JSON.parse(row.drd_axis_mapping || '{}');
        row.inconsistencies = JSON.parse(row.inconsistencies || '[]');

        return row;
    }

    /**
     * Detect inconsistencies with DRD assessment
     */
    async detectInconsistencies(organizationId: string, projectId: string, externalAssessment: any) {
        // TODO: Compare with DRD assessment for same project
        // For now, return empty array
        return [];
    }
}

export default ExternalAssessmentService;

/**
 * Assessment Overview Service
 * 
 * Provides unified dashboard data aggregating all assessment types:
 * - DRD (Decision Readiness Diagnosis)
 * - RapidLean
 * - External Digital Assessments (SIRI/ADMA)
 * - Generic Reports
 */

const db = require('../database');
const RapidLeanService = require('./rapidLeanService');
const ExternalAssessmentService = require('./externalAssessmentService');

class AssessmentOverviewService {
    /**
     * Get comprehensive assessment overview for organization/project
     * @param {string} organizationId - Organization ID
     * @param {string} projectId - Project ID (optional)
     * @returns {Promise<Object>} Assessment overview
     */
    static async getAssessmentOverview(organizationId, projectId = null) {
        try {
            const overview = {
                drd: await this.getDRDSummary(organizationId, projectId),
                rapidLean: await this.getRapidLeanSummary(organizationId, projectId),
                externalDigital: await this.getExternalDigitalSummary(organizationId, projectId),
                genericReports: await this.getGenericReportsSummary(organizationId, projectId),
                consolidated: null
            };

            // Calculate consolidated metrics
            overview.consolidated = this.calculateConsolidatedMetrics(overview);

            return overview;
        } catch (error) {
            console.error('[AssessmentOverview] Error:', error.message);
            throw error;
        }
    }

    /**
     * Get DRD assessment summary
     * @param {string} organizationId - Organization ID
     * @param {string} projectId - Project ID
     * @returns {Promise<Object>} DRD summary
     */
    static async getDRDSummary(organizationId, projectId) {
        return new Promise((resolve, reject) => {
            if (!projectId) {
                return resolve({ exists: false, message: 'No project selected' });
            }

            // Get latest maturity assessment
            const sql = `
                SELECT overall_as_is, overall_to_be, overall_gap, is_complete, updated_at
                FROM maturity_assessments
                WHERE project_id = ?
                LIMIT 1
            `;

            db.get(sql, [projectId], (err, row) => {
                if (err) return reject(err);
                if (!row) {
                    return resolve({ exists: false, message: 'No DRD assessment found' });
                }

                resolve({
                    exists: true,
                    isComplete: row.is_complete === 1,
                    overallScore: row.overall_as_is,
                    targetScore: row.overall_to_be,
                    gap: row.overall_gap,
                    lastUpdated: row.updated_at
                });
            });
        });
    }

    /**
     * Get RapidLean summary
     * @param {string} organizationId - Organization ID
     * @param {string} projectId - Project ID
     * @returns {Promise<Object>} RapidLean summary
     */
    static async getRapidLeanSummary(organizationId, projectId) {
        return new Promise((resolve, reject) => {
            let sql = `
                SELECT overall_score, industry_benchmark, assessment_date
                FROM rapid_lean_assessments
                WHERE organization_id = ?
            `;

            const params = [organizationId];

            if (projectId) {
                sql += ` AND project_id = ?`;
                params.push(projectId);
            }

            sql += ` ORDER BY assessment_date DESC LIMIT 1`;

            db.get(sql, params, (err, row) => {
                if (err) return reject(err);
                if (!row) {
                    return resolve({ exists: false, message: 'No RapidLean assessment found' });
                }

                resolve({
                    exists: true,
                    overallScore: row.overall_score,
                    benchmark: row.industry_benchmark,
                    gap: row.industry_benchmark - row.overall_score,
                    lastAssessed: row.assessment_date
                });
            });
        });
    }

    /**
     * Get external digital assessments summary
     * @param {string} organizationId - Organization ID
     * @param {string} projectId - Project ID
     * @returns {Promise<Object>} External assessments summary
     */
    static async getExternalDigitalSummary(organizationId, projectId) {
        return new Promise((resolve, reject) => {
            let sql = `
                SELECT framework_type, COUNT(*) as count, 
                       AVG(mapping_confidence) as avg_confidence
                FROM external_digital_assessments
                WHERE organization_id = ? AND processing_status = 'mapped'
            `;

            const params = [organizationId];

            if (projectId) {
                sql += ` AND project_id = ?`;
                params.push(projectId);
            }

            sql += ` GROUP BY framework_type`;

            db.all(sql, params, (err, rows) => {
                if (err) return reject(err);
                if (!rows || rows.length === 0) {
                    return resolve({ exists: false, message: 'No external assessments found' });
                }

                resolve({
                    exists: true,
                    frameworks: rows.map(r => ({
                        type: r.framework_type,
                        count: r.count,
                        avgConfidence: Math.round(r.avg_confidence * 100)
                    })),
                    totalCount: rows.reduce((sum, r) => sum + r.count, 0)
                });
            });
        });
    }

    /**
     * Get generic reports summary
     * @param {string} organizationId - Organization ID
     * @param {string} projectId - Project ID
     * @returns {Promise<Object>} Reports summary
     */
    static async getGenericReportsSummary(organizationId, projectId) {
        return new Promise((resolve, reject) => {
            let sql = `
                SELECT report_type, COUNT(*) as count
                FROM generic_assessment_reports
                WHERE organization_id = ?
            `;

            const params = [organizationId];

            if (projectId) {
                sql += ` AND project_id = ?`;
                params.push(projectId);
            }

            sql += ` GROUP BY report_type`;

            db.all(sql, params, (err, rows) => {
                if (err) return reject(err);
                if (!rows || rows.length === 0) {
                    return resolve({ exists: false, message: 'No generic reports found' });
                }

                resolve({
                    exists: true,
                    byType: rows.map(r => ({
                        type: r.report_type,
                        count: r.count
                    })),
                    totalCount: rows.reduce((sum, r) => sum + r.count, 0)
                });
            });
        });
    }

    /**
     * Calculate consolidated metrics across all assessment types
     * @param {Object} overview - Overview data from all sources
     * @returns {Object} Consolidated metrics
     */
    static calculateConsolidatedMetrics(overview) {
        const metrics = {
            totalAssessments: 0,
            completedModules: 0,
            strongestAreas: [],
            weakestAreas: [],
            overallReadiness: 0
        };

        // Count completed modules
        if (overview.drd.exists && overview.drd.isComplete) metrics.completedModules++;
        if (overview.rapidLean.exists) metrics.completedModules++;
        if (overview.externalDigital.exists) metrics.completedModules++;
        if (overview.genericReports.exists) metrics.completedModules++;

        // Count total assessments
        metrics.totalAssessments = metrics.completedModules;
        if (overview.externalDigital.exists) {
            metrics.totalAssessments += (overview.externalDigital.totalCount - 1);
        }
        if (overview.genericReports.exists) {
            metrics.totalAssessments += (overview.genericReports.totalCount - 1);
        }

        // Calculate overall readiness (average of available scores)
        const scores = [];
        if (overview.drd.exists && overview.drd.overallScore) {
            scores.push(overview.drd.overallScore);
        }
        if (overview.rapidLean.exists && overview.rapidLean.overallScore) {
            // Convert 1-5 to 1-7 scale
            const normalizedScore = (overview.rapidLean.overallScore - 1) / 4 * 6 + 1;
            scores.push(normalizedScore);
        }

        if (scores.length > 0) {
            metrics.overallReadiness = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
        }

        // TODO: Identify strongest/weakest areas by aggregating DRD + Lean + External
        metrics.strongestAreas = ['To be implemented'];
        metrics.weakestAreas = ['To be implemented'];

        return metrics;
    }
}

module.exports = AssessmentOverviewService;

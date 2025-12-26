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


    /**
     * Get list of assessments for AssessmentTable component
     * @param {string} organizationId - Organization ID
     * @param {string} projectId - Project ID (optional)
     * @param {string} currentUserId - Current user ID for review detection
     * @returns {Promise<Array>} List of assessments
     */
    static async getAssessmentsList(organizationId, projectId, currentUserId = null) {
        return new Promise((resolve, reject) => {
            // Build SQL with review information
            let sql = `
                SELECT 
                    aw.id,
                    aw.assessment_id,
                    aw.project_id,
                    aw.status,
                    aw.created_at,
                    aw.updated_at,
                    p.name as project_name,
                    u.first_name || ' ' || u.last_name as created_by_name,
                    ma.overall_as_is,
                    ma.overall_to_be,
                    ma.is_complete,
                    -- Review information for current user
                    CASE WHEN ar_me.reviewer_id IS NOT NULL THEN 1 ELSE 0 END AS review_requested_for_me,
                    ar_me.status AS my_review_status,
                    -- Total reviewers count
                    (SELECT COUNT(*) FROM assessment_reviews ar2 WHERE ar2.workflow_id = aw.id) AS reviewers_count,
                    -- Pending reviews count
                    (SELECT COUNT(*) FROM assessment_reviews ar3 WHERE ar3.workflow_id = aw.id AND ar3.status = 'PENDING') AS pending_reviews_count
                FROM assessment_workflows aw
                LEFT JOIN projects p ON aw.project_id = p.id
                LEFT JOIN users u ON aw.created_by = u.id
                LEFT JOIN maturity_assessments ma ON aw.project_id = ma.project_id
                LEFT JOIN assessment_reviews ar_me ON aw.id = ar_me.workflow_id AND ar_me.reviewer_id = ?
                WHERE aw.organization_id = ?
            `;

            const params = [currentUserId || '', organizationId];

            if (projectId) {
                sql += ` AND aw.project_id = ?`;
                params.push(projectId);
            }

            sql += ` ORDER BY aw.updated_at DESC`;

            db.all(sql, params, (err, rows) => {
                if (err) {
                    // If table doesn't exist, return empty array
                    if (err.message && err.message.includes('no such table')) {
                        console.warn('[AssessmentOverview] assessment_workflows table not found, returning empty list');
                        return resolve([]);
                    }
                    return reject(err);
                }

                const assessments = (rows || []).map(row => ({
                    id: row.assessment_id || row.id,
                    name: `DRD Assessment - ${new Date(row.created_at).toLocaleDateString()}`,
                    projectName: row.project_name || 'Unknown Project',
                    status: row.status || 'DRAFT',
                    progress: row.is_complete ? 100 : Math.round((row.overall_as_is / 7) * 100) || 0,
                    completedAxes: row.is_complete ? 7 : Math.min(Math.floor((row.overall_as_is || 0) * 7 / 7), 7),
                    totalAxes: 7,
                    createdAt: row.created_at,
                    updatedAt: row.updated_at,
                    createdBy: row.created_by_name || 'System',
                    canCreateReport: row.status === 'APPROVED',
                    // Review fields
                    reviewRequestedForMe: row.review_requested_for_me === 1,
                    myReviewStatus: row.my_review_status || null,
                    reviewersCount: row.reviewers_count || 0,
                    pendingReviewsCount: row.pending_reviews_count || 0
                }));

                resolve(assessments);
            });
        });
    }


    /**
     * Get list of reports for ReportsTable component
     * @param {string} organizationId - Organization ID
     * @param {string} projectId - Project ID
     * @returns {Promise<Array>} List of reports
     */
    static async getReportsList(organizationId, projectId) {
        return new Promise((resolve, reject) => {
            // assessment_reports table columns: title, report_status, generated_at, based_on_id, project_id
            let sql = `
                SELECT 
                    ar.id,
                    ar.title as name,
                    ar.based_on_id as assessment_id,
                    COALESCE(ar.report_status, 'DRAFT') as status,
                    ar.generated_at as created_at,
                    ar.generated_at as updated_at,
                    ar.project_id,
                    p.name as project_name,
                    u.first_name || ' ' || u.last_name as created_by,
                    (SELECT COUNT(*) FROM initiatives i WHERE i.project_id = ar.project_id) as initiatives_count
                FROM assessment_reports ar
                LEFT JOIN projects p ON ar.project_id = p.id
                LEFT JOIN users u ON ar.created_by = u.id
                WHERE ar.organization_id = ?
            `;

            const params = [organizationId];

            if (projectId) {
                sql += ` AND ar.project_id = ?`;
                params.push(projectId);
            }

            sql += ` ORDER BY ar.generated_at DESC`;

            db.all(sql, params, (err, rows) => {
                if (err) {
                    // If table doesn't exist, return empty array
                    if (err.message && err.message.includes('no such table')) {
                        return resolve([]);
                    }
                    return reject(err);
                }

                const reports = (rows || []).map(row => ({
                    id: row.id,
                    name: row.name || `Report - ${new Date(row.created_at).toLocaleDateString()}`,
                    assessmentId: row.assessment_id,
                    assessmentName: `DRD Assessment`,
                    status: row.status || 'DRAFT',
                    createdAt: row.created_at,
                    updatedAt: row.updated_at,
                    createdBy: row.created_by || 'System',
                    canGenerateInitiatives: row.status === 'FINAL',
                    initiativesGenerated: (row.initiatives_count || 0) > 0,
                    initiativesCount: row.initiatives_count || 0
                }));

                resolve(reports);
            });
        });
    }

    /**
     * Get full assessment details for Map view
     * @param {string} assessmentId - Assessment ID (from assessment_workflows)
     * @returns {Promise<Object|null>} Full assessment details or null
     */
    static async getAssessmentDetails(assessmentId) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    aw.id,
                    aw.assessment_id,
                    aw.project_id,
                    aw.status,
                    aw.created_at,
                    aw.updated_at,
                    p.name as project_name,
                    ma.axis_scores,
                    ma.overall_as_is,
                    ma.overall_to_be,
                    ma.is_complete
                FROM assessment_workflows aw
                LEFT JOIN projects p ON aw.project_id = p.id
                LEFT JOIN maturity_assessments ma ON aw.project_id = ma.project_id
                WHERE aw.id = ? OR aw.assessment_id = ?
            `;

            db.get(sql, [assessmentId, assessmentId], (err, row) => {
                if (err) return reject(err);
                if (!row) return resolve(null);

                // Parse axis_scores from JSON
                let axisData = {};
                try {
                    const scores = JSON.parse(row.axis_scores || '[]');
                    // Convert DB format to frontend format
                    axisData = AssessmentOverviewService.convertAxisScoresToFrontendFormat(scores);
                } catch (e) {
                    console.warn('[AssessmentOverview] Could not parse axis_scores:', e);
                }

                resolve({
                    id: row.assessment_id || row.id,
                    name: `DRD Assessment - ${new Date(row.created_at).toLocaleDateString()}`,
                    projectId: row.project_id,
                    projectName: row.project_name || 'Unknown Project',
                    status: row.status || 'DRAFT',
                    createdAt: row.created_at,
                    updatedAt: row.updated_at,
                    axisData: axisData,
                    overallAsIs: row.overall_as_is,
                    overallToBe: row.overall_to_be,
                    isComplete: row.is_complete === 1
                });
            });
        });
    }

    /**
     * Convert DB axis_scores format to frontend AxisAssessment format
     * @param {Array|Object} scores - Axis scores from DB
     * @returns {Object} Frontend-compatible axis data
     */
    static convertAxisScoresToFrontendFormat(scores) {
        const axisMapping = {
            'processes': 'processes',
            'digitalProducts': 'digitalProducts',
            'businessModels': 'businessModels',
            'dataManagement': 'dataManagement',
            'culture': 'culture',
            'cybersecurity': 'cybersecurity',
            'aiMaturity': 'aiMaturity'
        };

        const result = {};

        // Initialize all axes with defaults
        Object.values(axisMapping).forEach(axis => {
            result[axis] = {
                actual: 1,
                target: 1,
                justification: '',
                notes: ''
            };
        });

        // Handle array format from DB
        if (Array.isArray(scores)) {
            scores.forEach(score => {
                const axis = score.axis || score.axisId;
                if (axisMapping[axis]) {
                    result[axisMapping[axis]] = {
                        actual: score.asIs || score.actual || 1,
                        target: score.toBe || score.target || 1,
                        justification: score.justification || '',
                        notes: score.notes || ''
                    };
                }
            });
        } else if (typeof scores === 'object' && scores !== null) {
            // Handle object format
            Object.keys(scores).forEach(axis => {
                if (axisMapping[axis]) {
                    const data = scores[axis];
                    result[axisMapping[axis]] = {
                        actual: data.asIs || data.actual || 1,
                        target: data.toBe || data.target || 1,
                        justification: data.justification || '',
                        notes: data.notes || ''
                    };
                }
            });
        }

        return result;
    }
}

module.exports = AssessmentOverviewService;


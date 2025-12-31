/**
 * Economics Service
 * 
 * Business logic for digitization maturity analyses management
 * Provides CRUD operations and scoring calculations
 */

const uuidv4 = require('uuid').v4;
const queryHelpers = require('../utils/queryHelpers');
let db = require('../database');

const EconomicsService = {
    VALUE_TYPES: {
        COST_REDUCTION: 'COST_REDUCTION',
        REVENUE_INCREASE: 'REVENUE_INCREASE',
        RISK_REDUCTION: 'RISK_REDUCTION',
        EFFICIENCY: 'EFFICIENCY',
        STRATEGIC_OPTION: 'STRATEGIC_OPTION'
    },

    /**
     * Set dependencies (for test mocking)
     */
    setDependencies: (deps) => {
        if (deps.db) db = deps.db;
        // Note: queryHelpers uses its own db reference unless we refactor it too, 
        // but for integration tests it points to the same singleton.
    },

    // ============================================
    // Analysis CRUD Operations
    // ============================================

    /**
     * Create a new digitization analysis
     */
    createAnalysis: async (data, organizationId, userId) => {
        const id = uuidv4();
        const now = new Date().toISOString();

        const sql = `
            INSERT INTO digitization_analyses (
                id, name, description, status, project_id, organization_id,
                created_by, overall_score, completion_percent, axis_scores,
                imported_from, import_date, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const params = [
            id,
            data.name,
            data.description || null,
            data.status || 'draft',
            data.projectId || null,
            organizationId,
            userId,
            data.overallScore || 0,
            data.completionPercent || 0,
            JSON.stringify(data.axisScores || {}),
            data.importedFrom || null,
            data.importDate || null,
            now,
            now
        ];

        await queryHelpers.queryRun(sql, params);

        return EconomicsService.getAnalysisById(id, organizationId);
    },

    /**
     * Get analysis by ID
     */
    getAnalysisById: async (id, organizationId) => {
        const sql = `
            SELECT 
                da.*,
                p.name as project_name,
                u.first_name || ' ' || u.last_name as created_by_name
            FROM digitization_analyses da
            LEFT JOIN projects p ON da.project_id = p.id
            LEFT JOIN users u ON da.created_by = u.id
            WHERE da.id = ? AND da.organization_id = ?
        `;

        const analysis = await queryHelpers.queryOne(sql, [id, organizationId]);

        if (!analysis) return null;

        // Parse JSON fields
        analysis.axisScores = analysis.axis_scores ? JSON.parse(analysis.axis_scores) : {};

        // Get detailed axis scores
        const scores = await EconomicsService.getAxisScores(id);
        analysis.detailedScores = scores;

        return EconomicsService.formatAnalysis(analysis);
    },

    /**
     * List analyses for organization with filters
     */
    getAnalyses: async (organizationId, filters = {}) => {
        const {
            status,
            projectId,
            search,
            sortBy = 'created_at',
            sortOrder = 'desc',
            page = 1,
            pageSize = 20
        } = filters;

        let whereClauses = ['da.organization_id = ?'];
        let params = [organizationId];

        if (status && status !== 'all') {
            whereClauses.push('da.status = ?');
            params.push(status);
        }

        if (projectId) {
            whereClauses.push('da.project_id = ?');
            params.push(projectId);
        }

        if (search) {
            whereClauses.push('(da.name LIKE ? OR da.description LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }

        const whereClause = whereClauses.join(' AND ');

        // Get total count
        const countSql = `
            SELECT COUNT(*) as total 
            FROM digitization_analyses da 
            WHERE ${whereClause}
        `;
        const countResult = await queryHelpers.queryOne(countSql, params);
        const total = countResult?.total || 0;

        // Validate sort column
        const validSortColumns = ['name', 'created_at', 'updated_at', 'overall_score', 'status'];
        const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
        const order = sortOrder === 'asc' ? 'ASC' : 'DESC';

        // Get paginated results
        const offset = (page - 1) * pageSize;
        const sql = `
            SELECT 
                da.*,
                p.name as project_name,
                u.first_name || ' ' || u.last_name as created_by_name
            FROM digitization_analyses da
            LEFT JOIN projects p ON da.project_id = p.id
            LEFT JOIN users u ON da.created_by = u.id
            WHERE ${whereClause}
            ORDER BY da.${sortColumn} ${order}
            LIMIT ? OFFSET ?
        `;

        params.push(pageSize, offset);
        const rows = await queryHelpers.queryAll(sql, params);

        const analyses = rows.map(row => {
            row.axisScores = row.axis_scores ? JSON.parse(row.axis_scores) : {};
            return EconomicsService.formatAnalysis(row);
        });

        return {
            analyses,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize)
        };
    },

    /**
     * Update analysis metadata
     */
    updateAnalysis: async (id, data, organizationId) => {
        const existing = await EconomicsService.getAnalysisById(id, organizationId);
        if (!existing) {
            throw new Error('Analysis not found');
        }

        const updates = [];
        const params = [];

        if (data.name !== undefined) {
            updates.push('name = ?');
            params.push(data.name);
        }
        if (data.description !== undefined) {
            updates.push('description = ?');
            params.push(data.description);
        }
        if (data.status !== undefined) {
            updates.push('status = ?');
            params.push(data.status);
        }
        if (data.projectId !== undefined) {
            updates.push('project_id = ?');
            params.push(data.projectId);
        }
        if (data.axisScores !== undefined) {
            updates.push('axis_scores = ?');
            params.push(JSON.stringify(data.axisScores));
        }
        if (data.overallScore !== undefined) {
            updates.push('overall_score = ?');
            params.push(data.overallScore);
        }
        if (data.completionPercent !== undefined) {
            updates.push('completion_percent = ?');
            params.push(data.completionPercent);
        }

        updates.push('updated_at = ?');
        params.push(new Date().toISOString());

        params.push(id, organizationId);

        const sql = `
            UPDATE digitization_analyses 
            SET ${updates.join(', ')}
            WHERE id = ? AND organization_id = ?
        `;

        await queryHelpers.queryRun(sql, params);

        return EconomicsService.getAnalysisById(id, organizationId);
    },

    /**
     * Delete analysis
     */
    deleteAnalysis: async (id, organizationId) => {
        const sql = `
            DELETE FROM digitization_analyses 
            WHERE id = ? AND organization_id = ?
        `;

        const result = await queryHelpers.queryRun(sql, [id, organizationId]);
        return result.changes > 0;
    },

    /**
     * Duplicate analysis
     */
    duplicateAnalysis: async (id, newName, organizationId, userId) => {
        const original = await EconomicsService.getAnalysisById(id, organizationId);
        if (!original) {
            throw new Error('Original analysis not found');
        }

        // Create copy with new name
        const newAnalysis = await EconomicsService.createAnalysis({
            name: newName || `${original.name} (Copy)`,
            description: original.description,
            status: 'draft',
            projectId: original.projectId,
            axisScores: original.axisScores,
        }, organizationId, userId);

        // Copy detailed scores
        const scores = await EconomicsService.getAxisScores(id);
        for (const score of scores) {
            await EconomicsService.updateAxisScore(newAnalysis.id, {
                axisId: score.axis_id,
                areaId: score.area_id,
                areaCode: score.area_code,
                currentLevel: score.current_level,
                targetLevel: score.target_level,
                notes: score.notes,
                evidence: score.evidence,
                justification: score.justification,
            }, userId);
        }

        // Recalculate scores
        await EconomicsService.recalculateScores(newAnalysis.id, organizationId);

        return EconomicsService.getAnalysisById(newAnalysis.id, organizationId);
    },

    // ============================================
    // Score Operations
    // ============================================

    /**
     * Get axis scores for analysis
     */
    getAxisScores: async (analysisId) => {
        const sql = `
            SELECT * FROM digitization_axis_scores
            WHERE analysis_id = ?
            ORDER BY axis_id, area_id
        `;

        const rows = await queryHelpers.queryAll(sql, [analysisId]);
        return rows.map(row => ({
            ...row,
            evidence: row.evidence ? JSON.parse(row.evidence) : []
        }));
    },

    /**
     * Update or create axis score
     */
    updateAxisScore: async (analysisId, scoreData, userId) => {
        const id = uuidv4();
        const now = new Date().toISOString();

        const sql = `
            INSERT INTO digitization_axis_scores (
                id, analysis_id, axis_id, area_id, area_code,
                current_level, target_level, notes, evidence, justification,
                assessed_by, assessed_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(analysis_id, axis_id, area_id) DO UPDATE SET
                current_level = excluded.current_level,
                target_level = excluded.target_level,
                notes = excluded.notes,
                evidence = excluded.evidence,
                justification = excluded.justification,
                assessed_by = excluded.assessed_by,
                assessed_at = excluded.assessed_at,
                updated_at = excluded.updated_at
        `;

        const params = [
            id,
            analysisId,
            scoreData.axisId,
            scoreData.areaId,
            scoreData.areaCode || scoreData.areaId,
            scoreData.currentLevel || 0,
            scoreData.targetLevel || 0,
            scoreData.notes || null,
            JSON.stringify(scoreData.evidence || []),
            scoreData.justification || null,
            userId,
            now,
            now
        ];

        await db.run(sql, params);
        return true;
    },

    /**
     * Bulk update scores
     */
    bulkUpdateScores: async (analysisId, scores, organizationId, userId) => {
        for (const score of scores) {
            await EconomicsService.updateAxisScore(analysisId, score, userId);
        }

        await EconomicsService.recalculateScores(analysisId, organizationId);
        return EconomicsService.getAnalysisById(analysisId, organizationId);
    },

    /**
     * Recalculate analysis scores
     */
    recalculateScores: async (analysisId, organizationId) => {
        const scores = await EconomicsService.getAxisScores(analysisId);

        if (scores.length === 0) {
            return;
        }

        // Calculate axis-level scores
        const axisScores = {};
        const axisGroups = {};

        for (const score of scores) {
            if (!axisGroups[score.axis_id]) {
                axisGroups[score.axis_id] = [];
            }
            axisGroups[score.axis_id].push(score);
        }

        let totalCurrentScore = 0;
        let totalTargetScore = 0;
        let totalAreas = 0;
        let completedAreas = 0;

        for (const [axisId, axisScoresList] of Object.entries(axisGroups)) {
            const currentSum = axisScoresList.reduce((sum, s) => sum + (s.current_level || 0), 0);
            const targetSum = axisScoresList.reduce((sum, s) => sum + (s.target_level || 0), 0);
            const completed = axisScoresList.filter(s => s.current_level > 0).length;

            axisScores[axisId] = {
                axisId,
                currentScore: axisScoresList.length > 0 ? currentSum / axisScoresList.length : 0,
                targetScore: axisScoresList.length > 0 ? targetSum / axisScoresList.length : 0,
                completedAreas: completed,
                totalAreas: axisScoresList.length,
                gap: axisScoresList.length > 0 ? (targetSum - currentSum) / axisScoresList.length : 0,
            };

            totalCurrentScore += currentSum;
            totalTargetScore += targetSum;
            totalAreas += axisScoresList.length;
            completedAreas += completed;
        }

        const overallScore = totalAreas > 0 ? totalCurrentScore / totalAreas : 0;
        const completionPercent = totalAreas > 0 ? Math.round((completedAreas / totalAreas) * 100) : 0;

        // Update analysis with calculated scores
        await EconomicsService.updateAnalysis(analysisId, {
            axisScores,
            overallScore: Math.round(overallScore * 100) / 100,
            completionPercent,
            status: completionPercent === 100 ? 'completed' : completionPercent > 0 ? 'in_progress' : 'draft'
        }, organizationId);
    },

    // ============================================
    // Statistics
    // ============================================

    /**
     * Get catalog statistics
     */
    getCatalogStats: async (organizationId) => {
        const sql = `
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
                SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                AVG(overall_score) as avg_score,
                AVG(completion_percent) as avg_completion
            FROM digitization_analyses
            WHERE organization_id = ?
        `;

        const result = await db.get(sql, [organizationId]);
        return {
            total: result?.total || 0,
            draft: result?.draft || 0,
            inProgress: result?.in_progress || 0,
            completed: result?.completed || 0,
            avgScore: Math.round((result?.avg_score || 0) * 100) / 100,
            avgCompletion: Math.round(result?.avg_completion || 0),
        };
    },

    // ============================================
    // Comparisons
    // ============================================

    /**
     * Create comparison
     */
    createComparison: async (data, organizationId, userId) => {
        const id = uuidv4();
        const sql = `
            INSERT INTO digitization_comparisons (
                id, name, description, organization_id, created_by,
                analysis_ids, comparison_type, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await db.run(sql, [
            id,
            data.name,
            data.description || null,
            organizationId,
            userId,
            JSON.stringify(data.analysisIds),
            data.comparisonType || 'side_by_side',
            new Date().toISOString()
        ]);

        return { id, ...data };
    },

    /**
     * Get comparison with full analysis data
     */
    getComparison: async (id, organizationId) => {
        const sql = `
            SELECT * FROM digitization_comparisons
            WHERE id = ? AND organization_id = ?
        `;

        const comparison = await db.get(sql, [id, organizationId]);
        if (!comparison) return null;

        const analysisIds = JSON.parse(comparison.analysis_ids);
        const analyses = [];

        for (const analysisId of analysisIds) {
            const analysis = await EconomicsService.getAnalysisById(analysisId, organizationId);
            if (analysis) analyses.push(analysis);
        }

        return {
            ...comparison,
            analysisIds,
            analyses
        };
    },

    // ============================================
    // Export History
    // ============================================

    /**
     * Record export
     */
    recordExport: async (analysisId, exportType, filename, path, userId) => {
        const id = uuidv4();
        const sql = `
            INSERT INTO digitization_exports (
                id, analysis_id, export_type, export_filename, export_path,
                exported_by, exported_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        await db.run(sql, [
            id,
            analysisId,
            exportType,
            filename,
            path,
            userId,
            new Date().toISOString()
        ]);

        return { id, analysisId, exportType, filename };
    },

    // ============================================
    // Helpers
    // ============================================

    /**
     * Format analysis for API response
     */
    formatAnalysis: (row) => {
        return {
            id: row.id,
            name: row.name,
            description: row.description,
            status: row.status,
            projectId: row.project_id,
            projectName: row.project_name,
            organizationId: row.organization_id,
            createdBy: row.created_by,
            createdByName: row.created_by_name,
            overallScore: row.overall_score,
            completionPercent: row.completion_percent,
            axisScores: row.axisScores || {},
            importedFrom: row.imported_from,
            importDate: row.import_date,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            detailedScores: row.detailedScores || [],
        };
    },

    // ============================================
    // Phase 6: Benefits Realization (Economics)
    // ============================================

    /**
     * Create a value hypothesis
     */
    createValueHypothesis: async (data) => {
        const id = uuidv4();
        const now = new Date().toISOString();
        const sql = `
            INSERT INTO value_hypotheses (
                id, initiative_id, project_id, description, type,
                confidence_level, owner_id, related_initiative_ids,
                is_validated, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            id,
            data.initiativeId,
            data.projectId,
            data.description,
            data.type,
            data.confidenceLevel || 'MEDIUM',
            data.ownerId,
            JSON.stringify(data.relatedInitiativeIds || []),
            0,
            now,
            now
        ];

        return new Promise((resolve, reject) => {
            db.run(sql, params, function (err) {
                if (err) return reject(err);
                resolve({ id, ...data, isValidated: 0 });
            });
        });
    },

    /**
     * Get value hypotheses for a project
     */
    getValueHypotheses: async (projectId, initiativeId = null) => {
        let sql = `
            SELECT vh.*, u.first_name, u.last_name, i.name as initiative_name
            FROM value_hypotheses vh
            LEFT JOIN users u ON vh.owner_id = u.id
            LEFT JOIN initiatives i ON vh.initiative_id = i.id
            WHERE vh.project_id = ?
        `;
        const params = [projectId];

        if (initiativeId) {
            sql += ` AND vh.initiative_id = ?`;
            params.push(initiativeId);
        }

        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) return reject(err);

                const results = (rows || []).map(row => ({
                    ...row,
                    initiativeId: row.initiative_id,
                    projectId: row.project_id,
                    ownerId: row.owner_id,
                    relatedInitiativeIds: (() => {
                        try { return JSON.parse(row.related_initiative_ids || '[]'); }
                        catch (e) { return []; }
                    })(),
                    isValidated: row.is_validated === 1
                }));
                resolve(results);
            });
        });
    },

    /**
     * Validate a hypothesis
     */
    validateHypothesis: async (id, userId) => {
        const sql = `
            UPDATE value_hypotheses 
            SET is_validated = 1, validated_by = ?
            WHERE id = ?
        `;

        return new Promise((resolve, reject) => {
            db.run(sql, [userId, id], function (err) {
                if (err) return reject(err);
                resolve({ updated: this.changes > 0, hypothesisId: id });
            });
        });
    },

    /**
     * Add financial assumption
     */
    addFinancialAssumption: async (data) => {
        const id = uuidv4();
        const sql = `
            INSERT INTO financial_assumptions (
                id, value_hypothesis_id, low_estimate, expected_estimate,
                high_estimate, currency, timeframe, notes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            id,
            data.valueHypothesisId,
            data.lowEstimate,
            data.expectedEstimate,
            data.highEstimate,
            data.currency || 'USD',
            data.timeframe || 'per year',
            data.notes || null,
            new Date().toISOString()
        ];

        return new Promise((resolve, reject) => {
            db.run(sql, params, function (err) {
                if (err) return reject(err);
                resolve({ id, ...data });
            });
        });
    },

    /**
     * Detect initiatives missing value hypotheses
     */
    detectMissingValueHypotheses: async (projectId) => {
        const sql = `
            SELECT i.id, i.name
            FROM initiatives i
            LEFT JOIN value_hypotheses vh ON i.id = vh.initiative_id
            WHERE i.project_id = ? AND vh.id IS NULL
            AND i.status NOT IN ('CANCELLED', 'DRAFT')
        `;

        return new Promise((resolve, reject) => {
            db.all(sql, [projectId], (err, rows) => {
                if (err) return reject(err);
                resolve({
                    projectId,
                    count: (rows || []).length,
                    hasIssues: (rows || []).length > 0,
                    initiativesWithoutValue: rows || []
                });
            });
        });
    },

    // ============================================
    // Initiative & Financial Integration (Phase 4)
    // ============================================

    /**
     * Link analysis to initiative
     */
    linkAnalysisToInitiative: async (analysisId, initiativeId, organizationId) => {
        const analysis = await EconomicsService.getAnalysisById(analysisId, organizationId);
        if (!analysis) {
            throw new Error('Analysis not found');
        }

        const sql = `
            UPDATE digitization_analyses 
            SET linked_initiative_id = ?, updated_at = ?
            WHERE id = ? AND organization_id = ?
        `;

        await queryHelpers.queryRun(sql, [initiativeId, new Date().toISOString(), analysisId, organizationId]);
        return EconomicsService.getAnalysisById(analysisId, organizationId);
    },

    /**
     * Get financial data for analysis
     */
    getAnalysisFinancials: async (analysisId, organizationId) => {
        const sql = `
            SELECT * FROM initiative_financials
            WHERE analysis_id = ?
        `;

        const row = await queryHelpers.queryOne(sql, [analysisId]);
        if (!row) return null;

        return {
            id: row.id,
            analysisId: row.analysis_id,
            costs: row.costs ? JSON.parse(row.costs) : [],
            benefits: row.benefits ? JSON.parse(row.benefits) : [],
            discountRate: row.discount_rate,
            investmentHorizon: row.investment_horizon,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    },

    /**
     * Update financial data for analysis
     */
    updateAnalysisFinancials: async (analysisId, data, organizationId, userId) => {
        const existing = await EconomicsService.getAnalysisFinancials(analysisId, organizationId);
        const now = new Date().toISOString();

        if (existing) {
            // Update
            const sql = `
                UPDATE initiative_financials 
                SET costs = ?, benefits = ?, discount_rate = ?, investment_horizon = ?, updated_at = ?
                WHERE analysis_id = ?
            `;

            await queryHelpers.queryRun(sql, [
                JSON.stringify(data.costs || existing.costs),
                JSON.stringify(data.benefits || existing.benefits),
                data.discountRate !== undefined ? data.discountRate : existing.discountRate,
                data.investmentHorizon !== undefined ? data.investmentHorizon : existing.investmentHorizon,
                now,
                analysisId
            ]);
        } else {
            // Insert
            const id = uuidv4();
            const sql = `
                INSERT INTO initiative_financials (
                    id, analysis_id, costs, benefits, discount_rate, investment_horizon, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

            await queryHelpers.queryRun(sql, [
                id,
                analysisId,
                JSON.stringify(data.costs || []),
                JSON.stringify(data.benefits || []),
                data.discountRate || 10,
                data.investmentHorizon || 5,
                now,
                now
            ]);
        }

        return EconomicsService.getAnalysisFinancials(analysisId, organizationId);
    },

    /**
     * Get benefit tracking data for analysis
     */
    getAnalysisBenefits: async (analysisId, organizationId) => {
        const sql = `
            SELECT * FROM benefit_tracking
            WHERE analysis_id = ?
            ORDER BY tracked_at DESC
        `;

        const rows = await queryHelpers.queryAll(sql, [analysisId]);
        return rows.map(row => ({
            id: row.id,
            analysisId: row.analysis_id,
            trackingPeriod: row.tracking_period,
            plannedBenefits: row.planned_benefits,
            actualBenefits: row.actual_benefits,
            variance: row.variance,
            trackedAt: row.tracked_at,
            createdBy: row.created_by
        }));
    },

    /**
     * Update benefit tracking data for analysis
     */
    updateAnalysisBenefits: async (analysisId, data, organizationId, userId) => {
        const id = uuidv4();
        const variance = (data.actualBenefits || 0) - (data.plannedBenefits || 0);
        const now = new Date().toISOString();

        const sql = `
            INSERT INTO benefit_tracking (
                id, analysis_id, tracking_period, planned_benefits, actual_benefits, variance, tracked_at, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(analysis_id, tracking_period) DO UPDATE SET
                planned_benefits = excluded.planned_benefits,
                actual_benefits = excluded.actual_benefits,
                variance = excluded.variance,
                tracked_at = excluded.tracked_at
        `;

        await queryHelpers.queryRun(sql, [
            id,
            analysisId,
            data.trackingPeriod || 'Q1 2025',
            data.plannedBenefits || 0,
            data.actualBenefits || 0,
            variance,
            now,
            userId
        ]);

        return EconomicsService.getAnalysisBenefits(analysisId, organizationId);
    },

    /**
     * Get quality assessment for analysis
     */
    getAnalysisQualityAssessment: async (analysisId, organizationId) => {
        const sql = `
            SELECT * FROM quality_assessments
            WHERE analysis_id = ?
            ORDER BY assessed_at DESC
            LIMIT 1
        `;

        const row = await queryHelpers.queryOne(sql, [analysisId]);
        if (!row) {
            // Calculate from analysis data
            const analysis = await EconomicsService.getAnalysisById(analysisId, organizationId);
            if (!analysis) return null;

            // Calculate basic scores
            const methodologyScore = analysis.completionPercent > 80 ? 4 : 
                                     analysis.completionPercent > 60 ? 3 :
                                     analysis.completionPercent > 40 ? 2 : 1;
            const documentationScore = analysis.description ? 3 : 2;

            return {
                analysisId,
                forecastAccuracy: null, // Needs actual vs planned data
                methodologyScore,
                documentationScore,
                overallScore: (methodologyScore + documentationScore) / 2,
                assessedAt: new Date().toISOString(),
                computed: true
            };
        }

        return {
            id: row.id,
            analysisId: row.analysis_id,
            forecastAccuracy: row.forecast_accuracy,
            methodologyScore: row.methodology_score,
            documentationScore: row.documentation_score,
            assessedAt: row.assessed_at,
            assessedBy: row.assessed_by
        };
    },

    /**
     * Get value summary for a project
     */
    getValueSummary: async (projectId) => {
        // Hypotheses by type
        const typeSql = `
            SELECT type, COUNT(*) as count, SUM(is_validated) as validated
            FROM value_hypotheses
            WHERE project_id = ?
            GROUP BY type
        `;

        const financialSql = `
            SELECT 
                SUM(low_estimate) as total_low,
                SUM(expected_estimate) as total_expected,
                SUM(high_estimate) as total_high
            FROM financial_assumptions fa
            JOIN value_hypotheses vh ON fa.value_hypothesis_id = vh.id
            WHERE vh.project_id = ?
        `;

        const results = {};

        return new Promise((resolve, reject) => {
            db.all(typeSql, [projectId], async (err, types) => {
                if (err) return reject(err);
                results.hypothesesByType = types || [];

                db.get(financialSql, [projectId], async (err, totals) => {
                    if (err) return reject(err);

                    const missing = await EconomicsService.detectMissingValueHypotheses(projectId);

                    resolve({
                        projectId,
                        hypothesesByType: results.hypothesesByType,
                        financialRange: {
                            low: totals?.total_low || 0,
                            expected: totals?.total_expected || 0,
                            high: totals?.total_high || 0
                        },
                        initiativesWithoutValue: missing.count,
                        generatedAt: new Date().toISOString()
                    });
                });
            });
        });
    },
};

module.exports = EconomicsService;

/**
 * Versioning Service
 * 
 * Manages version history for digitization analyses.
 * Enables snapshots, baselines, comparison, and restoration.
 * 
 * Enterprise Features:
 * - Immutable version snapshots
 * - Version comparison (diff)
 * - Restore to previous version
 * - Baseline marking for milestones
 */

import { getDatabase } from '../src/database/Database.ts';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';



const VersioningService = {
    // ============================================
    // Version Creation
    // ============================================

    /**
     * Create a new version snapshot
     * @param {string} analysisId - Analysis ID
     * @param {Object} options - Version options
     * @param {string} options.versionName - Optional name for the version
     * @param {string} options.versionType - Type: 'snapshot', 'baseline', 'milestone'
     * @param {string} options.notes - Optional notes
     * @param {string} userId - User creating the version
     * @returns {Promise<Object>} - Created version
     */
    createVersion: async (analysisId, options = {}, userId) => {
        const {
            versionName,
            versionType = 'snapshot',
            notes
        } = options;

        // Get current analysis state
        const analysis = await VersioningService.getAnalysisSnapshot(analysisId);
        if (!analysis) {
            throw new Error('Analysis not found');
        }

        // Get next version number
        const versionNumber = await VersioningService.getNextVersionNumber(analysisId);

        const id = uuidv4();
        const now = new Date().toISOString();

        const sql = `
            INSERT INTO digitization_analysis_versions (
                id, analysis_id, version_number, version_name, version_type,
                snapshot_data, created_by, created_at, notes,
                overall_score, completion_percent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const params = [
            id,
            analysisId,
            versionNumber,
            versionName || `Version ${versionNumber}`,
            versionType,
            JSON.stringify(analysis),
            userId,
            now,
            notes || null,
            analysis.overallScore || 0,
            analysis.completionPercent || 0
        ];

        await new Promise((resolve, reject) => {
            db.run(sql, params, (err) => err ? reject(err) : resolve());
        });

        return VersioningService.getVersion(id);
    },

    /**
     * Get next version number for an analysis
     */
    getNextVersionNumber: async (analysisId) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT MAX(version_number) as maxVersion 
                 FROM digitization_analysis_versions 
                 WHERE analysis_id = ?`,
                [analysisId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve((row?.maxVersion || 0) + 1);
                }
            );
        });
    },

    /**
     * Get full analysis snapshot including all scores
     */
    getAnalysisSnapshot: async (analysisId) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM digitization_analyses WHERE id = ?`,
                [analysisId],
                async (err, analysis) => {
                    if (err) return reject(err);
                    if (!analysis) return resolve(null);

                    // Get all scores
                    db.all(
                        `SELECT * FROM digitization_axis_scores WHERE analysis_id = ?`,
                        [analysisId],
                        (scoreErr, scores) => {
                            if (scoreErr) return reject(scoreErr);

                            resolve({
                                ...analysis,
                                axisScores: analysis.axis_scores ? JSON.parse(analysis.axis_scores) : {},
                                detailedScores: scores.map(s => ({
                                    ...s,
                                    evidence: s.evidence ? JSON.parse(s.evidence) : []
                                }))
                            });
                        }
                    );
                }
            );
        });
    },

    // ============================================
    // Version Retrieval
    // ============================================

    /**
     * Get version by ID
     */
    getVersion: async (versionId) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT v.*, u.first_name || ' ' || u.last_name as created_by_name
                 FROM digitization_analysis_versions v
                 LEFT JOIN users u ON v.created_by = u.id
                 WHERE v.id = ?`,
                [versionId],
                (err, version) => {
                    if (err) return reject(err);
                    if (!version) return resolve(null);

                    resolve({
                        ...version,
                        snapshotData: JSON.parse(version.snapshot_data)
                    });
                }
            );
        });
    },

    /**
     * Get all versions for an analysis
     */
    getVersions: async (analysisId, options = {}) => {
        const { limit = 50, offset = 0 } = options;

        return new Promise((resolve, reject) => {
            db.all(
                `SELECT 
                    v.id, v.version_number, v.version_name, v.version_type,
                    v.created_by, v.created_at, v.notes,
                    v.overall_score, v.completion_percent,
                    u.first_name || ' ' || u.last_name as created_by_name
                 FROM digitization_analysis_versions v
                 LEFT JOIN users u ON v.created_by = u.id
                 WHERE v.analysis_id = ?
                 ORDER BY v.version_number DESC
                 LIMIT ? OFFSET ?`,
                [analysisId, limit, offset],
                (err, versions) => {
                    if (err) reject(err);
                    else resolve(versions || []);
                }
            );
        });
    },

    /**
     * Get latest version of an analysis
     */
    getLatestVersion: async (analysisId) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM digitization_analysis_versions 
                 WHERE analysis_id = ? 
                 ORDER BY version_number DESC 
                 LIMIT 1`,
                [analysisId],
                (err, version) => {
                    if (err) return reject(err);
                    if (!version) return resolve(null);

                    resolve({
                        ...version,
                        snapshotData: JSON.parse(version.snapshot_data)
                    });
                }
            );
        });
    },

    // ============================================
    // Version Comparison
    // ============================================

    /**
     * Compare two versions
     * @returns {Object} Diff between versions including score changes
     */
    compareVersions: async (versionId1, versionId2) => {
        const [v1, v2] = await Promise.all([
            VersioningService.getVersion(versionId1),
            VersioningService.getVersion(versionId2)
        ]);

        if (!v1 || !v2) {
            throw new Error('One or both versions not found');
        }

        const snapshot1 = v1.snapshotData;
        const snapshot2 = v2.snapshotData;

        // Compare overall metrics
        const metricsDiff = {
            overallScore: {
                before: snapshot1.overallScore || snapshot1.overall_score || 0,
                after: snapshot2.overallScore || snapshot2.overall_score || 0,
                change: (snapshot2.overallScore || snapshot2.overall_score || 0) - (snapshot1.overallScore || snapshot1.overall_score || 0)
            },
            completionPercent: {
                before: snapshot1.completionPercent || snapshot1.completion_percent || 0,
                after: snapshot2.completionPercent || snapshot2.completion_percent || 0,
                change: (snapshot2.completionPercent || snapshot2.completion_percent || 0) - (snapshot1.completionPercent || snapshot1.completion_percent || 0)
            },
            status: {
                before: snapshot1.status,
                after: snapshot2.status,
                changed: snapshot1.status !== snapshot2.status
            }
        };

        // Compare individual scores
        const scores1 = snapshot1.detailedScores || [];
        const scores2 = snapshot2.detailedScores || [];

        const scoreMap1 = new Map(scores1.map(s => [`${s.axis_id}:${s.area_id}`, s]));
        const scoreMap2 = new Map(scores2.map(s => [`${s.axis_id}:${s.area_id}`, s]));

        const scoreChanges = [];
        const allKeys = new Set([...scoreMap1.keys(), ...scoreMap2.keys()]);

        for (const key of allKeys) {
            const s1 = scoreMap1.get(key);
            const s2 = scoreMap2.get(key);

            if (!s1 && s2) {
                // New score added
                scoreChanges.push({
                    key,
                    axisId: s2.axis_id,
                    areaId: s2.area_id,
                    areaCode: s2.area_code,
                    type: 'added',
                    currentLevel: { before: null, after: s2.current_level },
                    targetLevel: { before: null, after: s2.target_level }
                });
            } else if (s1 && !s2) {
                // Score removed
                scoreChanges.push({
                    key,
                    axisId: s1.axis_id,
                    areaId: s1.area_id,
                    areaCode: s1.area_code,
                    type: 'removed',
                    currentLevel: { before: s1.current_level, after: null },
                    targetLevel: { before: s1.target_level, after: null }
                });
            } else if (s1 && s2) {
                // Check for changes
                const currentChanged = s1.current_level !== s2.current_level;
                const targetChanged = s1.target_level !== s2.target_level;

                if (currentChanged || targetChanged) {
                    scoreChanges.push({
                        key,
                        axisId: s1.axis_id,
                        areaId: s1.area_id,
                        areaCode: s1.area_code,
                        type: 'modified',
                        currentLevel: {
                            before: s1.current_level,
                            after: s2.current_level,
                            change: (s2.current_level || 0) - (s1.current_level || 0)
                        },
                        targetLevel: {
                            before: s1.target_level,
                            after: s2.target_level,
                            change: (s2.target_level || 0) - (s1.target_level || 0)
                        }
                    });
                }
            }
        }

        return {
            version1: {
                id: v1.id,
                versionNumber: v1.version_number,
                versionName: v1.version_name,
                createdAt: v1.created_at
            },
            version2: {
                id: v2.id,
                versionNumber: v2.version_number,
                versionName: v2.version_name,
                createdAt: v2.created_at
            },
            metricsDiff,
            scoreChanges,
            summary: {
                totalChanges: scoreChanges.length,
                added: scoreChanges.filter(c => c.type === 'added').length,
                removed: scoreChanges.filter(c => c.type === 'removed').length,
                modified: scoreChanges.filter(c => c.type === 'modified').length,
                improved: scoreChanges.filter(c => c.type === 'modified' && c.currentLevel.change > 0).length,
                regressed: scoreChanges.filter(c => c.type === 'modified' && c.currentLevel.change < 0).length
            }
        };
    },

    // ============================================
    // Version Restoration
    // ============================================

    /**
     * Restore analysis to a specific version
     * Creates a new version before restoring (safety snapshot)
     */
    restoreVersion: async (versionId, userId, EconomicsService) => {
        const version = await VersioningService.getVersion(versionId);
        if (!version) {
            throw new Error('Version not found');
        }

        const analysisId = version.analysis_id;
        const snapshot = version.snapshotData;

        // Create safety snapshot first
        await VersioningService.createVersion(analysisId, {
            versionName: 'Auto-save before restore',
            versionType: 'snapshot',
            notes: `Automatic snapshot before restoring to version ${version.version_number}`
        }, userId);

        // Restore analysis metadata
        await EconomicsService.updateAnalysis(analysisId, {
            status: snapshot.status,
            axisScores: snapshot.axisScores || (snapshot.axis_scores ? JSON.parse(snapshot.axis_scores) : {}),
            overallScore: snapshot.overallScore || snapshot.overall_score,
            completionPercent: snapshot.completionPercent || snapshot.completion_percent
        }, snapshot.organization_id);

        // Clear existing scores
        await new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM digitization_axis_scores WHERE analysis_id = ?`,
                [analysisId],
                (err) => err ? reject(err) : resolve()
            );
        });

        // Restore scores from snapshot
        const scores = snapshot.detailedScores || [];
        for (const score of scores) {
            await EconomicsService.updateAxisScore(analysisId, {
                axisId: score.axis_id,
                areaId: score.area_id,
                areaCode: score.area_code,
                currentLevel: score.current_level,
                targetLevel: score.target_level,
                notes: score.notes,
                evidence: score.evidence,
                justification: score.justification
            }, userId);
        }

        // Recalculate scores
        await EconomicsService.recalculateScores(analysisId, snapshot.organization_id);

        // Create post-restore version
        const restoredVersion = await VersioningService.createVersion(analysisId, {
            versionName: `Restored from v${version.version_number}`,
            versionType: 'milestone',
            notes: `Analysis restored from version "${version.version_name}"`
        }, userId);

        return restoredVersion;
    },

    // ============================================
    // Version Management
    // ============================================

    /**
     * Update version metadata (name, notes)
     */
    updateVersion: async (versionId, updates) => {
        const allowedFields = ['version_name', 'notes'];
        const updateParts = [];
        const params = [];

        for (const [key, value] of Object.entries(updates)) {
            const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
            if (allowedFields.includes(dbKey)) {
                updateParts.push(`${dbKey} = ?`);
                params.push(value);
            }
        }

        if (updateParts.length === 0) {
            return VersioningService.getVersion(versionId);
        }

        params.push(versionId);

        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE digitization_analysis_versions 
                 SET ${updateParts.join(', ')}
                 WHERE id = ?`,
                params,
                (err) => err ? reject(err) : resolve()
            );
        });

        return VersioningService.getVersion(versionId);
    },

    /**
     * Delete a version
     * Note: Baselines cannot be deleted
     */
    deleteVersion: async (versionId) => {
        const version = await VersioningService.getVersion(versionId);
        if (!version) {
            throw new Error('Version not found');
        }

        if (version.version_type === 'baseline') {
            throw new Error('Baseline versions cannot be deleted');
        }

        await new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM digitization_analysis_versions WHERE id = ?`,
                [versionId],
                (err) => err ? reject(err) : resolve()
            );
        });

        return true;
    },

    /**
     * Mark a version as baseline
     */
    markAsBaseline: async (versionId) => {
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE digitization_analysis_versions 
                 SET version_type = 'baseline'
                 WHERE id = ?`,
                [versionId],
                (err) => err ? reject(err) : resolve()
            );
        });

        return VersioningService.getVersion(versionId);
    }
};

export default VersioningService;

















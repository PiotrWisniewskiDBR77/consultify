// Baseline Service - Schedule baseline management
// Step 4: Roadmap, Sequencing & Capacity

// Dependency injection container (for deterministic unit tests)
const deps = {
    db: require('../database'),
    uuidv4: require('uuid').v4
};

const BaselineService = {
    // For testing: allow overriding dependencies
    setDependencies: (newDeps = {}) => {
        Object.assign(deps, newDeps);
    },
    /**
     * Capture a new schedule baseline
     */
    captureBaseline: async (roadmapId, projectId, userId, rationale) => {
        // Get current initiative timeline data from roadmap_initiatives
        const initiatives = await new Promise((resolve, reject) => {
            deps.db.all(`SELECT initiative_id, planned_start_date, planned_end_date, sequence_position 
                    FROM roadmap_initiatives WHERE roadmap_id = ?`, [roadmapId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        if (initiatives.length === 0) {
            throw new Error('No initiatives in roadmap to baseline');
        }

        // Get current version
        const currentVersion = await new Promise((resolve, reject) => {
            deps.db.get(`SELECT MAX(version) as maxVer FROM schedule_baselines WHERE roadmap_id = ?`,
                [roadmapId], (err, row) => {
                    if (err) reject(err);
                    else resolve((row?.maxVer || 0) + 1);
                });
        });

        const id = deps.uuidv4();
        const snapshots = initiatives.map(i => ({
            initiativeId: i.initiative_id,
            plannedStartDate: i.planned_start_date,
            plannedEndDate: i.planned_end_date,
            sequencePosition: i.sequence_position
        }));

        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO schedule_baselines (id, roadmap_id, project_id, version, initiative_snapshots, approved_by, rationale)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`;

            deps.db.run(sql, [id, roadmapId, projectId, currentVersion, JSON.stringify(snapshots), userId, rationale], function (err) {
                if (err) return reject(err);

                // Update roadmap baseline version
                deps.db.run(`UPDATE roadmaps SET current_baseline_version = ?, last_baselined_at = CURRENT_TIMESTAMP, status = 'BASELINED' WHERE id = ?`,
                    [currentVersion, roadmapId], (err2) => {
                        if (err2) return reject(err2);
                        resolve({ id, roadmapId, version: currentVersion, initiativeCount: initiatives.length });
                    });
            });
        });
    },

    /**
     * Get baseline by version
     */
    getBaseline: async (roadmapId, version) => {
        return new Promise((resolve, reject) => {
            const sql = version
                ? `SELECT * FROM schedule_baselines WHERE roadmap_id = ? AND version = ?`
                : `SELECT * FROM schedule_baselines WHERE roadmap_id = ? ORDER BY version DESC LIMIT 1`;

            deps.db.get(sql, version ? [roadmapId, version] : [roadmapId], (err, row) => {
                if (err) return reject(err);
                if (!row) return resolve(null);

                try {
                    row.initiativeSnapshots = JSON.parse(row.initiative_snapshots);
                } catch { row.initiativeSnapshots = []; }

                resolve(row);
            });
        });
    },

    /**
     * Get all baselines for a roadmap
     */
    getBaselineHistory: async (roadmapId) => {
        return new Promise((resolve, reject) => {
            deps.db.all(`SELECT id, version, approved_by, approved_at, rationale FROM schedule_baselines 
                    WHERE roadmap_id = ? ORDER BY version DESC`, [roadmapId], (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    },

    /**
     * Calculate variance between baseline and actual
     */
    calculateVariance: async (roadmapId, baselineVersion = null) => {
        const baseline = await BaselineService.getBaseline(roadmapId, baselineVersion);
        if (!baseline) throw new Error('No baseline found');

        // Get current actual data
        const actuals = await new Promise((resolve, reject) => {
            deps.db.all(`SELECT ri.initiative_id, ri.actual_start_date, ri.actual_end_date, i.name
                    FROM roadmap_initiatives ri
                    JOIN initiatives i ON ri.initiative_id = i.id
                    WHERE ri.roadmap_id = ?`, [roadmapId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        const actualsMap = {};
        actuals.forEach(a => { actualsMap[a.initiative_id] = a; });

        const variances = [];
        let onTrack = 0, delayed = 0, critical = 0;

        for (const snap of baseline.initiativeSnapshots) {
            const actual = actualsMap[snap.initiativeId] || {};

            const plannedStart = new Date(snap.plannedStartDate);
            const plannedEnd = new Date(snap.plannedEndDate);
            const actualStart = actual.actual_start_date ? new Date(actual.actual_start_date) : null;
            const actualEnd = actual.actual_end_date ? new Date(actual.actual_end_date) : null;

            const startVar = actualStart ? Math.round((actualStart - plannedStart) / (1000 * 60 * 60 * 24)) : 0;
            const endVar = actualEnd ? Math.round((actualEnd - plannedEnd) / (1000 * 60 * 60 * 24)) : 0;

            let status = 'ON_TRACK';
            if (endVar > 14) {
                status = 'CRITICAL';
                critical++;
            } else if (endVar > 0) {
                status = 'DELAYED';
                delayed++;
            } else if (endVar < 0) {
                status = 'EARLY';
                onTrack++;
            } else {
                onTrack++;
            }

            variances.push({
                initiativeId: snap.initiativeId,
                initiativeName: actual.name || 'Unknown',
                plannedStart: snap.plannedStartDate,
                plannedEnd: snap.plannedEndDate,
                actualStart: actual.actual_start_date,
                actualEnd: actual.actual_end_date,
                startVarianceDays: startVar,
                endVarianceDays: endVar,
                status
            });
        }

        return {
            roadmapId,
            baselineVersion: baseline.version,
            totalInitiatives: variances.length,
            onTrackCount: onTrack,
            delayedCount: delayed,
            criticalDelays: critical,
            onTrackPercent: variances.length > 0 ? Math.round((onTrack / variances.length) * 100) : 0,
            initiativeVariances: variances,
            generatedAt: new Date().toISOString()
        };
    }
};

module.exports = BaselineService;

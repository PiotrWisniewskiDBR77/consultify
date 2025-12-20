const db = require('../database');
const { v4: uuidv4 } = require('uuid');

const RoadmapService = {
    /**
     * Get all waves for a project
     */
    getWaves: (projectId) => {
        return new Promise((resolve, reject) => {
            db.all(`SELECT * FROM roadmap_waves WHERE project_id = ? ORDER BY sort_order`, [projectId], (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    },

    /**
     * Create a new wave
     */
    createWave: (projectId, waveData) => {
        return new Promise((resolve, reject) => {
            const id = uuidv4();
            const { name, description, startDate, endDate, sortOrder } = waveData;

            const sql = `INSERT INTO roadmap_waves (id, project_id, name, description, start_date, end_date, sort_order)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`;

            db.run(sql, [id, projectId, name, description, startDate, endDate, sortOrder || 0], function (err) {
                if (err) return reject(err);
                resolve({ id, projectId, name, ...waveData });
            });
        });
    },

    /**
     * Assign initiative to wave
     */
    assignToWave: (initiativeId, waveId) => {
        return new Promise((resolve, reject) => {
            db.run(`UPDATE initiatives SET wave_id = ? WHERE id = ?`, [waveId, initiativeId], function (err) {
                if (err) return reject(err);
                resolve({ initiativeId, waveId, success: true });
            });
        });
    },

    /**
     * Baseline the roadmap (lock current state)
     */
    baselineRoadmap: (projectId) => {
        return new Promise((resolve, reject) => {
            // Mark all waves as baselined
            db.run(`UPDATE roadmap_waves SET is_baselined = 1 WHERE project_id = ?`, [projectId], (err) => {
                if (err) return reject(err);
            });

            // Increment baseline version on all initiatives in this project
            db.run(`UPDATE initiatives SET baseline_version = baseline_version + 1 WHERE project_id = ?`, [projectId], function (err) {
                if (err) return reject(err);
                resolve({ projectId, baselineVersion: this.changes, success: true });
            });
        });
    },

    /**
     * Get roadmap summary (waves with initiatives)
     */
    getRoadmapSummary: (projectId) => {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    w.id as wave_id, w.name as wave_name, w.start_date, w.end_date, w.status,
                    i.id as initiative_id, i.name as initiative_name, i.status as initiative_status, i.priority
                FROM roadmap_waves w
                LEFT JOIN initiatives i ON i.wave_id = w.id
                WHERE w.project_id = ?
                ORDER BY w.sort_order, i.priority DESC
            `;

            db.all(sql, [projectId], (err, rows) => {
                if (err) return reject(err);

                // Group by wave
                const wavesMap = {};
                (rows || []).forEach(row => {
                    if (!wavesMap[row.wave_id]) {
                        wavesMap[row.wave_id] = {
                            id: row.wave_id,
                            name: row.wave_name,
                            startDate: row.start_date,
                            endDate: row.end_date,
                            status: row.status,
                            initiatives: []
                        };
                    }
                    if (row.initiative_id) {
                        wavesMap[row.wave_id].initiatives.push({
                            id: row.initiative_id,
                            name: row.initiative_name,
                            status: row.initiative_status,
                            priority: row.priority
                        });
                    }
                });

                resolve(Object.values(wavesMap));
            });
        });
    },

    /**
     * GAP-06: Update initiative schedule with CR check
     * If roadmap is baselined and governance requires CR, create one instead of direct update
     */
    updateInitiativeSchedule: async (initiativeId, updates, userId, projectId) => {
        const db = require('../database');

        // Check if initiative's wave is baselined
        const initiative = await new Promise((resolve) => {
            db.get(`SELECT i.wave_id, w.is_baselined, p.governance_settings
                    FROM initiatives i
                    LEFT JOIN roadmap_waves w ON i.wave_id = w.id
                    LEFT JOIN projects p ON i.project_id = p.id
                    WHERE i.id = ?`, [initiativeId], (err, row) => {
                resolve(row || {});
            });
        });

        const isBaselined = initiative.is_baselined === 1;
        let governanceSettings = {};
        try {
            governanceSettings = JSON.parse(initiative.governance_settings || '{}');
        } catch { }

        // If baselined and governance requires CR for schedule changes
        if (isBaselined && governanceSettings.requireChangeRequestForSchedule) {
            // Create Change Request instead of direct update
            const crId = uuidv4();
            const auditTrail = JSON.stringify([{
                action: 'CREATED',
                by: userId,
                at: new Date().toISOString()
            }]);

            await new Promise((resolve, reject) => {
                db.run(`INSERT INTO decisions (
                    id, project_id, decision_type, related_object_type, related_object_id,
                    decision_owner_id, required, title, description, audit_trail, status
                ) VALUES (?, ?, 'SCHEDULE_CHANGE', 'INITIATIVE', ?, ?, 1, ?, ?, ?, 'PENDING')`,
                    [
                        crId,
                        projectId,
                        initiativeId,
                        userId,
                        `Schedule change for initiative`,
                        JSON.stringify(updates),
                        auditTrail
                    ], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
            });

            return {
                changeRequestCreated: true,
                crId,
                message: 'Schedule change requires approval. Change request created.',
                proposedChanges: updates
            };
        }

        // Direct update allowed
        const setClauses = [];
        const params = [];

        if (updates.plannedStartDate) {
            setClauses.push('start_date = ?');
            params.push(updates.plannedStartDate);
        }
        if (updates.plannedEndDate) {
            setClauses.push('end_date = ?');
            params.push(updates.plannedEndDate);
        }
        if (updates.waveId !== undefined) {
            setClauses.push('wave_id = ?');
            params.push(updates.waveId);
        }

        if (setClauses.length === 0) {
            return { success: true, message: 'No changes to apply' };
        }

        params.push(initiativeId);

        await new Promise((resolve, reject) => {
            db.run(`UPDATE initiatives SET ${setClauses.join(', ')} WHERE id = ?`, params, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        return { success: true, initiativeId, updates };
    }
};

module.exports = RoadmapService;


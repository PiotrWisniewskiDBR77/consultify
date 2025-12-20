const db = require('../database');

/**
 * AIContextBuilder
 * Builds a deterministic context snapshot for an organization to be used by the AI Coach.
 */
const AIContextBuilder = {
    /**
     * Aggregates all necessary organizational data into a single JSON snapshot.
     * @param {string} orgId - The organization ID.
     * @returns {Promise<Object>} The AI_CONTEXT snapshot.
     */
    buildContext: async (orgId) => {
        const organization = await AIContextBuilder._getOrganization(orgId);
        const users = await AIContextBuilder._getUsers(orgId);
        const tasks = await AIContextBuilder._getTasks(orgId);
        const initiatives = await AIContextBuilder._getInitiatives(orgId);
        const helpEvents = await AIContextBuilder._getHelpEvents(orgId);
        const metrics = await AIContextBuilder._getMetrics(orgId);
        const lifecycleEvents = await AIContextBuilder._getLifecycleEvents(orgId);

        return {
            orgId,
            orgName: organization?.name,
            timestamp: new Date().toISOString(),
            data: {
                users,
                task_distribution: AIContextBuilder._calculateTaskDistribution(tasks),
                initiative_status: AIContextBuilder._calculateInitiativeStatus(initiatives),
                help_completion_ratios: AIContextBuilder._calculateHelpCompletionRatios(helpEvents),
                metrics_funnel: AIContextBuilder._processMetricsFunnel(metrics),
                recent_events: lifecycleEvents
            },
            raw: {
                tasks,
                initiatives,
                helpEvents
            }
        };
    },

    _getOrganization: (orgId) => {
        return new Promise((resolve, reject) => {
            db.get(`SELECT * FROM organizations WHERE id = ?`, [orgId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },

    _getUsers: (orgId) => {
        return new Promise((resolve, reject) => {
            db.all(`SELECT id, email, first_name, last_name, role FROM users WHERE organization_id = ?`, [orgId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    },

    _getTasks: (orgId) => {
        return new Promise((resolve, reject) => {
            db.all(`SELECT id, initiative_id, assignee_id, status, priority, blocked_reason FROM tasks WHERE organization_id = ?`, [orgId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    },

    _getInitiatives: (orgId) => {
        return new Promise((resolve, reject) => {
            db.all(`SELECT id, name, status, blocked_reason, updated_at FROM initiatives WHERE organization_id = ?`, [orgId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    },

    _getHelpEvents: (orgId) => {
        return new Promise((resolve, reject) => {
            db.all(`SELECT user_id, playbook_key, event_type, created_at FROM help_events WHERE organization_id = ?`, [orgId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    },

    _getMetrics: (orgId) => {
        return new Promise((resolve, reject) => {
            db.all(`SELECT event_type, created_at FROM metrics_events WHERE organization_id = ?`, [orgId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    },

    _getLifecycleEvents: (orgId) => {
        return new Promise((resolve, reject) => {
            db.all(`SELECT event_type, metadata, created_at FROM organization_events WHERE organization_id = ? ORDER BY created_at DESC LIMIT 20`, [orgId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    },

    _calculateTaskDistribution: (tasks) => {
        const stats = {
            total: tasks.length,
            by_status: {},
            by_priority: {},
            user_load: {}
        };

        tasks.forEach(t => {
            stats.by_status[t.status] = (stats.by_status[t.status] || 0) + 1;
            stats.by_priority[t.priority] = (stats.by_priority[t.priority] || 0) + 1;
            if (t.assignee_id) {
                if (!stats.user_load[t.assignee_id]) {
                    stats.user_load[t.assignee_id] = { total: 0, completed: 0, blocked: 0 };
                }
                stats.user_load[t.assignee_id].total++;
                if (t.status === 'done' || t.status === 'DONE') stats.user_load[t.assignee_id].completed++;
                if (t.status === 'blocked' || t.status === 'BLOCKED') stats.user_load[t.assignee_id].blocked++;
            }
        });

        return stats;
    },

    _calculateInitiativeStatus: (initiatives) => {
        const now = new Date();
        return initiatives.map(i => {
            const updatedAt = new Date(i.updated_at || i.created_at);
            const staleDays = Math.floor((now - updatedAt) / (1000 * 60 * 60 * 24));
            return {
                id: i.id,
                name: i.name,
                status: i.status,
                is_blocked: i.status === 'BLOCKED' || !!i.blocked_reason,
                blocked_days: (i.status === 'BLOCKED' || !!i.blocked_reason) ? staleDays : 0,
                stale_days: staleDays
            };
        });
    },

    _calculateHelpCompletionRatios: (events) => {
        const userPlaybooks = {};
        events.forEach(e => {
            const key = `${e.user_id}:${e.playbook_key}`;
            if (!userPlaybooks[key]) {
                userPlaybooks[key] = { started: false, completed: false, user_id: e.user_id };
            }
            if (e.event_type === 'STARTED') userPlaybooks[key].started = true;
            if (e.event_type === 'COMPLETED') userPlaybooks[key].completed = true;
        });

        const userStats = {};
        Object.values(userPlaybooks).forEach(p => {
            if (!userStats[p.user_id]) userStats[p.user_id] = { started: 0, completed: 0 };
            if (p.started) userStats[p.user_id].started++;
            if (p.completed) userStats[p.user_id].completed++;
        });

        const ratios = {};
        Object.keys(userStats).forEach(uid => {
            ratios[uid] = {
                started: userStats[uid].started,
                completed: userStats[uid].completed,
                ratio: userStats[uid].started > 0 ? (userStats[uid].completed / userStats[uid].started) : 0
            };
        });

        return ratios;
    },

    _processMetricsFunnel: (metrics) => {
        const counts = {};
        metrics.forEach(m => {
            counts[m.event_type] = (counts[m.event_type] || 0) + 1;
        });
        return counts;
    }
};

module.exports = AIContextBuilder;

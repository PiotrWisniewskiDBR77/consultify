// Narrative Service - AI-generated briefings
// Step 6: Stabilization, Reporting & Economics

const db = require('../database');

const NarrativeService = {
    /**
     * Generate weekly steering summary
     */
    generateWeeklySummary: async (projectId) => {
        // Get project info
        const project = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM projects WHERE id = ?`, [projectId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!project) throw new Error('Project not found');

        // Get weekly stats
        const weeklyStats = await new Promise((resolve, reject) => {
            db.get(`SELECT 
                    (SELECT COUNT(*) FROM tasks WHERE project_id = ? AND status IN ('done', 'DONE') AND updated_at > datetime('now', '-7 days')) as tasksCompleted,
                    (SELECT COUNT(*) FROM initiatives WHERE project_id = ? AND status = 'COMPLETED' AND updated_at > datetime('now', '-7 days')) as initiativesCompleted,
                    (SELECT COUNT(*) FROM decisions WHERE project_id = ? AND status != 'PENDING' AND decided_at > datetime('now', '-7 days')) as decisionsMade
                `, [projectId, projectId, projectId], (err, row) => {
                if (err) reject(err);
                else resolve(row || {});
            });
        });

        // Get current blockers
        const blockers = await new Promise((resolve, reject) => {
            db.all(`SELECT name, blocked_reason FROM initiatives WHERE project_id = ? AND status = 'BLOCKED' LIMIT 3`,
                [projectId], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
        });

        // Generate narrative
        const narrative = [];
        narrative.push(`**Weekly Summary: ${project.name}**`);
        narrative.push(`*Generated: ${new Date().toLocaleDateString()}*`);
        narrative.push('');
        narrative.push('**Progress This Week:**');
        narrative.push(`- ${weeklyStats.tasksCompleted || 0} task(s) completed`);
        narrative.push(`- ${weeklyStats.initiativesCompleted || 0} initiative(s) completed`);
        narrative.push(`- ${weeklyStats.decisionsMade || 0} decision(s) made`);

        if (blockers.length > 0) {
            narrative.push('');
            narrative.push('**Current Blockers:**');
            blockers.forEach(b => {
                narrative.push(`- ${b.name}: ${b.blocked_reason || 'No reason provided'}`);
            });
        }

        narrative.push('');
        narrative.push(`**Current Phase:** ${project.current_phase || 'Context'}`);
        narrative.push(`**Overall Progress:** ${project.progress || 0}%`);

        return {
            projectId,
            type: 'WEEKLY_SUMMARY',
            narrative: narrative.join('\n'),
            generatedAt: new Date().toISOString()
        };
    },

    /**
     * Generate executive memo
     */
    generateExecutiveMemo: async (projectId, topic = 'status') => {
        const project = await new Promise((resolve, reject) => {
            db.get(`SELECT p.*, o.name as org_name FROM projects p 
                    LEFT JOIN organizations o ON p.organization_id = o.id
                    WHERE p.id = ?`, [projectId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!project) throw new Error('Project not found');

        // Get key metrics
        const metrics = await new Promise((resolve, reject) => {
            db.get(`SELECT 
                    COUNT(*) as totalInitiatives,
                    SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
                    SUM(CASE WHEN status = 'BLOCKED' THEN 1 ELSE 0 END) as blocked
                    FROM initiatives WHERE project_id = ?`,
                [projectId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row || {});
                });
        });

        const memo = [];
        memo.push(`**EXECUTIVE MEMO**`);
        memo.push(`**To:** Executive Leadership`);
        memo.push(`**From:** PMO`);
        memo.push(`**Re:** ${project.name} - ${topic.charAt(0).toUpperCase() + topic.slice(1)} Update`);
        memo.push(`**Date:** ${new Date().toLocaleDateString()}`);
        memo.push('');
        memo.push('---');
        memo.push('');
        memo.push('**Executive Summary**');
        memo.push('');
        memo.push(`The ${project.name} transformation project is currently in the **${project.current_phase || 'Context'}** phase with an overall progress of **${project.progress || 0}%**.`);
        memo.push('');
        memo.push('**Key Metrics:**');
        memo.push(`- Total Initiatives: ${metrics.totalInitiatives || 0}`);
        memo.push(`- Completed: ${metrics.completed || 0}`);
        memo.push(`- Blocked: ${metrics.blocked || 0}`);

        if (metrics.blocked > 0) {
            memo.push('');
            memo.push('**Attention Required:**');
            memo.push(`- ${metrics.blocked} initiative(s) require intervention to unblock.`);
        }

        memo.push('');
        memo.push('**Recommendation:**');
        if (project.progress >= 80 && metrics.blocked === 0) {
            memo.push('The project is on track. Continue current execution cadence.');
        } else if (metrics.blocked > 0) {
            memo.push('Schedule blocker review meeting to address stalled initiatives.');
        } else {
            memo.push('Monitor progress closely; consider resource reallocation if delays persist.');
        }

        return {
            projectId,
            type: 'EXECUTIVE_MEMO',
            narrative: memo.join('\n'),
            generatedAt: new Date().toISOString()
        };
    },

    /**
     * Generate transformation progress narrative
     */
    generateProgressNarrative: async (projectId) => {
        const project = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM projects WHERE id = ?`, [projectId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!project) throw new Error('Project not found');

        // Get phase history
        let phaseHistory = [];
        try {
            phaseHistory = JSON.parse(project.phase_history || '[]');
        } catch { }

        // Get value summary
        const valueSummary = await new Promise((resolve, reject) => {
            db.get(`SELECT COUNT(*) as total, SUM(CASE WHEN is_validated = 1 THEN 1 ELSE 0 END) as validated
                    FROM value_hypotheses WHERE project_id = ?`,
                [projectId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row || {});
                });
        });

        const narrative = [];
        narrative.push(`# Transformation Progress: ${project.name}`);
        narrative.push('');
        narrative.push('## Journey So Far');
        narrative.push('');

        if (phaseHistory.length > 0) {
            phaseHistory.forEach(ph => {
                narrative.push(`- **${ph.phase}**: Entered ${new Date(ph.enteredAt).toLocaleDateString()}`);
            });
        } else {
            narrative.push(`- **${project.current_phase || 'Context'}**: Currently in progress`);
        }

        narrative.push('');
        narrative.push('## Current Status');
        narrative.push(`- Phase: ${project.current_phase || 'Context'}`);
        narrative.push(`- Progress: ${project.progress || 0}%`);
        narrative.push(`- Status: ${project.status || 'ACTIVE'}`);

        if (valueSummary.total > 0) {
            narrative.push('');
            narrative.push('## Value Realization');
            narrative.push(`- Value hypotheses defined: ${valueSummary.total}`);
            narrative.push(`- Validated: ${valueSummary.validated || 0}`);
        }

        return {
            projectId,
            type: 'PROGRESS_NARRATIVE',
            narrative: narrative.join('\n'),
            generatedAt: new Date().toISOString()
        };
    }
};

module.exports = NarrativeService;

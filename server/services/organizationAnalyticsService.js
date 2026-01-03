/**
 * Organization Analytics Service
 * Aggregates and provides analytics for organizations
 */

import db from '../database.js';
import { v4 as uuidv4 } from 'uuid';



const OrganizationAnalyticsService = {
    /**
     * Calculate and save analytics for a date
     */
    calculateAnalytics: async (organizationId, metricDate = null) => {
        const date = metricDate || new Date().toISOString().split('T')[0];
        
        const [users, activity, projects, tasks, support] = await Promise.all([
            new Promise((resolve) => {
                db.get(
                    `SELECT COUNT(*) as total, 
                     COUNT(CASE WHEN last_login > datetime('now', '-7 days') THEN 1 END) as active
                     FROM users WHERE organization_id = ?`,
                    [organizationId],
                    (err, row) => resolve(row || { total: 0, active: 0 })
                );
            }),
            new Promise((resolve) => {
                db.get(
                    `SELECT COUNT(*) as interactions, SUM(input_tokens + output_tokens) as tokens
                     FROM ai_logs WHERE user_id IN (SELECT id FROM users WHERE organization_id = ?)
                     AND DATE(created_at) = ?`,
                    [organizationId, date],
                    (err, row) => resolve(row || { interactions: 0, tokens: 0 })
                );
            }),
            new Promise((resolve) => {
                db.get(
                    'SELECT COUNT(*) as count FROM projects WHERE organization_id = ?',
                    [organizationId],
                    (err, row) => resolve(row || { count: 0 })
                );
            }),
            new Promise((resolve) => {
                db.get(
                    `SELECT 
                     COUNT(CASE WHEN DATE(created_at) = ? THEN 1 END) as created,
                     COUNT(CASE WHEN DATE(completed_at) = ? THEN 1 END) as completed
                     FROM tasks WHERE organization_id = ?`,
                    [date, date, organizationId],
                    (err, row) => resolve(row || { created: 0, completed: 0 })
                );
            }),
            new Promise((resolve) => {
                db.get(
                    'SELECT COUNT(*) as count FROM support_tickets WHERE organization_id = ?',
                    [organizationId],
                    (err, row) => resolve(row || { count: 0 })
                );
            })
        ]);

        const id = uuidv4();
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO organization_analytics 
                 (id, organization_id, metric_date, total_users, active_users, ai_interactions,
                  tokens_used, projects_count, tasks_created, tasks_completed, support_tickets)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(organization_id, metric_date) DO UPDATE SET
                 total_users = excluded.total_users,
                 active_users = excluded.active_users,
                 ai_interactions = excluded.ai_interactions,
                 tokens_used = excluded.tokens_used,
                 projects_count = excluded.projects_count,
                 tasks_created = excluded.tasks_created,
                 tasks_completed = excluded.tasks_completed,
                 support_tickets = excluded.support_tickets`,
                [
                    id, organizationId, date,
                    users.total, users.active,
                    activity.interactions, activity.tokens || 0,
                    projects.count, tasks.created, tasks.completed,
                    support.count
                ],
                (err) => err ? reject(err) : resolve()
            );
        });

        return {
            id, organizationId, metricDate: date,
            totalUsers: users.total,
            activeUsers: users.active,
            aiInteractions: activity.interactions,
            tokensUsed: activity.tokens || 0,
            projectsCount: projects.count,
            tasksCreated: tasks.created,
            tasksCompleted: tasks.completed,
            supportTickets: support.count
        };
    },

    /**
     * Get analytics for a date range
     */
    getAnalytics: (organizationId, startDate, endDate) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM organization_analytics 
                 WHERE organization_id = ? AND metric_date BETWEEN ? AND ?
                 ORDER BY metric_date ASC`,
                [organizationId, startDate, endDate],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    }
};

export default OrganizationAnalyticsService;








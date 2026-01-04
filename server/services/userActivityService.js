/**
 * User Activity Service
 * Tracks and aggregates user activity metrics
 */

import { getDatabase } from '../src/database/index.js';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';



const UserActivityService = {
    /**
     * Get activity summary for a user
     */
    getActivitySummary: (userId, organizationId, periodStart, periodEnd) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM user_activity_summary 
                 WHERE user_id = ? AND organization_id = ? AND period_start = ?`,
                [userId, organizationId, periodStart],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row || null);
                }
            );
        });
    },

    /**
     * Calculate and save activity summary for a period
     */
    calculateActivitySummary: async (userId, organizationId, periodStart, periodEnd) => {
        // Get activity data
        const [loginData, aiData, taskData, projectData] = await Promise.all([
            new Promise((resolve) => {
                db.get(
                    `SELECT COUNT(*) as login_count, MAX(last_login) as last_login_at
                     FROM users WHERE id = ? AND last_login BETWEEN ? AND ?`,
                    [userId, periodStart, periodEnd],
                    (err, row) => resolve(row || { login_count: 0, last_login_at: null })
                );
            }),
            new Promise((resolve) => {
                db.get(
                    `SELECT COUNT(*) as interactions
                     FROM ai_logs WHERE user_id = ? AND created_at BETWEEN ? AND ?`,
                    [userId, periodStart, periodEnd],
                    (err, row) => resolve(row || { interactions: 0 })
                );
            }),
            new Promise((resolve) => {
                db.get(
                    `SELECT 
                     COUNT(CASE WHEN created_at BETWEEN ? AND ? THEN 1 END) as created,
                     COUNT(CASE WHEN completed_at BETWEEN ? AND ? THEN 1 END) as completed
                     FROM tasks WHERE assignee_id = ?`,
                    [periodStart, periodEnd, periodStart, periodEnd, userId],
                    (err, row) => resolve(row || { created: 0, completed: 0 })
                );
            }),
            new Promise((resolve) => {
                db.get(
                    `SELECT COUNT(DISTINCT project_id) as accessed
                     FROM project_users WHERE user_id = ?`,
                    [userId],
                    (err, row) => resolve(row || { accessed: 0 })
                );
            })
        ]);

        // Calculate engagement score (0-100)
        const engagementScore = Math.min(100,
            (loginData.login_count * 10) +
            (aiData.interactions * 2) +
            (taskData.created * 5) +
            (taskData.completed * 10)
        );

        const id = uuidv4();
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO user_activity_summary 
                 (id, user_id, organization_id, period_start, period_end, login_count, last_login_at,
                  ai_interactions, tasks_created, tasks_completed, projects_accessed, engagement_score)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(user_id, organization_id, period_start) DO UPDATE SET
                 login_count = excluded.login_count,
                 last_login_at = excluded.last_login_at,
                 ai_interactions = excluded.ai_interactions,
                 tasks_created = excluded.tasks_created,
                 tasks_completed = excluded.tasks_completed,
                 projects_accessed = excluded.projects_accessed,
                 engagement_score = excluded.engagement_score`,
                [id, userId, organizationId, periodStart, periodEnd,
                 loginData.login_count, loginData.last_login_at,
                 aiData.interactions, taskData.created, taskData.completed,
                 projectData.accessed, engagementScore],
                (err) => err ? reject(err) : resolve()
            );
        });

        return {
            id,
            userId,
            organizationId,
            periodStart,
            periodEnd,
            loginCount: loginData.login_count,
            lastLoginAt: loginData.last_login_at,
            aiInteractions: aiData.interactions,
            tasksCreated: taskData.created,
            tasksCompleted: taskData.completed,
            projectsAccessed: projectData.accessed,
            engagementScore
        };
    },

    /**
     * Get activity history
     */
    getActivityHistory: (userId, organizationId, limit = 30) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM user_activity_summary 
                 WHERE user_id = ? AND organization_id = ?
                 ORDER BY period_start DESC LIMIT ?`,
                [userId, organizationId, limit],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    }
};

export default UserActivityService;










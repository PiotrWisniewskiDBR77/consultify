/**
 * User Adoption Service
 * Tracks user adoption metrics
 */

import { getDatabase } from '../src/database/index.js';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';



const UserAdoptionService = {
    /**
     * Calculate adoption metrics for a user
     */
    calculateMetrics: async (userId, organizationId, metricDate = null) => {
        const date = metricDate || new Date().toISOString().split('T')[0];
        
        const [features, playbooks, aiInteractions, logins] = await Promise.all([
            new Promise((resolve) => {
                // Get features used from activity logs
                db.all(
                    `SELECT DISTINCT entity_type as feature FROM activity_logs 
                     WHERE user_id = ? AND DATE(created_at) = ?`,
                    [userId, date],
                    (err, rows) => resolve(rows || [])
                );
            }),
            new Promise((resolve) => {
                db.get(
                    `SELECT COUNT(*) as completed
                     FROM ai_playbook_runs WHERE user_id = ? AND status = 'completed'
                     AND DATE(completed_at) = ?`,
                    [userId, date],
                    (err, row) => resolve(row || { completed: 0 })
                );
            }),
            new Promise((resolve) => {
                db.get(
                    `SELECT COUNT(*) as interactions
                     FROM ai_logs WHERE user_id = ? AND DATE(created_at) = ?`,
                    [userId, date],
                    (err, row) => resolve(row || { interactions: 0 })
                );
            }),
            new Promise((resolve) => {
                db.get(
                    `SELECT COUNT(*) as frequency
                     FROM users WHERE id = ? AND last_login IS NOT NULL`,
                    [userId],
                    (err, row) => resolve(row || { frequency: 0 })
                );
            })
        ]);

        const featuresUsed = features.map(f => f.feature);
        const engagementScore = Math.min(100,
            (featuresUsed.length * 10) +
            (playbooks.completed * 15) +
            (aiInteractions.interactions * 2) +
            (logins.frequency * 5)
        );

        const id = uuidv4();
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO user_adoption_metrics 
                 (id, user_id, organization_id, metric_date, features_used_json,
                  playbooks_completed, ai_interactions, login_frequency, engagement_score)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(user_id, organization_id, metric_date) DO UPDATE SET
                 features_used_json = excluded.features_used_json,
                 playbooks_completed = excluded.playbooks_completed,
                 ai_interactions = excluded.ai_interactions,
                 login_frequency = excluded.login_frequency,
                 engagement_score = excluded.engagement_score`,
                [
                    id, userId, organizationId, date,
                    JSON.stringify(featuresUsed),
                    playbooks.completed,
                    aiInteractions.interactions,
                    logins.frequency,
                    engagementScore
                ],
                (err) => err ? reject(err) : resolve()
            );
        });

        return {
            id, userId, organizationId, metricDate: date,
            featuresUsed,
            playbooksCompleted: playbooks.completed,
            aiInteractions: aiInteractions.interactions,
            loginFrequency: logins.frequency,
            engagementScore
        };
    },

    /**
     * Get adoption metrics for a date range
     */
    getMetrics: (userId, organizationId, startDate, endDate) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM user_adoption_metrics 
                 WHERE user_id = ? AND organization_id = ? AND metric_date BETWEEN ? AND ?
                 ORDER BY metric_date ASC`,
                [userId, organizationId, startDate, endDate],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    }
};

export default UserAdoptionService;










/**
 * Organization Health Service
 * Calculates health scores and churn risk for organizations
 */

import { getDatabase } from '../src/database/Database.ts';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';



const OrganizationHealthService = {
    /**
     * Calculate health score for an organization
     */
    calculateHealthScore: async (organizationId, scoreDate = null) => {
        const date = scoreDate || new Date().toISOString().split('T')[0];
        
        // Get recent activity data
        const [users, activity, support, billing] = await Promise.all([
            new Promise((resolve) => {
                db.get(
                    `SELECT COUNT(*) as total, 
                     COUNT(CASE WHEN last_login > datetime('now', '-7 days') THEN 1 END) as active_7d
                     FROM users WHERE organization_id = ?`,
                    [organizationId],
                    (err, row) => resolve(row || { total: 0, active_7d: 0 })
                );
            }),
            new Promise((resolve) => {
                db.get(
                    `SELECT COUNT(*) as interactions, SUM(input_tokens + output_tokens) as tokens
                     FROM ai_logs WHERE user_id IN (SELECT id FROM users WHERE organization_id = ?)
                     AND created_at > datetime('now', '-7 days')`,
                    [organizationId],
                    (err, row) => resolve(row || { interactions: 0, tokens: 0 })
                );
            }),
            new Promise((resolve) => {
                db.get(
                    `SELECT COUNT(*) as total, 
                     COUNT(CASE WHEN status = 'open' THEN 1 END) as open
                     FROM support_tickets WHERE organization_id = ?`,
                    [organizationId],
                    (err, row) => resolve(row || { total: 0, open: 0 })
                );
            }),
            new Promise((resolve) => {
                db.get(
                    `SELECT status FROM organization_billing WHERE organization_id = ?`,
                    [organizationId],
                    (err, row) => resolve(row || { status: 'no_subscription' })
                );
            })
        ]);

        // Calculate scores (0-100)
        const engagementScore = users.total > 0 
            ? Math.min(100, (users.active_7d / users.total) * 100)
            : 0;
        
        const adoptionScore = activity.interactions > 0 ? Math.min(100, Math.log10(activity.interactions + 1) * 20) : 0;
        
        const supportScore = support.total > 0 
            ? Math.max(0, 100 - (support.open / support.total) * 50)
            : 100;
        
        const technicalScore = 85; // Placeholder - would calculate from system health metrics
        const billingScore = billing.status === 'active' ? 100 : 50;

        const overallScore = (
            engagementScore * 0.3 +
            adoptionScore * 0.25 +
            supportScore * 0.2 +
            technicalScore * 0.15 +
            billingScore * 0.1
        );

        // Calculate churn risk (0-100, higher = more risk)
        const churnRisk = Math.max(0, Math.min(100, 
            100 - overallScore + 
            (support.open > 0 ? 10 : 0) +
            (billing.status !== 'active' ? 20 : 0)
        ));

        const healthTrend = overallScore >= 80 ? 'improving' : overallScore >= 60 ? 'stable' : 'declining';

        // Save health score
        const id = uuidv4();
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO organization_health_scores 
                 (id, organization_id, score_date, overall_score, engagement_score, adoption_score, 
                  support_score, technical_score, billing_score, churn_risk, health_trend, factors_json)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(organization_id, score_date) DO UPDATE SET
                 overall_score = excluded.overall_score,
                 engagement_score = excluded.engagement_score,
                 adoption_score = excluded.adoption_score,
                 support_score = excluded.support_score,
                 technical_score = excluded.technical_score,
                 billing_score = excluded.billing_score,
                 churn_risk = excluded.churn_risk,
                 health_trend = excluded.health_trend,
                 factors_json = excluded.factors_json`,
                [id, organizationId, date, overallScore, engagementScore, adoptionScore,
                 supportScore, technicalScore, billingScore, churnRisk, healthTrend,
                 JSON.stringify({ users, activity, support, billing })],
                (err) => err ? reject(err) : resolve()
            );
        });

        return {
            id,
            organizationId,
            scoreDate: date,
            overallScore,
            engagementScore,
            adoptionScore,
            supportScore,
            technicalScore,
            billingScore,
            churnRisk,
            healthTrend
        };
    },

    /**
     * Get health score for an organization
     */
    getHealthScore: (organizationId, scoreDate = null) => {
        const date = scoreDate || new Date().toISOString().split('T')[0];
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM organization_health_scores WHERE organization_id = ? AND score_date = ?',
                [organizationId, date],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row || null);
                }
            );
        });
    },

    /**
     * Get health score history
     */
    getHealthScoreHistory: (organizationId, limit = 30) => {
        return new Promise((resolve, reject) => {
            db.all(
                'SELECT * FROM organization_health_scores WHERE organization_id = ? ORDER BY score_date DESC LIMIT ?',
                [organizationId, limit],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    }
};

export default OrganizationHealthService;















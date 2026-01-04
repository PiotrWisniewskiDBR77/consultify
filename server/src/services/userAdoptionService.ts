/**
 * User Adoption Service
 * Tracks user adoption metrics.
 */

import { v4 as uuidv4 } from 'uuid';

import * as DbPromise from '../utils/DbPromise.ts';

type FeatureRow = {
    feature?: string | null;
};

type CountRow = {
    completed?: number;
    interactions?: number;
    frequency?: number;
};

type AdoptionMetrics = {
    id: string;
    userId: string;
    organizationId: string;
    metricDate: string;
    featuresUsed: string[];
    playbooksCompleted: number;
    aiInteractions: number;
    loginFrequency: number;
    engagementScore: number;
};

const UserAdoptionService = {
    calculateMetrics: async (
        userId: string,
        organizationId: string,
        metricDate: string | null = null,
    ): Promise<AdoptionMetrics> => {
        const date = metricDate || new Date().toISOString().split('T')[0];

        const [features, playbooks, aiInteractions, logins] = await Promise.all([
            DbPromise.all<FeatureRow>(
                `SELECT DISTINCT entity_type as feature FROM activity_logs 
                 WHERE user_id = ? AND DATE(created_at) = ?`,
                [userId, date],
            ),
            DbPromise.get<CountRow>(
                `SELECT COUNT(*) as completed
                 FROM ai_playbook_runs WHERE user_id = ? AND status = 'completed'
                 AND DATE(completed_at) = ?`,
                [userId, date],
            ),
            DbPromise.get<CountRow>(
                `SELECT COUNT(*) as interactions
                 FROM ai_logs WHERE user_id = ? AND DATE(created_at) = ?`,
                [userId, date],
            ),
            DbPromise.get<CountRow>(
                `SELECT COUNT(*) as frequency
                 FROM users WHERE id = ? AND last_login IS NOT NULL`,
                [userId],
            ),
        ]);

        const featuresUsed = features
            .map((row) => row.feature)
            .filter((feature): feature is string => Boolean(feature));

        const playbooksCompleted = playbooks?.completed ?? 0;
        const interactionCount = aiInteractions?.interactions ?? 0;
        const loginFrequency = logins?.frequency ?? 0;

        const engagementScore = Math.min(
            100,
            featuresUsed.length * 10 + playbooksCompleted * 15 + interactionCount * 2 + loginFrequency * 5,
        );

        const id = uuidv4();
        await DbPromise.run(
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
                id,
                userId,
                organizationId,
                date,
                JSON.stringify(featuresUsed),
                playbooksCompleted,
                interactionCount,
                loginFrequency,
                engagementScore,
            ],
            { fallback: false },
        );

        return {
            id,
            userId,
            organizationId,
            metricDate: date,
            featuresUsed,
            playbooksCompleted,
            aiInteractions: interactionCount,
            loginFrequency,
            engagementScore,
        };
    },

    getMetrics: async (
        userId: string,
        organizationId: string,
        startDate: string,
        endDate: string,
    ): Promise<unknown[]> => {
        return DbPromise.all(
            `SELECT * FROM user_adoption_metrics 
             WHERE user_id = ? AND organization_id = ? AND metric_date BETWEEN ? AND ?
             ORDER BY metric_date ASC`,
            [userId, organizationId, startDate, endDate],
        );
    },
};

export default UserAdoptionService;

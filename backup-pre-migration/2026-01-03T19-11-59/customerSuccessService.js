/**
 * Customer Success Service
 * Manages customer success notes and interactions
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

const CustomerSuccessService = {
    /**
     * Create a customer success note
     */
    createNote: (noteData) => {
        return new Promise((resolve, reject) => {
            const id = uuidv4();
            db.run(
                `INSERT INTO customer_success_notes 
                 (id, organization_id, user_id, note_type, title, content, action_items_json, follow_up_date, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id,
                    noteData.organizationId,
                    noteData.userId || null,
                    noteData.noteType || null,
                    noteData.title,
                    noteData.content,
                    JSON.stringify(noteData.actionItems || []),
                    noteData.followUpDate || null,
                    noteData.createdBy
                ],
                function (err) {
                    if (err) return reject(err);
                    resolve({ id, ...noteData });
                }
            );
        });
    },

    /**
     * Get notes for an organization
     */
    getNotes: (organizationId, filters = {}) => {
        return new Promise((resolve, reject) => {
            let query = `SELECT n.*, 
                        u.email as user_email, u.first_name, u.last_name,
                        c.email as created_email, c.first_name as created_first_name, c.last_name as created_last_name
                        FROM customer_success_notes n
                        LEFT JOIN users u ON n.user_id = u.id
                        LEFT JOIN users c ON n.created_by = c.id
                        WHERE n.organization_id = ?`;
            const params = [organizationId];

            if (filters.noteType) {
                query += ' AND n.note_type = ?';
                params.push(filters.noteType);
            }
            if (filters.userId) {
                query += ' AND n.user_id = ?';
                params.push(filters.userId);
            }

            query += ' ORDER BY n.created_at DESC LIMIT ?';
            params.push(filters.limit || 50);

            db.all(query, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    },

    /**
     * Get customer health check
     */
    getHealthCheck: (organizationId, checkDate = null) => {
        const date = checkDate || new Date().toISOString().split('T')[0];
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM customer_health_checks WHERE organization_id = ? AND check_date = ?',
                [organizationId, date],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row || null);
                }
            );
        });
    },

    /**
     * Create or update health check
     */
    createHealthCheck: (healthCheckData) => {
        return new Promise((resolve, reject) => {
            const id = uuidv4();
            const checkDate = healthCheckData.checkDate || new Date().toISOString().split('T')[0];
            
            db.run(
                `INSERT INTO customer_health_checks 
                 (id, organization_id, check_date, overall_health, engagement_level, adoption_score,
                  support_tickets_count, open_tickets_count, avg_response_time_hours, nps_score,
                  churn_risk, risk_factors_json, recommendations_json, checked_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(organization_id, check_date) DO UPDATE SET
                 overall_health = excluded.overall_health,
                 engagement_level = excluded.engagement_level,
                 adoption_score = excluded.adoption_score,
                 support_tickets_count = excluded.support_tickets_count,
                 open_tickets_count = excluded.open_tickets_count,
                 avg_response_time_hours = excluded.avg_response_time_hours,
                 nps_score = excluded.nps_score,
                 churn_risk = excluded.churn_risk,
                 risk_factors_json = excluded.risk_factors_json,
                 recommendations_json = excluded.recommendations_json,
                 checked_by = excluded.checked_by`,
                [
                    id,
                    healthCheckData.organizationId,
                    checkDate,
                    healthCheckData.overallHealth,
                    healthCheckData.engagementLevel,
                    healthCheckData.adoptionScore,
                    healthCheckData.supportTicketsCount || 0,
                    healthCheckData.openTicketsCount || 0,
                    healthCheckData.avgResponseTimeHours || 0,
                    healthCheckData.npsScore || null,
                    healthCheckData.churnRisk,
                    JSON.stringify(healthCheckData.riskFactors || []),
                    JSON.stringify(healthCheckData.recommendations || []),
                    healthCheckData.checkedBy || null
                ],
                function (err) {
                    if (err) return reject(err);
                    resolve({ id, organizationId: healthCheckData.organizationId, checkDate, ...healthCheckData });
                }
            );
        });
    }
};

export default CustomerSuccessService;






/**
 * Data Retention Service
 * Manages data retention policies
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

const DataRetentionService = {
    /**
     * Get retention policies
     */
    getPolicies: (organizationId = null) => {
        return new Promise((resolve, reject) => {
            let query = 'SELECT * FROM data_retention_policies WHERE 1=1';
            const params = [];

            if (organizationId) {
                query += ' AND organization_id = ?';
                params.push(organizationId);
            }

            query += ' ORDER BY created_at DESC';

            db.all(query, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    },

    /**
     * Create retention policy
     */
    createPolicy: (policyData) => {
        return new Promise((resolve, reject) => {
            const id = uuidv4();
            db.run(
                `INSERT INTO data_retention_policies 
                 (id, organization_id, data_type, retention_days, auto_delete, archive_before_delete)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    id,
                    policyData.organizationId || null,
                    policyData.dataType,
                    policyData.retentionDays,
                    policyData.autoDelete ? 1 : 0,
                    policyData.archiveBeforeDelete ? 1 : 0
                ],
                function (err) {
                    if (err) return reject(err);
                    resolve({ id, ...policyData });
                }
            );
        });
    },

    /**
     * Update retention policy
     */
    updatePolicy: (policyId, updates) => {
        return new Promise((resolve, reject) => {
            const fields = [];
            const values = [];

            if (updates.retentionDays !== undefined) {
                fields.push('retention_days = ?');
                values.push(updates.retentionDays);
            }
            if (updates.autoDelete !== undefined) {
                fields.push('auto_delete = ?');
                values.push(updates.autoDelete ? 1 : 0);
            }
            if (updates.archiveBeforeDelete !== undefined) {
                fields.push('archive_before_delete = ?');
                values.push(updates.archiveBeforeDelete ? 1 : 0);
            }

            if (fields.length === 0) {
                return resolve({ updated: false });
            }

            values.push(policyId);
            db.run(
                `UPDATE data_retention_policies SET ${fields.join(', ')} WHERE id = ?`,
                values,
                function (err) {
                    if (err) return reject(err);
                    resolve({ updated: this.changes > 0 });
                }
            );
        });
    },

    /**
     * Delete retention policy
     */
    deletePolicy: (policyId) => {
        return new Promise((resolve, reject) => {
            db.run(
                'DELETE FROM data_retention_policies WHERE id = ?',
                [policyId],
                function (err) {
                    if (err) return reject(err);
                    resolve({ deleted: this.changes > 0 });
                }
            );
        });
    }
};

module.exports = DataRetentionService;


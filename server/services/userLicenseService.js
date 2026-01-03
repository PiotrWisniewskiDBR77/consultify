/**
 * User License Service
 * Manages user license assignments
 */

import db from '../database.js';
import { v4 as uuidv4 } from 'uuid';



const UserLicenseService = {
    /**
     * Get license for a user
     */
    getLicense: (userId, organizationId) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM user_licenses 
                 WHERE user_id = ? AND organization_id = ?
                 ORDER BY assigned_at DESC LIMIT 1`,
                [userId, organizationId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row || null);
                }
            );
        });
    },

    /**
     * Assign a license to a user
     */
    assignLicense: (userId, organizationId, licenseType, features = [], limits = {}, expiresAt = null, assignedBy, notes = null) => {
        return new Promise((resolve, reject) => {
            const id = uuidv4();
            db.run(
                `INSERT INTO user_licenses 
                 (id, user_id, organization_id, license_type, features_json, limits_json, expires_at, assigned_by, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, userId, organizationId, licenseType, JSON.stringify(features), JSON.stringify(limits), expiresAt, assignedBy, notes],
                function (err) {
                    if (err) return reject(err);
                    resolve({ id, userId, organizationId, licenseType, features, limits, expiresAt });
                }
            );
        });
    },

    /**
     * Update license
     */
    updateLicense: (licenseId, updates) => {
        return new Promise((resolve, reject) => {
            const fields = [];
            const values = [];

            if (updates.licenseType) {
                fields.push('license_type = ?');
                values.push(updates.licenseType);
            }
            if (updates.features) {
                fields.push('features_json = ?');
                values.push(JSON.stringify(updates.features));
            }
            if (updates.limits) {
                fields.push('limits_json = ?');
                values.push(JSON.stringify(updates.limits));
            }
            if (updates.expiresAt !== undefined) {
                fields.push('expires_at = ?');
                values.push(updates.expiresAt);
            }
            if (updates.notes !== undefined) {
                fields.push('notes = ?');
                values.push(updates.notes);
            }

            if (fields.length === 0) {
                return resolve({ updated: false });
            }

            values.push(licenseId);
            db.run(
                `UPDATE user_licenses SET ${fields.join(', ')} WHERE id = ?`,
                values,
                function (err) {
                    if (err) return reject(err);
                    resolve({ updated: this.changes > 0 });
                }
            );
        });
    },

    /**
     * Get all licenses for an organization
     */
    getOrganizationLicenses: (organizationId) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT l.*, u.email, u.first_name, u.last_name
                 FROM user_licenses l
                 INNER JOIN users u ON l.user_id = u.id
                 WHERE l.organization_id = ?
                 ORDER BY l.assigned_at DESC`,
                [organizationId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    }
};

export default UserLicenseService;







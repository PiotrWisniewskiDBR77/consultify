/**
 * Organization Metadata Service
 * Manages custom fields and metadata for organizations
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

const OrganizationMetadataService = {
    /**
     * Get all metadata for an organization
     */
    getMetadata: (organizationId) => {
        return new Promise((resolve, reject) => {
            db.all(
                'SELECT * FROM organization_metadata WHERE organization_id = ? ORDER BY category, key',
                [organizationId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    },

    /**
     * Get metadata by key
     */
    getMetadataByKey: (organizationId, key) => {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM organization_metadata WHERE organization_id = ? AND key = ?',
                [organizationId, key],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row || null);
                }
            );
        });
    },

    /**
     * Set metadata value
     */
    setMetadata: (organizationId, key, value, valueType = 'string', category = null, isSensitive = false) => {
        return new Promise((resolve, reject) => {
            const id = uuidv4();
            db.run(
                `INSERT INTO organization_metadata (id, organization_id, key, value, value_type, category, is_sensitive, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
                 ON CONFLICT(organization_id, key) DO UPDATE SET
                 value = excluded.value,
                 value_type = excluded.value_type,
                 category = excluded.category,
                 is_sensitive = excluded.is_sensitive,
                 updated_at = datetime('now')`,
                [id, organizationId, key, value, valueType, category, isSensitive ? 1 : 0],
                function (err) {
                    if (err) return reject(err);
                    resolve({ id, organizationId, key, value, valueType, category, isSensitive });
                }
            );
        });
    },

    /**
     * Delete metadata by key
     */
    deleteMetadata: (organizationId, key) => {
        return new Promise((resolve, reject) => {
            db.run(
                'DELETE FROM organization_metadata WHERE organization_id = ? AND key = ?',
                [organizationId, key],
                function (err) {
                    if (err) return reject(err);
                    resolve({ deleted: this.changes > 0 });
                }
            );
        });
    },

    /**
     * Get metadata by category
     */
    getMetadataByCategory: (organizationId, category) => {
        return new Promise((resolve, reject) => {
            db.all(
                'SELECT * FROM organization_metadata WHERE organization_id = ? AND category = ? ORDER BY key',
                [organizationId, category],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    }
};

module.exports = OrganizationMetadataService;






/**
 * Organization Relationship Service
 * Manages relationships between organizations (parent-child, partners, etc.)
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

const OrganizationRelationshipService = {
    /**
     * Get all relationships for an organization
     */
    getRelationships: (organizationId) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT r.*, 
                 o1.name as parent_name, o2.name as child_name
                 FROM organization_relationships r
                 LEFT JOIN organizations o1 ON r.parent_org_id = o1.id
                 LEFT JOIN organizations o2 ON r.child_org_id = o2.id
                 WHERE r.parent_org_id = ? OR r.child_org_id = ?
                 ORDER BY r.created_at DESC`,
                [organizationId, organizationId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    },

    /**
     * Create a relationship
     */
    createRelationship: (parentOrgId, childOrgId, relationshipType, metadata = {}) => {
        return new Promise((resolve, reject) => {
            const id = uuidv4();
            db.run(
                `INSERT INTO organization_relationships 
                 (id, parent_org_id, child_org_id, relationship_type, metadata)
                 VALUES (?, ?, ?, ?, ?)`,
                [id, parentOrgId, childOrgId, relationshipType, JSON.stringify(metadata)],
                function (err) {
                    if (err) {
                        if (err.message.includes('UNIQUE constraint')) {
                            return reject(new Error('Relationship already exists'));
                        }
                        return reject(err);
                    }
                    resolve({ id, parentOrgId, childOrgId, relationshipType, metadata });
                }
            );
        });
    },

    /**
     * Update relationship status
     */
    updateRelationshipStatus: (relationshipId, status) => {
        return new Promise((resolve, reject) => {
            db.run(
                'UPDATE organization_relationships SET status = ? WHERE id = ?',
                [status, relationshipId],
                function (err) {
                    if (err) return reject(err);
                    resolve({ updated: this.changes > 0 });
                }
            );
        });
    },

    /**
     * Delete a relationship
     */
    deleteRelationship: (relationshipId) => {
        return new Promise((resolve, reject) => {
            db.run(
                'DELETE FROM organization_relationships WHERE id = ?',
                [relationshipId],
                function (err) {
                    if (err) return reject(err);
                    resolve({ deleted: this.changes > 0 });
                }
            );
        });
    }
};

module.exports = OrganizationRelationshipService;


/**
 * Organization Tag Service
 * Manages tags and labels for organizations
 */

import { getDatabase } from '../src/database/Database.ts';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';



const OrganizationTagService = {
    /**
     * Get all tags for an organization
     */
    getTags: (organizationId) => {
        return new Promise((resolve, reject) => {
            db.all(
                'SELECT * FROM organization_tags WHERE organization_id = ? ORDER BY category, tag',
                [organizationId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    },

    /**
     * Add a tag to an organization
     */
    addTag: (organizationId, tag, color = null, category = null) => {
        return new Promise((resolve, reject) => {
            const id = uuidv4();
            db.run(
                `INSERT INTO organization_tags (id, organization_id, tag, color, category)
                 VALUES (?, ?, ?, ?, ?)`,
                [id, organizationId, tag, color, category],
                function (err) {
                    if (err) {
                        if (err.message.includes('UNIQUE constraint')) {
                            return reject(new Error('Tag already exists'));
                        }
                        return reject(err);
                    }
                    resolve({ id, organizationId, tag, color, category });
                }
            );
        });
    },

    /**
     * Remove a tag from an organization
     */
    removeTag: (organizationId, tagId) => {
        return new Promise((resolve, reject) => {
            db.run(
                'DELETE FROM organization_tags WHERE id = ? AND organization_id = ?',
                [tagId, organizationId],
                function (err) {
                    if (err) return reject(err);
                    resolve({ deleted: this.changes > 0 });
                }
            );
        });
    },

    /**
     * Get tags by category
     */
    getTagsByCategory: (organizationId, category) => {
        return new Promise((resolve, reject) => {
            db.all(
                'SELECT * FROM organization_tags WHERE organization_id = ? AND category = ? ORDER BY tag',
                [organizationId, category],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    }
};

export default OrganizationTagService;










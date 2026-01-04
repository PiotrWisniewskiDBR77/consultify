/**
 * User Group Service
 * Manages cross-organization user groups
 */

import { getDatabase } from '../src/database/index.js';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';



const UserGroupService = {
    /**
     * Create a user group
     */
    createGroup: (name, description, groupType, organizationId, createdBy) => {
        return new Promise((resolve, reject) => {
            const id = uuidv4();
            db.run(
                `INSERT INTO user_groups (id, name, description, group_type, organization_id, created_by)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [id, name, description, groupType, organizationId, createdBy],
                function (err) {
                    if (err) return reject(err);
                    resolve({ id, name, description, groupType, organizationId });
                }
            );
        });
    },

    /**
     * Get all groups for an organization
     */
    getGroups: (organizationId) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT g.*, COUNT(gm.user_id) as member_count
                 FROM user_groups g
                 LEFT JOIN user_group_members gm ON g.id = gm.group_id
                 WHERE g.organization_id = ?
                 GROUP BY g.id
                 ORDER BY g.created_at DESC`,
                [organizationId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    },

    /**
     * Get group details with members
     */
    getGroupDetails: (groupId) => {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM user_groups WHERE id = ?',
                [groupId],
                (err, group) => {
                    if (err) return reject(err);
                    if (!group) return resolve(null);

                    db.all(
                        `SELECT gm.*, u.email, u.first_name, u.last_name
                         FROM user_group_members gm
                         INNER JOIN users u ON gm.user_id = u.id
                         WHERE gm.group_id = ?`,
                        [groupId],
                        (err, members) => {
                            if (err) return reject(err);
                            resolve({ ...group, members: members || [] });
                        }
                    );
                }
            );
        });
    },

    /**
     * Add user to group
     */
    addMember: (groupId, userId, role = 'member', addedBy) => {
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO user_group_members (group_id, user_id, role, added_by)
                 VALUES (?, ?, ?, ?)`,
                [groupId, userId, role, addedBy],
                function (err) {
                    if (err) {
                        if (err.message.includes('UNIQUE constraint')) {
                            return reject(new Error('User already in group'));
                        }
                        return reject(err);
                    }
                    resolve({ groupId, userId, role });
                }
            );
        });
    },

    /**
     * Remove user from group
     */
    removeMember: (groupId, userId) => {
        return new Promise((resolve, reject) => {
            db.run(
                'DELETE FROM user_group_members WHERE group_id = ? AND user_id = ?',
                [groupId, userId],
                function (err) {
                    if (err) return reject(err);
                    resolve({ removed: this.changes > 0 });
                }
            );
        });
    },

    /**
     * Get groups for a user
     */
    getUserGroups: (userId) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT g.*, gm.role
                 FROM user_groups g
                 INNER JOIN user_group_members gm ON g.id = gm.group_id
                 WHERE gm.user_id = ?`,
                [userId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    }
};

export default UserGroupService;










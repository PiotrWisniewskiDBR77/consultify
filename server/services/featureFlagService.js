const { v4: uuidv4 } = require('uuid');
const db = require('../database');

class FeatureFlagService {

    constructor() {
        this.cache = {}; // Simple in-memory cache
        this.cacheTTL = 60 * 1000; // 1 minute
        this.lastFetch = 0;
    }

    async refreshCache() {
        if (Date.now() - this.lastFetch < this.cacheTTL) return;

        return new Promise((resolve) => {
            db.all('SELECT * FROM feature_flags WHERE enabled = 1', [], (err, rows) => {
                if (!err && rows) {
                    rows.forEach(row => {
                        this.cache[row.flag_key] = {
                            ...row,
                            targeting_rules: row.targeting_rules ? JSON.parse(row.targeting_rules) : []
                        };
                    });
                    this.lastFetch = Date.now();
                }
                resolve();
            });
        });
    }

    /**
     * Get all feature flags
     */
    async getFlags(filters = {}) {
        const { environment, organizationId, enabled } = filters;

        let query = 'SELECT * FROM feature_flags WHERE 1=1';
        const params = [];

        if (environment) {
            query += ' AND environment = ?';
            params.push(environment);
        }

        if (organizationId !== undefined) {
            if (organizationId === null) {
                query += ' AND organization_id IS NULL';
            } else {
                query += ' AND organization_id = ?';
                params.push(organizationId);
            }
        }

        if (enabled !== undefined) {
            query += ' AND enabled = ?';
            params.push(enabled ? 1 : 0);
        }

        query += ' ORDER BY created_at DESC';

        return new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('[FeatureFlag] Error fetching flags:', err);
                    return reject(err);
                }

                const flags = rows.map(row => ({
                    ...row,
                    targeting_rules: row.targeting_rules ? JSON.parse(row.targeting_rules) : [],
                    enabled: row.enabled === 1
                }));

                resolve(flags);
            });
        });
    }

    /**
     * Get feature flag by ID
     */
    async getFlagById(id) {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM feature_flags WHERE id = ?', [id], (err, row) => {
                if (err) {
                    console.error('[FeatureFlag] Error fetching flag:', err);
                    return reject(err);
                }

                if (!row) {
                    return resolve(null);
                }

                resolve({
                    ...row,
                    targeting_rules: row.targeting_rules ? JSON.parse(row.targeting_rules) : [],
                    enabled: row.enabled === 1
                });
            });
        });
    }

    /**
     * Get feature flag by key
     */
    async getFlagByKey(key, environment = 'production') {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM feature_flags WHERE flag_key = ? AND environment = ?',
                [key, environment],
                (err, row) => {
                    if (err) {
                        console.error('[FeatureFlag] Error fetching flag:', err);
                        return reject(err);
                    }

                    if (!row) {
                        return resolve(null);
                    }

                    resolve({
                        ...row,
                        targeting_rules: row.targeting_rules ? JSON.parse(row.targeting_rules) : [],
                        enabled: row.enabled === 1
                    });
                }
            );
        });
    }

    /**
     * Create a feature flag
     */
    async createFlag(flagData) {
        const {
            flag_key,
            name,
            description,
            enabled = false,
            flag_type = 'boolean',
            targeting_rules = [],
            rollout_percentage = 0,
            environment = 'production',
            organization_id = null,
            created_by
        } = flagData;

        const id = uuidv4();
        const now = new Date().toISOString();

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO feature_flags (
                    id, flag_key, name, description, enabled, flag_type,
                    targeting_rules, rollout_percentage, environment,
                    organization_id, created_at, updated_at, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id, flag_key, name, description, enabled ? 1 : 0, flag_type,
                    JSON.stringify(targeting_rules), rollout_percentage, environment,
                    organization_id, now, now, created_by
                ],
                async function (err) {
                    if (err) {
                        console.error('[FeatureFlag] Error creating flag:', err);
                        return reject(err);
                    }

                    // Record history
                    await this.recordHistory(id, 'created', null, flagData, created_by);

                    // Invalidate cache
                    this.lastFetch = 0;
                    await this.refreshCache();

                    resolve({ id, ...flagData });
                }.bind(this)
            );
        });
    }

    /**
     * Update a feature flag
     */
    async updateFlag(id, updates) {
        const {
            name,
            description,
            enabled,
            flag_type,
            targeting_rules,
            rollout_percentage,
            environment,
            updated_by
        } = updates;

        const flag = await this.getFlagById(id);
        if (!flag) {
            throw new Error('Feature flag not found');
        }

        const oldValue = { ...flag };
        const updatesList = [];
        const params = [];

        if (name !== undefined) {
            updatesList.push('name = ?');
            params.push(name);
        }

        if (description !== undefined) {
            updatesList.push('description = ?');
            params.push(description);
        }

        if (enabled !== undefined) {
            updatesList.push('enabled = ?');
            params.push(enabled ? 1 : 0);
        }

        if (flag_type !== undefined) {
            updatesList.push('flag_type = ?');
            params.push(flag_type);
        }

        if (targeting_rules !== undefined) {
            updatesList.push('targeting_rules = ?');
            params.push(JSON.stringify(targeting_rules));
        }

        if (rollout_percentage !== undefined) {
            updatesList.push('rollout_percentage = ?');
            params.push(rollout_percentage);
        }

        if (environment !== undefined) {
            updatesList.push('environment = ?');
            params.push(environment);
        }

        if (updatesList.length === 0) {
            return flag;
        }

        updatesList.push('updated_at = ?');
        params.push(new Date().toISOString());
        params.push(id);

        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE feature_flags SET ${updatesList.join(', ')} WHERE id = ?`,
                params,
                async function (err) {
                    if (err) {
                        console.error('[FeatureFlag] Error updating flag:', err);
                        return reject(err);
                    }

                    const newFlag = await this.getFlagById(id);

                    // Record history
                    await this.recordHistory(id, 'updated', oldValue, newFlag, updated_by);

                    // Invalidate cache
                    this.lastFetch = 0;
                    await this.refreshCache();

                    resolve(newFlag);
                }.bind(this)
            );
        });
    }

    /**
     * Delete a feature flag
     */
    async deleteFlag(id, deletedBy) {
        const flag = await this.getFlagById(id);
        if (!flag) {
            throw new Error('Feature flag not found');
        }

        return new Promise((resolve, reject) => {
            db.run('DELETE FROM feature_flags WHERE id = ?', [id], async function (err) {
                if (err) {
                    console.error('[FeatureFlag] Error deleting flag:', err);
                    return reject(err);
                }

                // Record history
                await this.recordHistory(id, 'deleted', flag, null, deletedBy);

                // Invalidate cache
                this.lastFetch = 0;
                await this.refreshCache();

                resolve({ deleted: this.changes > 0 });
            }.bind(this));
        });
    }

    /**
     * Toggle a feature flag
     */
    async toggleFlag(id, enabled, updatedBy) {
        return this.updateFlag(id, { enabled, updated_by: updatedBy });
    }

    /**
     * Record flag history
     */
    async recordHistory(flagId, changeType, oldValue, newValue, changedBy) {
        const historyId = uuidv4();

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO feature_flag_history (
                    id, feature_flag_id, change_type, old_value, new_value, changed_by
                ) VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    historyId, flagId, changeType,
                    oldValue ? JSON.stringify(oldValue) : null,
                    newValue ? JSON.stringify(newValue) : null,
                    changedBy
                ],
                function (err) {
                    if (err) {
                        console.error('[FeatureFlag] Error recording history:', err);
                        // Don't reject, just log
                    }
                    resolve();
                }
            );
        });
    }

    /**
     * Get flag history
     */
    async getFlagHistory(flagId, limit = 50) {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM feature_flag_history
                 WHERE feature_flag_id = ?
                 ORDER BY changed_at DESC
                 LIMIT ?`,
                [flagId, limit],
                (err, rows) => {
                    if (err) {
                        console.error('[FeatureFlag] Error fetching history:', err);
                        return reject(err);
                    }

                    const history = rows.map(row => ({
                        ...row,
                        old_value: row.old_value ? JSON.parse(row.old_value) : null,
                        new_value: row.new_value ? JSON.parse(row.new_value) : null
                    }));

                    resolve(history);
                }
            );
        });
    }

    /**
     * Evaluate a flag for a specific context
     * @param {string} key - Flag key e.g. 'new_ai_dashboard'
     * @param {object} context - { userId, orgId, email, role }
     */
    async isEnabled(key, context = {}, environment = 'production') {
        await this.refreshCache();
        const flag = this.cache[key] || await this.getFlagByKey(key, environment);

        // 1. Flag doesn't exist? Default false
        if (!flag) return false;

        // 2. Global switch
        if (!flag.enabled) return false;

        // 3. Check organization-specific flags
        if (flag.organization_id && flag.organization_id !== context.orgId) {
            return false;
        }

        // 4. Check flag type
        if (flag.flag_type === 'boolean') {
            // If no targeting rules, everyone gets it
            if (!flag.targeting_rules || flag.targeting_rules.length === 0) {
                return true;
            }

            // Evaluate targeting rules
            for (const rule of flag.targeting_rules) {
                if (this.evaluateRule(rule, context)) return true;
            }
            return false;
        } else if (flag.flag_type === 'percentage') {
            // Percentage-based rollout
            if (!context.userId) return false;
            const hash = this.simpleHash(context.userId + flag.flag_key);
            return (hash % 100) < flag.rollout_percentage;
        }

        return false;
    }

    evaluateRule(rule, context) {
        switch (rule.type) {
            case 'email_domain':
                if (!context.email) return false;
                const domain = context.email.split('@')[1];
                return rule.values.includes(domain);

            case 'org_id':
                return rule.values.includes(context.orgId);

            case 'user_id':
                return rule.values.includes(context.userId);

            case 'role':
                return rule.values.includes(context.role);

            case 'percentage':
                if (!context.userId) return false;
                const hash = this.simpleHash(context.userId + (rule.seed || ''));
                return (hash % 100) < rule.value;

            default:
                return false;
        }
    }

    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
        }
        return Math.abs(hash);
    }
}

module.exports = new FeatureFlagService();

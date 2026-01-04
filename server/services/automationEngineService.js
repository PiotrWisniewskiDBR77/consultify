/**
 * Automation Engine Service
 * Manages automation rules and execution
 */

import { getDatabase } from '../src/database/Database.ts';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';



const AutomationEngineService = {
    /**
     * Get automation rules for an organization
     */
    getRules: (organizationId, activeOnly = false) => {
        return new Promise((resolve, reject) => {
            let query = 'SELECT * FROM automation_rules WHERE organization_id = ?';
            const params = [organizationId];

            if (activeOnly) {
                query += ' AND is_active = 1';
            }

            query += ' ORDER BY created_at DESC';

            db.all(query, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    },

    /**
     * Create automation rule
     */
    createRule: (ruleData) => {
        return new Promise((resolve, reject) => {
            const id = uuidv4();
            db.run(
                `INSERT INTO automation_rules 
                 (id, organization_id, name, description, trigger_type, trigger_config_json,
                  action_type, action_config_json, conditions_json, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id,
                    ruleData.organizationId,
                    ruleData.name,
                    ruleData.description || null,
                    ruleData.triggerType,
                    JSON.stringify(ruleData.triggerConfig),
                    ruleData.actionType,
                    JSON.stringify(ruleData.actionConfig),
                    JSON.stringify(ruleData.conditions || []),
                    ruleData.createdBy
                ],
                function (err) {
                    if (err) return reject(err);
                    resolve({ id, ...ruleData });
                }
            );
        });
    },

    /**
     * Update automation rule
     */
    updateRule: (ruleId, updates) => {
        return new Promise((resolve, reject) => {
            const fields = [];
            const values = [];

            if (updates.name) {
                fields.push('name = ?');
                values.push(updates.name);
            }
            if (updates.description !== undefined) {
                fields.push('description = ?');
                values.push(updates.description);
            }
            if (updates.triggerType) {
                fields.push('trigger_type = ?');
                values.push(updates.triggerType);
            }
            if (updates.triggerConfig) {
                fields.push('trigger_config_json = ?');
                values.push(JSON.stringify(updates.triggerConfig));
            }
            if (updates.actionType) {
                fields.push('action_type = ?');
                values.push(updates.actionType);
            }
            if (updates.actionConfig) {
                fields.push('action_config_json = ?');
                values.push(JSON.stringify(updates.actionConfig));
            }
            if (updates.conditions) {
                fields.push('conditions_json = ?');
                values.push(JSON.stringify(updates.conditions));
            }
            if (updates.isActive !== undefined) {
                fields.push('is_active = ?');
                values.push(updates.isActive ? 1 : 0);
            }

            if (fields.length === 0) {
                return resolve({ updated: false });
            }

            fields.push('updated_at = datetime("now")');
            values.push(ruleId);

            db.run(
                `UPDATE automation_rules SET ${fields.join(', ')} WHERE id = ?`,
                values,
                function (err) {
                    if (err) return reject(err);
                    resolve({ updated: this.changes > 0 });
                }
            );
        });
    },

    /**
     * Execute automation rule (called by event handlers)
     */
    executeRule: async (ruleId) => {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM automation_rules WHERE id = ? AND is_active = 1',
                [ruleId],
                async (err, rule) => {
                    if (err) return reject(err);
                    if (!rule) return reject(new Error('Rule not found or inactive'));

                    // Update execution count
                    db.run(
                        `UPDATE automation_rules 
                         SET execution_count = execution_count + 1, last_executed_at = datetime('now')
                         WHERE id = ?`,
                        [ruleId]
                    );

                    // Return rule config for execution by event handler
                    resolve({
                        ruleId,
                        triggerType: rule.trigger_type,
                        triggerConfig: JSON.parse(rule.trigger_config_json),
                        actionType: rule.action_type,
                        actionConfig: JSON.parse(rule.action_config_json),
                        conditions: JSON.parse(rule.conditions_json || '[]')
                    });
                }
            );
        });
    }
};

export default AutomationEngineService;













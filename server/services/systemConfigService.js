/**
 * System Configuration Service
 * 
 * Manages system-wide configuration settings.
 * Features:
 * - Environment-specific configuration
 * - Type-safe configuration values
 * - Configuration history
 * - Default value management
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../database');

class SystemConfigService {
    /**
     * Get configuration value by key
     */
    async getConfig(key, environment = null) {
        let query = 'SELECT * FROM system_config WHERE config_key = ?';
        const params = [key];

        if (environment) {
            query += ' AND (environment = ? OR environment IS NULL)';
            params.push(environment);
        } else {
            query += ' AND environment IS NULL';
        }

        query += ' ORDER BY environment DESC LIMIT 1';

        return new Promise((resolve, reject) => {
            db.get(query, params, (err, row) => {
                if (err) {
                    console.error('[SystemConfig] Error fetching config:', err);
                    return reject(err);
                }

                if (!row) {
                    return resolve(null);
                }

                let value = row.config_value;
                try {
                    value = JSON.parse(value);
                } catch (e) {
                    // If not JSON, return as string
                }

                resolve({
                    ...row,
                    config_value: value
                });
            });
        });
    }

    /**
     * Get all configurations
     */
    async getAllConfigs(environment = null) {
        let query = 'SELECT * FROM system_config WHERE 1=1';
        const params = [];

        if (environment) {
            query += ' AND (environment = ? OR environment IS NULL)';
            params.push(environment);
        }

        query += ' ORDER BY config_key, environment';

        return new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('[SystemConfig] Error fetching configs:', err);
                    return reject(err);
                }

                const configs = rows.map(row => {
                    let value = row.config_value;
                    try {
                        value = JSON.parse(value);
                    } catch (e) {
                        // If not JSON, keep as string
                    }

                    return {
                        ...row,
                        config_value: value
                    };
                });

                resolve(configs);
            });
        });
    }

    /**
     * Set configuration value
     */
    async setConfig(configData) {
        const {
            config_key,
            config_value,
            config_type = 'string',
            environment = null,
            description,
            updated_by
        } = configData;

        // Validate config type
        const validTypes = ['string', 'number', 'boolean', 'json'];
        if (!validTypes.includes(config_type)) {
            throw new Error(`Invalid config_type: ${config_type}. Must be one of: ${validTypes.join(', ')}`);
        }

        // Serialize value based on type
        let serializedValue;
        if (config_type === 'json') {
            serializedValue = JSON.stringify(config_value);
        } else {
            serializedValue = String(config_value);
        }

        await initDeps();
        const id = deps.uuidv4();
        const updatedAt = new Date().toISOString();

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO system_config (
                    id, config_key, config_value, config_type, environment,
                    description, updated_at, updated_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(config_key) DO UPDATE SET
                    config_value = excluded.config_value,
                    config_type = excluded.config_type,
                    environment = excluded.environment,
                    description = excluded.description,
                    updated_at = excluded.updated_at,
                    updated_by = excluded.updated_by`,
                [
                    id, config_key, serializedValue, config_type, environment,
                    description, updatedAt, updated_by
                ],
                function (err) {
                    if (err) {
                        console.error('[SystemConfig] Error setting config:', err);
                        return reject(err);
                    }
                    resolve({
                        config_key,
                        config_value,
                        config_type,
                        environment,
                        description,
                        updated_at: updatedAt,
                        updated_by
                    });
                }
            );
        });
    }

    /**
     * Delete configuration
     */
    async deleteConfig(key, environment = null) {
        let query = 'DELETE FROM system_config WHERE config_key = ?';
        const params = [key];

        if (environment) {
            query += ' AND environment = ?';
            params.push(environment);
        }

        return new Promise((resolve, reject) => {
            db.run(query, params, function (err) {
                if (err) {
                    console.error('[SystemConfig] Error deleting config:', err);
                    return reject(err);
                }
                resolve({ deleted: this.changes > 0 });
            });
        });
    }

    /**
     * Get configuration as typed value
     */
    async getConfigValue(key, defaultValue = null, environment = null) {
        const config = await this.getConfig(key, environment);
        if (!config) {
            return defaultValue;
        }

        const { config_value, config_type } = config;

        // Convert based on type
        switch (config_type) {
            case 'number':
                return Number(config_value);
            case 'boolean':
                return config_value === 'true' || config_value === true;
            case 'json':
                return typeof config_value === 'string' ? JSON.parse(config_value) : config_value;
            default:
                return config_value;
        }
    }
}

module.exports = new SystemConfigService();





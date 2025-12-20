/**
 * AI External Data Control Service
 * 
 * Manages controlled access to external data sources (internet).
 * External data is DISABLED by default and must be explicitly enabled.
 * All external queries are logged for audit.
 */

const db = require('../database');
const WebSearchService = require('./webSearchService');
const { v4: uuidv4 } = require('uuid');

// Supported external data providers
const EXTERNAL_PROVIDERS = {
    TAVILY: 'tavily',
    SERPER: 'serper',
    GOOGLE_SEARCH: 'google_search'
};

const AIExternalDataControl = {
    EXTERNAL_PROVIDERS,

    // ==========================================
    // SETTINGS MANAGEMENT
    // ==========================================

    /**
     * Get external data settings for a scope
     */
    getSettings: async (scopeType, scopeId) => {
        return new Promise((resolve) => {
            db.get(`
                SELECT * FROM external_data_settings 
                WHERE scope_type = ? AND scope_id = ?
            `, [scopeType, scopeId], (err, row) => {
                resolve(row || {
                    enabled: false,
                    allowed_providers: '[]',
                    max_queries_per_day: 100,
                    require_labeling: true
                });
            });
        });
    },

    /**
     * Check if external data is enabled for a context
     * Checks both tenant and project levels
     */
    isEnabled: async (organizationId, projectId = null) => {
        // First check project-level (more specific)
        if (projectId) {
            const projectSettings = await AIExternalDataControl.getSettings('project', projectId);
            if (projectSettings.enabled) {
                return {
                    enabled: true,
                    scope: 'project',
                    settings: projectSettings
                };
            }
        }

        // Then check tenant-level
        const tenantSettings = await AIExternalDataControl.getSettings('tenant', organizationId);
        if (tenantSettings.enabled) {
            return {
                enabled: true,
                scope: 'tenant',
                settings: tenantSettings
            };
        }

        // Default: disabled
        return {
            enabled: false,
            scope: null,
            settings: null
        };
    },

    /**
     * Enable external data for a scope
     */
    enable: async (scopeType, scopeId, options, enabledBy) => {
        const {
            allowedProviders = ['tavily'],
            maxQueriesPerDay = 100,
            requireLabeling = true
        } = options;

        const id = `ext-${scopeType}-${scopeId}`;

        return new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO external_data_settings 
                (id, scope_type, scope_id, enabled, allowed_providers, max_queries_per_day, require_labeling, enabled_by, enabled_at)
                VALUES (?, ?, ?, 1, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(scope_type, scope_id) DO UPDATE SET
                    enabled = 1,
                    allowed_providers = ?,
                    max_queries_per_day = ?,
                    require_labeling = ?,
                    enabled_by = ?,
                    enabled_at = CURRENT_TIMESTAMP
            `, [
                id, scopeType, scopeId,
                JSON.stringify(allowedProviders), maxQueriesPerDay, requireLabeling ? 1 : 0, enabledBy,
                JSON.stringify(allowedProviders), maxQueriesPerDay, requireLabeling ? 1 : 0, enabledBy
            ], function (err) {
                if (err) reject(err);
                else resolve({ id, scopeType, scopeId, enabled: true });
            });
        });
    },

    /**
     * Disable external data for a scope
     */
    disable: async (scopeType, scopeId) => {
        return new Promise((resolve, reject) => {
            db.run(`
                UPDATE external_data_settings 
                SET enabled = 0
                WHERE scope_type = ? AND scope_id = ?
            `, [scopeType, scopeId], function (err) {
                if (err) reject(err);
                else resolve({ scopeType, scopeId, enabled: false, changes: this.changes });
            });
        });
    },

    // ==========================================
    // CONTROLLED SEARCH
    // ==========================================

    /**
     * Execute a controlled external search
     * Returns data with external labeling and logs for audit
     */
    search: async (query, context) => {
        const { organizationId, projectId, userId, purpose = 'enrichment' } = context;

        // 1. Check if enabled
        const enabledStatus = await AIExternalDataControl.isEnabled(organizationId, projectId);

        if (!enabledStatus.enabled) {
            return {
                allowed: false,
                reason: 'External data access is disabled for this scope',
                isExternal: false,
                results: null
            };
        }

        // 2. Check daily quota
        const quotaStatus = await AIExternalDataControl._checkDailyQuota(
            enabledStatus.scope === 'project' ? projectId : organizationId,
            enabledStatus.scope,
            enabledStatus.settings.max_queries_per_day
        );

        if (!quotaStatus.allowed) {
            return {
                allowed: false,
                reason: `Daily external query limit exceeded (${quotaStatus.used}/${quotaStatus.limit})`,
                isExternal: false,
                results: null
            };
        }

        // 3. Execute search
        let searchResults;
        try {
            searchResults = await WebSearchService.search(query);
        } catch (error) {
            console.error('[AIExternalDataControl] Search error:', error);
            return {
                allowed: true,
                success: false,
                error: error.message,
                isExternal: true,
                results: null
            };
        }

        // 4. Log for audit
        await AIExternalDataControl._logExternalQuery({
            organizationId,
            projectId,
            userId,
            query,
            provider: searchResults.provider || 'unknown',
            sourcesCount: searchResults.sources?.length || 0,
            sourcesUsed: searchResults.sources?.map(s => s.url) || [],
            responseSummary: searchResults.answer?.substring(0, 500)
        });

        // 5. Add external data labels
        const labeledResults = {
            ...searchResults,
            isExternal: true,
            disclaimer: '⚠️ EXTERNAL DATA: This information is from external sources and has not been verified against internal data. Use for reference only.',
            searchedAt: new Date().toISOString(),
            scope: enabledStatus.scope,
            sources: (searchResults.sources || []).map(s => ({
                ...s,
                external: true,
                verified: false
            }))
        };

        return {
            allowed: true,
            success: true,
            isExternal: true,
            results: labeledResults,
            quotaRemaining: quotaStatus.limit - quotaStatus.used - 1
        };
    },

    /**
     * Check daily quota for external queries
     */
    _checkDailyQuota: async (scopeId, scopeType, limit) => {
        return new Promise((resolve) => {
            const scopeColumn = scopeType === 'project' ? 'project_id' : 'organization_id';

            db.get(`
                SELECT COUNT(*) as count FROM external_data_log
                WHERE ${scopeColumn} = ?
                AND DATE(created_at) = DATE('now')
            `, [scopeId], (err, row) => {
                const used = row?.count || 0;
                resolve({
                    allowed: used < limit,
                    used,
                    limit
                });
            });
        });
    },

    /**
     * Log external query for audit
     */
    _logExternalQuery: async ({ organizationId, projectId, userId, query, provider, sourcesCount, sourcesUsed, responseSummary }) => {
        const id = uuidv4();

        return new Promise((resolve) => {
            db.run(`
                INSERT INTO external_data_log 
                (id, organization_id, project_id, user_id, query, provider, sources_count, sources_used, response_summary)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                id, organizationId, projectId, userId, query, provider,
                sourcesCount, JSON.stringify(sourcesUsed), responseSummary
            ], (err) => {
                if (err) console.error('[AIExternalDataControl] Log error:', err);
                resolve({ id, logged: !err });
            });
        });
    },

    // ==========================================
    // AUDIT & ANALYTICS
    // ==========================================

    /**
     * Get external data usage logs
     */
    getAuditLogs: async (organizationId, options = {}) => {
        const { projectId, userId, startDate, endDate, limit = 100 } = options;

        return new Promise((resolve, reject) => {
            let sql = `
                SELECT l.*, u.first_name, u.last_name, u.email
                FROM external_data_log l
                LEFT JOIN users u ON l.user_id = u.id
                WHERE l.organization_id = ?
            `;
            const params = [organizationId];

            if (projectId) {
                sql += ` AND l.project_id = ?`;
                params.push(projectId);
            }
            if (userId) {
                sql += ` AND l.user_id = ?`;
                params.push(userId);
            }
            if (startDate) {
                sql += ` AND l.created_at >= ?`;
                params.push(startDate);
            }
            if (endDate) {
                sql += ` AND l.created_at <= ?`;
                params.push(endDate);
            }

            sql += ` ORDER BY l.created_at DESC LIMIT ?`;
            params.push(limit);

            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else {
                    resolve((rows || []).map(row => ({
                        ...row,
                        sources_used: JSON.parse(row.sources_used || '[]'),
                        userName: row.first_name ? `${row.first_name} ${row.last_name}` : row.email
                    })));
                }
            });
        });
    },

    /**
     * Get usage statistics
     */
    getUsageStats: async (organizationId, days = 30) => {
        return new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as queries,
                    COUNT(DISTINCT user_id) as unique_users,
                    SUM(sources_count) as total_sources,
                    provider
                FROM external_data_log
                WHERE organization_id = ?
                AND created_at >= datetime('now', '-${days} days')
                GROUP BY DATE(created_at), provider
                ORDER BY date DESC
            `, [organizationId], (err, rows) => {
                if (err) reject(err);
                else {
                    const summary = {
                        totalQueries: 0,
                        uniqueDays: new Set(),
                        byProvider: {},
                        daily: []
                    };

                    for (const row of (rows || [])) {
                        summary.totalQueries += row.queries;
                        summary.uniqueDays.add(row.date);
                        summary.byProvider[row.provider] = (summary.byProvider[row.provider] || 0) + row.queries;
                        summary.daily.push(row);
                    }

                    summary.daysWithUsage = summary.uniqueDays.size;
                    delete summary.uniqueDays;

                    resolve(summary);
                }
            });
        });
    },

    /**
     * Get all external data settings for admin view
     */
    getAllSettings: async () => {
        return new Promise((resolve, reject) => {
            db.all(`
                SELECT s.*, 
                    CASE WHEN s.scope_type = 'tenant' THEN o.name ELSE p.name END as scope_name
                FROM external_data_settings s
                LEFT JOIN organizations o ON s.scope_type = 'tenant' AND s.scope_id = o.id
                LEFT JOIN projects p ON s.scope_type = 'project' AND s.scope_id = p.id
                ORDER BY s.scope_type, s.scope_id
            `, [], (err, rows) => {
                if (err) reject(err);
                else {
                    resolve((rows || []).map(row => ({
                        ...row,
                        allowed_providers: JSON.parse(row.allowed_providers || '[]')
                    })));
                }
            });
        });
    }
};

module.exports = AIExternalDataControl;

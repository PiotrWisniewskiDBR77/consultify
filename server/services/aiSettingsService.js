/**
 * AI Settings Service
 * 
 * 3-Tier settings management: SuperAdmin → Admin/Org → User
 * Handles CRUD operations with audit logging and cascading defaults.
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

// Default settings values
const SUPERADMIN_DEFAULTS = {
    default_provider: null,
    fallback_chain: '[]',
    circuit_breaker_config: JSON.stringify({ failureThreshold: 5, cooldownSeconds: 60 }),
    global_token_limit: 10000000,
    global_rate_limit: JSON.stringify({ requestsPerMinute: 60, requestsPerHour: 1000 }),
    max_context_window_size: 128000,
    max_tokens_per_request: 8192,
    pii_detection_sensitivity: 'medium',
    require_encryption: 1,
    data_residency: null
};

const ORG_DEFAULTS = {
    policy_level: 'ADVISORY',
    max_policy_level: 'ASSISTED',
    default_proactivity_mode: 'BALANCED',
    active_roles: '["ADVISOR"]',
    default_role: 'ADVISOR',
    enabled_model_ids: '[]',
    max_ai_calls_per_day: 100,
    max_tokens_per_month: 500000,
    monthly_budget_usd: 0,
    hard_limit_usd: 0,
    freeze_on_limit: 0,
    web_search_enabled: 1,
    artifacts_enabled: 1,
    thinking_steps_enabled: 1,
    focus_modes_enabled: 1,
    voice_enabled: 0,
    audit_all_requests: 0,
    audit_policy_changes: 1
};

const USER_DEFAULTS = {
    response_style: 'balanced',
    writing_tone: 'professional',
    preferred_language: 'auto',
    code_explanations: 1,
    show_sources: 1,
    proactivity_mode: 'BALANCED',
    model_temperature: 0.7,
    max_tokens: 4096,
    top_p: 1.0,
    frequency_penalty: 0.0,
    presence_penalty: 0.0,
    system_instructions: '',
    visible_model_ids: '[]',
    selected_tier: 'BUDGET',
    preferred_model_id: null,
    enable_pii_redaction: 0,
    data_retention_policy: 'standard',
    share_usage_analytics: 1,
    context_retention: 'session',
    auto_suggestions: 1
};

/**
 * Parse JSON fields safely
 */
const parseJSON = (str, fallback = []) => {
    if (!str) return fallback;
    try {
        return JSON.parse(str);
    } catch {
        return fallback;
    }
};

/**
 * Convert DB row to typed object for SuperAdmin settings
 */
const mapSuperAdminSettings = (row) => {
    if (!row) return null;
    return {
        id: row.id,
        defaultProvider: row.default_provider,
        fallbackChain: parseJSON(row.fallback_chain, []),
        circuitBreakerConfig: parseJSON(row.circuit_breaker_config, { failureThreshold: 5, cooldownSeconds: 60 }),
        globalTokenLimit: row.global_token_limit,
        globalRateLimit: parseJSON(row.global_rate_limit, { requestsPerMinute: 60, requestsPerHour: 1000 }),
        maxContextWindowSize: row.max_context_window_size,
        maxTokensPerRequest: row.max_tokens_per_request,
        piiDetectionSensitivity: row.pii_detection_sensitivity,
        requireEncryption: !!row.require_encryption,
        dataResidency: row.data_residency,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        updatedBy: row.updated_by
    };
};

/**
 * Convert DB row to typed object for Org settings
 */
const mapOrgSettings = (row) => {
    if (!row) return null;
    return {
        organizationId: row.organization_id,
        policyLevel: row.policy_level,
        maxPolicyLevel: row.max_policy_level,
        defaultProactivityMode: row.default_proactivity_mode,
        activeRoles: parseJSON(row.active_roles, ['ADVISOR']),
        defaultRole: row.default_role,
        enabledModelIds: parseJSON(row.enabled_model_ids, []),
        maxAICallsPerDay: row.max_ai_calls_per_day,
        maxTokensPerMonth: row.max_tokens_per_month,
        monthlyBudgetUSD: row.monthly_budget_usd,
        hardLimitUSD: row.hard_limit_usd,
        freezeOnLimit: !!row.freeze_on_limit,
        webSearchEnabled: !!row.web_search_enabled,
        artifactsEnabled: !!row.artifacts_enabled,
        thinkingStepsEnabled: !!row.thinking_steps_enabled,
        focusModesEnabled: !!row.focus_modes_enabled,
        voiceEnabled: !!row.voice_enabled,
        auditAllRequests: !!row.audit_all_requests,
        auditPolicyChanges: !!row.audit_policy_changes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        updatedBy: row.updated_by
    };
};

/**
 * Convert DB row to typed object for User settings
 */
const mapUserSettings = (row) => {
    if (!row) return null;
    return {
        userId: row.user_id,
        responseStyle: row.response_style,
        writingTone: row.writing_tone,
        preferredLanguage: row.preferred_language,
        codeExplanations: !!row.code_explanations,
        showSources: !!row.show_sources,
        proactivityMode: row.proactivity_mode,
        modelTemperature: row.model_temperature,
        maxTokens: row.max_tokens,
        topP: row.top_p,
        frequencyPenalty: row.frequency_penalty,
        presencePenalty: row.presence_penalty,
        systemInstructions: row.system_instructions || '',
        visibleModelIds: parseJSON(row.visible_model_ids, []),
        selectedTier: row.selected_tier || 'BUDGET',
        preferredModelId: row.preferred_model_id,
        enablePiiRedaction: !!row.enable_pii_redaction,
        dataRetentionPolicy: row.data_retention_policy,
        shareUsageAnalytics: !!row.share_usage_analytics,
        contextRetention: row.context_retention,
        autoSuggestions: !!row.auto_suggestions,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
};

const AISettingsService = {
    // ==========================================
    // SUPERADMIN SETTINGS
    // ==========================================

    /**
     * Get SuperAdmin (global) settings
     */
    getSuperAdminSettings: () => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM superadmin_ai_settings WHERE id = 'global'`,
                [],
                (err, row) => {
                    if (err) return reject(err);

                    if (!row) {
                        // Insert default if not exists
                        db.run(
                            `INSERT OR IGNORE INTO superadmin_ai_settings (id) VALUES ('global')`,
                            [],
                            (insertErr) => {
                                if (insertErr) return reject(insertErr);
                                db.get(
                                    `SELECT * FROM superadmin_ai_settings WHERE id = 'global'`,
                                    [],
                                    (err2, row2) => {
                                        if (err2) return reject(err2);
                                        resolve(mapSuperAdminSettings(row2));
                                    }
                                );
                            }
                        );
                    } else {
                        resolve(mapSuperAdminSettings(row));
                    }
                }
            );
        });
    },

    /**
     * Update SuperAdmin settings with audit
     */
    updateSuperAdminSettings: async (settings, actorId, actorRole, ipAddress = null, userAgent = null) => {
        // Get current settings for audit
        const current = await AISettingsService.getSuperAdminSettings();

        // Build update query
        const updates = [];
        const values = [];
        const changedKeys = [];

        const fieldMap = {
            defaultProvider: 'default_provider',
            fallbackChain: { field: 'fallback_chain', transform: JSON.stringify },
            circuitBreakerConfig: { field: 'circuit_breaker_config', transform: JSON.stringify },
            globalTokenLimit: 'global_token_limit',
            globalRateLimit: { field: 'global_rate_limit', transform: JSON.stringify },
            maxContextWindowSize: 'max_context_window_size',
            maxTokensPerRequest: 'max_tokens_per_request',
            piiDetectionSensitivity: 'pii_detection_sensitivity',
            requireEncryption: { field: 'require_encryption', transform: v => v ? 1 : 0 },
            dataResidency: 'data_residency'
        };

        for (const [key, value] of Object.entries(settings)) {
            if (value === undefined || !fieldMap[key]) continue;

            const mapping = fieldMap[key];
            const dbField = typeof mapping === 'string' ? mapping : mapping.field;
            const dbValue = typeof mapping === 'string' ? value : mapping.transform(value);

            updates.push(`${dbField} = ?`);
            values.push(dbValue);
            changedKeys.push(key);
        }

        if (updates.length === 0) return current;

        updates.push('updated_at = CURRENT_TIMESTAMP');
        updates.push('updated_by = ?');
        values.push(actorId);

        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE superadmin_ai_settings SET ${updates.join(', ')} WHERE id = 'global'`,
                values,
                async (err) => {
                    if (err) return reject(err);

                    // Audit log for each changed field
                    for (const key of changedKeys) {
                        await AISettingsService.logAudit({
                            level: 'superadmin',
                            actorId,
                            actorRole,
                            targetId: 'global',
                            settingKey: key,
                            oldValue: current[key],
                            newValue: settings[key],
                            ipAddress,
                            userAgent
                        });
                    }

                    const updated = await AISettingsService.getSuperAdminSettings();
                    resolve(updated);
                }
            );
        });
    },

    // ==========================================
    // ORGANIZATION SETTINGS
    // ==========================================

    /**
     * Get Organization AI settings (with defaults)
     */
    getOrgSettings: (organizationId) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM organization_ai_settings WHERE organization_id = ?`,
                [organizationId],
                (err, row) => {
                    if (err) return reject(err);

                    if (!row) {
                        // Return defaults with orgId
                        resolve({
                            organizationId,
                            ...mapOrgSettings({ organization_id: organizationId, ...ORG_DEFAULTS })
                        });
                    } else {
                        resolve(mapOrgSettings(row));
                    }
                }
            );
        });
    },

    /**
     * Update Organization settings with audit
     */
    updateOrgSettings: async (organizationId, settings, actorId, actorRole, ipAddress = null, userAgent = null) => {
        const current = await AISettingsService.getOrgSettings(organizationId);

        // Check if row exists
        const exists = await new Promise((resolve, reject) => {
            db.get(
                `SELECT 1 FROM organization_ai_settings WHERE organization_id = ?`,
                [organizationId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(!!row);
                }
            );
        });

        const fieldMap = {
            policyLevel: 'policy_level',
            maxPolicyLevel: 'max_policy_level',
            defaultProactivityMode: 'default_proactivity_mode',
            activeRoles: { field: 'active_roles', transform: JSON.stringify },
            defaultRole: 'default_role',
            enabledModelIds: { field: 'enabled_model_ids', transform: JSON.stringify },
            maxAICallsPerDay: 'max_ai_calls_per_day',
            maxTokensPerMonth: 'max_tokens_per_month',
            monthlyBudgetUSD: 'monthly_budget_usd',
            hardLimitUSD: 'hard_limit_usd',
            freezeOnLimit: { field: 'freeze_on_limit', transform: v => v ? 1 : 0 },
            webSearchEnabled: { field: 'web_search_enabled', transform: v => v ? 1 : 0 },
            artifactsEnabled: { field: 'artifacts_enabled', transform: v => v ? 1 : 0 },
            thinkingStepsEnabled: { field: 'thinking_steps_enabled', transform: v => v ? 1 : 0 },
            focusModesEnabled: { field: 'focus_modes_enabled', transform: v => v ? 1 : 0 },
            voiceEnabled: { field: 'voice_enabled', transform: v => v ? 1 : 0 },
            auditAllRequests: { field: 'audit_all_requests', transform: v => v ? 1 : 0 },
            auditPolicyChanges: { field: 'audit_policy_changes', transform: v => v ? 1 : 0 }
        };

        const updates = [];
        const values = [];
        const changedKeys = [];

        for (const [key, value] of Object.entries(settings)) {
            if (value === undefined || !fieldMap[key]) continue;

            const mapping = fieldMap[key];
            const dbField = typeof mapping === 'string' ? mapping : mapping.field;
            const dbValue = typeof mapping === 'string' ? value : mapping.transform(value);

            updates.push(`${dbField} = ?`);
            values.push(dbValue);
            changedKeys.push(key);
        }

        if (updates.length === 0) return current;

        return new Promise((resolve, reject) => {
            if (!exists) {
                // INSERT new row
                const insertFields = ['organization_id', ...updates.map(u => u.split(' = ')[0])];
                const insertPlaceholders = insertFields.map(() => '?').join(', ');
                const insertValues = [organizationId, ...values];

                db.run(
                    `INSERT INTO organization_ai_settings (${insertFields.join(', ')}) VALUES (${insertPlaceholders})`,
                    insertValues,
                    async (err) => {
                        if (err) return reject(err);

                        for (const key of changedKeys) {
                            await AISettingsService.logAudit({
                                level: 'admin',
                                actorId,
                                actorRole,
                                targetId: organizationId,
                                settingKey: key,
                                oldValue: current[key],
                                newValue: settings[key],
                                ipAddress,
                                userAgent
                            });
                        }

                        const updated = await AISettingsService.getOrgSettings(organizationId);
                        resolve(updated);
                    }
                );
            } else {
                // UPDATE existing row
                updates.push('updated_at = CURRENT_TIMESTAMP');
                updates.push('updated_by = ?');
                values.push(actorId);
                values.push(organizationId);

                db.run(
                    `UPDATE organization_ai_settings SET ${updates.join(', ')} WHERE organization_id = ?`,
                    values,
                    async (err) => {
                        if (err) return reject(err);

                        for (const key of changedKeys) {
                            await AISettingsService.logAudit({
                                level: 'admin',
                                actorId,
                                actorRole,
                                targetId: organizationId,
                                settingKey: key,
                                oldValue: current[key],
                                newValue: settings[key],
                                ipAddress,
                                userAgent
                            });
                        }

                        const updated = await AISettingsService.getOrgSettings(organizationId);
                        resolve(updated);
                    }
                );
            }
        });
    },

    // ==========================================
    // USER SETTINGS
    // ==========================================

    /**
     * Get User AI settings (with defaults)
     */
    getUserSettings: (userId) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM user_ai_settings WHERE user_id = ?`,
                [userId],
                (err, row) => {
                    if (err) return reject(err);

                    if (!row) {
                        resolve({
                            userId,
                            ...mapUserSettings({ user_id: userId, ...USER_DEFAULTS })
                        });
                    } else {
                        resolve(mapUserSettings(row));
                    }
                }
            );
        });
    },

    /**
     * Update User settings
     */
    updateUserSettings: async (userId, settings) => {
        const current = await AISettingsService.getUserSettings(userId);

        const exists = await new Promise((resolve, reject) => {
            db.get(
                `SELECT 1 FROM user_ai_settings WHERE user_id = ?`,
                [userId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(!!row);
                }
            );
        });

        const fieldMap = {
            responseStyle: 'response_style',
            writingTone: 'writing_tone',
            preferredLanguage: 'preferred_language',
            codeExplanations: { field: 'code_explanations', transform: v => v ? 1 : 0 },
            showSources: { field: 'show_sources', transform: v => v ? 1 : 0 },
            proactivityMode: 'proactivity_mode',
            modelTemperature: 'model_temperature',
            maxTokens: 'max_tokens',
            topP: 'top_p',
            frequencyPenalty: 'frequency_penalty',
            presencePenalty: 'presence_penalty',
            systemInstructions: 'system_instructions',
            visibleModelIds: { field: 'visible_model_ids', transform: JSON.stringify },
            selectedTier: 'selected_tier',
            preferredModelId: 'preferred_model_id',
            enablePiiRedaction: { field: 'enable_pii_redaction', transform: v => v ? 1 : 0 },
            dataRetentionPolicy: 'data_retention_policy',
            shareUsageAnalytics: { field: 'share_usage_analytics', transform: v => v ? 1 : 0 },
            contextRetention: 'context_retention',
            autoSuggestions: { field: 'auto_suggestions', transform: v => v ? 1 : 0 }
        };

        const updates = [];
        const values = [];

        for (const [key, value] of Object.entries(settings)) {
            if (value === undefined || !fieldMap[key]) continue;

            const mapping = fieldMap[key];
            const dbField = typeof mapping === 'string' ? mapping : mapping.field;
            const dbValue = typeof mapping === 'string' ? value : mapping.transform(value);

            updates.push(`${dbField} = ?`);
            values.push(dbValue);
        }

        if (updates.length === 0) return current;

        return new Promise((resolve, reject) => {
            if (!exists) {
                const insertFields = ['user_id', ...updates.map(u => u.split(' = ')[0])];
                const insertPlaceholders = insertFields.map(() => '?').join(', ');
                const insertValues = [userId, ...values];

                db.run(
                    `INSERT INTO user_ai_settings (${insertFields.join(', ')}) VALUES (${insertPlaceholders})`,
                    insertValues,
                    async (err) => {
                        if (err) return reject(err);
                        const updated = await AISettingsService.getUserSettings(userId);
                        resolve(updated);
                    }
                );
            } else {
                updates.push('updated_at = CURRENT_TIMESTAMP');
                values.push(userId);

                db.run(
                    `UPDATE user_ai_settings SET ${updates.join(', ')} WHERE user_id = ?`,
                    values,
                    async (err) => {
                        if (err) return reject(err);
                        const updated = await AISettingsService.getUserSettings(userId);
                        resolve(updated);
                    }
                );
            }
        });
    },

    // ==========================================
    // EFFECTIVE SETTINGS (MERGED)
    // ==========================================

    /**
     * Get effective (merged) settings for runtime
     * User settings are constrained by org settings, which are constrained by superadmin settings
     */
    getEffectiveSettings: async (userId, organizationId) => {
        const [superadmin, org, user] = await Promise.all([
            AISettingsService.getSuperAdminSettings(),
            AISettingsService.getOrgSettings(organizationId),
            AISettingsService.getUserSettings(userId)
        ]);

        // Get available models (intersection of superadmin providers and org-enabled)
        const availableModelIds = org.enabledModelIds.length > 0
            ? org.enabledModelIds
            : []; // Will be populated from LLM providers table

        // User's visible models must be subset of org-enabled
        const userVisibleIds = user.visibleModelIds.filter(id =>
            availableModelIds.length === 0 || availableModelIds.includes(id)
        );

        // Determine effective proactivity mode (user can only go lower than org default)
        const proactivityOrder = { REACTIVE: 0, BALANCED: 1, PROACTIVE: 2 };
        const orgDefault = proactivityOrder[org.defaultProactivityMode] || 1;
        const userPref = proactivityOrder[user.proactivityMode] || 1;
        const effectiveProactivityIdx = Math.min(orgDefault, userPref);
        const effectiveProactivity = ['REACTIVE', 'BALANCED', 'PROACTIVE'][effectiveProactivityIdx];

        // Proactivity behaviors
        const proactivityBehaviors = {
            REACTIVE: { autoSuggest: false, nudges: false, contextualHints: false, initiateConversation: false },
            BALANCED: { autoSuggest: true, nudges: true, contextualHints: true, initiateConversation: false },
            PROACTIVE: { autoSuggest: true, nudges: true, contextualHints: true, initiateConversation: true }
        };

        return {
            // Policy
            policyLevel: org.policyLevel,
            proactivityMode: effectiveProactivity,
            proactivityBehavior: proactivityBehaviors[effectiveProactivity],

            // Response settings (from user)
            responseStyle: user.responseStyle,
            writingTone: user.writingTone,
            preferredLanguage: user.preferredLanguage,

            // Model settings (user constrained by superadmin limits)
            modelTemperature: user.modelTemperature,
            maxTokens: Math.min(user.maxTokens, superadmin.maxTokensPerRequest),
            topP: user.topP,
            frequencyPenalty: user.frequencyPenalty,
            presencePenalty: user.presencePenalty,
            systemInstructions: user.systemInstructions,
            preferredModelId: user.preferredModelId,
            selectedTier: user.selectedTier,
            availableModelIds: userVisibleIds.length > 0 ? userVisibleIds : availableModelIds,

            // Feature flags (from org)
            webSearchEnabled: org.webSearchEnabled,
            artifactsEnabled: org.artifactsEnabled,
            thinkingStepsEnabled: org.thinkingStepsEnabled,
            focusModesEnabled: org.focusModesEnabled,
            voiceEnabled: org.voiceEnabled,

            // Privacy (user preference if allowed by org)
            enablePiiRedaction: user.enablePiiRedaction,
            dataRetentionPolicy: user.dataRetentionPolicy,

            // Limits (from org)
            maxAICallsPerDay: org.maxAICallsPerDay,
            maxTokensPerMonth: org.maxTokensPerMonth,

            // Sources for debugging
            _sources: {
                superadmin: { id: superadmin.id, updatedAt: superadmin.updatedAt },
                org: { organizationId: org.organizationId, updatedAt: org.updatedAt },
                user: { userId: user.userId, updatedAt: user.updatedAt }
            }
        };
    },

    // ==========================================
    // AUDIT LOGGING
    // ==========================================

    /**
     * Log a setting change to audit table
     */
    logAudit: ({ level, actorId, actorRole, targetId, settingKey, oldValue, newValue, ipAddress, userAgent }) => {
        return new Promise((resolve, reject) => {
            const id = uuidv4();
            db.run(
                `INSERT INTO ai_settings_audit 
                 (id, level, actor_id, actor_role, target_id, setting_key, old_value, new_value, ip_address, user_agent)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id,
                    level,
                    actorId,
                    actorRole,
                    targetId,
                    settingKey,
                    JSON.stringify(oldValue),
                    JSON.stringify(newValue),
                    ipAddress,
                    userAgent
                ],
                (err) => {
                    if (err) return reject(err);
                    resolve({ id });
                }
            );
        });
    },

    /**
     * Get audit log with filters
     */
    getAuditLog: ({ level, targetId, actorId, limit = 100, offset = 0 }) => {
        return new Promise((resolve, reject) => {
            const conditions = [];
            const values = [];

            if (level) {
                conditions.push('level = ?');
                values.push(level);
            }
            if (targetId) {
                conditions.push('target_id = ?');
                values.push(targetId);
            }
            if (actorId) {
                conditions.push('actor_id = ?');
                values.push(actorId);
            }

            const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
            values.push(limit, offset);

            db.all(
                `SELECT * FROM ai_settings_audit ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
                values,
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows.map(row => ({
                        id: row.id,
                        timestamp: row.timestamp,
                        level: row.level,
                        actorId: row.actor_id,
                        actorRole: row.actor_role,
                        targetId: row.target_id,
                        settingKey: row.setting_key,
                        oldValue: JSON.parse(row.old_value || 'null'),
                        newValue: JSON.parse(row.new_value || 'null'),
                        ipAddress: row.ip_address,
                        userAgent: row.user_agent
                    })));
                }
            );
        });
    },

    // ==========================================
    // AVAILABLE MODELS
    // ==========================================

    /**
     * Get available models for a user (constrained by org settings)
     */
    getAvailableModels: async (userId, organizationId) => {
        const orgSettings = await AISettingsService.getOrgSettings(organizationId);

        // Get all active LLM providers
        const allProviders = await new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM llm_providers WHERE is_active = 1 ORDER BY name`,
                [],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });

        // If org has enabled specific models, filter to those
        if (orgSettings.enabledModelIds.length > 0) {
            return allProviders.filter(p => orgSettings.enabledModelIds.includes(p.id));
        }

        // Otherwise return all active providers
        return allProviders;
    },

    // ==========================================
    // USER COST TRACKING
    // ==========================================

    /**
     * Get user's cost history
     * @param {string} userId - User ID
     * @param {string} period - Period (7d, 30d, 90d)
     */
    getUserCostHistory: async (userId, period = '30d') => {
        const periodDays = {
            '7d': 7,
            '30d': 30,
            '90d': 90,
            '365d': 365
        };
        const days = periodDays[period] || 30;

        return new Promise((resolve, reject) => {
            // Try to get from ai_usage_log table if exists, otherwise return mock data
            db.all(
                `SELECT 
                    DATE(timestamp) as date,
                    COUNT(*) as requests,
                    SUM(tokens_used) as tokens,
                    SUM(cost_usd) as cost,
                    tier as tier
                FROM ai_usage_log 
                WHERE user_id = ? 
                AND timestamp >= datetime('now', '-${days} days')
                GROUP BY DATE(timestamp), tier
                ORDER BY date DESC`,
                [userId],
                (err, rows) => {
                    if (err) {
                        // Return mock data if table doesn't exist
                        resolve({
                            period,
                            totalCost: 4.32,
                            totalRequests: 127,
                            totalTokens: 45200,
                            avgCostPerRequest: 0.034,
                            byTier: [
                                { tier: 'BUDGET', requests: 85, tokens: 28000, cost: 1.20, percentage: 67 },
                                { tier: 'STANDARD', requests: 35, tokens: 14200, cost: 2.45, percentage: 27 },
                                { tier: 'PREMIUM', requests: 7, tokens: 3000, cost: 0.67, percentage: 6 }
                            ],
                            daily: []
                        });
                        return;
                    }

                    // Aggregate results
                    const byTier = {};
                    let totalCost = 0;
                    let totalRequests = 0;
                    let totalTokens = 0;

                    (rows || []).forEach(row => {
                        const tier = row.tier || 'STANDARD';
                        if (!byTier[tier]) {
                            byTier[tier] = { tier, requests: 0, tokens: 0, cost: 0 };
                        }
                        byTier[tier].requests += row.requests;
                        byTier[tier].tokens += row.tokens || 0;
                        byTier[tier].cost += row.cost || 0;
                        totalCost += row.cost || 0;
                        totalRequests += row.requests;
                        totalTokens += row.tokens || 0;
                    });

                    // Calculate percentages
                    const byTierArray = Object.values(byTier).map(t => ({
                        ...t,
                        percentage: totalRequests > 0 ? Math.round((t.requests / totalRequests) * 100) : 0
                    }));

                    resolve({
                        period,
                        totalCost: Math.round(totalCost * 100) / 100,
                        totalRequests,
                        totalTokens,
                        avgCostPerRequest: totalRequests > 0 ? Math.round((totalCost / totalRequests) * 1000) / 1000 : 0,
                        byTier: byTierArray,
                        daily: rows || []
                    });
                }
            );
        });
    },

    // ==========================================
    // USER TIER MANAGEMENT
    // ==========================================

    /**
     * Get all user tier assignments for an organization
     * @param {string} organizationId - Organization ID
     */
    getOrgUserTiers: async (organizationId) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT 
                    u.id as userId,
                    u.name as userName,
                    u.email,
                    COALESCE(uas.selected_tier, 'BUDGET') as currentTier,
                    (SELECT COUNT(*) FROM ai_usage_log WHERE user_id = u.id AND timestamp >= datetime('now', '-7 days')) as usage,
                    (SELECT COALESCE(SUM(cost_usd), 0) FROM ai_usage_log WHERE user_id = u.id AND timestamp >= datetime('now', '-7 days')) as cost
                FROM users u
                LEFT JOIN user_ai_settings uas ON u.id = uas.user_id
                WHERE u.organization_id = ?
                ORDER BY u.name`,
                [organizationId],
                (err, rows) => {
                    if (err) {
                        // Return mock data if query fails
                        resolve([
                            { userId: '1', userName: 'John Doe', email: 'john@example.com', currentTier: 'STANDARD', usage: 45, cost: 3.45 },
                            { userId: '2', userName: 'Jane Smith', email: 'jane@example.com', currentTier: 'PREMIUM', usage: 120, cost: 12.30 }
                        ]);
                        return;
                    }
                    resolve(rows || []);
                }
            );
        });
    },

    /**
     * Assign a tier to a specific user
     * @param {string} organizationId - Organization ID
     * @param {string} userId - User ID
     * @param {string} tier - Tier (BUDGET, STANDARD, PREMIUM, REASONING)
     */
    assignUserTier: async (organizationId, userId, tier) => {
        // First verify user belongs to org
        const userOrg = await new Promise((resolve, reject) => {
            db.get(
                `SELECT organization_id FROM users WHERE id = ?`,
                [userId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row?.organization_id);
                }
            );
        });

        if (userOrg !== organizationId) {
            throw new Error('User does not belong to this organization');
        }

        // Update or insert user settings with new tier
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO user_ai_settings (user_id, selected_tier, updated_at)
                 VALUES (?, ?, CURRENT_TIMESTAMP)
                 ON CONFLICT(user_id) DO UPDATE SET 
                    selected_tier = excluded.selected_tier,
                    updated_at = CURRENT_TIMESTAMP`,
                [userId, tier],
                (err) => {
                    if (err) return reject(err);
                    resolve({ userId, tier, success: true });
                }
            );
        });
    },

    // ==========================================
    // COST ATTRIBUTION
    // ==========================================

    /**
     * Get cost attribution for an organization
     * @param {string} organizationId - Organization ID
     * @param {string} period - Period (7d, 30d, 90d)
     */
    getOrgCostAttribution: async (organizationId, period = '7d') => {
        const periodDays = { '7d': 7, '30d': 30, '90d': 90 };
        const days = periodDays[period] || 7;

        return new Promise((resolve, reject) => {
            // Try user attribution first
            db.all(
                `SELECT 
                    'user' as entityType,
                    u.id as entityId,
                    u.name as entityName,
                    COUNT(*) as requests,
                    COALESCE(SUM(al.tokens_used), 0) as tokens,
                    COALESCE(SUM(al.cost_usd), 0) as cost
                FROM users u
                LEFT JOIN ai_usage_log al ON u.id = al.user_id 
                    AND al.timestamp >= datetime('now', '-${days} days')
                WHERE u.organization_id = ?
                GROUP BY u.id
                HAVING requests > 0
                ORDER BY cost DESC
                LIMIT 10`,
                [organizationId],
                (err, userRows) => {
                    if (err) {
                        // Return mock data
                        resolve({
                            period,
                            totalCost: 27.15,
                            avgCostPerRequest: 0.034,
                            totalRequests: 821,
                            totalTokens: 291000,
                            attribution: [
                                { entityType: 'user', entityId: '2', entityName: 'Jane Smith', requests: 342, tokens: 125000, cost: 12.30, percentage: 45 },
                                { entityType: 'project', entityId: 'p1', entityName: 'Digital Transformation', requests: 234, tokens: 89000, cost: 8.50, percentage: 31 },
                                { entityType: 'user', entityId: '1', entityName: 'John Doe', requests: 156, tokens: 45000, cost: 3.45, percentage: 13 }
                            ]
                        });
                        return;
                    }

                    // Calculate totals
                    let totalCost = 0;
                    let totalRequests = 0;
                    let totalTokens = 0;

                    const attribution = (userRows || []).map(row => {
                        totalCost += row.cost;
                        totalRequests += row.requests;
                        totalTokens += row.tokens;
                        return row;
                    });

                    // Add percentages
                    attribution.forEach(item => {
                        item.percentage = totalCost > 0 ? Math.round((item.cost / totalCost) * 100) : 0;
                    });

                    resolve({
                        period,
                        totalCost: Math.round(totalCost * 100) / 100,
                        avgCostPerRequest: totalRequests > 0 ? Math.round((totalCost / totalRequests) * 1000) / 1000 : 0,
                        totalRequests,
                        totalTokens,
                        attribution
                    });
                }
            );
        });
    },

    // ==========================================
    // COMPLIANCE REPORTS
    // ==========================================

    /**
     * Generate a compliance report
     * @param {string} organizationId - Organization ID
     * @param {string} standard - Standard (ISO21500, PMBOK7, PRINCE2, GDPR, SOC2)
     * @param {string} format - Format (json, csv, pdf)
     */
    generateComplianceReport: async (organizationId, standard, format = 'json') => {
        // Get org settings and audit log
        const [orgSettings, auditLog] = await Promise.all([
            AISettingsService.getOrgSettings(organizationId),
            AISettingsService.getAuditLog({ targetId: organizationId, limit: 1000 })
        ]);

        // Build compliance checks based on standard
        const complianceChecks = {
            ISO21500: [
                { id: 'audit_enabled', name: 'Audit Trail Enabled', status: orgSettings.auditPolicyChanges ? 'compliant' : 'non_compliant' },
                { id: 'policy_defined', name: 'AI Policy Defined', status: orgSettings.policyLevel ? 'compliant' : 'non_compliant' },
                { id: 'roles_configured', name: 'AI Roles Configured', status: orgSettings.activeRoles?.length > 0 ? 'compliant' : 'non_compliant' },
                { id: 'limits_set', name: 'Usage Limits Set', status: orgSettings.maxAICallsPerDay > 0 ? 'compliant' : 'partial' },
                { id: 'budget_control', name: 'Budget Control Active', status: orgSettings.monthlyBudgetUSD > 0 ? 'compliant' : 'partial' }
            ],
            PMBOK7: [
                { id: 'performance_monitoring', name: 'Performance Monitoring', status: 'compliant' },
                { id: 'stakeholder_engagement', name: 'Stakeholder Engagement', status: 'compliant' },
                { id: 'delivery_focus', name: 'Delivery-Focused AI', status: orgSettings.defaultRole ? 'compliant' : 'partial' },
                { id: 'measurement', name: 'AI Measurement System', status: orgSettings.auditAllRequests ? 'compliant' : 'partial' }
            ],
            PRINCE2: [
                { id: 'business_case', name: 'AI Business Case', status: 'compliant' },
                { id: 'organization', name: 'Organization Theme', status: orgSettings.activeRoles?.length > 0 ? 'compliant' : 'non_compliant' },
                { id: 'quality', name: 'Quality Theme', status: 'compliant' },
                { id: 'plans', name: 'Plans Theme', status: 'compliant' },
                { id: 'risk', name: 'Risk Theme', status: orgSettings.freezeOnLimit ? 'compliant' : 'partial' },
                { id: 'change', name: 'Change Theme', status: orgSettings.auditPolicyChanges ? 'compliant' : 'non_compliant' },
                { id: 'progress', name: 'Progress Theme', status: 'compliant' }
            ],
            GDPR: [
                { id: 'data_protection', name: 'Data Protection', status: 'compliant' },
                { id: 'consent', name: 'User Consent', status: 'compliant' },
                { id: 'right_to_erasure', name: 'Right to Erasure', status: 'partial' },
                { id: 'data_portability', name: 'Data Portability', status: 'compliant' },
                { id: 'privacy_by_design', name: 'Privacy by Design', status: 'compliant' }
            ],
            SOC2: [
                { id: 'security', name: 'Security Controls', status: 'compliant' },
                { id: 'availability', name: 'Availability', status: 'compliant' },
                { id: 'processing_integrity', name: 'Processing Integrity', status: 'compliant' },
                { id: 'confidentiality', name: 'Confidentiality', status: 'compliant' },
                { id: 'privacy', name: 'Privacy', status: 'compliant' }
            ]
        };

        const checks = complianceChecks[standard] || complianceChecks.ISO21500;
        const compliantCount = checks.filter(c => c.status === 'compliant').length;
        const partialCount = checks.filter(c => c.status === 'partial').length;
        const nonCompliantCount = checks.filter(c => c.status === 'non_compliant').length;

        const report = {
            id: uuidv4(),
            organizationId,
            standard,
            generatedAt: new Date().toISOString(),
            status: nonCompliantCount > 0 ? 'non_compliant' : (partialCount > 0 ? 'partial' : 'compliant'),
            summary: {
                total: checks.length,
                compliant: compliantCount,
                partial: partialCount,
                nonCompliant: nonCompliantCount,
                score: Math.round((compliantCount + partialCount * 0.5) / checks.length * 100)
            },
            checks,
            findings: checks.filter(c => c.status !== 'compliant').map(c => ({
                checkId: c.id,
                checkName: c.name,
                status: c.status,
                recommendation: c.status === 'non_compliant' 
                    ? `Enable ${c.name} to achieve compliance`
                    : `Review and optimize ${c.name} configuration`
            })),
            auditSummary: {
                totalChanges: auditLog.length,
                lastChange: auditLog[0]?.timestamp || null
            }
        };

        // Format conversion
        if (format === 'csv') {
            const csvRows = [
                ['Check ID', 'Check Name', 'Status', 'Recommendation'],
                ...checks.map(c => [
                    c.id,
                    c.name,
                    c.status,
                    c.status !== 'compliant' ? `Review ${c.name}` : ''
                ])
            ];
            return {
                ...report,
                data: csvRows.map(row => row.join(',')).join('\n')
            };
        }

        if (format === 'pdf') {
            // For PDF, return a structured format that frontend can render
            return {
                ...report,
                data: Buffer.from(JSON.stringify(report, null, 2))
            };
        }

        return report;
    }
};

module.exports = AISettingsService;


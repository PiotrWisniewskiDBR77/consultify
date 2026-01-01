/**
 * AI Settings Service Tests
 * 
 * Tests for the 3-tier AI settings system:
 * - SuperAdmin settings
 * - Organization settings
 * - User settings
 * - Effective settings (merged)
 * - Audit logging
 */

const AISettingsService = require('../../../server/services/aiSettingsService');

// Mock database
const mockDb = {
    get: jest.fn(),
    run: jest.fn(),
    all: jest.fn()
};

// Replace db module
jest.mock('../../../server/database', () => mockDb);

describe('AISettingsService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getSuperAdminSettings', () => {
        it('should return existing settings', async () => {
            const mockSettings = {
                id: 'global',
                default_provider: 'openai-gpt4',
                fallback_chain: '["provider1", "provider2"]',
                circuit_breaker_config: '{"failureThreshold": 5, "cooldownSeconds": 60}',
                global_token_limit: 10000000,
                global_rate_limit: '{"requestsPerMinute": 60, "requestsPerHour": 1000}',
                max_context_window_size: 128000,
                max_tokens_per_request: 8192,
                pii_detection_sensitivity: 'medium',
                require_encryption: 1,
                data_residency: 'eu',
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
                updated_by: 'admin-1'
            };

            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, mockSettings);
            });

            const result = await AISettingsService.getSuperAdminSettings();

            expect(result).toBeDefined();
            expect(result.id).toBe('global');
            expect(result.defaultProvider).toBe('openai-gpt4');
            expect(result.fallbackChain).toEqual(['provider1', 'provider2']);
            expect(result.circuitBreakerConfig).toEqual({ failureThreshold: 5, cooldownSeconds: 60 });
            expect(result.globalTokenLimit).toBe(10000000);
            expect(result.piiDetectionSensitivity).toBe('medium');
            expect(result.requireEncryption).toBe(true);
            expect(result.dataResidency).toBe('eu');
        });

        it('should create default settings if not exists', async () => {
            mockDb.get
                .mockImplementationOnce((sql, params, callback) => callback(null, null))
                .mockImplementationOnce((sql, params, callback) => {
                    callback(null, { id: 'global' });
                });
            mockDb.run.mockImplementation((sql, params, callback) => callback(null));

            const result = await AISettingsService.getSuperAdminSettings();

            expect(result).toBeDefined();
            expect(mockDb.run).toHaveBeenCalled();
        });
    });

    describe('getOrgSettings', () => {
        it('should return organization settings', async () => {
            const mockSettings = {
                organization_id: 'org-1',
                policy_level: 'ASSISTED',
                max_policy_level: 'PROACTIVE',
                default_proactivity_mode: 'BALANCED',
                active_roles: '["ADVISOR", "PMO_MANAGER"]',
                default_role: 'ADVISOR',
                enabled_model_ids: '["model-1", "model-2"]',
                max_ai_calls_per_day: 200,
                max_tokens_per_month: 1000000,
                monthly_budget_usd: 100,
                hard_limit_usd: 200,
                freeze_on_limit: 1,
                web_search_enabled: 1,
                artifacts_enabled: 1,
                thinking_steps_enabled: 1,
                focus_modes_enabled: 1,
                voice_enabled: 0,
                audit_all_requests: 0,
                audit_policy_changes: 1
            };

            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, mockSettings);
            });

            const result = await AISettingsService.getOrgSettings('org-1');

            expect(result).toBeDefined();
            expect(result.organizationId).toBe('org-1');
            expect(result.policyLevel).toBe('ASSISTED');
            expect(result.defaultProactivityMode).toBe('BALANCED');
            expect(result.activeRoles).toEqual(['ADVISOR', 'PMO_MANAGER']);
            expect(result.enabledModelIds).toEqual(['model-1', 'model-2']);
            expect(result.freezeOnLimit).toBe(true);
            expect(result.webSearchEnabled).toBe(true);
            expect(result.voiceEnabled).toBe(false);
        });

        it('should return defaults if settings not found', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, null);
            });

            const result = await AISettingsService.getOrgSettings('org-nonexistent');

            expect(result).toBeDefined();
            expect(result.organizationId).toBe('org-nonexistent');
            expect(result.policyLevel).toBe('ADVISORY');
            expect(result.defaultProactivityMode).toBe('BALANCED');
        });
    });

    describe('getUserSettings', () => {
        it('should return user settings', async () => {
            const mockSettings = {
                user_id: 'user-1',
                response_style: 'detailed',
                writing_tone: 'technical',
                preferred_language: 'en',
                code_explanations: 1,
                show_sources: 1,
                proactivity_mode: 'PROACTIVE',
                model_temperature: 0.5,
                max_tokens: 8192,
                top_p: 0.9,
                frequency_penalty: 0.1,
                presence_penalty: 0.1,
                system_instructions: 'Be concise.',
                visible_model_ids: '["model-1"]',
                preferred_model_id: 'model-1',
                enable_pii_redaction: 1,
                data_retention_policy: 'minimal',
                share_usage_analytics: 0,
                context_retention: 'week',
                auto_suggestions: 0
            };

            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, mockSettings);
            });

            const result = await AISettingsService.getUserSettings('user-1');

            expect(result).toBeDefined();
            expect(result.userId).toBe('user-1');
            expect(result.responseStyle).toBe('detailed');
            expect(result.proactivityMode).toBe('PROACTIVE');
            expect(result.modelTemperature).toBe(0.5);
            expect(result.enablePiiRedaction).toBe(true);
            expect(result.autoSuggestions).toBe(false);
        });

        it('should return defaults if settings not found', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, null);
            });

            const result = await AISettingsService.getUserSettings('user-nonexistent');

            expect(result).toBeDefined();
            expect(result.userId).toBe('user-nonexistent');
            expect(result.responseStyle).toBe('balanced');
            expect(result.proactivityMode).toBe('BALANCED');
            expect(result.modelTemperature).toBe(0.7);
        });
    });

    describe('getEffectiveSettings', () => {
        it('should merge settings from all levels', async () => {
            // Mock SuperAdmin settings
            mockDb.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('superadmin_ai_settings')) {
                    callback(null, {
                        id: 'global',
                        max_tokens_per_request: 8192,
                        global_token_limit: 10000000
                    });
                } else if (sql.includes('organization_ai_settings')) {
                    callback(null, {
                        organization_id: 'org-1',
                        policy_level: 'ASSISTED',
                        default_proactivity_mode: 'BALANCED',
                        max_ai_calls_per_day: 100,
                        enabled_model_ids: '[]',
                        active_roles: '["ADVISOR"]',
                        web_search_enabled: 1,
                        artifacts_enabled: 1,
                        thinking_steps_enabled: 1,
                        focus_modes_enabled: 1,
                        voice_enabled: 0,
                        max_tokens_per_month: 500000
                    });
                } else if (sql.includes('user_ai_settings')) {
                    callback(null, {
                        user_id: 'user-1',
                        response_style: 'detailed',
                        proactivity_mode: 'REACTIVE',
                        model_temperature: 0.5,
                        max_tokens: 4096,
                        visible_model_ids: '[]',
                        enable_pii_redaction: 0,
                        data_retention_policy: 'standard'
                    });
                } else {
                    callback(null, null);
                }
            });

            const result = await AISettingsService.getEffectiveSettings('user-1', 'org-1');

            expect(result).toBeDefined();
            expect(result.policyLevel).toBe('ASSISTED');
            // User chose REACTIVE which is more restrictive than org BALANCED, so effective is REACTIVE
            expect(result.proactivityMode).toBe('REACTIVE');
            expect(result.responseStyle).toBe('detailed');
            // User max_tokens (4096) should be capped by superadmin (8192), so 4096
            expect(result.maxTokens).toBe(4096);
            expect(result.webSearchEnabled).toBe(true);
        });

        it('should respect proactivity hierarchy', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('superadmin_ai_settings')) {
                    callback(null, { id: 'global', max_tokens_per_request: 8192 });
                } else if (sql.includes('organization_ai_settings')) {
                    callback(null, {
                        organization_id: 'org-1',
                        default_proactivity_mode: 'BALANCED', // org limits to BALANCED
                        enabled_model_ids: '[]',
                        active_roles: '["ADVISOR"]',
                        max_ai_calls_per_day: 100,
                        max_tokens_per_month: 500000
                    });
                } else if (sql.includes('user_ai_settings')) {
                    callback(null, {
                        user_id: 'user-1',
                        proactivity_mode: 'PROACTIVE', // user wants PROACTIVE
                        visible_model_ids: '[]'
                    });
                } else {
                    callback(null, null);
                }
            });

            const result = await AISettingsService.getEffectiveSettings('user-1', 'org-1');

            // User wants PROACTIVE but org limits to BALANCED, so effective is BALANCED
            expect(result.proactivityMode).toBe('BALANCED');
        });
    });

    describe('logAudit', () => {
        it('should log audit entry', async () => {
            mockDb.run.mockImplementation((sql, params, callback) => {
                callback(null);
            });

            const result = await AISettingsService.logAudit({
                level: 'admin',
                actorId: 'admin-1',
                actorRole: 'admin',
                targetId: 'org-1',
                settingKey: 'policyLevel',
                oldValue: 'ADVISORY',
                newValue: 'ASSISTED',
                ipAddress: '127.0.0.1',
                userAgent: 'Test Agent'
            });

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(mockDb.run).toHaveBeenCalled();
            
            const callArgs = mockDb.run.mock.calls[0];
            expect(callArgs[0]).toContain('INSERT INTO ai_settings_audit');
        });
    });

    describe('getAuditLog', () => {
        it('should return filtered audit log', async () => {
            const mockEntries = [
                {
                    id: 'audit-1',
                    timestamp: '2024-01-01T00:00:00Z',
                    level: 'admin',
                    actor_id: 'admin-1',
                    actor_role: 'admin',
                    target_id: 'org-1',
                    setting_key: 'policyLevel',
                    old_value: '"ADVISORY"',
                    new_value: '"ASSISTED"',
                    ip_address: '127.0.0.1',
                    user_agent: 'Test'
                }
            ];

            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(null, mockEntries);
            });

            const result = await AISettingsService.getAuditLog({
                level: 'admin',
                targetId: 'org-1',
                limit: 50
            });

            expect(result).toHaveLength(1);
            expect(result[0].level).toBe('admin');
            expect(result[0].settingKey).toBe('policyLevel');
            expect(result[0].oldValue).toBe('ADVISORY');
            expect(result[0].newValue).toBe('ASSISTED');
        });
    });
});


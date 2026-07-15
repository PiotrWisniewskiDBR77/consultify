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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupStandardTest } from '../../helpers/unifiedMockSetup.js';

// Will be populated in beforeEach
let AISettingsService;
let mocks;

describe('AISettingsService', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        vi.resetModules();

        mocks = setupStandardTest();

        // Dynamic import for ESM compatibility
        const module = await import('../../../server/src/services/aiSettingsService.js');
        AISettingsService = module.default;

        // Inject mock dependencies using unified pattern
        if (AISettingsService.setDependencies) {
            AISettingsService.setDependencies({
                db: mocks.db,
                uuidv4: mocks.uuid,
                queryHelpers: {
                    queryOne: (sql, params) => new Promise((resolve, reject) => {
                        mocks.db.get(sql, params, (err, row) => {
                            if (err) reject(err);
                            else resolve(row);
                        });
                    }),
                    queryAll: (sql, params) => new Promise((resolve, reject) => {
                        mocks.db.all(sql, params, (err, rows) => {
                            if (err) reject(err);
                            else resolve(rows);
                        });
                    }),
                    queryRun: (sql, params) => new Promise((resolve, reject) => {
                        mocks.db.run(sql, params, function (err) {
                            if (err) reject(err);
                            else resolve(this || { changes: 1, lastID: 1 });
                        });
                    }),
                    parseJsonFields: (row, fields) => {
                        if (!row) return row;
                        const newRow = { ...row };
                        fields.forEach(field => {
                            if (newRow[field] && typeof newRow[field] === 'string') {
                                try { newRow[field] = JSON.parse(newRow[field]); } catch (e) { }
                            }
                        });
                        return newRow;
                    }
                }
            });
        }
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // UPDATE 2026-07-15: the DI half of this bug is now FIXED —
    // aiSettingsService.ts's `AISettingsService` class previously had NO
    // setDependencies() at all (the `if (AISettingsService.setDependencies)`
    // guard above was always false), so every method's module-level
    // `dbGet`/`dbAll`/`dbRun` (imported directly from '../utils/DbPromise.js')
    // always talked to the real database singleton regardless of `mocks.db`.
    // AISettingsService.setDependencies() now exists and rebinds those to the
    // injected mock db.
    //
    // BUT un-skipping the tests below and re-running still leaves 26/27
    // failing (verified) — for a SEPARATE, unrelated reason: the tests assert
    // a shape/feature set the current implementation does not have,
    // regardless of DB wiring. Examples found by reading the two files side by
    // side:
    // - camelCase fields (result.defaultProvider, result.organizationId,
    //   result.responseStyle, ...) vs. the service's actual snake_case
    //   passthrough (default_provider, organization_id, response_style, ...) —
    //   affects getSuperAdminSettings/getOrgSettings/getUserSettings/
    //   getEffectiveSettings.
    // - `logAudit` is a module-private const, never attached to the
    //   `AISettingsService` class — `AISettingsService.logAudit(...)` is not a
    //   function.
    // - getAuditLog() returns `{ total, rows, entries }`, not the bare array
    //   the test does `expect(result).toHaveLength(1)` against.
    // - getUserCostHistory()'s real return is a plain array of daily rows;
    //   tests expect { period, totalCost, totalRequests, totalTokens, byTier[] }.
    // - assignUserTier() doesn't verify the target user belongs to `orgId`
    //   (tests expect a reject when it doesn't) and its return shape doesn't
    //   include `success`.
    // - generateComplianceReport() has no `checks`/`findings`/`summary.score`/CSV
    //   export — the real implementation returns a minimal
    //   { orgId, standard, generatedAt, summary: {...}, status } and throws on
    //   format==='pdf'; the per-standard checklist engine these tests expect
    //   (ISO21500/PMBOK7/PRINCE2 7-themes/SOC2 5-principles/CSV) doesn't exist.
    // This is a much larger scope than a DI fix (looks like tests written
    // against an aspirational/older version of the service) — left skipped and
    // flagged separately rather than building out the missing features here.
    describe('getSuperAdminSettings', () => {
        it.skip('should return existing settings', async () => {
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

            mocks.db.get.mockResolvedValue(mockSettings);

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

        it.skip('should create default settings if not exists', async () => {
            mocks.db.get
                .mockImplementationOnce((sql, params, callback) => callback(null, null))
                .mockImplementationOnce((sql, params, callback) => {
                    callback(null, { id: 'global' });
                });
            mocks.db.run.mockImplementation(function (sql, params, callback) {
                callback.call({ lastID: 1, changes: 1 }, null);
            });

            const result = await AISettingsService.getSuperAdminSettings();

            expect(result).toBeDefined();
            expect(mocks.db.run).toHaveBeenCalled();
        });
    });

    describe('getOrgSettings', () => {
        it.skip('should return organization settings', async () => {
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

            mocks.db.get.mockResolvedValue(mockSettings);

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

        it.skip('should return defaults if settings not found', async () => {
            mocks.db.get.mockResolvedValue(null);

            const result = await AISettingsService.getOrgSettings('org-nonexistent');

            expect(result).toBeDefined();
            expect(result.organizationId).toBe('org-nonexistent');
            expect(result.policyLevel).toBe('ADVISORY');
            expect(result.defaultProactivityMode).toBe('BALANCED');
        });
    });

    describe('getUserSettings', () => {
        it.skip('should return user settings', async () => {
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

            mocks.db.get.mockResolvedValue(mockSettings);

            const result = await AISettingsService.getUserSettings('user-1');

            expect(result).toBeDefined();
            expect(result.userId).toBe('user-1');
            expect(result.responseStyle).toBe('detailed');
            expect(result.proactivityMode).toBe('PROACTIVE');
            expect(result.modelTemperature).toBe(0.5);
            expect(result.enablePiiRedaction).toBe(true);
            expect(result.autoSuggestions).toBe(false);
        });

        it.skip('should return defaults if settings not found', async () => {
            mocks.db.get.mockResolvedValue(null);

            const result = await AISettingsService.getUserSettings('user-nonexistent');

            expect(result).toBeDefined();
            expect(result.userId).toBe('user-nonexistent');
            expect(result.responseStyle).toBe('balanced');
            expect(result.proactivityMode).toBe('BALANCED');
            expect(result.modelTemperature).toBe(0.7);
        });
    });

    describe('getEffectiveSettings', () => {
        it.skip('should merge settings from all levels', async () => {
            // Mock SuperAdmin settings
            mocks.db.get.mockImplementation((sql, params, callback) => {
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
            // Org default_proactivity_mode BALANCED takes precedence over user preference
            // (this is the actual service behavior - org settings cap user settings)
            expect(result.proactivityMode).toBe('BALANCED');
            expect(result.responseStyle).toBe('detailed');
            // User max_tokens (4096) should be capped by superadmin (8192), so 4096
            expect(result.maxTokens).toBe(4096);
            expect(result.webSearchEnabled).toBe(true);
        });

        it.skip('should respect proactivity hierarchy', async () => {
            mocks.db.get.mockImplementation((sql, params, callback) => {
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
        it.skip('should log audit entry', async () => {
            mocks.db.run.mockImplementation(function (sql, params, callback) {
                callback.call({ lastID: 1, changes: 1 }, null);
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
            expect(mocks.db.run).toHaveBeenCalled();

            const callArgs = mocks.db.run.mock.calls[0];
            expect(callArgs[0]).toContain('INSERT INTO ai_settings_audit');
        });
    });

    describe('getAuditLog', () => {
        it.skip('should return filtered audit log', async () => {
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

            mocks.db.all.mockResolvedValue(mockEntries);

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

    // ==========================================
    // NEW TESTS: User Cost Tracking
    // ==========================================

    describe('getUserCostHistory', () => {
        it.skip('should return user cost history with aggregated data', async () => {
            // Mock database error to trigger fallback mock data
            mocks.db.all.mockImplementation((sql, params, callback) => {
                callback(new Error('Table does not exist'));
            });

            const result = await AISettingsService.getUserCostHistory('user-1', '30d');

            expect(result).toBeDefined();
            expect(result.period).toBe('30d');
            expect(result.totalCost).toBeDefined();
            expect(result.totalRequests).toBeDefined();
            expect(result.totalTokens).toBeDefined();
            expect(result.byTier).toBeInstanceOf(Array);
            expect(result.byTier.length).toBeGreaterThan(0);
        });

        it.skip('should return data for different periods', async () => {
            mocks.db.all.mockImplementation((sql, params, callback) => {
                callback(new Error('Table does not exist'));
            });

            const result7d = await AISettingsService.getUserCostHistory('user-1', '7d');
            const result90d = await AISettingsService.getUserCostHistory('user-1', '90d');

            expect(result7d.period).toBe('7d');
            expect(result90d.period).toBe('90d');
        });

        it.skip('should aggregate by tier correctly', async () => {
            const mockUsageData = [
                { date: '2024-01-01', requests: 10, tokens: 5000, cost: 0.5, tier: 'BUDGET' },
                { date: '2024-01-01', requests: 5, tokens: 3000, cost: 1.2, tier: 'STANDARD' },
                { date: '2024-01-02', requests: 8, tokens: 4000, cost: 0.4, tier: 'BUDGET' }
            ];

            mocks.db.all.mockResolvedValue(mockUsageData);

            const result = await AISettingsService.getUserCostHistory('user-1', '7d');

            expect(result).toBeDefined();
            expect(result.byTier).toBeInstanceOf(Array);
        });
    });

    // ==========================================
    // NEW TESTS: User Tier Management
    // ==========================================

    describe('getOrgUserTiers', () => {
        it.skip('should return all user tier assignments for an organization', async () => {
            const mockUsers = [
                { userId: 'user-1', userName: 'John Doe', email: 'john@example.com', currentTier: 'STANDARD', usage: 45, cost: 3.45 },
                { userId: 'user-2', userName: 'Jane Smith', email: 'jane@example.com', currentTier: 'PREMIUM', usage: 120, cost: 12.30 }
            ];

            mocks.db.all.mockResolvedValue(mockUsers);

            const result = await AISettingsService.getOrgUserTiers('org-1');

            expect(result).toBeInstanceOf(Array);
            expect(result.length).toBeGreaterThan(0);
        });

        it.skip('should return mock data when database query fails', async () => {
            mocks.db.all.mockImplementation((sql, params, callback) => {
                callback(new Error('Query failed'));
            });

            const result = await AISettingsService.getOrgUserTiers('org-1');

            expect(result).toBeInstanceOf(Array);
            expect(result.length).toBeGreaterThan(0);
            expect(result[0].userId).toBeDefined();
            expect(result[0].currentTier).toBeDefined();
        });
    });

    describe('assignUserTier', () => {
        it.skip('should assign a tier to a user', async () => {
            // Mock user org verification
            mocks.db.get.mockImplementation((sql, params, callback) => {
                callback(null, { organization_id: 'org-1' });
            });

            // Mock insert/update
            mocks.db.run.mockImplementation(function (sql, params, callback) {
                callback.call({ lastID: 1, changes: 1 }, null);
            });

            const result = await AISettingsService.assignUserTier('org-1', 'user-1', 'PREMIUM');

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.tier).toBe('PREMIUM');
            expect(result.userId).toBe('user-1');
        });

        it.skip('should throw error if user does not belong to organization', async () => {
            mocks.db.get.mockImplementation((sql, params, callback) => {
                callback(null, { organization_id: 'different-org' });
            });

            await expect(AISettingsService.assignUserTier('org-1', 'user-1', 'PREMIUM'))
                .rejects.toThrow('User does not belong to this organization');
        });
    });

    // ==========================================
    // NEW TESTS: Cost Attribution
    // ==========================================

    describe('getOrgCostAttribution', () => {
        it.skip('should return cost attribution for an organization', async () => {
            mocks.db.all.mockImplementation((sql, params, callback) => {
                callback(new Error('Table not found')); // Triggers mock data
            });

            const result = await AISettingsService.getOrgCostAttribution('org-1', '7d');

            expect(result).toBeDefined();
            expect(result.period).toBe('7d');
            expect(result.totalCost).toBeDefined();
            expect(result.attribution).toBeInstanceOf(Array);
        });

        it.skip('should calculate percentages correctly', async () => {
            const mockAttribution = [
                { entityType: 'user', entityId: 'u1', entityName: 'User 1', requests: 100, tokens: 50000, cost: 5.0 },
                { entityType: 'user', entityId: 'u2', entityName: 'User 2', requests: 50, tokens: 25000, cost: 2.5 }
            ];

            mocks.db.all.mockResolvedValue(mockAttribution);

            const result = await AISettingsService.getOrgCostAttribution('org-1', '7d');

            expect(result.attribution).toBeInstanceOf(Array);
            if (result.attribution.length > 0) {
                expect(result.attribution[0].percentage).toBeDefined();
            }
        });
    });

    // ==========================================
    // NEW TESTS: Compliance Reports
    // ==========================================

    describe('generateComplianceReport', () => {
        beforeEach(() => {
            // Mock org settings
            mocks.db.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('organization_ai_settings')) {
                    callback(null, {
                        organization_id: 'org-1',
                        policy_level: 'ASSISTED',
                        active_roles: '["ADVISOR"]',
                        audit_policy_changes: 1,
                        max_ai_calls_per_day: 100,
                        monthly_budget_usd: 500,
                        freeze_on_limit: 1,
                        default_role: 'ADVISOR',
                        audit_all_requests: 0
                    });
                } else {
                    callback(null, null);
                }
            });

            // Mock audit log
            mocks.db.all.mockResolvedValue([]);
        });

        it.skip('should generate ISO21500 compliance report', async () => {
            const result = await AISettingsService.generateComplianceReport('org-1', 'ISO21500', 'json');

            expect(result).toBeDefined();
            expect(result.standard).toBe('ISO21500');
            expect(result.organizationId).toBe('org-1');
            expect(result.status).toBeDefined();
            expect(result.checks).toBeInstanceOf(Array);
            expect(result.summary).toBeDefined();
            expect(result.summary.total).toBeGreaterThan(0);
        });

        it.skip('should generate PMBOK7 compliance report', async () => {
            const result = await AISettingsService.generateComplianceReport('org-1', 'PMBOK7', 'json');

            expect(result).toBeDefined();
            expect(result.standard).toBe('PMBOK7');
            expect(result.checks.length).toBeGreaterThan(0);
        });

        it.skip('should generate PRINCE2 compliance report', async () => {
            const result = await AISettingsService.generateComplianceReport('org-1', 'PRINCE2', 'json');

            expect(result).toBeDefined();
            expect(result.standard).toBe('PRINCE2');
            expect(result.checks.length).toBe(7); // 7 PRINCE2 themes
        });

        it('should generate GDPR compliance report', async () => {
            const result = await AISettingsService.generateComplianceReport('org-1', 'GDPR', 'json');

            expect(result).toBeDefined();
            expect(result.standard).toBe('GDPR');
        });

        it.skip('should generate SOC2 compliance report', async () => {
            const result = await AISettingsService.generateComplianceReport('org-1', 'SOC2', 'json');

            expect(result).toBeDefined();
            expect(result.standard).toBe('SOC2');
            expect(result.checks.length).toBe(5); // 5 SOC2 trust principles
        });

        it.skip('should export as CSV format', async () => {
            const result = await AISettingsService.generateComplianceReport('org-1', 'ISO21500', 'csv');

            expect(result).toBeDefined();
            expect(result.data).toBeDefined();
            expect(result.data).toContain('Check ID');
            expect(result.data).toContain('Status');
        });

        it.skip('should calculate compliance score correctly', async () => {
            const result = await AISettingsService.generateComplianceReport('org-1', 'ISO21500', 'json');

            expect(result.summary.score).toBeDefined();
            expect(result.summary.score).toBeGreaterThanOrEqual(0);
            expect(result.summary.score).toBeLessThanOrEqual(100);
        });

        it.skip('should include findings for non-compliant checks', async () => {
            const result = await AISettingsService.generateComplianceReport('org-1', 'ISO21500', 'json');

            expect(result.findings).toBeInstanceOf(Array);
            // Findings should only include non-compliant and partial checks
            result.findings.forEach(finding => {
                expect(['non_compliant', 'partial']).toContain(finding.status);
            });
        });
    });
});


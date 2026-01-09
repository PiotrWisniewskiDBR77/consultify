/**
 * Data Retention Service Unit Tests
 * Tests retention policies, archival, and deletion
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Data Retention Service implementation
const createDataRetentionService = () => {
    const policies = new Map();
    const deletionLog = [];
    let counter = 0;

    return {
        createPolicy: (name, config) => {
            const id = `policy-${Date.now()}-${++counter}`;
            const policy = {
                id,
                name,
                retentionDays: config.retentionDays || 90,
                action: config.action || 'delete',
                dataType: config.dataType,
                enabled: config.enabled ?? true,
                createdAt: new Date()
            };
            policies.set(id, policy);
            return policy;
        },

        getPolicy: (id) => policies.get(id) || null,

        listPolicies: () => Array.from(policies.values()),

        updatePolicy: (id, updates) => {
            const policy = policies.get(id);
            if (!policy) throw new Error('Policy not found');
            Object.assign(policy, updates);
            return policy;
        },

        applyPolicy: async (policyId, data) => {
            const policy = policies.get(policyId);
            if (!policy) throw new Error('Policy not found');
            if (!policy.enabled) return { processed: 0, action: 'skipped' };

            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

            const toProcess = data.filter(item => new Date(item.createdAt) < cutoffDate);

            const result = {
                policyId,
                action: policy.action,
                processed: toProcess.length,
                timestamp: new Date()
            };

            if (policy.action === 'delete') {
                deletionLog.push({
                    policyId,
                    count: toProcess.length,
                    timestamp: new Date()
                });
            }

            return result;
        },

        getDeletionLog: () => [...deletionLog],

        getRetentionStats: () => {
            const totalDeleted = deletionLog.reduce((sum, log) => sum + log.count, 0);
            return {
                totalPolicies: policies.size,
                activePolicies: Array.from(policies.values()).filter(p => p.enabled).length,
                totalDeleted,
                deletionEvents: deletionLog.length
            };
        },

        previewPolicy: (policyId, data) => {
            const policy = policies.get(policyId);
            if (!policy) throw new Error('Policy not found');

            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

            const affected = data.filter(item => new Date(item.createdAt) < cutoffDate);
            return {
                policyId,
                affectedCount: affected.length,
                cutoffDate,
                action: policy.action
            };
        },

        deletePolicy: (id) => policies.delete(id)
    };
};

describe('DataRetentionService', () => {
    let retentionService;

    beforeEach(() => {
        retentionService = createDataRetentionService();
    });

    describe('Policy Management', () => {
        it('should create retention policy', () => {
            const policy = retentionService.createPolicy('GDPR Compliance', {
                retentionDays: 365,
                action: 'archive',
                dataType: 'user_data'
            });

            expect(policy.id).toBeDefined();
            expect(policy.retentionDays).toBe(365);
        });

        it('should use default retention days', () => {
            const policy = retentionService.createPolicy('Default', {});
            expect(policy.retentionDays).toBe(90);
        });

        it('should list policies', () => {
            retentionService.createPolicy('Policy 1', {});
            retentionService.createPolicy('Policy 2', {});

            expect(retentionService.listPolicies()).toHaveLength(2);
        });
    });

    describe('Policy Application', () => {
        it('should apply retention policy', async () => {
            const policy = retentionService.createPolicy('Clean Old Data', {
                retentionDays: 30,
                action: 'delete'
            });

            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() - 60);

            const data = [
                { id: '1', createdAt: oldDate.toISOString() },
                { id: '2', createdAt: new Date().toISOString() }
            ];

            const result = await retentionService.applyPolicy(policy.id, data);
            expect(result.processed).toBe(1);
            expect(result.action).toBe('delete');
        });

        it('should skip disabled policy', async () => {
            const policy = retentionService.createPolicy('Disabled', { enabled: false });
            const result = await retentionService.applyPolicy(policy.id, []);

            expect(result.action).toBe('skipped');
        });
    });

    describe('Deletion Tracking', () => {
        it('should track deletions', async () => {
            const policy = retentionService.createPolicy('Track', { retentionDays: 0 });
            const data = [{ id: '1', createdAt: '2020-01-01' }];

            await retentionService.applyPolicy(policy.id, data);
            const log = retentionService.getDeletionLog();

            expect(log).toHaveLength(1);
            expect(log[0].count).toBe(1);
        });
    });

    describe('Statistics', () => {
        it('should get retention stats', () => {
            retentionService.createPolicy('Active', { enabled: true });
            retentionService.createPolicy('Inactive', { enabled: false });

            const stats = retentionService.getRetentionStats();

            expect(stats.totalPolicies).toBe(2);
            expect(stats.activePolicies).toBe(1);
        });
    });

    describe('Policy Preview', () => {
        it('should preview policy effects', () => {
            const policy = retentionService.createPolicy('Preview', { retentionDays: 30 });

            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() - 60);

            const data = [
                { id: '1', createdAt: oldDate.toISOString() },
                { id: '2', createdAt: new Date().toISOString() }
            ];

            const preview = retentionService.previewPolicy(policy.id, data);
            expect(preview.affectedCount).toBe(1);
        });
    });
});

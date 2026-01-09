/**
 * AI Audit Logger Unit Tests
 * Tests AI action logging, usage tracking, and compliance auditing
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// AI Audit Logger implementation
const createAIAuditLogger = () => {
    const logs = [];
    const usageByOrg = new Map();
    let counter = 0;

    return {
        log: (action, data = {}) => {
            const entry = {
                id: `log-${Date.now()}-${++counter}`,
                action,
                userId: data.userId,
                organizationId: data.organizationId,
                model: data.model || 'gpt-4',
                prompt: data.prompt,
                response: data.response,
                tokensUsed: data.tokensUsed || 0,
                cost: data.cost || 0,
                timestamp: new Date(),
                metadata: data.metadata || {}
            };
            logs.push(entry);

            // Track usage by org
            if (data.organizationId) {
                const orgUsage = usageByOrg.get(data.organizationId) || { tokens: 0, cost: 0, requests: 0 };
                orgUsage.tokens += entry.tokensUsed;
                orgUsage.cost += entry.cost;
                orgUsage.requests += 1;
                usageByOrg.set(data.organizationId, orgUsage);
            }

            return entry;
        },

        getLog: (id) => logs.find(l => l.id === id) || null,

        getLogs: (filters = {}) => {
            let result = [...logs];
            if (filters.organizationId) result = result.filter(l => l.organizationId === filters.organizationId);
            if (filters.userId) result = result.filter(l => l.userId === filters.userId);
            if (filters.action) result = result.filter(l => l.action === filters.action);
            if (filters.startDate) result = result.filter(l => l.timestamp >= filters.startDate);
            if (filters.endDate) result = result.filter(l => l.timestamp <= filters.endDate);
            return result.sort((a, b) => b.timestamp - a.timestamp);
        },

        getUsageByOrg: (organizationId) => usageByOrg.get(organizationId) || { tokens: 0, cost: 0, requests: 0 },

        getUsageSummary: () => {
            return {
                totalTokens: logs.reduce((sum, l) => sum + l.tokensUsed, 0),
                totalCost: logs.reduce((sum, l) => sum + l.cost, 0),
                totalRequests: logs.length,
                byModel: logs.reduce((acc, l) => {
                    acc[l.model] = (acc[l.model] || 0) + l.tokensUsed;
                    return acc;
                }, {})
            };
        },

        exportForCompliance: (filters = {}) => {
            const entries = filters.organizationId
                ? logs.filter(l => l.organizationId === filters.organizationId)
                : logs;
            return entries.map(e => ({
                id: e.id,
                action: e.action,
                userId: e.userId,
                timestamp: e.timestamp.toISOString(),
                tokensUsed: e.tokensUsed,
                cost: e.cost
            }));
        }
    };
};

describe('AIAuditLogger', () => {
    let auditLogger;

    beforeEach(() => {
        auditLogger = createAIAuditLogger();
    });

    describe('Action Logging', () => {
        it('should log AI action', () => {
            const log = auditLogger.log('generate', {
                userId: 'user-1',
                organizationId: 'org-1',
                prompt: 'Test prompt',
                tokensUsed: 500
            });

            expect(log.id).toBeDefined();
            expect(log.action).toBe('generate');
            expect(log.tokensUsed).toBe(500);
        });

        it('should track timestamp', () => {
            const log = auditLogger.log('chat', { userId: 'user-1' });
            expect(log.timestamp).toBeDefined();
        });

        it('should support different actions', () => {
            const actions = ['generate', 'chat', 'embed', 'analyze', 'summarize'];
            for (const action of actions) {
                const log = auditLogger.log(action, {});
                expect(log.action).toBe(action);
            }
        });
    });

    describe('Usage Tracking', () => {
        it('should track tokens used', () => {
            auditLogger.log('generate', { tokensUsed: 100 });
            auditLogger.log('generate', { tokensUsed: 200 });

            const summary = auditLogger.getUsageSummary();
            expect(summary.totalTokens).toBe(300);
        });

        it('should track cost', () => {
            auditLogger.log('generate', { cost: 0.01 });
            auditLogger.log('generate', { cost: 0.02 });

            const summary = auditLogger.getUsageSummary();
            expect(summary.totalCost).toBeCloseTo(0.03, 2);
        });

        it('should track usage by organization', () => {
            auditLogger.log('generate', { organizationId: 'org-1', tokensUsed: 100 });
            auditLogger.log('generate', { organizationId: 'org-1', tokensUsed: 200 });
            auditLogger.log('generate', { organizationId: 'org-2', tokensUsed: 50 });

            const org1Usage = auditLogger.getUsageByOrg('org-1');
            expect(org1Usage.tokens).toBe(300);
            expect(org1Usage.requests).toBe(2);
        });

        it('should track by model', () => {
            auditLogger.log('generate', { model: 'gpt-4', tokensUsed: 100 });
            auditLogger.log('generate', { model: 'claude-3', tokensUsed: 200 });

            const summary = auditLogger.getUsageSummary();
            expect(summary.byModel['gpt-4']).toBe(100);
            expect(summary.byModel['claude-3']).toBe(200);
        });
    });

    describe('Log Filtering', () => {
        it('should filter by organization', () => {
            auditLogger.log('generate', { organizationId: 'org-1' });
            auditLogger.log('generate', { organizationId: 'org-2' });

            const logs = auditLogger.getLogs({ organizationId: 'org-1' });
            expect(logs).toHaveLength(1);
        });

        it('should filter by action', () => {
            auditLogger.log('chat', {});
            auditLogger.log('embed', {});
            auditLogger.log('chat', {});

            const logs = auditLogger.getLogs({ action: 'chat' });
            expect(logs).toHaveLength(2);
        });
    });

    describe('Compliance Export', () => {
        it('should export for compliance', () => {
            auditLogger.log('generate', { userId: 'user-1', organizationId: 'org-1' });

            const exported = auditLogger.exportForCompliance();
            expect(exported).toHaveLength(1);
            expect(exported[0].timestamp).toBeDefined();
        });
    });
});

/**
 * Governance Audit Service Unit Tests
 * Step 14: Governance, Security & Enterprise Controls
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Import real modules
const GovernanceAuditService = require('../../server/services/governanceAuditService');
const db = require('../../server/database');

describe('GovernanceAuditService', () => {
    let dbGetSpy;
    let dbRunSpy;
    let dbAllSpy;

    beforeEach(() => {
        // Spy on database methods to prevent actual DB access and simulate behavior
        dbGetSpy = vi.spyOn(db, 'get').mockImplementation((sql, params, cb) => {
            // Default: Return null (no error, no result)
            cb(null, null);
        });

        dbRunSpy = vi.spyOn(db, 'run').mockImplementation(function (sql, params, cb) {
            // Default: successful run, changes=1, this context bound for 'this.changes'
            cb.call({ changes: 1 }, null);
        });

        dbAllSpy = vi.spyOn(db, 'all').mockImplementation((sql, params, cb) => {
            // Default: empty array
            cb(null, []);
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('logAudit', () => {
        it('should throw error for missing required parameters', async () => {
            await expect(GovernanceAuditService.logAudit({}))
                .rejects.toThrow('Missing required audit parameters');
        });

        it('should throw error for invalid action', async () => {
            await expect(GovernanceAuditService.logAudit({
                actorId: 'user-1',
                orgId: 'org-1',
                action: 'INVALID_ACTION',
                resourceType: 'POLICY_RULE'
            })).rejects.toThrow('Invalid action: INVALID_ACTION');
        });

        it('should log audit entry successfully', async () => {
            const result = await GovernanceAuditService.logAudit({
                actorId: 'user-1',
                actorRole: 'ADMIN',
                orgId: 'org-1',
                action: 'CREATE',
                resourceType: 'POLICY_RULE',
                resourceId: 'rule-1'
            });

            expect(result).toBeDefined();
            expect(result.actorId).toBe('user-1');
            expect(result.action).toBe('CREATE');

            // Verify DB interaction
            expect(dbRunSpy).toHaveBeenCalled();
            const insertCall = dbRunSpy.mock.calls.find(call => call[0].includes('INSERT INTO governance_audit_log'));
            expect(insertCall).toBeDefined();
        });
    });

    describe('getAuditLog', () => {
        it('should query with organization filter', async () => {
            let capturedSql = '';
            dbAllSpy.mockImplementation((sql, params, cb) => {
                capturedSql = sql;
                cb(null, []);
            });

            await GovernanceAuditService.getAuditLog({ orgId: 'org-1' });

            expect(capturedSql).toContain('organization_id = ?');
        });

        it('should bypass org filter for superadmin', async () => {
            let capturedSql = '';
            dbAllSpy.mockImplementation((sql, params, cb) => {
                capturedSql = sql;
                cb(null, []);
            });

            await GovernanceAuditService.getAuditLog({
                orgId: 'org-1',
                superadminBypass: true
            });

            expect(capturedSql).not.toContain('organization_id = ?');
        });

        it('should support action filter', async () => {
            let capturedParams = [];
            dbAllSpy.mockImplementation((sql, params, cb) => {
                capturedParams = params;
                cb(null, []);
            });

            await GovernanceAuditService.getAuditLog({
                orgId: 'org-1',
                action: 'TOGGLE'
            });

            expect(capturedParams).toContain('TOGGLE');
        });
    });

    describe('exportAuditLog', () => {
        it('should export as JSON by default', async () => {
            dbAllSpy.mockImplementation((sql, params, cb) => cb(null, []));

            const result = await GovernanceAuditService.exportAuditLog({
                orgId: 'org-1'
            });

            expect(result.format).toBe('json');
            expect(Array.isArray(result.data)).toBe(true);
        });

        it('should export as CSV when specified', async () => {
            dbAllSpy.mockImplementation((sql, params, cb) => cb(null, [{
                id: 'audit-1',
                organization_id: 'org-1',
                actor_id: 'user-1',
                actor_role: 'ADMIN',
                action: 'CREATE',
                resource_type: 'POLICY_RULE',
                resource_id: 'rule-1',
                correlation_id: 'corr-1',
                created_at: '2024-01-01T00:00:00Z'
            }]));

            const result = await GovernanceAuditService.exportAuditLog({
                orgId: 'org-1',
                format: 'csv'
            });

            expect(result.format).toBe('csv');
            expect(typeof result.data).toBe('string');
            expect(result.data).toContain('id,organization_id');
        });
    });
});

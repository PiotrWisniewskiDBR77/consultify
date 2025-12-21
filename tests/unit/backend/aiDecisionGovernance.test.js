import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { createMockDb } from '../../helpers/dependencyInjector.js';

const require = createRequire(import.meta.url);

describe('AI Decision Governance Service', () => {
    let AIDecisionGovernance;
    let mockDb;

    beforeEach(() => {
        vi.resetModules();

        mockDb = createMockDb();

        vi.doMock('../../../server/database', () => ({ default: mockDb }));

        AIDecisionGovernance = require('../../../server/services/aiDecisionGovernance.js');

        // Inject mock dependencies
        AIDecisionGovernance.setDependencies({
            db: mockDb,
            uuidv4: () => 'mock-uuid-1234'
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.doUnmock('../../../server/database');
    });

    describe('detectDecisionNeeded', () => {
        it('should detect phase transition decision', async () => {
            const context = {
                projectId: 'p-1',
                trigger: 'phase_transition'
            };

            const result = await AIDecisionGovernance.detectDecisionNeeded(context);

            expect(result.count).toBe(1);
            expect(result.decisionsNeeded[0].type).toBe('program');
        });

        it('should check DB for blocked task reason', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                if (sql.includes('tasks')) {
                    cb(null, { id: 't-1', blocked_reason: 'Waiting on resource' });
                } else {
                    cb(null, null);
                }
            });

            const context = {
                projectId: 'p-1',
                trigger: 'task_blocked',
                entityType: 'task',
                entityId: 't-1'
            };

            const result = await AIDecisionGovernance.detectDecisionNeeded(context);
            expect(result.count).toBe(1);
            expect(result.decisionsNeeded[0].reason).toContain('Waiting on resource');
        });
    });

    describe('getBlockingDecisions', () => {
        it('should calculate daysWaiting correctly', async () => {
            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() - 10);
            const mockRows = [{
                id: 'd-1',
                status: 'PENDING',
                created_at: oldDate.toISOString(),
                decision_owner_id: 'user-1',
                owner_first: 'John',
                owner_last: 'Doe',
                blocked_items: 0
            }];

            mockDb.all.mockImplementation((sql, params, cb) => cb(null, mockRows));

            const decisions = await AIDecisionGovernance.getBlockingDecisions('p-1');

            expect(decisions).toHaveLength(1);
            expect(decisions[0].daysWaiting).toBe(10);
        });
    });

    // SKIPPED: Complex mock chaining issues
    describe('prepareDecisionBrief', () => {
        it('should generate a brief and insert into DB', async () => {
            let callCount = 0;
            mockDb.get.mockImplementation((sql, params, cb) => {
                callCount++;
                const s = sql.toLowerCase();
                // Use process.nextTick for async callback
                process.nextTick(() => {
                    if (s.includes('from decisions')) {
                        return cb(null, {
                            id: 'd-1',
                            title: 'Go/No Go',
                            related_object_type: 'project',
                            related_object_id: 'p-1',
                            decision_type: 'strategic',
                            status: 'PENDING',
                            created_at: new Date().toISOString()
                        });
                    }
                    if (s.includes('from projects')) {
                        return cb(null, { name: 'Apollo' });
                    }
                    cb(null, null);
                });
            });

            mockDb.all.mockImplementation((sql, params, cb) => {
                // Use process.nextTick for async callback
                process.nextTick(() => {
                    if (sql.includes('decision_impacts')) {
                        cb(null, [{ description: 'Item', is_blocker: 1 }]);
                    } else {
                        cb(null, []);
                    }
                });
            });

            mockDb.run.mockImplementation(function (sql, params, cb) {
                // Use process.nextTick for async callback
                if (cb) {
                    process.nextTick(() => {
                        cb.call({ changes: 1, lastID: 1 }, null);
                    });
                }
            });

            const brief = await AIDecisionGovernance.prepareDecisionBrief('d-1');
            expect(brief.decision.title).toBe('Go/No Go');
            expect(brief.briefId).toBeDefined();
            expect(mockDb.run).toHaveBeenCalled();
        });
    });

    describe('registerImpact', () => {
        it('should record an impact with mocked UUID', async () => {
            mockDb.run.mockImplementation(function (sql, params, cb) {
                if (cb) cb.call({ changes: 1 }, null);
            });

            const result = await AIDecisionGovernance.registerImpact('d-1', {
                impactedType: 'task',
                impactedId: 't-1',
                description: 'Blocked',
                isBlocker: true
            });

            expect(result.id).toBe('mock-uuid-1234');
            expect(result.isBlocker).toBe(true);
        });
    });
});

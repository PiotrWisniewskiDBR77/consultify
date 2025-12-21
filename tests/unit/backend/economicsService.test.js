/**
 * Economics Service Tests
 * 
 * HIGH PRIORITY BUSINESS SERVICE - Must have 85%+ coverage
 * Tests value hypothesis management, financial assumptions, and value summaries.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { createMockDb, createMockUuid } from '../../helpers/dependencyInjector.js';
import { testUsers, testOrganizations, testProjects } from '../../fixtures/testData.js';

const require = createRequire(import.meta.url);

describe('EconomicsService', () => {
    let mockDb;
    let EconomicsService;
    let mockUuid;

    beforeEach(() => {
        mockDb = createMockDb();
        mockUuid = createMockUuid('hypothesis');

        vi.mock('../../../server/database', () => ({
            default: mockDb
        }));

        vi.mock('uuid', () => ({
            v4: mockUuid
        }));

        EconomicsService = require('../../../server/services/economicsService.js');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('createValueHypothesis()', () => {
        it('should create a value hypothesis', async () => {
            const hypothesis = {
                initiativeId: 'init-123',
                projectId: testProjects.project1.id,
                description: 'Reduce operational costs',
                type: EconomicsService.VALUE_TYPES.EFFICIENCY,
                confidenceLevel: 'HIGH',
                ownerId: testUsers.admin.id,
                relatedInitiativeIds: ['init-456']
            };

            mockDb.run.mockImplementation((query, params, callback) => {
                expect(query).toContain('INSERT INTO value_hypotheses');
                expect(params[0]).toBe('hypothesis-1'); // UUID
                expect(params[1]).toBe(hypothesis.initiativeId);
                expect(params[2]).toBe(hypothesis.projectId);
                expect(params[4]).toBe(hypothesis.type);
                expect(params[5]).toBe('HIGH');
                callback.call({ changes: 1 }, null);
            });

            const result = await EconomicsService.createValueHypothesis(hypothesis);

            expect(result.id).toBe('hypothesis-1');
            expect(result.initiativeId).toBe(hypothesis.initiativeId);
            expect(result.type).toBe(hypothesis.type);
        });

        it('should default confidenceLevel to MEDIUM', async () => {
            const hypothesis = {
                initiativeId: 'init-123',
                projectId: testProjects.project1.id,
                description: 'Test',
                type: EconomicsService.VALUE_TYPES.EFFICIENCY,
                ownerId: testUsers.admin.id
            };

            mockDb.run.mockImplementation((query, params, callback) => {
                expect(params[5]).toBe('MEDIUM');
                callback.call({ changes: 1 }, null);
            });

            await EconomicsService.createValueHypothesis(hypothesis);
        });

        it('should handle empty relatedInitiativeIds', async () => {
            const hypothesis = {
                initiativeId: 'init-123',
                projectId: testProjects.project1.id,
                description: 'Test',
                type: EconomicsService.VALUE_TYPES.EFFICIENCY,
                ownerId: testUsers.admin.id
            };

            mockDb.run.mockImplementation((query, params, callback) => {
                expect(JSON.parse(params[7])).toEqual([]);
                callback.call({ changes: 1 }, null);
            });

            await EconomicsService.createValueHypothesis(hypothesis);
        });

        it('should handle database errors', async () => {
            const hypothesis = {
                initiativeId: 'init-123',
                projectId: testProjects.project1.id,
                description: 'Test',
                type: EconomicsService.VALUE_TYPES.EFFICIENCY,
                ownerId: testUsers.admin.id
            };

            const dbError = new Error('Database error');
            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 0 }, dbError);
            });

            await expect(
                EconomicsService.createValueHypothesis(hypothesis)
            ).rejects.toThrow('Database error');
        });
    });

    describe('getValueHypotheses()', () => {
        it('should retrieve value hypotheses for a project', async () => {
            const projectId = testProjects.project1.id;
            const mockRows = [
                {
                    id: 'hyp-1',
                    initiative_id: 'init-1',
                    type: EconomicsService.VALUE_TYPES.EFFICIENCY,
                    related_initiative_ids: '["init-2"]',
                    first_name: 'John',
                    last_name: 'Doe',
                    initiative_name: 'Test Initiative'
                }
            ];

            mockDb.all.mockImplementation((query, params, callback) => {
                expect(query).toContain('SELECT vh.*');
                expect(query).toContain('WHERE vh.project_id = ?');
                expect(params[0]).toBe(projectId);
                callback(null, mockRows);
            });

            const result = await EconomicsService.getValueHypotheses(projectId);

            expect(result).toHaveLength(1);
            expect(result[0].relatedInitiativeIds).toEqual(['init-2']);
        });

        it('should filter by initiativeId when provided', async () => {
            const projectId = testProjects.project1.id;
            const initiativeId = 'init-123';

            mockDb.all.mockImplementation((query, params, callback) => {
                expect(query).toContain('AND vh.initiative_id = ?');
                expect(params).toContain(initiativeId);
                callback(null, []);
            });

            await EconomicsService.getValueHypotheses(projectId, initiativeId);
        });

        it('should handle invalid JSON in relatedInitiativeIds', async () => {
            const projectId = testProjects.project1.id;
            const mockRows = [
                {
                    id: 'hyp-1',
                    related_initiative_ids: 'invalid-json'
                }
            ];

            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, mockRows);
            });

            const result = await EconomicsService.getValueHypotheses(projectId);

            expect(result[0].relatedInitiativeIds).toEqual([]);
        });
    });

    describe('validateHypothesis()', () => {
        it('should validate a value hypothesis', async () => {
            const hypothesisId = 'hyp-123';
            const userId = testUsers.admin.id;

            mockDb.run.mockImplementation((query, params, callback) => {
                expect(query).toContain('UPDATE value_hypotheses');
                expect(query).toContain('is_validated = 1');
                expect(params[0]).toBe(userId);
                expect(params[1]).toBe(hypothesisId);
                callback.call({ changes: 1 }, null);
            });

            const result = await EconomicsService.validateHypothesis(hypothesisId, userId);

            expect(result.updated).toBe(true);
            expect(result.hypothesisId).toBe(hypothesisId);
        });

        it('should return false when hypothesis not found', async () => {
            const hypothesisId = 'nonexistent';
            const userId = testUsers.admin.id;

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 0 }, null);
            });

            const result = await EconomicsService.validateHypothesis(hypothesisId, userId);

            expect(result.updated).toBe(false);
        });
    });

    describe('addFinancialAssumption()', () => {
        it('should add financial assumption to hypothesis', async () => {
            const assumption = {
                valueHypothesisId: 'hyp-123',
                lowEstimate: 10000,
                expectedEstimate: 20000,
                highEstimate: 30000,
                currency: 'USD',
                timeframe: 'per year',
                notes: 'Based on historical data'
            };

            mockDb.run.mockImplementation((query, params, callback) => {
                expect(query).toContain('INSERT INTO financial_assumptions');
                expect(params[0]).toBe('hypothesis-1'); // UUID
                expect(params[1]).toBe(assumption.valueHypothesisId);
                expect(params[2]).toBe(assumption.lowEstimate);
                expect(params[3]).toBe(assumption.expectedEstimate);
                expect(params[4]).toBe(assumption.highEstimate);
                callback.call({ changes: 1 }, null);
            });

            const result = await EconomicsService.addFinancialAssumption(assumption);

            expect(result.id).toBe('hypothesis-1');
            expect(result.valueHypothesisId).toBe(assumption.valueHypothesisId);
        });

        it('should default currency to USD', async () => {
            const assumption = {
                valueHypothesisId: 'hyp-123',
                lowEstimate: 10000,
                expectedEstimate: 20000,
                highEstimate: 30000
            };

            mockDb.run.mockImplementation((query, params, callback) => {
                expect(params[5]).toBe('USD');
                callback.call({ changes: 1 }, null);
            });

            await EconomicsService.addFinancialAssumption(assumption);
        });

        it('should default timeframe to "per year"', async () => {
            const assumption = {
                valueHypothesisId: 'hyp-123',
                lowEstimate: 10000,
                expectedEstimate: 20000,
                highEstimate: 30000
            };

            mockDb.run.mockImplementation((query, params, callback) => {
                expect(params[6]).toBe('per year');
                callback.call({ changes: 1 }, null);
            });

            await EconomicsService.addFinancialAssumption(assumption);
        });
    });

    describe('detectMissingValueHypotheses()', () => {
        it('should detect initiatives without value hypotheses', async () => {
            const projectId = testProjects.project1.id;
            const mockRows = [
                { id: 'init-1', name: 'Initiative 1' },
                { id: 'init-2', name: 'Initiative 2' }
            ];

            mockDb.all.mockImplementation((query, params, callback) => {
                expect(query).toContain('LEFT JOIN value_hypotheses');
                expect(query).toContain('WHERE i.project_id = ?');
                expect(query).toContain("status NOT IN ('CANCELLED', 'DRAFT')");
                expect(params[0]).toBe(projectId);
                callback(null, mockRows);
            });

            const result = await EconomicsService.detectMissingValueHypotheses(projectId);

            expect(result.projectId).toBe(projectId);
            expect(result.count).toBe(2);
            expect(result.hasIssues).toBe(true);
            expect(result.initiativesWithoutValue).toHaveLength(2);
        });

        it('should return empty array when all initiatives have hypotheses', async () => {
            const projectId = testProjects.project1.id;

            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, []);
            });

            const result = await EconomicsService.detectMissingValueHypotheses(projectId);

            expect(result.count).toBe(0);
            expect(result.hasIssues).toBe(false);
        });
    });

    describe('getValueSummary()', () => {
        it('should generate value summary for project', async () => {
            const projectId = testProjects.project1.id;
            const mockByType = [
                { type: EconomicsService.VALUE_TYPES.EFFICIENCY, count: 2, validated: 1 }
            ];
            const mockFinancials = {
                total_low: 100000,
                total_expected: 200000,
                total_high: 300000
            };

            mockDb.all
                .mockImplementationOnce((query, params, callback) => {
                    // First call: byType
                    callback(null, mockByType);
                })
                .mockImplementationOnce((query, params, callback) => {
                    // Second call: detectMissingValueHypotheses
                    callback(null, []);
                });

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, mockFinancials);
            });

            const result = await EconomicsService.getValueSummary(projectId);

            expect(result.projectId).toBe(projectId);
            expect(result.hypothesesByType).toEqual(mockByType);
            expect(result.financialRange.low).toBe(100000);
            expect(result.financialRange.expected).toBe(200000);
            expect(result.financialRange.high).toBe(300000);
            expect(result.initiativesWithoutValue).toBe(0);
            expect(result.generatedAt).toBeDefined();
        });

        it('should handle missing financial data', async () => {
            const projectId = testProjects.project1.id;

            mockDb.all
                .mockImplementationOnce((query, params, callback) => {
                    callback(null, []);
                })
                .mockImplementationOnce((query, params, callback) => {
                    callback(null, []);
                });

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, null);
            });

            const result = await EconomicsService.getValueSummary(projectId);

            expect(result.financialRange.low).toBe(0);
            expect(result.financialRange.expected).toBe(0);
            expect(result.financialRange.high).toBe(0);
        });
    });

    describe('VALUE_TYPES', () => {
        it('should export VALUE_TYPES enum', () => {
            expect(EconomicsService.VALUE_TYPES).toBeDefined();
            expect(EconomicsService.VALUE_TYPES.COST_REDUCTION).toBe('COST_REDUCTION');
            expect(EconomicsService.VALUE_TYPES.REVENUE_INCREASE).toBe('REVENUE_INCREASE');
            expect(EconomicsService.VALUE_TYPES.RISK_REDUCTION).toBe('RISK_REDUCTION');
            expect(EconomicsService.VALUE_TYPES.EFFICIENCY).toBe('EFFICIENCY');
            expect(EconomicsService.VALUE_TYPES.STRATEGIC_OPTION).toBe('STRATEGIC_OPTION');
        });
    });

    describe('Multi-Tenant Isolation', () => {
        it('should filter hypotheses by project_id', async () => {
            const projectId = testProjects.project1.id;

            mockDb.all.mockImplementation((query, params, callback) => {
                expect(query).toContain('WHERE vh.project_id = ?');
                expect(params[0]).toBe(projectId);
                callback(null, []);
            });

            await EconomicsService.getValueHypotheses(projectId);
        });
    });
});

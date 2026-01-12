import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock database
const mockDb = vi.hoisted(() => ({
    get: vi.fn(),
    all: vi.fn(),
    run: vi.fn()
}));

const createMockDb = () => mockDb;

// Mock the database module
vi.mock('../../../../server/src/database/index.js', () => ({
    default: mockDb
}));

// Import service (will inject mock)
const StageGateServiceModule = await import('../../../../server/services/stageGateService.js');
const StageGateService = StageGateServiceModule.default;

describe('StageGateService', () => {
    let mockDb;

    beforeEach(() => {
        vi.clearAllMocks();
        mockDb = createMockDb();
        StageGateService.setDependencies({ db: mockDb });
    });

    describe('GATE_TYPES', () => {
        it('defines all required gate types', () => {
            expect(StageGateService.GATE_TYPES).toHaveProperty('READINESS_GATE');
            expect(StageGateService.GATE_TYPES).toHaveProperty('DESIGN_GATE');
            expect(StageGateService.GATE_TYPES).toHaveProperty('PLANNING_GATE');
            expect(StageGateService.GATE_TYPES).toHaveProperty('EXECUTION_GATE');
            expect(StageGateService.GATE_TYPES).toHaveProperty('CLOSURE_GATE');
        });
    });

    describe('PHASE_ORDER', () => {
        it('defines correct phase sequence', () => {
            expect(StageGateService.PHASE_ORDER).toEqual([
                'Context', 'Assessment', 'Initiatives', 'Roadmap', 'Execution', 'Stabilization'
            ]);
        });
    });

    describe('getGateType', () => {
        it('returns READINESS_GATE for Context to Assessment', () => {
            const result = StageGateService.getGateType('Context', 'Assessment');
            expect(result).toBe('READINESS_GATE');
        });

        it('returns DESIGN_GATE for Assessment to Initiatives', () => {
            const result = StageGateService.getGateType('Assessment', 'Initiatives');
            expect(result).toBe('DESIGN_GATE');
        });

        it('returns PLANNING_GATE for Initiatives to Roadmap', () => {
            const result = StageGateService.getGateType('Initiatives', 'Roadmap');
            expect(result).toBe('PLANNING_GATE');
        });

        it('returns EXECUTION_GATE for Roadmap to Execution', () => {
            const result = StageGateService.getGateType('Roadmap', 'Execution');
            expect(result).toBe('EXECUTION_GATE');
        });

        it('returns CLOSURE_GATE for Execution to Stabilization', () => {
            const result = StageGateService.getGateType('Execution', 'Stabilization');
            expect(result).toBe('CLOSURE_GATE');
        });

        it('handles Idea as Context alias', () => {
            const result = StageGateService.getGateType('Idea', 'Assessment');
            expect(result).toBe('READINESS_GATE');
        });

        it('returns null for invalid transition', () => {
            const result = StageGateService.getGateType('Context', 'Execution');
            expect(result).toBeNull();
        });
    });

    describe('evaluateGate', () => {
        const projectId = 'proj-1';

        describe('READINESS_GATE', () => {
            it('evaluates strategic goals criterion', async () => {
                mockDb.get
                    .mockImplementationOnce((sql, params, cb) => {
                        // Project query
                        cb(null, { id: projectId, name: 'Test Project' });
                    })
                    .mockImplementation((sql, params, cb) => {
                        // Context data query
                        cb(null, {
                            context_data: JSON.stringify({
                                strategicGoals: ['Goal 1', 'Goal 2'],
                                challenges: ['Challenge 1'],
                                constraints: ['Constraint 1']
                            })
                        });
                    });

                const result = await StageGateService.evaluateGate(projectId, 'READINESS_GATE');

                expect(result.gateType).toBe('READINESS_GATE');
                expect(result.projectId).toBe(projectId);
                expect(result.completionCriteria).toBeInstanceOf(Array);
                expect(result.completionCriteria.length).toBeGreaterThan(0);
            });

            it('marks criteria as not met when missing strategic goals', async () => {
                mockDb.get
                    .mockImplementationOnce((sql, params, cb) => {
                        cb(null, { id: projectId });
                    })
                    .mockImplementation((sql, params, cb) => {
                        cb(null, { context_data: JSON.stringify({ strategicGoals: [] }) });
                    });

                const result = await StageGateService.evaluateGate(projectId, 'READINESS_GATE');

                expect(result.status).toBe('NOT_READY');
                expect(result.missingElements.length).toBeGreaterThan(0);
            });

            it('returns READY when all criteria met', async () => {
                mockDb.get
                    .mockImplementationOnce((sql, params, cb) => {
                        cb(null, { id: projectId });
                    })
                    .mockImplementation((sql, params, cb) => {
                        cb(null, {
                            context_data: JSON.stringify({
                                strategicGoals: ['Goal 1'],
                                challenges: ['Challenge 1'],
                                constraints: ['Constraint 1']
                            })
                        });
                    });

                const result = await StageGateService.evaluateGate(projectId, 'READINESS_GATE');

                expect(result.status).toBe('READY');
                expect(result.missingElements.length).toBe(0);
            });
        });

        describe('DESIGN_GATE', () => {
            it('checks assessment completion', async () => {
                mockDb.get
                    .mockImplementationOnce((sql, params, cb) => {
                        cb(null, { id: projectId });
                    })
                    .mockImplementation((sql, params, cb) => {
                        if (sql.includes('maturity_assessments')) {
                            cb(null, { is_complete: 1 });
                        } else {
                            cb(null, null);
                        }
                    });

                const result = await StageGateService.evaluateGate(projectId, 'DESIGN_GATE');

                expect(result.gateType).toBe('DESIGN_GATE');
                expect(result.completionCriteria).toBeDefined();
            });
        });

        describe('PLANNING_GATE', () => {
            it('checks for initiatives', async () => {
                mockDb.get
                    .mockImplementationOnce((sql, params, cb) => {
                        cb(null, { id: projectId });
                    })
                    .mockImplementation((sql, params, cb) => {
                        if (sql.includes('COUNT')) {
                            cb(null, { cnt: 3 });
                        } else {
                            cb(null, null);
                        }
                    });

                const result = await StageGateService.evaluateGate(projectId, 'PLANNING_GATE');

                expect(result.gateType).toBe('PLANNING_GATE');
            });

            it('checks all initiatives have owners', async () => {
                mockDb.get
                    .mockImplementationOnce((sql, params, cb) => {
                        cb(null, { id: projectId });
                    })
                    .mockImplementation((sql, params, cb) => {
                        if (sql.includes('owner_business_id IS NULL')) {
                            cb(null, { cnt: 0 }); // No ownerless initiatives
                        } else if (sql.includes('COUNT')) {
                            cb(null, { cnt: 3 });
                        } else {
                            cb(null, null);
                        }
                    });

                const result = await StageGateService.evaluateGate(projectId, 'PLANNING_GATE');

                const ownerCriterion = result.completionCriteria.find(
                    c => c.criterion.includes('owners')
                );
                expect(ownerCriterion?.isMet).toBe(true);
            });
        });

        describe('EXECUTION_GATE', () => {
            it('checks roadmap is baselined', async () => {
                mockDb.get
                    .mockImplementationOnce((sql, params, cb) => {
                        cb(null, { id: projectId });
                    })
                    .mockImplementation((sql, params, cb) => {
                        if (sql.includes('roadmap_waves') && sql.includes('is_baselined')) {
                            cb(null, { cnt: 1 });
                        } else {
                            cb(null, { cnt: 0 });
                        }
                    });

                const result = await StageGateService.evaluateGate(projectId, 'EXECUTION_GATE');

                expect(result.gateType).toBe('EXECUTION_GATE');
            });

            it('checks all initiatives assigned to waves', async () => {
                mockDb.get
                    .mockImplementationOnce((sql, params, cb) => {
                        cb(null, { id: projectId });
                    })
                    .mockImplementation((sql, params, cb) => {
                        if (sql.includes('wave_id IS NULL')) {
                            cb(null, { cnt: 0 }); // No waveless initiatives
                        } else {
                            cb(null, { cnt: 1 });
                        }
                    });

                const result = await StageGateService.evaluateGate(projectId, 'EXECUTION_GATE');

                const waveCriterion = result.completionCriteria.find(
                    c => c.criterion.includes('waves')
                );
                expect(waveCriterion?.isMet).toBe(true);
            });
        });

        describe('CLOSURE_GATE', () => {
            it('checks all initiatives closed', async () => {
                mockDb.get
                    .mockImplementationOnce((sql, params, cb) => {
                        cb(null, { id: projectId });
                    })
                    .mockImplementation((sql, params, cb) => {
                        if (sql.includes('NOT IN (\'DONE\', \'CANCELLED\')')) {
                            cb(null, { cnt: 0 }); // All closed
                        } else {
                            cb(null, { cnt: 0 });
                        }
                    });

                const result = await StageGateService.evaluateGate(projectId, 'CLOSURE_GATE');

                expect(result.gateType).toBe('CLOSURE_GATE');
            });

            it('checks no blocking decisions', async () => {
                mockDb.get
                    .mockImplementationOnce((sql, params, cb) => {
                        cb(null, { id: projectId });
                    })
                    .mockImplementation((sql, params, cb) => {
                        if (sql.includes('decisions') && sql.includes('PENDING')) {
                            cb(null, { cnt: 0 }); // No pending decisions
                        } else {
                            cb(null, { cnt: 0 });
                        }
                    });

                const result = await StageGateService.evaluateGate(projectId, 'CLOSURE_GATE');

                const decisionCriterion = result.completionCriteria.find(
                    c => c.criterion.includes('decision')
                );
                expect(decisionCriterion?.isMet).toBe(true);
            });

            it('checks KPIs measured', async () => {
                mockDb.get
                    .mockImplementationOnce((sql, params, cb) => {
                        cb(null, { id: projectId });
                    })
                    .mockImplementation((sql, params, cb) => {
                        if (sql.includes('kpi_results')) {
                            cb(null, { cnt: 5 }); // Has KPIs
                        } else {
                            cb(null, { cnt: 0 });
                        }
                    });

                const result = await StageGateService.evaluateGate(projectId, 'CLOSURE_GATE');

                const kpiCriterion = result.completionCriteria.find(
                    c => c.criterion.includes('KPI')
                );
                expect(kpiCriterion?.isMet).toBe(true);
            });
        });

        describe('Error Handling', () => {
            it('throws error when project not found', async () => {
                mockDb.get.mockImplementation((sql, params, cb) => {
                    cb(null, null);
                });

                await expect(
                    StageGateService.evaluateGate(projectId, 'READINESS_GATE')
                ).rejects.toThrow('Project not found');
            });

            it('handles database errors', async () => {
                mockDb.get.mockImplementation((sql, params, cb) => {
                    cb(new Error('Database error'));
                });

                await expect(
                    StageGateService.evaluateGate(projectId, 'READINESS_GATE')
                ).rejects.toThrow('Database error');
            });
        });
    });

    describe('passGate', () => {
        const projectId = 'proj-1';
        const userId = 'user-1';

        it('records gate passage', async () => {
            mockDb.run
                .mockImplementationOnce((sql, params, cb) => {
                    cb.call({ lastID: 1 }, null);
                })
                .mockImplementationOnce((sql, params, cb) => {
                    cb(null);
                });

            const result = await StageGateService.passGate(
                projectId,
                'READINESS_GATE',
                userId,
                'Approved by PM'
            );

            expect(result).toHaveProperty('id');
            expect(result.gateType).toBe('READINESS_GATE');
            expect(result.status).toBe('PASSED');
            expect(result.toPhase).toBe('Assessment');
        });

        it('updates project phase after passing gate', async () => {
            mockDb.run
                .mockImplementationOnce((sql, params, cb) => {
                    cb.call({ lastID: 1 }, null);
                })
                .mockImplementationOnce((sql, params, cb) => {
                    // Verify phase update query
                    expect(sql).toContain('UPDATE projects');
                    expect(params).toContain('Assessment');
                    cb(null);
                });

            await StageGateService.passGate(projectId, 'READINESS_GATE', userId, 'Notes');
        });

        it('handles gate passage errors', async () => {
            mockDb.run.mockImplementation((sql, params, cb) => {
                cb(new Error('Insert failed'));
            });

            await expect(
                StageGateService.passGate(projectId, 'READINESS_GATE', userId, '')
            ).rejects.toThrow('Insert failed');
        });

        it('handles phase update errors', async () => {
            mockDb.run
                .mockImplementationOnce((sql, params, cb) => {
                    cb.call({ lastID: 1 }, null);
                })
                .mockImplementationOnce((sql, params, cb) => {
                    cb(new Error('Update failed'));
                });

            await expect(
                StageGateService.passGate(projectId, 'READINESS_GATE', userId, '')
            ).rejects.toThrow('Update failed');
        });
    });

    describe('Helper Methods', () => {
        describe('_checkContextField', () => {
            it('validates array fields correctly', async () => {
                mockDb.get.mockImplementation((sql, params, cb) => {
                    cb(null, {
                        context_data: JSON.stringify({ testField: ['item1', 'item2'] })
                    });
                });

                const result = await StageGateService._checkContextField(
                    'proj-1',
                    'testField',
                    arr => arr && arr.length > 0
                );

                expect(result).toBe(true);
            });

            it('handles missing context data', async () => {
                mockDb.get.mockImplementation((sql, params, cb) => {
                    cb(null, { context_data: null });
                });

                const result = await StageGateService._checkContextField(
                    'proj-1',
                    'testField',
                    arr => arr && arr.length > 0
                );

                expect(result).toBe(false);
            });

            it('handles invalid JSON', async () => {
                mockDb.get.mockImplementation((sql, params, cb) => {
                    cb(null, { context_data: 'invalid json' });
                });

                const result = await StageGateService._checkContextField(
                    'proj-1',
                    'testField',
                    arr => arr && arr.length > 0
                );

                expect(result).toBe(false);
            });
        });

        describe('_checkContextReadiness', () => {
            it('returns true when goals and challenges present', async () => {
                mockDb.get.mockImplementation((sql, params, cb) => {
                    cb(null, {
                        context_data: JSON.stringify({
                            strategicGoals: ['Goal'],
                            challenges: ['Challenge']
                        })
                    });
                });

                const result = await StageGateService._checkContextReadiness('proj-1');

                expect(result).toBe(true);
            });

            it('returns false when goals missing', async () => {
                mockDb.get.mockImplementation((sql, params, cb) => {
                    cb(null, {
                        context_data: JSON.stringify({
                            strategicGoals: [],
                            challenges: ['Challenge']
                        })
                    });
                });

                const result = await StageGateService._checkContextReadiness('proj-1');

                expect(result).toBe(false);
            });
        });

        describe('_countInitiatives', () => {
            it('returns initiative count', async () => {
                mockDb.get.mockImplementation((sql, params, cb) => {
                    cb(null, { cnt: 5 });
                });

                const result = await StageGateService._countInitiatives('proj-1');

                expect(result).toBe(5);
            });

            it('returns 0 when no initiatives', async () => {
                mockDb.get.mockImplementation((sql, params, cb) => {
                    cb(null, null);
                });

                const result = await StageGateService._countInitiatives('proj-1');

                expect(result).toBe(0);
            });
        });
    });
});











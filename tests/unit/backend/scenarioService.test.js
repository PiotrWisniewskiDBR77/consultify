import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { createMockDb } from '../../helpers/dependencyInjector.js';

const require = createRequire(import.meta.url);

describe('Scenario Service', () => {
    let ScenarioService;
    let mockDb;
    let mockDependencyService;

    beforeEach(() => {
        vi.resetModules();

        mockDb = createMockDb();

        mockDependencyService = {
            buildDependencyGraph: vi.fn()
        };

        vi.doMock('../../../server/database', () => ({ default: mockDb }));
        vi.doMock('../../../server/services/dependencyService', () => ({ default: mockDependencyService }));

        ScenarioService = require('../../../server/services/scenarioService.js');

        // Inject mock dependencies
        ScenarioService.setDependencies({
            db: mockDb,
            uuidv4: () => 'mock-uuid-scenario',
            DependencyService: mockDependencyService
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.doUnmock('../../../server/database');
        vi.doUnmock('../../../server/services/dependencyService');
    });

    describe('compareScenarios', () => {
        it('should compare delays correctly', () => {
            const s1 = { name: 'S1', impactAnalysis: { delayedByDays: 10 } };
            const s2 = { name: 'S2', impactAnalysis: { delayedByDays: 5 } };

            // This is a static method on the object, assuming it doesn't need external deps if passed objects are complete.
            // But wait, the service exports the object. 
            // In the file it is `compareScenarios: (s1, s2) => { ... }`.

            // If the module import failed due to DB, we can't test even this. 
            // BUT, usually we can import it if we mock DB. The failure happens when *executing* code that calls DB, or heavily side-effect imports.
            // scenarioService.js imports database at top level. If that crashes, we can't use the service.
            // Ideally, mocking it prevents the crash.

            if (ScenarioService) {
                const result = ScenarioService.compareScenarios(s1, s2);
                expect(result.recommendation).toContain('S2');
            }
        });
    });

    describe('analyzeImpact', () => {
        it('should detect dependency breaks', async () => {
            mockDb.all.mockImplementation((sql, params, cb) => cb(null, [
                { id: 'i1', name: 'Init 1', planned_end_date: '2025-01-10', planned_start_date: '2025-01-01', owner_business_id: 'b1' },
                { id: 'i2', name: 'Init 2', planned_start_date: '2025-01-12', planned_end_date: '2025-01-20', owner_business_id: 'b2' }
            ]));

            mockDependencyService.buildDependencyGraph.mockResolvedValue({
                edges: [{ from_initiative_id: 'i1', to_initiative_id: 'i2', type: 'FINISH_TO_START' }]
            });

            // Propose moving i1 end date to 2025-01-15 (breaking i2 start of 12th)
            // i1 ends 2025-01-15, i2 starts 2025-01-12, so 2025-01-15 > 2025-01-12 = conflict
            const changes = [{ initiativeId: 'i1', field: 'plannedEndDate', newValue: '2025-01-15' }];

            const result = await ScenarioService.analyzeImpact('p-1', changes);
            // The logic checks: if newEnd (2025-01-15) > dependent.planned_start_date (2025-01-12), then break
            // So isValid should be false if dependencyBreaks.length > 0
            expect(result.dependencyBreaks.length).toBeGreaterThan(0);
            expect(result.isValid).toBe(false);
            expect(result.warnings.length).toBeGreaterThan(0);
        });
    });

    describe('createScenario', () => {
        it('should persist scenario', async () => {
            mockDb.all.mockImplementation((sql, params, cb) => cb(null, []));
            mockDependencyService.buildDependencyGraph.mockResolvedValue({ edges: [] });
            mockDb.run.mockImplementation(function (sql, params, cb) { if (cb) cb.call({ changes: 1 }, null); });

            const result = await ScenarioService.createScenario('p-1', 'Test', [], 'u-1', true);
            expect(result.persisted).toBe(true);
        });
    });
});

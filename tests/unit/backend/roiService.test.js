import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks for dependency injection
const mockUuidv4 = vi.hoisted(() => vi.fn(() => 'uuid-1234'));

const mockDb = vi.hoisted(() => ({
    get: vi.fn(),
    all: vi.fn(),
    run: vi.fn(),
    serialize: vi.fn((cb) => cb()),
    initPromise: Promise.resolve()
}));

vi.mock('../../../server/database', () => ({
    default: mockDb
}));

vi.mock('uuid', () => ({
    v4: mockUuidv4
}));

import ROIService from '../../../server/services/roiService.js';

describe('ROIService', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Inject mock dependencies
        ROIService.setDependencies({
            db: mockDb,
            uuidv4: mockUuidv4
        });

        mockDb.get.mockImplementation((sql, params, callback) => {
            const cb = typeof callback === 'function' ? callback : (typeof params === 'function' ? params : null);
            if (typeof cb === 'function') cb(null, null);
        });

        mockDb.run.mockImplementation(function (sql, params, callback) {
            const cb = typeof callback === 'function' ? callback : (typeof params === 'function' ? params : null);
            if (typeof cb === 'function') cb.call({ changes: 1 }, null);
        });
    });

    describe('getDefaultModel', () => {
        it('should return existing model if found', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                const cb = typeof callback === 'function' ? callback : (typeof params === 'function' ? params : null);
                if (typeof cb === 'function') {
                    cb(null, { 
                        id: 'roi-1',
                        org_id: 'org-1',
                        name: 'Test Model',
                        assumptions: JSON.stringify({ hourly_cost: 100 }),
                        metric_mappings: JSON.stringify({}),
                        is_default: 1
                    });
                }
            });

            const model = await ROIService.getDefaultModel('org-1');
            expect(model.assumptions.hourly_cost).toBe(100);
        });

        it('should create default model if missing', async () => {
            // get returns null (default mock), so it should create default
            // Reset mock to ensure it returns null
            mockDb.get.mockImplementation((sql, params, callback) => {
                const cb = typeof callback === 'function' ? callback : (typeof params === 'function' ? params : null);
                if (typeof cb === 'function') cb(null, null);
            });

            const model = await ROIService.getDefaultModel('org-1');
            expect(model.assumptions.hourly_cost).toBeDefined(); // Should have defaults (75)
            expect(model.assumptions.hourly_cost).toBe(75);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO roi_models'),
                expect.any(Array),
                expect.any(Function)
            );
        });
    });

    describe('calculateROI', () => {
        it('should calculate ROI based on measurements', async () => {
            const measurements = [
                { 
                    metric_type: 'TIME_SAVED_MINUTES', 
                    delta_json: JSON.stringify({ time_saved_mins: 60 }) // 1 hour
                }
            ];

            // Mock getDefaultModel call - check SQL to route correctly
            mockDb.get.mockImplementation((sql, params, callback) => {
                const cb = typeof callback === 'function' ? callback : (typeof params === 'function' ? params : null);
                const sqlStr = typeof sql === 'string' ? sql : '';
                
                if (typeof cb === 'function') {
                    if (sqlStr.includes('is_default = 1')) {
                        // Return model for getDefaultModel
                        cb(null, {
                            id: 'roi-1',
                            org_id: 'org-1',
                            name: 'Default ROI Model',
                            assumptions: JSON.stringify({
                                hourly_cost: 100,
                                task_avg_time_mins: 30
                            }),
                            metric_mappings: JSON.stringify({
                                time_saved_mins: { formula: 'value * (hourly_cost / 60)', label: 'Time Saved' }
                            }),
                            is_default: 1
                        });
                    } else {
                        cb(null, null);
                    }
                }
            });

            const result = await ROIService.calculateROI('org-1', measurements);

            // 60 mins * (100 / 60) = 100
            expect(result.total_value).toBe(100);
            expect(result.breakdown).toBeDefined();
        });
    });

    describe('estimateHoursSaved', () => {
        it('should aggregate time saved metrics', async () => {
            // Use mockImplementationOnce for sequential calls - reset mock first
            mockDb.get.mockReset();
            mockDb.get
                .mockImplementationOnce((sql, params, callback) => {
                    const cb = typeof callback === 'function' ? callback : (typeof params === 'function' ? params : null);
                    if (typeof cb === 'function') {
                        // First call: getDefaultModel
                        cb(null, {
                            id: 'roi-1',
                            org_id: 'org-1',
                            name: 'Default ROI Model',
                            assumptions: JSON.stringify({ hourly_cost: 75, task_avg_time_mins: 30 }),
                            metric_mappings: JSON.stringify({}),
                            is_default: 1
                        });
                    }
                })
                .mockImplementationOnce((sql, params, callback) => {
                    const cb = typeof callback === 'function' ? callback : (typeof params === 'function' ? params : null);
                    if (typeof cb === 'function') {
                        // Second call: aggregation query
                        cb(null, { time_saved_mins: 120, tasks_delta: 0, measurement_count: 1 }); // 120 minutes = 2 hours
                    }
                })
                .mockImplementation((sql, params, callback) => {
                    const cb = typeof callback === 'function' ? callback : (typeof params === 'function' ? params : null);
                    if (typeof cb === 'function') {
                        cb(null, null);
                    }
                });

            const result = await ROIService.estimateHoursSaved('org-1');
            expect(result.hours_saved).toBe(2); // 120 minutes = 2 hours
        });
    });
});

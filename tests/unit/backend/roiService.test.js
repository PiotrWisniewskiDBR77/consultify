import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
const mockDb = {
    get: vi.fn(),
    all: vi.fn(),
    run: vi.fn(),
    serialize: vi.fn((cb) => cb()),
    initPromise: Promise.resolve()
};

vi.mock('../../../server/database', () => ({
    default: mockDb
}));

import ROIService from '../../../server/services/roiService.js';

describe('ROIService', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mockDb.get.mockImplementation((...args) => {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') cb(null, null);
        });
    });

    describe('getDefaultModel', () => {
        it('should return existing model if found', async () => {
            mockDb.get.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, { assumptions: JSON.stringify({ hourlyRate: 100 }) });
                }
            });

            const model = await ROIService.getDefaultModel('org-1');
            expect(model.assumptions.hourlyRate).toBe(100);
        });

        it('should create default model if missing', async () => {
            // get returns null (default mock)

            mockDb.run.mockImplementation(function (...args) {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') cb.call({ changes: 1 }, null);
            });

            const model = await ROIService.getDefaultModel('org-1');
            expect(model.assumptions.hourly_rate).toBeDefined(); // Should have defaults
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
                { metric_type: 'TIME_SAVED_MINUTES', value: 60 }, // 1 hour
                { metric_type: 'COST_AVOIDANCE', value: 500 }
            ];

            // Mock model assumptions
            mockDb.get.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, {
                        assumptions: JSON.stringify({
                            hourly_rate: 100,
                            task_avg_time_mins: 30
                        })
                    });
                }
            });

            const result = await ROIService.calculateROI('org-1', measurements);

            // 1 hour * $100/hr = $100
            // + $500 cost avoidance
            // Total benefit = 600

            expect(result.totalValue).toBe(600);
            expect(result.components.timeValue).toBe(100);
        });
    });

    describe('estimateHoursSaved', () => {
        it('should aggregate time saved metrics', async () => {
            mockDb.get.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, { total_minutes: 120 }); // 2 hours
                }
            });

            const result = await ROIService.estimateHoursSaved('org-1');
            expect(result.hours).toBe(2);
        });
    });
});

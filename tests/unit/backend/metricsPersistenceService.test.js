// Mock dependencies (using globals)

// Load real middleware
const performanceMetrics = require('../../../server/middleware/performanceMetrics');

// Load service
const MetricsPersistenceService = require('../../../server/services/metricsPersistenceService');

describe('MetricsPersistenceService', () => {
    // Manually create mock DB
    const mockDb = {
        run: vi.fn((query, params, cb) => cb.call({ lastID: 1 }, null)),
        all: vi.fn((query, params, cb) => cb(null, []))
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.run.mockClear();
        mockDb.all.mockClear();

        // Spy on middleware methods
        vi.spyOn(performanceMetrics, 'getMetricsSummary').mockReturnValue({
            totalRequests: 100,
            avgResponseTime: 50,
            errorRate: 0,
            slowRequests: 0,
            avgDbQueryTime: 10,
            avgDbQueryCount: 2
        });
        vi.spyOn(performanceMetrics, 'getMemoryMetrics').mockReturnValue({
            heapUsed: 100,
            rss: 200
        });
        vi.spyOn(performanceMetrics, 'resetMetrics').mockImplementation(() => { });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('saveSnapshot should insert data into DB', async () => {
        // Inject mockDb
        const result = await MetricsPersistenceService.saveSnapshot(true, mockDb);
        expect(result).toBe(true);

        // Verify DB call
        expect(mockDb.run).toHaveBeenCalledTimes(1);
        const [query, params] = mockDb.run.mock.calls[0];

        expect(query).toContain('INSERT INTO metrics_snapshots');
        expect(params).toHaveLength(10);
        // params: [timestamp, window, requests, response_time, error_rate, slow, heap, rss, db_time, db_count]
        expect(params[2]).toBe(100); // total_requests
        expect(params[6]).toBe(100); // heap

        // Verify reset called
        expect(performanceMetrics.resetMetrics).toHaveBeenCalled();
    });

    it('getHistory should query DB', async () => {
        const days = 7;
        // Inject mockDb
        await MetricsPersistenceService.getHistory(days, mockDb);

        expect(mockDb.all).toHaveBeenCalledTimes(1);
        const [query, params] = mockDb.all.mock.calls[0];

        expect(query).toContain('SELECT * FROM metrics_snapshots');
        try {
            expect(params[0]).toBe(`-${days} days`);
        } catch (e) {
            expect(query).toContain(`timestamp > datetime('now', ?)`);
        }
    });
});

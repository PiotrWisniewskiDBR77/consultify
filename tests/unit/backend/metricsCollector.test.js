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

vi.mock('uuid', () => ({
    v4: () => 'uuid-1234'
}));

import MetricsCollector from '../../../server/services/metricsCollector.js';

describe('MetricsCollector', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mockDb.run.mockImplementation(function (...args) {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') cb.call({ changes: 1 }, null);
        });

        mockDb.all.mockImplementation((...args) => {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') cb(null, []);
        });

        mockDb.get.mockImplementation((...args) => {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') cb(null, { count: 0 });
        });
    });

    describe('recordEvent', () => {
        it('should record event successfully', async () => {
            const result = await MetricsCollector.recordEvent('TEST_EVENT', {
                userId: 'user-1',
                source: 'DEMO'
            });

            expect(result.eventId).toBe('uuid-1234');
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO metrics_events'),
                expect.any(Array),
                expect.any(Function)
            );
        });

        it('should throw on database error', async () => {
            mockDb.run.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') cb(new Error('Insert failed'));
            });

            await expect(MetricsCollector.recordEvent('TEST_EVENT', {}))
                .rejects.toThrow('Insert failed');
        });
    });

    describe('getEvents', () => {
        it('should fetch events with filters', async () => {
            mockDb.all.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, [{ id: 'e1', event_type: 'TEST_EVENT' }]);
                }
            });

            const events = await MetricsCollector.getEvents('TEST_EVENT', { startDate: '2024-01-01' });

            expect(events).toHaveLength(1);
            expect(mockDb.all).toHaveBeenCalledWith(
                expect.stringContaining('WHERE event_type = ?'),
                expect.any(Array),
                expect.any(Function)
            );
        });
    });

    describe('getEventCount', () => {
        it('should return count', async () => {
            mockDb.get.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, { count: 42 });
                }
            });

            const count = await MetricsCollector.getEventCount('TEST_EVENT');
            expect(count).toBe(42);
        });
    });
});

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

import { LegalEventLogger } from '../../../server/services/legalEventLogger.js';

describe('LegalEventLogger', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        
        // Inject mocked dependencies
        LegalEventLogger._setDependencies({
            db: mockDb,
            uuidv4: mockUuidv4
        });

        mockDb.run.mockImplementation(function (...args) {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') cb.call({ changes: 1 }, null);
        });

        mockDb.all.mockImplementation((...args) => {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') cb(null, []);
        });
    });

    describe('log', () => {
        it('should append log entry', async () => {
            const eventId = await LegalEventLogger.log({
                eventType: 'test_event', // Custom type just for testing generic log flow if validation allows, else use real type
                // Actually EVENT_TYPES check might warn but still insert or fail depending on IMPLEMENTATION
                // Snippet says: "if (!Object.values...includes) warn". So it proceeds.
                performedBy: 'user-1'
            });

            expect(eventId).toBe('uuid-1234');
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO legal_events'),
                expect.any(Array),
                expect.any(Function)
            );
        });
    });

    describe('logAccept', () => {
        it('should log user acceptance', async () => {
            const eventId = await LegalEventLogger.logAccept(
                'doc-1', '1.0', 'user-1', 'org-1', 'user-1'
            );

            expect(eventId).toBe('uuid-1234');
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
                expect.arrayContaining(['accept', 'doc-1', 'user-1']),
                expect.any(Function)
            );
        });
    });

    describe('getEvents', () => {
        it('should fetch events with filters', async () => {
            mockDb.all.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, [{ id: 'e1' }]);
                }
            });

            const events = await LegalEventLogger.getEvents({ userId: 'user-1' });

            expect(events).toHaveLength(1);
            expect(mockDb.all).toHaveBeenCalledWith(
                expect.stringContaining('AND user_id = ?'),
                expect.arrayContaining(['user-1']),
                expect.any(Function)
            );
        });
    });
});

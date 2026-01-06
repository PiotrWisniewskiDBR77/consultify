// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';

// We do not need to mock modules anymore, just pass mock DB logic
const mockDbInstance = {
    all: vi.fn(),
    run: vi.fn()
};

vi.mock('../../../../server/ai/logger.js', () => ({
    aiLogger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn()
    }
}));

// We still import the class, assuming it handles the require of db safely 
// (it does: require is top level, but constructor uses passed value)
// Note: importing persistentSessionStore WILL trigger the real DB require.
// But as we saw, real DB connect is fine in memory. We just don't want to USE it.
// We want to verify logic using OUR mock.

describe('PersistentSessionStore', () => {
    let PersistentSessionStore;
    let store;

    beforeEach(async () => {
        vi.clearAllMocks();

        // Dynamic import to ensure fresh module if needed, though class is stateless mostly
        const mod = await import('../../../../server/ai/persistentSessionStore.js');
        PersistentSessionStore = mod.PersistentSessionStore || mod.default;

        // INJECT MOCK DB
        store = new PersistentSessionStore(mockDbInstance);
    });

    describe('getRecentContext()', () => {
        it('should fetch and format messages from database', async () => {
            const mockRows = [
                { role: 'user', content: 'Hello', created_at: '2024-01-01T10:00:00Z', metadata: '{}' },
                { role: 'assistant', content: 'Hi there', created_at: '2024-01-01T10:01:00Z', metadata: '{}' }
            ];

            mockDbInstance.all.mockImplementation((sql, params, callback) => {
                callback(null, [mockRows[1], mockRows[0]]);
            });

            const context = await store.getRecentContext('user-1', 10);

            expect(mockDbInstance.all).toHaveBeenCalled();
            expect(context.length).toBe(2);
            expect(context[0].content).toContain('Hello');
            expect(context[1].content).toContain('Hi there');
        });

        it('should handle database errors gracefully', async () => {
            mockDbInstance.all.mockImplementation((sql, params, callback) => {
                callback(new Error('DB Error'), null);
            });

            const context = await store.getRecentContext('user-1');
            expect(context).toEqual([]);
        });
    });

    describe('addMessage()', () => {
        it('should insert message into database', async () => {
            mockDbInstance.run.mockImplementation((sql, params, callback) => {
                callback(null);
            });

            const message = { role: 'user', content: 'Test message' };
            await store.addMessage('user-1', message);

            expect(mockDbInstance.run).toHaveBeenCalled();
            const sql = mockDbInstance.run.mock.calls[0][0];
            expect(sql).toContain('INSERT INTO conversation_history');
        });
    });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateRateLimiter, acceptRateLimiter, recordAcceptFailure } from '../../../../server/middleware/invitationRateLimiter';

// Mock RedisStore to allow controlling state
const mockStoreMethods = {
    get: vi.fn(),
    set: vi.fn(),
    increment: vi.fn(),
    delete: vi.fn()
};

vi.mock('../../../../server/src/utils/RedisStore.js', () => {
    return {
        default: class RedisStore {
            constructor(prefix) {
                this.prefix = prefix;
                this.store = new Map();
            }
            async get(key) {
                mockStoreMethods.get(key);
                return this.store.get(key) || null;
            }
            async set(key, value) {
                mockStoreMethods.set(key, value);
                this.store.set(key, String(value));
            }
            async increment(key) {
                mockStoreMethods.increment(key);
                const val = Number(this.store.get(key) || 0) + 1;
                this.store.set(key, String(val));
                return val;
            }
            async delete(key) {
                mockStoreMethods.delete(key);
                this.store.delete(key);
            }
        }
    };
});

describe('Invitation Rate Limiter', () => {
    let req;
    let res;
    let next;

    beforeEach(() => {
        req = { ip: '1.2.3.4', headers: {} };
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
            set: vi.fn()
        };
        next = vi.fn();
        vi.useFakeTimers();

        // Clear mocks
        Object.values(mockStoreMethods).forEach(m => m.mockClear());

        // We can't easily clear the internal state of the module-scoped stores
        // without re-importing. However, our simulated RedisStore is created 
        // at module load time. 
        // For unit testing, a better approach might be dependent injection 
        // or resetting modules. For now, we rely on unique IPs or assuming 
        // state resets if we could re-import. 
        // To simplify, we'll try to rely on isolation or unique keys if needed.
        // Actually, since we mocked the class, the instances in the module 
        // are already created. We can't access them to clear them.
        // Workaround: Use a new IP for each test or rely on mocking return values purely?
        // No, our mock implementation uses a Map. 
        // The implementation in the mock above uses `this.store = new Map()`.
        // The *instances* are created once when module loads.
        // We need a way to clear them.
    });

    // Instead of complex state verification of internals, we verify functional behavior.
    // Issue: The module-level instances persist across tests.
    // Fix: We reset modules before each test to get fresh instances.

    beforeEach(async () => {
        vi.resetModules();
        await import('../../../../server/middleware/invitationRateLimiter');
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    describe('validateRateLimiter', () => {
        it('should allow requests under limit', async () => {
            const { validateRateLimiter } = await import('../../../../server/middleware/invitationRateLimiter');
            await validateRateLimiter(req, res, next);
            expect(next).toHaveBeenCalled();
        });

        it('should block requests over limit', async () => {
            const { validateRateLimiter } = await import('../../../../server/middleware/invitationRateLimiter');

            // Fill quota (20)
            for (let i = 0; i < 20; i++) {
                await validateRateLimiter(req, res, next);
            }
            expect(next).toHaveBeenCalledTimes(20);
            next.mockClear();

            // Exceed quota
            await validateRateLimiter(req, res, next);
            expect(res.status).toHaveBeenCalledWith(429);
            expect(next).not.toHaveBeenCalled();
        });
    });

    describe('acceptRateLimiter', () => {
        it('should allow if not blocked', async () => {
            const { acceptRateLimiter } = await import('../../../../server/middleware/invitationRateLimiter');
            await acceptRateLimiter(req, res, next);
            expect(next).toHaveBeenCalled();
        });

        it('should block if IP is blocked', async () => {
            const { acceptRateLimiter, recordAcceptFailure } = await import('../../../../server/middleware/invitationRateLimiter');

            // Fail 5 times to trigger block
            for (let i = 0; i < 5; i++) {
                await recordAcceptFailure(req);
            }

            // Verify blocked
            await acceptRateLimiter(req, res, next);
            expect(res.status).toHaveBeenCalledWith(429);
            expect(next).not.toHaveBeenCalled();
        });
    });
});

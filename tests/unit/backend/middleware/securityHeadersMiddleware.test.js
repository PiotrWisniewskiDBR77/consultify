import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { securityHeaders, createRateLimiter, validateRequest } from '../../../../server/middleware/securityHeadersMiddleware';

// Mock RedisStore
vi.mock('../../../../server/src/utils/RedisStore.js', () => {
    return {
        default: class RedisStore {
            constructor() {
                this.store = new Map();
            }
            async get(key) { return this.store.get(key) || null; }
            async increment(key) {
                const val = Number(this.store.get(key) || 0) + 1;
                this.store.set(key, String(val));
                return val;
            }
        }
    };
});

describe('Security Headers Middleware', () => {
    let req;
    let res;
    let next;

    beforeEach(() => {
        req = { ip: '127.0.0.1', path: '/test', body: {} };
        res = {
            setHeader: vi.fn(),
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };
        next = vi.fn();
        vi.useFakeTimers();
        vi.resetModules(); // Ensure clean state
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    describe('securityHeaders', () => {
        it('should set standard security headers', () => {
            securityHeaders(req, res, next);

            expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
            expect(res.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
            expect(next).toHaveBeenCalled();
        });
    });

    describe('createRateLimiter', () => {
        it('should allow requests under the limit', async () => {
            const limiter = createRateLimiter({ windowMs: 1000, max: 2 });

            await limiter(req, res, next);
            expect(next).toHaveBeenCalled();
            expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 1);

            next.mockClear();
            await limiter(req, res, next);
            expect(next).toHaveBeenCalled();
            expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 0);
        });

        it('should block requests over the limit', async () => {
            const limiter = createRateLimiter({ windowMs: 1000, max: 1 });

            await limiter(req, res, next); // 1st OK
            next.mockClear();

            await limiter(req, res, next); // 2nd Blocked

            expect(res.status).toHaveBeenCalledWith(429);
            expect(next).not.toHaveBeenCalled();
        });
    });

    describe('validateRequest', () => {
        it('should call next if validation passes', () => {
            const schema = { name: { required: true, type: 'string' } };
            req.body = { name: 'Test' };
            const validator = validateRequest(schema);

            validator(req, res, next);
            expect(next).toHaveBeenCalled();
        });

        it('should return 400 if required field is missing', () => {
            const schema = { name: { required: true } };
            req.body = {};
            const validator = validateRequest(schema);

            validator(req, res, next);
            expect(res.status).toHaveBeenCalledWith(400);
        });
    });
});

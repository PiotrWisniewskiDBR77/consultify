import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { securityHeaders, createRateLimiter, validateRequest } from '../../../../server/middleware/securityHeadersMiddleware';

describe('Security Headers Middleware', () => {
    let req;
    let res;
    let next;

    beforeEach(() => {
        req = { ip: '127.0.0.1', path: '/test' };
        res = {
            setHeader: vi.fn(),
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };
        next = vi.fn();
        vi.useFakeTimers();
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
            expect(res.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
            expect(res.setHeader).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin');
            expect(res.setHeader).toHaveBeenCalledWith('Content-Security-Policy', expect.stringContaining("default-src 'self'"));
            expect(next).toHaveBeenCalled();
        });

        it('should set HSTS in production', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';

            securityHeaders(req, res, next);
            expect(res.setHeader).toHaveBeenCalledWith('Strict-Transport-Security', expect.stringContaining('max-age='));

            process.env.NODE_ENV = originalEnv;
        });

        it('should NOT set HSTS in non-production', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';

            securityHeaders(req, res, next);
            expect(res.setHeader).not.toHaveBeenCalledWith('Strict-Transport-Security', expect.any(String));

            process.env.NODE_ENV = originalEnv;
        });
    });

    describe('createRateLimiter', () => {
        it('should allow requests under the limit', () => {
            const limiter = createRateLimiter({ windowMs: 1000, max: 2 });

            limiter(req, res, next);
            expect(next).toHaveBeenCalled();
            expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 1);

            next.mockClear();
            limiter(req, res, next);
            expect(next).toHaveBeenCalled();
            expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 0);
        });

        it('should block requests over the limit', () => {
            const limiter = createRateLimiter({ windowMs: 1000, max: 1 });

            limiter(req, res, next); // 1st OK
            next.mockClear();

            limiter(req, res, next); // 2nd Blocked

            expect(res.status).toHaveBeenCalledWith(429);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'RATE_LIMITED' }));
            expect(next).not.toHaveBeenCalled();
        });

        it('should reset after windowMs', () => {
            const limiter = createRateLimiter({ windowMs: 1000, max: 1 });

            limiter(req, res, next); // 1st OK

            // Advance time past window
            vi.advanceTimersByTime(1100);

            next.mockClear();
            res.setHeader.mockClear();

            limiter(req, res, next); // Should be OK again

            expect(next).toHaveBeenCalled();
            expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 0);
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
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Validation failed' }));
            expect(next).not.toHaveBeenCalled();
        });

        it('should return 400 if type is incorrect', () => {
            const schema = { age: { type: 'number' } };
            req.body = { age: 'not-a-number' };
            const validator = validateRequest(schema);

            validator(req, res, next);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ details: expect.arrayContaining([expect.objectContaining({ field: 'age' })]) }));
        });

        it('should validate enum values', () => {
            const schema = { role: { enum: ['admin', 'user'] } };
            req.body = { role: 'superadmin' };
            const validator = validateRequest(schema);

            validator(req, res, next);
            expect(res.status).toHaveBeenCalledWith(400);
        });
    });
});

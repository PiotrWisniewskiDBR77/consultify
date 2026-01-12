import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateRateLimiter, acceptRateLimiter, recordAcceptFailure, _validateRateLimits, _acceptFailures } from '../../../../server/middleware/invitationRateLimiter';

describe('Invitation Rate Limiter', () => {
    let req;
    let res;
    let next;

    beforeEach(() => {
        req = { ip: '1.2.3.4' };
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
            set: vi.fn()
        };
        next = vi.fn();
        vi.useFakeTimers();
        _validateRateLimits.clear();
        _acceptFailures.clear();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    describe('validateRateLimiter', () => {
        it('should allow requests under limit', () => {
            validateRateLimiter(req, res, next);
            expect(next).toHaveBeenCalled();
            expect(_validateRateLimits.get('1.2.3.4').count).toBe(1);
        });

        it('should block requests over limit', () => {
            // Fill quota
            for (let i = 0; i < 20; i++) {
                validateRateLimiter(req, res, next);
            }
            expect(next).toHaveBeenCalledTimes(20);
            next.mockClear();

            // Exceed quota
            validateRateLimiter(req, res, next);
            expect(res.status).toHaveBeenCalledWith(429);
            expect(next).not.toHaveBeenCalled();
        });

        it('should reset quota after window', () => {
            // Fill quota
            for (let i = 0; i < 20; i++) {
                validateRateLimiter(req, res, next);
            }

            vi.advanceTimersByTime(10 * 60 * 1000 + 100); // 10 min +
            next.mockClear();
            res.status.mockClear();

            validateRateLimiter(req, res, next);
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });
    });

    describe('acceptRateLimiter', () => {
        it('should allow if not blocked', () => {
            acceptRateLimiter(req, res, next);
            expect(next).toHaveBeenCalled();
        });

        it('should block if IP is blocked', () => {
            _acceptFailures.set('1.2.3.4', { blockedUntil: Date.now() + 10000 });

            acceptRateLimiter(req, res, next);
            expect(res.status).toHaveBeenCalledWith(429);
            expect(next).not.toHaveBeenCalled();
        });

        it('should unblock after expiration', () => {
            const now = Date.now();
            _acceptFailures.set('1.2.3.4', { blockedUntil: now + 5000 });

            vi.setSystemTime(now + 6000);

            acceptRateLimiter(req, res, next);
            expect(next).toHaveBeenCalled();
        });
    });

    describe('recordAcceptFailure', () => {
        it('should track failures and block', () => {
            // 4 failures
            for (let i = 0; i < 4; i++) {
                recordAcceptFailure(req);
            }
            let data = _acceptFailures.get('1.2.3.4');
            expect(data.count).toBe(4);
            expect(data.blockedUntil).toBeUndefined();

            // 5th failure -> Block
            recordAcceptFailure(req);
            data = _acceptFailures.get('1.2.3.4');
            expect(data.count).toBe(5);
            expect(data.blockedUntil).toBeDefined();
        });
    });
});

/**
 * Rate Limiter Tests
 * Tests for rate limiting implementations
 * 
 * @module tests/limits/rate-limiter.test.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Token bucket rate limiter
const createTokenBucket = (options = {}) => {
    const { capacity = 10, refillRate = 1, refillInterval = 1000 } = options;

    let tokens = capacity;
    let lastRefill = Date.now();

    const refill = () => {
        const now = Date.now();
        const elapsed = now - lastRefill;
        const tokensToAdd = Math.floor(elapsed / refillInterval) * refillRate;

        if (tokensToAdd > 0) {
            tokens = Math.min(capacity, tokens + tokensToAdd);
            lastRefill = now;
        }
    };

    return {
        consume: (count = 1) => {
            refill();

            if (tokens >= count) {
                tokens -= count;
                return { allowed: true, remaining: tokens };
            }

            return { allowed: false, remaining: tokens };
        },

        getTokens: () => {
            refill();
            return tokens;
        },

        reset: () => {
            tokens = capacity;
            lastRefill = Date.now();
        },
    };
};

// Sliding window rate limiter
const createSlidingWindow = (options = {}) => {
    const { windowSize = 60000, maxRequests = 100 } = options;
    const requests = new Map(); // userId -> timestamps[]

    return {
        isAllowed: (userId) => {
            const now = Date.now();
            const windowStart = now - windowSize;

            // Get user's request history
            let userRequests = requests.get(userId) || [];

            // Remove expired entries
            userRequests = userRequests.filter(ts => ts > windowStart);

            if (userRequests.length >= maxRequests) {
                requests.set(userId, userRequests);
                return {
                    allowed: false,
                    remaining: 0,
                    resetAt: userRequests[0] + windowSize,
                };
            }

            // Record new request
            userRequests.push(now);
            requests.set(userId, userRequests);

            return {
                allowed: true,
                remaining: maxRequests - userRequests.length,
            };
        },

        getRemaining: (userId) => {
            const now = Date.now();
            const windowStart = now - windowSize;
            const userRequests = (requests.get(userId) || [])
                .filter(ts => ts > windowStart);
            return maxRequests - userRequests.length;
        },

        reset: (userId) => {
            if (userId) {
                requests.delete(userId);
            } else {
                requests.clear();
            }
        },
    };
};

// Fixed window rate limiter
const createFixedWindow = (options = {}) => {
    const { windowSize = 60000, maxRequests = 100 } = options;
    const windows = new Map(); // userId -> { count, windowStart }

    return {
        isAllowed: (userId) => {
            const now = Date.now();
            const windowStart = Math.floor(now / windowSize) * windowSize;

            let window = windows.get(userId);

            // New window
            if (!window || window.windowStart !== windowStart) {
                window = { count: 0, windowStart };
            }

            if (window.count >= maxRequests) {
                windows.set(userId, window);
                return {
                    allowed: false,
                    remaining: 0,
                    resetAt: windowStart + windowSize,
                };
            }

            window.count++;
            windows.set(userId, window);

            return {
                allowed: true,
                remaining: maxRequests - window.count,
            };
        },

        reset: (userId) => {
            if (userId) {
                windows.delete(userId);
            } else {
                windows.clear();
            }
        },
    };
};

describe('Rate Limiter Tests', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // ═══════════════════════════════════════════════════════════════════
    // TOKEN BUCKET
    // ═══════════════════════════════════════════════════════════════════

    describe('Token Bucket', () => {
        let limiter;

        beforeEach(() => {
            limiter = createTokenBucket({ capacity: 5, refillRate: 1, refillInterval: 1000 });
        });

        it('should allow requests within capacity', () => {
            const result = limiter.consume();

            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(4);
        });

        it('should deny when out of tokens', () => {
            for (let i = 0; i < 5; i++) {
                limiter.consume();
            }

            const result = limiter.consume();

            expect(result.allowed).toBe(false);
            expect(result.remaining).toBe(0);
        });

        it('should refill tokens over time', () => {
            for (let i = 0; i < 5; i++) {
                limiter.consume();
            }

            vi.advanceTimersByTime(2000);

            const result = limiter.consume();
            expect(result.allowed).toBe(true);
        });

        it('should not exceed capacity', () => {
            vi.advanceTimersByTime(10000);

            expect(limiter.getTokens()).toBe(5);
        });

        it('should consume multiple tokens', () => {
            const result = limiter.consume(3);

            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(2);
        });

        it('should reset tokens', () => {
            for (let i = 0; i < 5; i++) {
                limiter.consume();
            }

            limiter.reset();

            expect(limiter.getTokens()).toBe(5);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // SLIDING WINDOW
    // ═══════════════════════════════════════════════════════════════════

    describe('Sliding Window', () => {
        let limiter;

        beforeEach(() => {
            limiter = createSlidingWindow({ windowSize: 10000, maxRequests: 5 });
        });

        it('should allow requests within limit', () => {
            const result = limiter.isAllowed('user-1');

            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(4);
        });

        it('should deny when limit exceeded', () => {
            for (let i = 0; i < 5; i++) {
                limiter.isAllowed('user-1');
            }

            const result = limiter.isAllowed('user-1');

            expect(result.allowed).toBe(false);
            expect(result.remaining).toBe(0);
        });

        it('should track users separately', () => {
            for (let i = 0; i < 5; i++) {
                limiter.isAllowed('user-1');
            }

            const result = limiter.isAllowed('user-2');

            expect(result.allowed).toBe(true);
        });

        it('should allow after window slides', () => {
            for (let i = 0; i < 5; i++) {
                limiter.isAllowed('user-1');
            }

            vi.advanceTimersByTime(12000);

            const result = limiter.isAllowed('user-1');
            expect(result.allowed).toBe(true);
        });

        it('should get remaining requests', () => {
            limiter.isAllowed('user-1');
            limiter.isAllowed('user-1');

            expect(limiter.getRemaining('user-1')).toBe(3);
        });

        it('should reset user', () => {
            for (let i = 0; i < 5; i++) {
                limiter.isAllowed('user-1');
            }

            limiter.reset('user-1');

            expect(limiter.getRemaining('user-1')).toBe(5);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // FIXED WINDOW
    // ═══════════════════════════════════════════════════════════════════

    describe('Fixed Window', () => {
        let limiter;

        beforeEach(() => {
            limiter = createFixedWindow({ windowSize: 10000, maxRequests: 5 });
        });

        it('should allow requests within window limit', () => {
            const result = limiter.isAllowed('user-1');

            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(4);
        });

        it('should deny when window limit exceeded', () => {
            for (let i = 0; i < 5; i++) {
                limiter.isAllowed('user-1');
            }

            const result = limiter.isAllowed('user-1');

            expect(result.allowed).toBe(false);
        });

        it('should reset at window boundary', () => {
            for (let i = 0; i < 5; i++) {
                limiter.isAllowed('user-1');
            }

            vi.advanceTimersByTime(10000);

            const result = limiter.isAllowed('user-1');
            expect(result.allowed).toBe(true);
        });

        it('should include reset time in response', () => {
            for (let i = 0; i < 5; i++) {
                limiter.isAllowed('user-1');
            }

            const result = limiter.isAllowed('user-1');

            expect(result.resetAt).toBeDefined();
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // EDGE CASES
    // ═══════════════════════════════════════════════════════════════════

    describe('Edge Cases', () => {
        it('should handle concurrent requests', () => {
            const limiter = createSlidingWindow({ maxRequests: 2 });

            // Simulate concurrent requests
            const results = [
                limiter.isAllowed('user-1'),
                limiter.isAllowed('user-1'),
                limiter.isAllowed('user-1'),
            ];

            expect(results[0].allowed).toBe(true);
            expect(results[1].allowed).toBe(true);
            expect(results[2].allowed).toBe(false);
        });

        it('should handle very high request rates', () => {
            const limiter = createTokenBucket({ capacity: 1000 });

            for (let i = 0; i < 1000; i++) {
                limiter.consume();
            }

            expect(limiter.consume().allowed).toBe(false);
        });
    });
});

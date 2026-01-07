/**
 * Circuit Breaker Tests
 * Tests for circuit breaker pattern implementation
 * 
 * @module tests/resilience/circuit-breaker.test.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Circuit breaker states
const STATES = {
    CLOSED: 'closed',
    OPEN: 'open',
    HALF_OPEN: 'half-open',
};

// Circuit breaker implementation
const createCircuitBreaker = (options = {}) => {
    const {
        failureThreshold = 5,
        successThreshold = 2,
        timeout = 30000,
        onStateChange = () => { },
    } = options;

    let state = STATES.CLOSED;
    let failures = 0;
    let successes = 0;
    let lastFailureTime = null;
    let totalRequests = 0;
    let totalFailures = 0;
    let totalSuccesses = 0;

    const trip = () => {
        if (state !== STATES.OPEN) {
            const previousState = state;
            state = STATES.OPEN;
            lastFailureTime = Date.now();
            onStateChange({ from: previousState, to: STATES.OPEN });
        }
    };

    const reset = () => {
        const previousState = state;
        state = STATES.CLOSED;
        failures = 0;
        successes = 0;
        if (previousState !== STATES.CLOSED) {
            onStateChange({ from: previousState, to: STATES.CLOSED });
        }
    };

    const halfOpen = () => {
        const previousState = state;
        state = STATES.HALF_OPEN;
        successes = 0;
        onStateChange({ from: previousState, to: STATES.HALF_OPEN });
    };

    return {
        getState: () => state,
        getFailures: () => failures,
        getSuccesses: () => successes,

        execute: async (fn) => {
            totalRequests++;

            // Check if should transition from open to half-open
            if (state === STATES.OPEN) {
                if (Date.now() - lastFailureTime >= timeout) {
                    halfOpen();
                } else {
                    throw new Error('Circuit breaker is open');
                }
            }

            try {
                const result = await fn();

                totalSuccesses++;

                if (state === STATES.HALF_OPEN) {
                    successes++;
                    if (successes >= successThreshold) {
                        reset();
                    }
                } else {
                    failures = 0; // Reset on success in closed state
                }

                return result;
            } catch (error) {
                totalFailures++;
                failures++;

                if (state === STATES.HALF_OPEN) {
                    trip();
                } else if (failures >= failureThreshold) {
                    trip();
                }

                throw error;
            }
        },

        isOpen: () => state === STATES.OPEN,
        isClosed: () => state === STATES.CLOSED,
        isHalfOpen: () => state === STATES.HALF_OPEN,

        trip,
        reset,

        getStats: () => ({
            state,
            failures,
            successes,
            totalRequests,
            totalFailures,
            totalSuccesses,
            lastFailureTime,
        }),
    };
};

describe('Circuit Breaker Tests', () => {
    let breaker;

    beforeEach(() => {
        vi.useFakeTimers();
        breaker = createCircuitBreaker({
            failureThreshold: 3,
            successThreshold: 2,
            timeout: 1000,
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // ═══════════════════════════════════════════════════════════════════
    // INITIAL STATE
    // ═══════════════════════════════════════════════════════════════════

    describe('Initial State', () => {
        it('should start closed', () => {
            expect(breaker.getState()).toBe(STATES.CLOSED);
            expect(breaker.isClosed()).toBe(true);
        });

        it('should have zero failures', () => {
            expect(breaker.getFailures()).toBe(0);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // SUCCESS
    // ═══════════════════════════════════════════════════════════════════

    describe('Successful Execution', () => {
        it('should execute function', async () => {
            const result = await breaker.execute(() => 'success');
            expect(result).toBe('success');
        });

        it('should stay closed on success', async () => {
            await breaker.execute(() => 'ok');
            expect(breaker.isClosed()).toBe(true);
        });

        it('should reset failure count on success', async () => {
            await breaker.execute(() => { throw new Error('fail'); }).catch(() => { });
            await breaker.execute(() => { throw new Error('fail'); }).catch(() => { });

            await breaker.execute(() => 'ok');

            expect(breaker.getFailures()).toBe(0);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // FAILURE & TRIP
    // ═══════════════════════════════════════════════════════════════════

    describe('Failure & Trip', () => {
        it('should increment failures', async () => {
            await breaker.execute(() => { throw new Error('fail'); }).catch(() => { });
            expect(breaker.getFailures()).toBe(1);
        });

        it('should trip after threshold', async () => {
            for (let i = 0; i < 3; i++) {
                await breaker.execute(() => { throw new Error('fail'); }).catch(() => { });
            }

            expect(breaker.isOpen()).toBe(true);
        });

        it('should reject when open', async () => {
            breaker.trip();

            await expect(breaker.execute(() => 'ok'))
                .rejects.toThrow('Circuit breaker is open');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // HALF-OPEN STATE
    // ═══════════════════════════════════════════════════════════════════

    describe('Half-Open State', () => {
        it('should transition to half-open after timeout', async () => {
            breaker.trip();

            vi.advanceTimersByTime(1000);

            // This attempt should transition to half-open
            await breaker.execute(() => 'ok').catch(() => { });

            // State should be closed or half-open now
            expect(breaker.isOpen()).toBe(false);
        });

        it('should close after success threshold', async () => {
            breaker.trip();
            vi.advanceTimersByTime(1000);

            // Execute twice to meet success threshold
            await breaker.execute(() => 'ok');
            await breaker.execute(() => 'ok');

            expect(breaker.isClosed()).toBe(true);
        });

        it('should trip again on failure in half-open', async () => {
            breaker.trip();
            vi.advanceTimersByTime(1000);

            await breaker.execute(() => { throw new Error('fail'); }).catch(() => { });

            expect(breaker.isOpen()).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // MANUAL TRIP/RESET
    // ═══════════════════════════════════════════════════════════════════

    describe('Manual Trip/Reset', () => {
        it('should manually trip', () => {
            breaker.trip();
            expect(breaker.isOpen()).toBe(true);
        });

        it('should manually reset', () => {
            breaker.trip();
            breaker.reset();
            expect(breaker.isClosed()).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // STATE CHANGE CALLBACK
    // ═══════════════════════════════════════════════════════════════════

    describe('State Change Callback', () => {
        it('should call callback on state change', async () => {
            const callback = vi.fn();
            const cbBreaker = createCircuitBreaker({
                failureThreshold: 1,
                onStateChange: callback,
            });

            await cbBreaker.execute(() => { throw new Error('fail'); }).catch(() => { });

            expect(callback).toHaveBeenCalledWith({
                from: STATES.CLOSED,
                to: STATES.OPEN,
            });
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // STATS
    // ═══════════════════════════════════════════════════════════════════

    describe('Stats', () => {
        it('should track total requests', async () => {
            await breaker.execute(() => 'ok');
            await breaker.execute(() => 'ok');

            expect(breaker.getStats().totalRequests).toBe(2);
        });

        it('should track total successes', async () => {
            await breaker.execute(() => 'ok');
            await breaker.execute(() => { throw new Error('fail'); }).catch(() => { });

            expect(breaker.getStats().totalSuccesses).toBe(1);
        });

        it('should track total failures', async () => {
            await breaker.execute(() => { throw new Error('fail'); }).catch(() => { });
            await breaker.execute(() => { throw new Error('fail'); }).catch(() => { });

            expect(breaker.getStats().totalFailures).toBe(2);
        });
    });
});

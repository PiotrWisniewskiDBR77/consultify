/**
 * Debounce / Throttle Tests
 * Tests for rate control utilities
 * 
 * @module tests/timing/debounce-throttle.test.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Debounce implementation
const debounce = (fn, wait, options = {}) => {
    const { leading = false, trailing = true, maxWait } = options;
    let timeoutId = null;
    let lastCallTime = null;
    let lastInvokeTime = 0;
    let result;
    let lastArgs;
    let lastThis;

    const shouldInvoke = (time) => {
        const timeSinceLastCall = time - (lastCallTime || 0);
        const timeSinceLastInvoke = time - lastInvokeTime;

        return (
            lastCallTime === null ||
            timeSinceLastCall >= wait ||
            (maxWait !== undefined && timeSinceLastInvoke >= maxWait)
        );
    };

    const invoke = (time) => {
        lastInvokeTime = time;
        result = fn.apply(lastThis, lastArgs);
        lastArgs = lastThis = null;
        return result;
    };

    const startTimer = (pendingFunc, wait) => {
        return setTimeout(pendingFunc, wait);
    };

    const cancelTimer = () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
    };

    const debounced = function (...args) {
        const time = Date.now();
        lastArgs = args;
        lastThis = this;
        lastCallTime = time;

        const isInvoking = shouldInvoke(time);

        if (isInvoking) {
            if (!timeoutId && leading) {
                return invoke(time);
            }
        }

        if (!timeoutId && trailing) {
            timeoutId = startTimer(() => {
                timeoutId = null;
                if (trailing && lastArgs) {
                    invoke(Date.now());
                }
            }, wait);
        }

        return result;
    };

    debounced.cancel = () => {
        cancelTimer();
        lastArgs = lastThis = null;
        lastCallTime = null;
    };

    debounced.flush = () => {
        if (timeoutId && lastArgs) {
            cancelTimer();
            return invoke(Date.now());
        }
        return result;
    };

    debounced.pending = () => timeoutId !== null;

    return debounced;
};

// Throttle implementation
const throttle = (fn, wait, options = {}) => {
    const { leading = true, trailing = true } = options;
    let lastInvokeTime = 0;
    let timeoutId = null;
    let lastArgs;
    let lastThis;
    let result;

    const invoke = () => {
        lastInvokeTime = Date.now();
        result = fn.apply(lastThis, lastArgs);
        lastArgs = lastThis = null;
        return result;
    };

    const throttled = function (...args) {
        const time = Date.now();
        const timeSinceLastInvoke = time - lastInvokeTime;
        lastArgs = args;
        lastThis = this;

        if (timeSinceLastInvoke >= wait) {
            if (leading) {
                return invoke();
            }
            lastInvokeTime = time;
        }

        if (!timeoutId && trailing) {
            const remaining = wait - timeSinceLastInvoke;
            timeoutId = setTimeout(() => {
                timeoutId = null;
                if (lastArgs) {
                    invoke();
                }
            }, remaining > 0 ? remaining : wait);
        }

        return result;
    };

    throttled.cancel = () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        lastArgs = lastThis = null;
    };

    return throttled;
};

describe('Debounce / Throttle Tests', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // ═══════════════════════════════════════════════════════════════════
    // DEBOUNCE - BASIC
    // ═══════════════════════════════════════════════════════════════════

    describe('Debounce - Basic', () => {
        it('should delay execution', () => {
            const fn = vi.fn();
            const debounced = debounce(fn, 100);

            debounced();
            expect(fn).not.toHaveBeenCalled();

            vi.advanceTimersByTime(100);
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should only execute once for rapid calls', () => {
            const fn = vi.fn();
            const debounced = debounce(fn, 100);

            debounced();
            debounced();
            debounced();

            vi.advanceTimersByTime(100);
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should pass last arguments', () => {
            const fn = vi.fn();
            const debounced = debounce(fn, 100);

            debounced('first');
            debounced('second');
            debounced('third');

            vi.advanceTimersByTime(100);
            expect(fn).toHaveBeenCalledWith('third');
        });

        it('should reset timer on each call', () => {
            const fn = vi.fn();
            const debounced = debounce(fn, 100);

            debounced();
            vi.advanceTimersByTime(50);
            debounced();
            vi.advanceTimersByTime(50);
            debounced();
            vi.advanceTimersByTime(50);

            expect(fn).not.toHaveBeenCalled();

            vi.advanceTimersByTime(50);
            expect(fn).toHaveBeenCalledTimes(1);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // DEBOUNCE - LEADING
    // ═══════════════════════════════════════════════════════════════════

    describe('Debounce - Leading', () => {
        it('should execute immediately with leading', () => {
            const fn = vi.fn();
            const debounced = debounce(fn, 100, { leading: true, trailing: false });

            debounced();
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should not execute again during wait', () => {
            const fn = vi.fn();
            const debounced = debounce(fn, 100, { leading: true, trailing: false });

            debounced();
            debounced();
            debounced();

            expect(fn).toHaveBeenCalledTimes(1);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // DEBOUNCE - CANCEL
    // ═══════════════════════════════════════════════════════════════════

    describe('Debounce - Cancel', () => {
        it('should cancel pending execution', () => {
            const fn = vi.fn();
            const debounced = debounce(fn, 100);

            debounced();
            debounced.cancel();

            vi.advanceTimersByTime(100);
            expect(fn).not.toHaveBeenCalled();
        });

        it('should report pending status', () => {
            const fn = vi.fn();
            const debounced = debounce(fn, 100);

            expect(debounced.pending()).toBe(false);
            debounced();
            expect(debounced.pending()).toBe(true);
            vi.advanceTimersByTime(100);
            expect(debounced.pending()).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // DEBOUNCE - FLUSH
    // ═══════════════════════════════════════════════════════════════════

    describe('Debounce - Flush', () => {
        it('should flush immediately', () => {
            const fn = vi.fn().mockReturnValue('result');
            const debounced = debounce(fn, 100);

            debounced('arg');
            const result = debounced.flush();

            expect(fn).toHaveBeenCalledWith('arg');
            expect(result).toBe('result');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // THROTTLE - BASIC
    // ═══════════════════════════════════════════════════════════════════

    describe('Throttle - Basic', () => {
        it('should execute immediately', () => {
            const fn = vi.fn();
            const throttled = throttle(fn, 100);

            throttled();
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should limit execution rate', () => {
            const fn = vi.fn();
            const throttled = throttle(fn, 100);

            throttled();
            throttled();
            throttled();

            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should execute again after wait', () => {
            const fn = vi.fn();
            const throttled = throttle(fn, 100);

            throttled();
            vi.advanceTimersByTime(100);
            throttled();

            expect(fn).toHaveBeenCalledTimes(2);
        });

        it('should execute trailing call', () => {
            const fn = vi.fn();
            const throttled = throttle(fn, 100);

            throttled('first');
            throttled('second');
            throttled('third');

            vi.advanceTimersByTime(100);

            expect(fn).toHaveBeenCalledTimes(2);
            expect(fn).toHaveBeenLastCalledWith('third');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // THROTTLE - OPTIONS
    // ═══════════════════════════════════════════════════════════════════

    describe('Throttle - Options', () => {
        it('should skip leading with option', () => {
            const fn = vi.fn();
            const throttled = throttle(fn, 100, { leading: false });

            throttled();
            expect(fn).not.toHaveBeenCalled();

            vi.advanceTimersByTime(100);
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should skip trailing with option', () => {
            const fn = vi.fn();
            const throttled = throttle(fn, 100, { trailing: false });

            throttled();
            throttled();
            throttled();

            vi.advanceTimersByTime(100);
            expect(fn).toHaveBeenCalledTimes(1);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // THROTTLE - CANCEL
    // ═══════════════════════════════════════════════════════════════════

    describe('Throttle - Cancel', () => {
        it('should cancel pending trailing call', () => {
            const fn = vi.fn();
            const throttled = throttle(fn, 100);

            throttled();
            throttled();
            throttled.cancel();

            vi.advanceTimersByTime(100);
            expect(fn).toHaveBeenCalledTimes(1);
        });
    });
});

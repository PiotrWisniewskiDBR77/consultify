/**
 * Circuit Breaker Service
 * 
 * Implements the Circuit Breaker pattern to handle failures of external services (LLMs, Search, etc).
 * States: CLOSED (Normal), OPEN (Failing Fast), HALF_OPEN (Testing recovery)
 * 
 * "Resilience is not the absence of failure, but the management of it."
 */

const STATES = {
    CLOSED: 'CLOSED',
    OPEN: 'OPEN',
    HALF_OPEN: 'HALF_OPEN'
};

class CircuitBreaker {
    constructor(name, options = {}) {
        this.name = name;
        this.failureThreshold = options.failureThreshold || 5;
        this.resetTimeout = options.resetTimeout || 30000; // 30 seconds
        this.successThreshold = options.successThreshold || 2;

        this.state = STATES.CLOSED;
        this.failures = 0;
        this.successes = 0;
        this.lastFailureTime = null;
        this.nextAttemptTime = null;
    }

    /**
     * Execute a function within the circuit breaker
     */
    async execute(fn) {
        if (this.state === STATES.OPEN) {
            if (Date.now() > this.nextAttemptTime) {
                this.state = STATES.HALF_OPEN;
                console.log(`[CircuitBreaker:${this.name}] Transitioned to HALF_OPEN (Testing recovery)`);
            } else {
                const timeRemaining = Math.round((this.nextAttemptTime - Date.now()) / 1000);
                const err = new Error(`Circuit breaker [${this.name}] is OPEN. Next attempt in ${timeRemaining}s`);
                err.isCircuitOpen = true;
                err.breakerName = this.name;
                throw err;
            }
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            // Only count "system" failures as circuit breakers
            // Authentication or Budget errors should probably NOT trip the breaker
            if (this._isSystemFailure(error)) {
                this.onFailure(error);
            }
            throw error;
        }
    }

    onSuccess() {
        this.failures = 0;
        if (this.state === STATES.HALF_OPEN) {
            this.successes++;
            if (this.successes >= this.successThreshold) {
                this.state = STATES.CLOSED;
                this.successes = 0;
                console.log(`[CircuitBreaker:${this.name}] Transitioned to CLOSED (Recovered fully)`);
            }
        }
    }

    onFailure(error) {
        this.failures++;
        this.lastFailureTime = Date.now();

        if (this.state === STATES.HALF_OPEN || this.failures >= this.failureThreshold) {
            this.state = STATES.OPEN;
            this.nextAttemptTime = Date.now() + this.resetTimeout;
            console.warn(`[CircuitBreaker:${this.name}] Transitioned to OPEN. Failures: ${this.failures}. Next attempt in ${this.resetTimeout}ms`);
        }
    }

    /**
     * Determine if an error should trip the breaker
     */
    _isSystemFailure(error) {
        const msg = (error.message || '').toLowerCase();
        // Don't trip for these (they are client/auth issues, not provider instability)
        if (msg.includes('budget') || msg.includes('limit exceeded') && !msg.includes('rate limit')) return false;
        if (msg.includes('unauthorized') || msg.includes('auth') || msg.includes('key invalid')) return false;
        if (msg.includes('validation') || msg.includes('invalid argument')) return false;

        return true;
    }

    getStatus() {
        return {
            name: this.name,
            state: this.state,
            failures: this.failures,
            successes: this.successes,
            threshold: this.failureThreshold,
            nextAttemptTime: this.nextAttemptTime ? new Date(this.nextAttemptTime).toISOString() : null,
            isFailing: this.state !== STATES.CLOSED
        };
    }
}

const breakers = {};

const CircuitBreakerService = {
    STATES,

    getBreaker: (name, options) => {
        if (!breakers[name]) {
            breakers[name] = new CircuitBreaker(name, options);
        }
        return breakers[name];
    },

    execute: async (name, fn, options) => {
        const breaker = CircuitBreakerService.getBreaker(name, options);
        return await breaker.execute(fn);
    },

    getAllStatuses: () => {
        return Object.keys(breakers).map(name => breakers[name].getStatus());
    }
};

module.exports = CircuitBreakerService;

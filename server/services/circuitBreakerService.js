/**
 * Circuit Breaker Service (Consolidated)
 * 
 * Unified Circuit Breaker implementation for all external services (LLMs, APIs, etc).
 * This is a facade that provides both:
 * 1. Simple API for non-AI services (legacy compatibility)
 * 2. Full-featured API for AI/LLM services
 * 
 * States: CLOSED (Normal), OPEN (Failing Fast), HALF_OPEN (Testing recovery)
 * 
 * Features:
 * - Per-service circuit breakers
 * - Automatic recovery after cooldown
 * - Retry with exponential backoff
 * - State persistence (for critical circuits)
 * - Health status reporting
 * - Integration with alerting system
 * 
 * "Resilience is not the absence of failure, but the management of it."
 * 
 * @version 2.0.0 - Consolidated from separate implementations
 */

const { aiLogger } = require('./ai/logger');

// Lazy-load alerting to avoid circular dependencies
let alertsModule = null;
function getAlerts() {
    if (!alertsModule) {
        try {
            alertsModule = require('./ai/alerting').alerts;
        } catch (e) {
            // Alerting not available
        }
    }
    return alertsModule;
}

// Lazy-load database for persistence
let db = null;
function getDb() {
    if (!db) {
        try {
            db = require('../database');
        } catch (e) {
            // Database not available
        }
    }
    return db;
}

const STATES = {
    CLOSED: 'CLOSED',
    OPEN: 'OPEN',
    HALF_OPEN: 'HALF_OPEN'
};

// Default configuration
const DEFAULT_CONFIG = {
    failureThreshold: 5,        // Failures before opening circuit
    successThreshold: 2,        // Successes in half-open before closing
    resetTimeout: 60000,        // Time in ms before trying half-open (60 seconds)
    retryAttempts: 3,           // Max retry attempts per request
    retryBaseDelay: 1000,       // Base delay for exponential backoff (1 second)
    retryMaxDelay: 30000,       // Maximum delay between retries (30 seconds)
    persistenceEnabled: false   // Enable database persistence (opt-in)
};

// Store circuit state per service
const circuits = new Map();

// Track if we've restored state from database
let stateRestored = false;

/**
 * Circuit Breaker Class
 */
class CircuitBreaker {
    constructor(name, options = {}) {
        this.name = name;
        this.config = { ...DEFAULT_CONFIG, ...options };
        
        this.state = STATES.CLOSED;
        this.failures = 0;
        this.successes = 0;
        this.lastFailureTime = null;
        this.lastSuccessTime = null;
        this.openedAt = null;
        this.nextAttemptTime = null;
        
        // Track error details for debugging
        this.lastError = null;
        this.totalFailures = 0;
        this.totalSuccesses = 0;
    }

    /**
     * Check if circuit allows request
     */
    canExecute() {
        const now = Date.now();

        switch (this.state) {
            case STATES.CLOSED:
                return { allowed: true, state: STATES.CLOSED };

            case STATES.OPEN:
                if (now >= this.nextAttemptTime) {
                    this.state = STATES.HALF_OPEN;
                    this.successes = 0;
                    aiLogger.info('CircuitBreaker', `Circuit [${this.name}] transitioning to HALF_OPEN`);
                    return { allowed: true, state: STATES.HALF_OPEN };
                }
                const remainingCooldown = Math.ceil((this.nextAttemptTime - now) / 1000);
                return {
                    allowed: false,
                    state: STATES.OPEN,
                    reason: `Circuit [${this.name}] is OPEN. Retry in ${remainingCooldown}s`
                };

            case STATES.HALF_OPEN:
                return { allowed: true, state: STATES.HALF_OPEN };

            default:
                return { allowed: true, state: STATES.CLOSED };
        }
    }

    /**
     * Execute a function within the circuit breaker with optional retry
     */
    async execute(fn, options = {}) {
        const check = this.canExecute();
        
        if (!check.allowed) {
            const err = new Error(check.reason);
            err.isCircuitOpen = true;
            err.breakerName = this.name;
            err.code = 'CIRCUIT_OPEN';
            throw err;
        }

        const maxRetries = options.retries ?? this.config.retryAttempts;
        let lastError = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const result = await fn();
                this.recordSuccess();
                return result;
            } catch (error) {
                lastError = error;
                
                // Only count "system" failures
                if (this._isSystemFailure(error)) {
                    this.recordFailure(error);
                }

                // Don't retry on last attempt or non-retriable errors
                if (attempt === maxRetries || !this._isRetriable(error)) {
                    break;
                }

                // Check if circuit opened during retry
                const newCheck = this.canExecute();
                if (!newCheck.allowed) {
                    const circuitError = new Error(`Circuit [${this.name}] opened during retry: ${error.message}`);
                    circuitError.code = 'CIRCUIT_OPENED';
                    circuitError.originalError = error;
                    circuitError.isCircuitOpen = true;
                    throw circuitError;
                }

                // Exponential backoff
                const delay = Math.min(
                    this.config.retryBaseDelay * Math.pow(2, attempt),
                    this.config.retryMaxDelay
                );
                await new Promise(resolve => setTimeout(resolve, delay));
                
                aiLogger.info('CircuitBreaker', `Retrying [${this.name}] in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
            }
        }

        throw lastError;
    }

    /**
     * Record a successful request
     */
    recordSuccess() {
        const previousState = this.state;
        this.lastSuccessTime = Date.now();
        this.failures = 0;
        this.totalSuccesses++;

        if (this.state === STATES.HALF_OPEN) {
            this.successes++;
            if (this.successes >= this.config.successThreshold) {
                this.state = STATES.CLOSED;
                this.openedAt = null;
                this.nextAttemptTime = null;
                
                aiLogger.info('CircuitBreaker', `Circuit [${this.name}] CLOSED after recovery`);

                // Send recovery alert
                const alerts = getAlerts();
                if (alerts && alerts.circuitClosed) {
                    alerts.circuitClosed(this.name);
                }

                if (this.config.persistenceEnabled) {
                    this._persistState();
                }
            }
        }
    }

    /**
     * Record a failed request
     */
    recordFailure(error) {
        this.failures++;
        this.totalFailures++;
        this.lastFailureTime = Date.now();
        this.lastError = error?.message || 'Unknown error';

        aiLogger.warn('CircuitBreaker', `Failure recorded for [${this.name}] (${this.failures}/${this.config.failureThreshold})`, {
            error: this.lastError
        });

        if (this.state === STATES.HALF_OPEN || this.failures >= this.config.failureThreshold) {
            const wasHalfOpen = this.state === STATES.HALF_OPEN;
            this.state = STATES.OPEN;
            this.openedAt = Date.now();
            this.nextAttemptTime = this.openedAt + this.config.resetTimeout;

            const logMsg = wasHalfOpen 
                ? `Circuit [${this.name}] REOPENED after half-open failure`
                : `Circuit [${this.name}] OPENED after ${this.failures} failures`;
            aiLogger.error('CircuitBreaker', logMsg);

            // Send alert
            const alerts = getAlerts();
            if (alerts && alerts.circuitOpen) {
                alerts.circuitOpen(this.name, this.failures, this.config.resetTimeout / 1000);
            }

            if (this.config.persistenceEnabled) {
                this._persistState();
            }
        }
    }

    /**
     * Reset circuit to closed state (admin function)
     */
    reset() {
        this.state = STATES.CLOSED;
        this.failures = 0;
        this.successes = 0;
        this.openedAt = null;
        this.nextAttemptTime = null;
        this.lastError = null;
        
        aiLogger.info('CircuitBreaker', `Circuit [${this.name}] manually reset to CLOSED`);

        if (this.config.persistenceEnabled) {
            this._persistState();
        }
    }

    /**
     * Get status information
     */
    getStatus() {
        return {
            name: this.name,
            state: this.state,
            failures: this.failures,
            successes: this.successes,
            threshold: this.config.failureThreshold,
            lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
            lastSuccessTime: this.lastSuccessTime ? new Date(this.lastSuccessTime).toISOString() : null,
            nextAttemptTime: this.nextAttemptTime ? new Date(this.nextAttemptTime).toISOString() : null,
            openedAt: this.openedAt ? new Date(this.openedAt).toISOString() : null,
            cooldownRemaining: this.state === STATES.OPEN && this.nextAttemptTime
                ? Math.max(0, this.nextAttemptTime - Date.now())
                : null,
            isFailing: this.state !== STATES.CLOSED,
            lastError: this.lastError,
            totalStats: {
                successes: this.totalSuccesses,
                failures: this.totalFailures
            }
        };
    }

    /**
     * Determine if an error should trip the breaker
     */
    _isSystemFailure(error) {
        const msg = (error.message || '').toLowerCase();
        
        // Don't trip for client/auth issues
        if (msg.includes('budget') || (msg.includes('limit exceeded') && !msg.includes('rate limit'))) return false;
        if (msg.includes('unauthorized') || msg.includes('auth') || msg.includes('key invalid')) return false;
        if (msg.includes('validation') || msg.includes('invalid argument')) return false;
        if (msg.includes('not found') || msg.includes('404')) return false;
        
        return true;
    }

    /**
     * Determine if an error is retriable
     */
    _isRetriable(error) {
        const msg = (error.message || '').toLowerCase();
        
        // Network/timeout errors are retriable
        if (msg.includes('timeout') || msg.includes('network') || msg.includes('econnreset')) return true;
        if (msg.includes('rate limit') || msg.includes('429') || msg.includes('503')) return true;
        if (msg.includes('server error') || msg.includes('500') || msg.includes('502')) return true;
        
        // Don't retry client errors
        if (msg.includes('400') || msg.includes('401') || msg.includes('403') || msg.includes('404')) return false;
        
        return true;
    }

    /**
     * Persist state to database
     */
    async _persistState() {
        const database = getDb();
        if (!database) return;

        try {
            await new Promise((resolve, reject) => {
                database.run(`
                    INSERT OR REPLACE INTO circuit_breaker_state 
                    (provider_id, state, failures, successes, last_failure, last_success, opened_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `, [
                    this.name,
                    this.state,
                    this.failures,
                    this.successes,
                    this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
                    this.lastSuccessTime ? new Date(this.lastSuccessTime).toISOString() : null,
                    this.openedAt ? new Date(this.openedAt).toISOString() : null
                ], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        } catch (e) {
            aiLogger.warn('CircuitBreaker', `Failed to persist state for [${this.name}]: ${e.message}`);
        }
    }
}

// ============================================================================
// AUTO-RECOVERY ENHANCEMENT (Phase 2.4)
// ============================================================================

/**
 * Provider rotation configuration
 */
const PROVIDER_ROTATION = new Map([
    ['openai', ['anthropic', 'google']],
    ['anthropic', ['openai', 'google']],
    ['google', ['openai', 'anthropic']]
]);

/**
 * Health check configurations per provider
 */
const HEALTH_CHECK_CONFIG = {
    interval: 30000,        // Health check every 30 seconds when in HALF_OPEN
    timeout: 5000,          // Health check timeout
    minSuccessRate: 0.8,    // 80% success rate required for full recovery
    gradualRecoverySteps: 5 // Steps for gradual traffic increase
};

/**
 * Track health check intervals
 */
const healthCheckIntervals = new Map();

/**
 * Track recovery progress
 */
const recoveryProgress = new Map();

/**
 * Extended Circuit Breaker with Auto-Recovery
 */
class EnhancedCircuitBreaker extends CircuitBreaker {
    constructor(name, options = {}) {
        super(name, options);
        this.healthCheckFn = options.healthCheckFn || null;
        this.recoveryPercent = 100; // Traffic percentage allowed through
        this.consecutiveHealthChecks = 0;
        this.isRecovering = false;
    }

    /**
     * Start health check probes when entering HALF_OPEN
     */
    startHealthChecks() {
        if (healthCheckIntervals.has(this.name)) {
            return; // Already running
        }

        if (!this.healthCheckFn) {
            aiLogger.debug('CircuitBreaker', `No health check function for [${this.name}]`);
            return;
        }

        aiLogger.info('CircuitBreaker', `Starting health checks for [${this.name}]`);

        const interval = setInterval(async () => {
            try {
                const startTime = Date.now();
                await Promise.race([
                    this.healthCheckFn(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Health check timeout')), HEALTH_CHECK_CONFIG.timeout)
                    )
                ]);
                
                const latency = Date.now() - startTime;
                this.consecutiveHealthChecks++;
                
                aiLogger.debug('CircuitBreaker', `Health check OK for [${this.name}] (${latency}ms)`);

                // If enough successful health checks, begin recovery
                if (this.consecutiveHealthChecks >= 3 && this.state === STATES.HALF_OPEN) {
                    this.beginGradualRecovery();
                }
            } catch (error) {
                aiLogger.warn('CircuitBreaker', `Health check failed for [${this.name}]: ${error.message}`);
                this.consecutiveHealthChecks = 0;
                
                // If health check fails in HALF_OPEN, go back to OPEN
                if (this.state === STATES.HALF_OPEN) {
                    this.recordFailure(error);
                }
            }
        }, HEALTH_CHECK_CONFIG.interval);

        healthCheckIntervals.set(this.name, interval);
    }

    /**
     * Stop health checks
     */
    stopHealthChecks() {
        const interval = healthCheckIntervals.get(this.name);
        if (interval) {
            clearInterval(interval);
            healthCheckIntervals.delete(this.name);
            aiLogger.info('CircuitBreaker', `Stopped health checks for [${this.name}]`);
        }
    }

    /**
     * Begin gradual traffic recovery
     */
    beginGradualRecovery() {
        if (this.isRecovering) return;

        this.isRecovering = true;
        this.recoveryPercent = 20; // Start with 20% traffic
        
        aiLogger.info('CircuitBreaker', `Beginning gradual recovery for [${this.name}] at ${this.recoveryPercent}%`);

        const recoverySteps = [];
        const stepIncrement = Math.floor(80 / HEALTH_CHECK_CONFIG.gradualRecoverySteps);
        
        for (let i = 0; i < HEALTH_CHECK_CONFIG.gradualRecoverySteps; i++) {
            const stepTimeout = setTimeout(() => {
                if (this.state === STATES.CLOSED || this.state === STATES.HALF_OPEN) {
                    this.recoveryPercent = Math.min(100, this.recoveryPercent + stepIncrement);
                    aiLogger.info('CircuitBreaker', `Recovery progress for [${this.name}]: ${this.recoveryPercent}%`);
                    
                    if (this.recoveryPercent >= 100) {
                        this.completeRecovery();
                    }
                }
            }, (i + 1) * 10000); // 10 seconds between steps
            
            recoverySteps.push(stepTimeout);
        }

        recoveryProgress.set(this.name, recoverySteps);
    }

    /**
     * Complete the recovery process
     */
    completeRecovery() {
        this.isRecovering = false;
        this.recoveryPercent = 100;
        this.stopHealthChecks();
        
        // Clear recovery timeouts
        const steps = recoveryProgress.get(this.name);
        if (steps) {
            steps.forEach(clearTimeout);
            recoveryProgress.delete(this.name);
        }

        aiLogger.info('CircuitBreaker', `Recovery complete for [${this.name}]`);
    }

    /**
     * Check if request should be allowed during recovery
     */
    shouldAllowDuringRecovery() {
        if (!this.isRecovering || this.recoveryPercent >= 100) {
            return true;
        }
        // Randomly allow based on recovery percentage
        return Math.random() * 100 < this.recoveryPercent;
    }

    /**
     * Override canExecute to include recovery logic
     */
    canExecute() {
        const baseCheck = super.canExecute();
        
        if (baseCheck.allowed && this.isRecovering) {
            if (!this.shouldAllowDuringRecovery()) {
                return {
                    allowed: false,
                    state: STATES.HALF_OPEN,
                    reason: `Circuit [${this.name}] in recovery (${this.recoveryPercent}% traffic)`
                };
            }
        }

        // Start health checks when entering HALF_OPEN
        if (baseCheck.state === STATES.HALF_OPEN && !healthCheckIntervals.has(this.name)) {
            this.startHealthChecks();
        }

        return baseCheck;
    }

    /**
     * Override recordSuccess for recovery tracking
     */
    recordSuccess() {
        super.recordSuccess();
        
        // If we were in recovery and circuit is now closed, complete recovery
        if (this.state === STATES.CLOSED && this.isRecovering) {
            this.completeRecovery();
        }
    }

    /**
     * Override reset to clean up recovery state
     */
    reset() {
        super.reset();
        this.completeRecovery();
        this.consecutiveHealthChecks = 0;
    }

    /**
     * Get extended status with recovery info
     */
    getStatus() {
        return {
            ...super.getStatus(),
            recoveryPercent: this.recoveryPercent,
            isRecovering: this.isRecovering,
            consecutiveHealthChecks: this.consecutiveHealthChecks,
            healthCheckActive: healthCheckIntervals.has(this.name)
        };
    }
}

/**
 * Circuit Breaker Service - Main API
 */
const CircuitBreakerService = {
    STATES,

    /**
     * Get or create a circuit breaker (enhanced version)
     */
    getBreaker: (name, options = {}) => {
        if (!circuits.has(name)) {
            circuits.set(name, new EnhancedCircuitBreaker(name, options));
        }
        return circuits.get(name);
    },

    /**
     * Execute function with circuit breaker protection
     * @param {string} name - Circuit breaker name
     * @param {Function} fn - Async function to execute
     * @param {Object} options - { failureThreshold, resetTimeout, retries, ... }
     */
    execute: async (name, fn, options = {}) => {
        const breaker = CircuitBreakerService.getBreaker(name, options);
        return await breaker.execute(fn, options);
    },

    /**
     * Check if a circuit allows requests
     */
    canExecute: (name) => {
        const breaker = circuits.get(name);
        return breaker ? breaker.canExecute() : { allowed: true, state: STATES.CLOSED };
    },

    /**
     * Record a success for a circuit
     */
    recordSuccess: (name) => {
        const breaker = circuits.get(name);
        if (breaker) breaker.recordSuccess();
    },

    /**
     * Record a failure for a circuit
     */
    recordFailure: (name, error) => {
        const breaker = circuits.get(name);
        if (breaker) breaker.recordFailure(error);
    },

    /**
     * Reset a circuit to closed state
     */
    reset: (name) => {
        const breaker = circuits.get(name);
        if (breaker) breaker.reset();
    },

    /**
     * Get status of a specific circuit
     */
    getStatus: (name) => {
        const breaker = circuits.get(name);
        return breaker ? breaker.getStatus() : null;
    },

    /**
     * Get statuses of all circuits
     */
    getAllStatuses: () => {
        return Array.from(circuits.values()).map(b => b.getStatus());
    },

    /**
     * Restore circuit states from database (call on startup)
     */
    restoreStates: async () => {
        if (stateRestored) return;
        
        const database = getDb();
        if (!database) return;

        try {
            await new Promise((resolve, reject) => {
                database.all(
                    'SELECT * FROM circuit_breaker_state WHERE state = ?',
                    [STATES.OPEN],
                    (err, rows) => {
                        if (err) {
                            // Table might not exist yet
                            resolve();
                            return;
                        }

                        const now = Date.now();
                        for (const row of (rows || [])) {
                            // Only restore OPEN circuits that haven't expired
                            if (row.opened_at) {
                                const openedAt = new Date(row.opened_at).getTime();
                                const timeout = DEFAULT_CONFIG.resetTimeout;
                                
                                if (now - openedAt < timeout) {
                                    const breaker = CircuitBreakerService.getBreaker(row.provider_id, {
                                        persistenceEnabled: true
                                    });
                                    breaker.state = row.state;
                                    breaker.failures = row.failures;
                                    breaker.openedAt = openedAt;
                                    breaker.nextAttemptTime = openedAt + timeout;
                                    
                                    aiLogger.info('CircuitBreaker', `Restored OPEN state for [${row.provider_id}]`);
                                }
                            }
                        }
                        resolve();
                    }
                );
            });
            stateRestored = true;
        } catch (e) {
            aiLogger.warn('CircuitBreaker', `Failed to restore states: ${e.message}`);
        }
    },

    // ========================================================================
    // AUTO-RECOVERY & PROVIDER ROTATION (Phase 2.4)
    // ========================================================================

    /**
     * Get fallback provider when primary is unavailable
     * @param {string} primaryProvider - The primary provider that's failing
     * @returns {string|null} Fallback provider name or null if none available
     */
    getFallbackProvider: (primaryProvider) => {
        const fallbacks = PROVIDER_ROTATION.get(primaryProvider) || [];
        
        for (const fallback of fallbacks) {
            const breaker = circuits.get(fallback);
            if (!breaker || breaker.state === STATES.CLOSED) {
                aiLogger.info('CircuitBreaker', `Using fallback provider [${fallback}] for [${primaryProvider}]`);
                return fallback;
            }
        }

        aiLogger.warn('CircuitBreaker', `No healthy fallback provider available for [${primaryProvider}]`);
        return null;
    },

    /**
     * Execute with automatic provider rotation
     * @param {string} primaryProvider - Primary provider name
     * @param {Function} createFn - Function that creates the execution function for a provider
     * @param {Object} options - Circuit breaker options
     */
    executeWithRotation: async (primaryProvider, createFn, options = {}) => {
        const providers = [primaryProvider, ...(PROVIDER_ROTATION.get(primaryProvider) || [])];
        let lastError = null;

        for (const provider of providers) {
            const breaker = CircuitBreakerService.getBreaker(provider, options);
            const check = breaker.canExecute();

            if (!check.allowed) {
                aiLogger.info('CircuitBreaker', `Skipping [${provider}]: ${check.reason}`);
                continue;
            }

            try {
                const fn = createFn(provider);
                const result = await breaker.execute(fn, options);
                return { result, provider };
            } catch (error) {
                lastError = error;
                aiLogger.warn('CircuitBreaker', `Provider [${provider}] failed: ${error.message}`);
                
                // If circuit opened, it will be handled automatically
                // Continue to next provider
            }
        }

        // All providers failed
        throw lastError || new Error('All providers unavailable');
    },

    /**
     * Set health check function for a circuit
     * @param {string} name - Circuit breaker name
     * @param {Function} healthCheckFn - Async function that returns true if healthy
     */
    setHealthCheck: (name, healthCheckFn) => {
        const breaker = CircuitBreakerService.getBreaker(name);
        if (breaker instanceof EnhancedCircuitBreaker) {
            breaker.healthCheckFn = healthCheckFn;
            aiLogger.info('CircuitBreaker', `Health check function set for [${name}]`);
        }
    },

    /**
     * Get recovery status for all circuits
     */
    getRecoveryStatuses: () => {
        return Array.from(circuits.values())
            .filter(b => b instanceof EnhancedCircuitBreaker && b.isRecovering)
            .map(b => ({
                name: b.name,
                recoveryPercent: b.recoveryPercent,
                consecutiveHealthChecks: b.consecutiveHealthChecks
            }));
    },

    /**
     * Force start recovery for a circuit (admin function)
     */
    forceRecovery: (name) => {
        const breaker = circuits.get(name);
        if (breaker instanceof EnhancedCircuitBreaker && breaker.state === STATES.OPEN) {
            breaker.state = STATES.HALF_OPEN;
            breaker.startHealthChecks();
            aiLogger.info('CircuitBreaker', `Forced recovery started for [${name}]`);
            return true;
        }
        return false;
    },

    /**
     * Cleanup all health check intervals (for shutdown)
     */
    cleanup: () => {
        for (const [name, interval] of healthCheckIntervals.entries()) {
            clearInterval(interval);
            aiLogger.debug('CircuitBreaker', `Cleaned up health check for [${name}]`);
        }
        healthCheckIntervals.clear();
        
        for (const [name, steps] of recoveryProgress.entries()) {
            steps.forEach(clearTimeout);
        }
        recoveryProgress.clear();
    }
};

module.exports = CircuitBreakerService;

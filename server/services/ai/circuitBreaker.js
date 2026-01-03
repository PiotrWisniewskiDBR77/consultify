/**
 * Circuit Breaker for LLM Providers
 * 
 * NOTE: This module is a backward-compatible wrapper around the consolidated
 * CircuitBreakerService. Use CircuitBreakerService directly for new code.
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failure threshold exceeded, requests fail immediately
 * - HALF_OPEN: Testing if service recovered, limited requests allowed
 * 
 * Features:
 * - Per-provider circuit breakers
 * - Automatic recovery after cooldown
 * - Retry with exponential backoff
 * - Health status reporting
 * - State persistence to database (survives restarts)
 * - Integration with LLMConfigService health tracking
 * 
 * @deprecated Use CircuitBreakerService directly for new implementations
 */

const CircuitBreakerService = require('../circuitBreakerService');
const { aiLogger } = require('./logger');

// Re-export states for backward compatibility
const STATE = CircuitBreakerService.STATES;

// LLM-specific configuration (higher thresholds for AI providers)
const LLM_CONFIG = {
    failureThreshold: 5,
    successThreshold: 2,
    resetTimeout: 60000,
    retryAttempts: 3,
    retryBaseDelay: 1000,
    retryMaxDelay: 30000,
    persistenceEnabled: true
};

/**
 * Check if circuit allows request (legacy API)
 */
function canExecute(providerId) {
    const breaker = CircuitBreakerService.getBreaker(providerId, LLM_CONFIG);
    return breaker.canExecute();
}

/**
 * Record a successful request (legacy API)
 */
function recordSuccess(providerId) {
    CircuitBreakerService.recordSuccess(providerId);
}

/**
 * Record a failed request (legacy API)
 */
function recordFailure(providerId, error) {
    CircuitBreakerService.recordFailure(providerId, error);
}

/**
 * Reset circuit to closed state (legacy API)
 */
function reset(providerId) {
    CircuitBreakerService.reset(providerId);
}

/**
 * Get status of all circuits (legacy API)
 */
function getStatus() {
    return CircuitBreakerService.getAllStatuses().reduce((acc, status) => {
        acc[status.name] = status;
        return acc;
    }, {});
}

/**
 * Execute function with circuit breaker and retry logic (legacy API)
 */
async function execute(providerId, fn, options = {}) {
    const breaker = CircuitBreakerService.getBreaker(providerId, {
        ...LLM_CONFIG,
        ...options
    });
    return await breaker.execute(fn, options);
}

/**
 * Initialize circuit breaker - restore states from database
 */
async function initialize() {
    try {
        await CircuitBreakerService.restoreStates();
        aiLogger.info('CircuitBreaker', 'LLM circuit breakers initialized');
    } catch (e) {
        aiLogger.warn('CircuitBreaker', `Initialization warning: ${e.message}`);
    }
}

// Auto-initialize on module load (for backward compatibility)
setImmediate(() => {
    initialize().catch(e => {
        console.warn('[CircuitBreaker] Auto-init failed:', e.message);
    });
});

module.exports = {
    STATE,
    canExecute,
    recordSuccess,
    recordFailure,
    reset,
    getStatus,
    execute,
    initialize,
    
    // Export for direct access if needed
    CircuitBreakerService
};

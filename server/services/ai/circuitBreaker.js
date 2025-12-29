/**
 * Circuit Breaker for LLM Providers
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
 */

const { aiLogger } = require('./logger');

// Lazy-load alerting to avoid circular dependencies
let alertsModule = null;
function getAlerts() {
    if (!alertsModule) {
        try {
            alertsModule = require('./alerting').alerts;
        } catch (e) {
            // Alerting not available
        }
    }
    return alertsModule;
}

// Circuit breaker configuration
const CONFIG = {
    failureThreshold: 5,        // Failures before opening circuit
    successThreshold: 2,        // Successes in half-open before closing
    timeout: 60000,             // Time in ms before trying half-open (60 seconds)
    retryAttempts: 3,           // Max retry attempts per request
    retryBaseDelay: 1000,       // Base delay for exponential backoff (1 second)
    retryMaxDelay: 30000        // Maximum delay between retries (30 seconds)
};

// Circuit states
const STATE = {
    CLOSED: 'CLOSED',
    OPEN: 'OPEN',
    HALF_OPEN: 'HALF_OPEN'
};

// Store circuit state per provider
const circuits = new Map();

/**
 * Get or create circuit for a provider
 */
function getCircuit(providerId) {
    if (!circuits.has(providerId)) {
        circuits.set(providerId, {
            state: STATE.CLOSED,
            failures: 0,
            successes: 0,
            lastFailure: null,
            lastSuccess: null,
            openedAt: null
        });
    }
    return circuits.get(providerId);
}

/**
 * Check if circuit allows request
 * @param {string} providerId - LLM provider ID (e.g., 'openai', 'anthropic')
 * @returns {Object} { allowed: boolean, state: string, reason?: string }
 */
function canExecute(providerId) {
    const circuit = getCircuit(providerId);
    const now = Date.now();

    switch (circuit.state) {
        case STATE.CLOSED:
            return { allowed: true, state: STATE.CLOSED };

        case STATE.OPEN:
            // Check if cooldown period has passed
            if (now - circuit.openedAt >= CONFIG.timeout) {
                // Transition to half-open
                circuit.state = STATE.HALF_OPEN;
                circuit.successes = 0;
                aiLogger.info('CircuitBreaker', `Circuit ${providerId} transitioning to HALF_OPEN`);
                return { allowed: true, state: STATE.HALF_OPEN };
            }
            const remainingCooldown = Math.ceil((CONFIG.timeout - (now - circuit.openedAt)) / 1000);
            return {
                allowed: false,
                state: STATE.OPEN,
                reason: `Circuit open for ${providerId}. Retry in ${remainingCooldown}s`
            };

        case STATE.HALF_OPEN:
            return { allowed: true, state: STATE.HALF_OPEN };

        default:
            return { allowed: true, state: STATE.CLOSED };
    }
}

/**
 * Record a successful request
 */
function recordSuccess(providerId) {
    const circuit = getCircuit(providerId);
    circuit.lastSuccess = Date.now();
    circuit.failures = 0;

    if (circuit.state === STATE.HALF_OPEN) {
        circuit.successes++;
        if (circuit.successes >= CONFIG.successThreshold) {
            circuit.state = STATE.CLOSED;
            aiLogger.info('CircuitBreaker', `Circuit ${providerId} CLOSED after recovery`);
            
            // Send recovery alert
            const alerts = getAlerts();
            if (alerts) alerts.circuitClosed(providerId);
        }
    }
}

/**
 * Record a failed request
 */
function recordFailure(providerId, error) {
    const circuit = getCircuit(providerId);
    circuit.failures++;
    circuit.lastFailure = Date.now();

    aiLogger.warn('CircuitBreaker', `Failure recorded for ${providerId} (${circuit.failures}/${CONFIG.failureThreshold})`, {
        error: error?.message
    });

    if (circuit.state === STATE.HALF_OPEN) {
        // Any failure in half-open reopens the circuit
        circuit.state = STATE.OPEN;
        circuit.openedAt = Date.now();
        aiLogger.error('CircuitBreaker', `Circuit ${providerId} REOPENED after half-open failure`);
        
        // Send alert
        const alerts = getAlerts();
        if (alerts) alerts.circuitOpen(providerId, circuit.failures, CONFIG.timeout / 1000);
    } else if (circuit.failures >= CONFIG.failureThreshold) {
        circuit.state = STATE.OPEN;
        circuit.openedAt = Date.now();
        aiLogger.error('CircuitBreaker', `Circuit ${providerId} OPENED after ${circuit.failures} failures`);
        
        // Send alert
        const alerts = getAlerts();
        if (alerts) alerts.circuitOpen(providerId, circuit.failures, CONFIG.timeout / 1000);
    }
}

/**
 * Reset circuit to closed state (admin function)
 */
function reset(providerId) {
    const circuit = getCircuit(providerId);
    circuit.state = STATE.CLOSED;
    circuit.failures = 0;
    circuit.successes = 0;
    circuit.openedAt = null;
    aiLogger.info('CircuitBreaker', `Circuit ${providerId} manually reset to CLOSED`);
}

/**
 * Get status of all circuits
 */
function getStatus() {
    const status = {};
    for (const [providerId, circuit] of circuits) {
        status[providerId] = {
            state: circuit.state,
            failures: circuit.failures,
            lastFailure: circuit.lastFailure,
            lastSuccess: circuit.lastSuccess,
            openedAt: circuit.openedAt,
            cooldownRemaining: circuit.state === STATE.OPEN
                ? Math.max(0, CONFIG.timeout - (Date.now() - circuit.openedAt))
                : 0
        };
    }
    return status;
}

/**
 * Calculate delay for exponential backoff
 * @param {number} attempt - Current attempt number (0-based)
 * @returns {number} Delay in milliseconds
 */
function calculateBackoff(attempt) {
    const delay = Math.min(
        CONFIG.retryBaseDelay * Math.pow(2, attempt),
        CONFIG.retryMaxDelay
    );
    // Add jitter (±20%)
    const jitter = delay * 0.2 * (Math.random() - 0.5);
    return Math.floor(delay + jitter);
}

/**
 * Execute function with circuit breaker and retry logic
 * @param {string} providerId - Provider ID for circuit tracking
 * @param {Function} fn - Async function to execute
 * @param {Object} options - { maxRetries, onRetry }
 * @returns {Promise<any>} Result of the function
 */
async function execute(providerId, fn, options = {}) {
    const maxRetries = options.maxRetries ?? CONFIG.retryAttempts;
    const onRetry = options.onRetry || (() => {});

    // Check circuit state
    const circuitCheck = canExecute(providerId);
    if (!circuitCheck.allowed) {
        const error = new Error(circuitCheck.reason);
        error.code = 'CIRCUIT_OPEN';
        error.provider = providerId;
        throw error;
    }

    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const result = await fn();
            recordSuccess(providerId);
            return result;
        } catch (error) {
            lastError = error;

            // Don't retry on certain errors
            if (isNonRetryableError(error)) {
                recordFailure(providerId, error);
                throw error;
            }

            recordFailure(providerId, error);

            // Check if circuit opened after this failure
            const newCircuitCheck = canExecute(providerId);
            if (!newCircuitCheck.allowed) {
                const circuitError = new Error(`Circuit opened for ${providerId}: ${error.message}`);
                circuitError.code = 'CIRCUIT_OPENED';
                circuitError.originalError = error;
                throw circuitError;
            }

            // If we have retries left, wait and try again
            if (attempt < maxRetries) {
                const delay = calculateBackoff(attempt);
                aiLogger.info('CircuitBreaker', `Retrying ${providerId} in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`, {
                    error: error.message
                });
                onRetry(attempt + 1, delay, error);
                await sleep(delay);
            }
        }
    }

    // All retries exhausted
    throw lastError;
}

/**
 * Check if error should not be retried
 */
function isNonRetryableError(error) {
    const nonRetryableCodes = [
        'invalid_api_key',
        'authentication_error',
        'insufficient_quota',
        'content_policy_violation',
        'invalid_request_error'
    ];

    const statusCode = error.statusCode || error.status;
    if (statusCode === 400 || statusCode === 401 || statusCode === 403) {
        return true;
    }

    if (error.code && nonRetryableCodes.includes(error.code)) {
        return true;
    }

    return false;
}

/**
 * Sleep utility
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    canExecute,
    recordSuccess,
    recordFailure,
    reset,
    getStatus,
    execute,
    calculateBackoff,
    STATE,
    CONFIG
};


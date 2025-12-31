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
 * - State persistence to database (survives restarts)
 * - Integration with LLMConfigService health tracking
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

// Lazy-load database
let db = null;
function getDb() {
    if (!db) {
        try {
            db = require('../../database');
        } catch (e) {
            // Database not available
        }
    }
    return db;
}

// Circuit breaker configuration
const CONFIG = {
    failureThreshold: 5,        // Failures before opening circuit
    successThreshold: 2,        // Successes in half-open before closing
    timeout: 60000,             // Time in ms before trying half-open (60 seconds)
    retryAttempts: 3,           // Max retry attempts per request
    retryBaseDelay: 1000,       // Base delay for exponential backoff (1 second)
    retryMaxDelay: 30000,       // Maximum delay between retries (30 seconds)
    persistenceEnabled: true,   // Enable database persistence
    persistenceInterval: 30000  // How often to persist state (30 seconds)
};

// Circuit states
const STATE = {
    CLOSED: 'CLOSED',
    OPEN: 'OPEN',
    HALF_OPEN: 'HALF_OPEN'
};

// Store circuit state per provider
const circuits = new Map();

// Track if we've restored state from database
let stateRestored = false;
let persistenceTimer = null;

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
    const previousState = circuit.state;
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

            // Log event and persist
            logEvent(providerId, 'CIRCUIT_CLOSED', { 
                previousState, 
                successCount: circuit.successes 
            });
            persistState(providerId, circuit);
            updateConfigServiceHealth(providerId, 'healthy');
        }
    } else if (previousState === STATE.CLOSED) {
        // Update health to healthy on success in closed state
        updateConfigServiceHealth(providerId, 'healthy');
    }
}

/**
 * Record a failed request
 */
function recordFailure(providerId, error) {
    const circuit = getCircuit(providerId);
    const previousState = circuit.state;
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

        // Log event and persist
        logEvent(providerId, 'CIRCUIT_REOPENED', { 
            error: error?.message,
            failureCount: circuit.failures
        });
        persistState(providerId, circuit);
        updateConfigServiceHealth(providerId, 'unhealthy');
        
    } else if (circuit.failures >= CONFIG.failureThreshold) {
        circuit.state = STATE.OPEN;
        circuit.openedAt = Date.now();
        aiLogger.error('CircuitBreaker', `Circuit ${providerId} OPENED after ${circuit.failures} failures`);
        
        // Send alert
        const alerts = getAlerts();
        if (alerts) alerts.circuitOpen(providerId, circuit.failures, CONFIG.timeout / 1000);

        // Log event and persist
        logEvent(providerId, 'CIRCUIT_OPENED', { 
            error: error?.message,
            failureCount: circuit.failures,
            threshold: CONFIG.failureThreshold
        });
        persistState(providerId, circuit);
        updateConfigServiceHealth(providerId, 'unhealthy');
        
    } else {
        // Update health to degraded on failure (but not yet open)
        updateConfigServiceHealth(providerId, 'degraded');
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

// ============================================================================
// PERSISTENCE FUNCTIONS
// ============================================================================

/**
 * Save circuit state to database
 * @param {string} providerId - Provider ID
 * @param {Object} circuit - Circuit state
 */
async function persistState(providerId, circuit) {
    if (!CONFIG.persistenceEnabled) return;
    
    const database = getDb();
    if (!database) return;

    try {
        // Ensure table exists
        await new Promise((resolve) => {
            database.run(`
                CREATE TABLE IF NOT EXISTS circuit_breaker_state (
                    provider_id TEXT PRIMARY KEY,
                    state TEXT NOT NULL,
                    failures INTEGER DEFAULT 0,
                    successes INTEGER DEFAULT 0,
                    last_failure TEXT,
                    last_success TEXT,
                    opened_at TEXT,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `, () => resolve());
        });

        // Upsert circuit state
        await new Promise((resolve, reject) => {
            database.run(`
                INSERT INTO circuit_breaker_state 
                (provider_id, state, failures, successes, last_failure, last_success, opened_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(provider_id) DO UPDATE SET
                    state = excluded.state,
                    failures = excluded.failures,
                    successes = excluded.successes,
                    last_failure = excluded.last_failure,
                    last_success = excluded.last_success,
                    opened_at = excluded.opened_at,
                    updated_at = excluded.updated_at
            `, [
                providerId,
                circuit.state,
                circuit.failures,
                circuit.successes,
                circuit.lastFailure ? new Date(circuit.lastFailure).toISOString() : null,
                circuit.lastSuccess ? new Date(circuit.lastSuccess).toISOString() : null,
                circuit.openedAt ? new Date(circuit.openedAt).toISOString() : null,
                new Date().toISOString()
            ], (err) => {
                if (err) {
                    aiLogger.warn('CircuitBreaker', `Failed to persist state for ${providerId}: ${err.message}`);
                }
                resolve();
            });
        });
    } catch (e) {
        aiLogger.warn('CircuitBreaker', `Persistence error: ${e.message}`);
    }
}

/**
 * Restore all circuit states from database
 */
async function restoreState() {
    if (!CONFIG.persistenceEnabled || stateRestored) return;
    
    const database = getDb();
    if (!database) return;

    try {
        const rows = await new Promise((resolve) => {
            database.all(
                'SELECT * FROM circuit_breaker_state',
                [],
                (err, rows) => resolve(err ? [] : rows || [])
            );
        });

        for (const row of rows) {
            // Only restore OPEN circuits that haven't expired
            if (row.state === STATE.OPEN && row.opened_at) {
                const openedAt = new Date(row.opened_at).getTime();
                const now = Date.now();
                
                if (now - openedAt < CONFIG.timeout) {
                    // Circuit was recently opened, restore it
                    circuits.set(row.provider_id, {
                        state: STATE.OPEN,
                        failures: row.failures || 0,
                        successes: 0,
                        lastFailure: row.last_failure ? new Date(row.last_failure).getTime() : null,
                        lastSuccess: row.last_success ? new Date(row.last_success).getTime() : null,
                        openedAt: openedAt
                    });
                    aiLogger.info('CircuitBreaker', `Restored OPEN circuit for ${row.provider_id}`);
                } else {
                    // Circuit has cooled down, start in HALF_OPEN
                    circuits.set(row.provider_id, {
                        state: STATE.HALF_OPEN,
                        failures: row.failures || 0,
                        successes: 0,
                        lastFailure: row.last_failure ? new Date(row.last_failure).getTime() : null,
                        lastSuccess: null,
                        openedAt: openedAt
                    });
                    aiLogger.info('CircuitBreaker', `Restored ${row.provider_id} as HALF_OPEN (cooldown expired)`);
                }
            }
        }

        stateRestored = true;
        aiLogger.info('CircuitBreaker', `Restored ${rows.length} circuit state(s) from database`);
    } catch (e) {
        aiLogger.warn('CircuitBreaker', `Failed to restore state: ${e.message}`);
    }
}

/**
 * Start periodic persistence of circuit states
 */
function startPersistence() {
    if (persistenceTimer) return;
    
    // Restore state on startup
    restoreState().catch(e => {
        aiLogger.warn('CircuitBreaker', `Initial state restore failed: ${e.message}`);
    });

    // Periodically persist all circuit states
    persistenceTimer = setInterval(async () => {
        for (const [providerId, circuit] of circuits) {
            await persistState(providerId, circuit);
        }
    }, CONFIG.persistenceInterval);

    aiLogger.info('CircuitBreaker', `Persistence started (interval: ${CONFIG.persistenceInterval}ms)`);
}

/**
 * Stop persistence
 */
function stopPersistence() {
    if (persistenceTimer) {
        clearInterval(persistenceTimer);
        persistenceTimer = null;
        aiLogger.info('CircuitBreaker', 'Persistence stopped');
    }
}

/**
 * Get history of circuit events for a provider
 * @param {string} providerId - Provider ID
 * @param {number} limit - Max events to return
 */
async function getHistory(providerId, limit = 50) {
    const database = getDb();
    if (!database) return [];

    return new Promise((resolve) => {
        database.all(
            `SELECT * FROM circuit_breaker_events 
             WHERE provider_id = ? 
             ORDER BY timestamp DESC 
             LIMIT ?`,
            [providerId, limit],
            (err, rows) => resolve(err ? [] : rows || [])
        );
    });
}

/**
 * Log circuit event to database for history/analytics
 */
async function logEvent(providerId, eventType, details = {}) {
    const database = getDb();
    if (!database) return;

    try {
        // Ensure events table exists
        await new Promise((resolve) => {
            database.run(`
                CREATE TABLE IF NOT EXISTS circuit_breaker_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    provider_id TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    details TEXT,
                    timestamp TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `, () => resolve());
        });

        // Insert event
        database.run(
            `INSERT INTO circuit_breaker_events (provider_id, event_type, details, timestamp) 
             VALUES (?, ?, ?, ?)`,
            [providerId, eventType, JSON.stringify(details), new Date().toISOString()],
            () => {} // Fire and forget
        );
    } catch (e) {
        // Ignore logging errors
    }
}

/**
 * Update LLMConfigService health status when circuit changes
 */
async function updateConfigServiceHealth(providerId, status) {
    try {
        const { llmConfigService } = require('./llmConfigService');
        await llmConfigService.updateHealthStatus(providerId, status);
    } catch (e) {
        // LLMConfigService not available
    }
}

module.exports = {
    canExecute,
    recordSuccess,
    recordFailure,
    reset,
    getStatus,
    execute,
    calculateBackoff,
    // Persistence functions
    persistState,
    restoreState,
    startPersistence,
    stopPersistence,
    getHistory,
    logEvent,
    // Constants
    STATE,
    CONFIG
};


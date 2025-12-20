/**
 * AI Failure Handler Service
 * 
 * Implements graceful degradation and resilience for AI operations.
 * CRITICAL RULE: AI failure must NEVER block PMO execution.
 * 
 * "Enterprise = predictability in failure"
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

// Failure scenario types
const FAILURE_SCENARIOS = {
    MODEL_UNAVAILABLE: 'model_unavailable',
    BUDGET_EXCEEDED: 'budget_exceeded',
    CONTEXT_INCOMPLETE: 'context_incomplete',
    KNOWLEDGE_EMPTY: 'knowledge_empty',
    RATE_LIMITED: 'rate_limited',
    TIMEOUT: 'timeout',
    PARSING_ERROR: 'parsing_error',
    AUTHENTICATION_ERROR: 'auth_error'
};

// Health status levels
const HEALTH_STATUS = {
    HEALTHY: 'healthy',
    DEGRADED: 'degraded',
    UNAVAILABLE: 'unavailable'
};

// Fallback strategies
const FALLBACK_STRATEGIES = {
    [FAILURE_SCENARIOS.MODEL_UNAVAILABLE]: 'use_alternative_model',
    [FAILURE_SCENARIOS.BUDGET_EXCEEDED]: 'use_cached_response',
    [FAILURE_SCENARIOS.CONTEXT_INCOMPLETE]: 'proceed_with_partial',
    [FAILURE_SCENARIOS.KNOWLEDGE_EMPTY]: 'use_general_knowledge',
    [FAILURE_SCENARIOS.RATE_LIMITED]: 'queue_and_retry',
    [FAILURE_SCENARIOS.TIMEOUT]: 'return_cached_or_skip',
    [FAILURE_SCENARIOS.PARSING_ERROR]: 'return_raw_response',
    [FAILURE_SCENARIOS.AUTHENTICATION_ERROR]: 'fail_gracefully'
};

const AIFailureHandler = {
    FAILURE_SCENARIOS,
    HEALTH_STATUS,
    FALLBACK_STRATEGIES,

    // ==========================================
    // WRAPPED EXECUTION
    // ==========================================

    /**
     * Wrap any AI function with failure handling
     * @param {Function} aiFunction - The AI function to execute
     * @param {Function} fallbackFn - Fallback function if AI fails
     * @param {Object} context - Context for logging
     */
    withFallback: async (aiFunction, fallbackFn, context = {}) => {
        const startTime = Date.now();
        let result = null;
        let usedFallback = false;
        let failureType = null;

        try {
            // Add timeout wrapper
            result = await AIFailureHandler._withTimeout(aiFunction(), context.timeoutMs || 30000);

            // Log success
            await AIFailureHandler._updateHealthStatus({ lastSuccessfulCall: new Date().toISOString() });

            return {
                success: true,
                data: result,
                usedFallback: false,
                latencyMs: Date.now() - startTime
            };

        } catch (error) {
            // Identify failure type
            failureType = AIFailureHandler._identifyFailureType(error);

            // Log the failure
            await AIFailureHandler.logFailure(failureType, {
                ...context,
                errorMessage: error.message,
                errorCode: error.code
            });

            // Update health status
            await AIFailureHandler._incrementFailureCount();

            // Try fallback
            if (fallbackFn) {
                try {
                    result = await fallbackFn(error, context);
                    usedFallback = true;
                } catch (fallbackError) {
                    // Even fallback failed - return graceful degradation
                    return {
                        success: false,
                        error: AIFailureHandler.explainFailure(failureType),
                        usedFallback: true,
                        fallbackFailed: true,
                        gracefulDegradation: AIFailureHandler.degrade(failureType, context),
                        latencyMs: Date.now() - startTime
                    };
                }
            }

            return {
                success: usedFallback,
                data: result,
                usedFallback,
                failureType,
                fallbackUsed: FALLBACK_STRATEGIES[failureType],
                latencyMs: Date.now() - startTime
            };
        }
    },

    /**
     * Add timeout to promise
     */
    _withTimeout: (promise, timeoutMs) => {
        return Promise.race([
            promise,
            new Promise((_, reject) => {
                setTimeout(() => reject(new Error('AI_TIMEOUT')), timeoutMs);
            })
        ]);
    },

    // ==========================================
    // FAILURE IDENTIFICATION
    // ==========================================

    /**
     * Identify what type of failure occurred
     */
    _identifyFailureType: (error) => {
        const message = (error.message || '').toLowerCase();
        const code = error.code || '';

        if (message.includes('timeout') || code === 'ETIMEDOUT' || message === 'ai_timeout') {
            return FAILURE_SCENARIOS.TIMEOUT;
        }
        if (message.includes('rate limit') || code === '429') {
            return FAILURE_SCENARIOS.RATE_LIMITED;
        }
        if (message.includes('budget') || message.includes('insufficient')) {
            return FAILURE_SCENARIOS.BUDGET_EXCEEDED;
        }
        if (message.includes('unauthorized') || message.includes('authentication') || code === '401') {
            return FAILURE_SCENARIOS.AUTHENTICATION_ERROR;
        }
        if (message.includes('context') || message.includes('required')) {
            return FAILURE_SCENARIOS.CONTEXT_INCOMPLETE;
        }
        if (message.includes('json') || message.includes('parse')) {
            return FAILURE_SCENARIOS.PARSING_ERROR;
        }
        if (message.includes('empty') || message.includes('no knowledge')) {
            return FAILURE_SCENARIOS.KNOWLEDGE_EMPTY;
        }
        if (message.includes('unavailable') || message.includes('service') || code === '503' || code === '500') {
            return FAILURE_SCENARIOS.MODEL_UNAVAILABLE;
        }

        return FAILURE_SCENARIOS.MODEL_UNAVAILABLE; // Default
    },

    // ==========================================
    // AVAILABILITY CHECK
    // ==========================================

    /**
     * Check if AI services are available
     */
    checkAvailability: async () => {
        const status = await AIFailureHandler._getHealthStatus();

        return {
            available: status.overall_status !== HEALTH_STATUS.UNAVAILABLE,
            status: status.overall_status,
            modelStatus: status.model_status,
            budgetStatus: status.budget_status,
            lastSuccessfulCall: status.last_successful_call,
            failureCount24h: status.failure_count_24h,
            recommendation: status.overall_status === HEALTH_STATUS.HEALTHY
                ? 'All systems operational'
                : status.overall_status === HEALTH_STATUS.DEGRADED
                    ? 'Some AI features may be limited'
                    : 'AI services temporarily unavailable. Core PMO functions continue to work.'
        };
    },

    /**
     * Get health status from database
     */
    _getHealthStatus: async () => {
        return new Promise((resolve) => {
            db.get(`SELECT * FROM ai_health_status WHERE id = 'singleton'`, [], (err, row) => {
                resolve(row || {
                    overall_status: HEALTH_STATUS.HEALTHY,
                    model_status: 'available',
                    budget_status: 'ok',
                    knowledge_status: 'ok',
                    failure_count_24h: 0
                });
            });
        });
    },

    /**
     * Update health status
     */
    _updateHealthStatus: async (updates) => {
        const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
        const values = Object.values(updates);

        return new Promise((resolve) => {
            db.run(`
                INSERT INTO ai_health_status (id, ${Object.keys(updates).join(', ')}, updated_at)
                VALUES ('singleton', ${values.map(() => '?').join(', ')}, CURRENT_TIMESTAMP)
                ON CONFLICT(id) DO UPDATE SET ${setClauses}, updated_at = CURRENT_TIMESTAMP
            `, [...values, ...values], resolve);
        });
    },

    /**
     * Increment failure count and update status
     */
    _incrementFailureCount: async () => {
        const status = await AIFailureHandler._getHealthStatus();
        const newCount = (status.failure_count_24h || 0) + 1;

        let overallStatus = HEALTH_STATUS.HEALTHY;
        if (newCount >= 10) overallStatus = HEALTH_STATUS.UNAVAILABLE;
        else if (newCount >= 5) overallStatus = HEALTH_STATUS.DEGRADED;

        await AIFailureHandler._updateHealthStatus({
            failure_count_24h: newCount,
            overall_status: overallStatus,
            last_failure: new Date().toISOString()
        });
    },

    // ==========================================
    // GRACEFUL DEGRADATION
    // ==========================================

    /**
     * Provide graceful degradation response
     */
    degrade: (scenario, context = {}) => {
        const degradations = {
            [FAILURE_SCENARIOS.MODEL_UNAVAILABLE]: {
                message: 'AI assistant is temporarily unavailable. You can continue working manually.',
                capabilities: ['manual_input', 'view_data', 'basic_operations'],
                limitations: ['ai_suggestions', 'automated_analysis', 'smart_recommendations'],
                action: 'All core PMO functions remain available.'
            },
            [FAILURE_SCENARIOS.BUDGET_EXCEEDED]: {
                message: 'AI usage limit reached for this period.',
                capabilities: ['manual_input', 'view_data', 'basic_operations', 'cached_insights'],
                limitations: ['new_ai_requests', 'ai_analysis'],
                action: 'Contact admin to increase limits or wait for next billing cycle.'
            },
            [FAILURE_SCENARIOS.CONTEXT_INCOMPLETE]: {
                message: 'Insufficient context for AI analysis.',
                capabilities: ['partial_suggestions', 'manual_override'],
                limitations: ['full_ai_analysis'],
                action: 'Provide additional context or proceed with manual decision.'
            },
            [FAILURE_SCENARIOS.KNOWLEDGE_EMPTY]: {
                message: 'No knowledge base documents found for context.',
                capabilities: ['general_ai_assistance', 'manual_input'],
                limitations: ['contextual_rag', 'document_citations'],
                action: 'Upload relevant documents to improve AI context.'
            },
            [FAILURE_SCENARIOS.RATE_LIMITED]: {
                message: 'AI request queued due to rate limiting.',
                capabilities: ['queued_processing', 'manual_operations'],
                limitations: ['immediate_ai_response'],
                action: 'Request will be processed automatically. Continue with other tasks.'
            },
            [FAILURE_SCENARIOS.TIMEOUT]: {
                message: 'AI request timed out.',
                capabilities: ['retry', 'manual_operations'],
                limitations: ['immediate_ai_response'],
                action: 'You can retry or proceed manually.'
            }
        };

        return degradations[scenario] || {
            message: 'An error occurred with AI services.',
            capabilities: ['manual_operations'],
            limitations: ['ai_features'],
            action: 'Core system remains functional. AI features will resume when resolved.'
        };
    },

    // ==========================================
    // USER-FRIENDLY EXPLANATIONS
    // ==========================================

    /**
     * Generate user-friendly failure explanation
     */
    explainFailure: (scenario) => {
        const explanations = {
            [FAILURE_SCENARIOS.MODEL_UNAVAILABLE]: {
                title: 'AI Service Temporarily Unavailable',
                message: 'The AI service is experiencing issues. Don\'t worry - all your data is safe and core features continue to work.',
                technicalNote: 'Model service returned 5xx error',
                userAction: 'You can continue working manually. AI features will resume automatically when the service recovers.'
            },
            [FAILURE_SCENARIOS.BUDGET_EXCEEDED]: {
                title: 'AI Usage Limit Reached',
                message: 'You\'ve reached the AI usage limit for this period.',
                technicalNote: 'Token/cost budget exceeded',
                userAction: 'Contact your administrator to increase limits, or continue with manual operations.'
            },
            [FAILURE_SCENARIOS.CONTEXT_INCOMPLETE]: {
                title: 'More Information Needed',
                message: 'AI needs more context to provide a helpful response.',
                technicalNote: 'Required context parameters missing',
                userAction: 'Please provide additional details about your request.'
            },
            [FAILURE_SCENARIOS.KNOWLEDGE_EMPTY]: {
                title: 'No Reference Documents Found',
                message: 'AI couldn\'t find relevant documents to reference.',
                technicalNote: 'RAG query returned empty results',
                userAction: 'Upload project documents to the knowledge base for better AI assistance.'
            },
            [FAILURE_SCENARIOS.RATE_LIMITED]: {
                title: 'Too Many Requests',
                message: 'You\'re sending requests faster than we can process them.',
                technicalNote: 'Rate limit exceeded (429)',
                userAction: 'Please wait a moment and try again.'
            },
            [FAILURE_SCENARIOS.TIMEOUT]: {
                title: 'Request Timed Out',
                message: 'The AI request took longer than expected.',
                technicalNote: 'Request exceeded timeout threshold',
                userAction: 'This sometimes happens with complex requests. Try again or simplify your request.'
            },
            [FAILURE_SCENARIOS.PARSING_ERROR]: {
                title: 'Response Processing Error',
                message: 'We received a response but couldn\'t process it correctly.',
                technicalNote: 'JSON parsing failed',
                userAction: 'Please try again. If the problem persists, contact support.'
            },
            [FAILURE_SCENARIOS.AUTHENTICATION_ERROR]: {
                title: 'Authentication Issue',
                message: 'There was a problem verifying access to AI services.',
                technicalNote: 'API key invalid or expired',
                userAction: 'Contact your administrator to check AI service configuration.'
            }
        };

        return explanations[scenario] || {
            title: 'Unexpected Error',
            message: 'Something unexpected happened.',
            technicalNote: 'Unknown error',
            userAction: 'Please try again. If the problem persists, contact support.'
        };
    },

    // ==========================================
    // FAILURE LOGGING
    // ==========================================

    /**
     * Log a failure for monitoring
     */
    logFailure: async (failureType, details = {}) => {
        const id = uuidv4();
        const { userId, organizationId, projectId, errorMessage, errorCode, fallbackUsed, recoveryAction } = details;

        return new Promise((resolve) => {
            db.run(`
                INSERT INTO ai_failure_log 
                (id, failure_type, context, user_id, organization_id, project_id, error_message, error_code, fallback_used, recovery_action)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                id, failureType, JSON.stringify(details),
                userId, organizationId, projectId,
                errorMessage, errorCode,
                fallbackUsed || FALLBACK_STRATEGIES[failureType],
                recoveryAction || 'graceful_degradation'
            ], (err) => {
                if (err) console.error('[AIFailureHandler] Log error:', err);
                resolve({ id, logged: !err });
            });
        });
    },

    /**
     * Get recent failures for monitoring
     */
    getRecentFailures: async (organizationId = null, hours = 24) => {
        return new Promise((resolve, reject) => {
            let sql = `
                SELECT failure_type, COUNT(*) as count, 
                    MAX(occurred_at) as last_occurred,
                    GROUP_CONCAT(DISTINCT error_message) as error_messages
                FROM ai_failure_log
                WHERE occurred_at >= datetime('now', '-${hours} hours')
            `;
            const params = [];

            if (organizationId) {
                sql += ` AND organization_id = ?`;
                params.push(organizationId);
            }

            sql += ` GROUP BY failure_type ORDER BY count DESC`;

            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else {
                    const summary = {
                        totalFailures: (rows || []).reduce((sum, r) => sum + r.count, 0),
                        byType: {},
                        lastHours: hours
                    };

                    for (const row of (rows || [])) {
                        summary.byType[row.failure_type] = {
                            count: row.count,
                            lastOccurred: row.last_occurred,
                            sampleErrors: (row.error_messages || '').split(',').slice(0, 3)
                        };
                    }

                    resolve(summary);
                }
            });
        });
    },

    // ==========================================
    // RECOVERY
    // ==========================================

    /**
     * Reset failure count (called by scheduler or after recovery)
     */
    resetFailureCount: async () => {
        return AIFailureHandler._updateHealthStatus({
            failure_count_24h: 0,
            overall_status: HEALTH_STATUS.HEALTHY
        });
    },

    /**
     * Force health check and status update
     */
    forceHealthCheck: async () => {
        const recentFailures = await AIFailureHandler.getRecentFailures(null, 1);

        let status = HEALTH_STATUS.HEALTHY;
        if (recentFailures.totalFailures >= 10) {
            status = HEALTH_STATUS.UNAVAILABLE;
        } else if (recentFailures.totalFailures >= 3) {
            status = HEALTH_STATUS.DEGRADED;
        }

        await AIFailureHandler._updateHealthStatus({
            overall_status: status,
            last_check_at: new Date().toISOString()
        });

        return {
            status,
            recentFailures: recentFailures.totalFailures,
            checkedAt: new Date().toISOString()
        };
    },

    // ==========================================
    // NON-BLOCKING WRAPPER
    // ==========================================

    /**
     * Execute AI function without blocking PMO operations
     * Returns immediately if AI fails, allows PMO to continue
     */
    nonBlocking: async (aiFunction, defaultValue, context = {}) => {
        try {
            const result = await AIFailureHandler._withTimeout(aiFunction(), context.timeoutMs || 5000);
            return { value: result, fromAI: true };
        } catch (error) {
            // Don't block - return default and continue
            await AIFailureHandler.logFailure(
                AIFailureHandler._identifyFailureType(error),
                { ...context, errorMessage: error.message, recoveryAction: 'returned_default' }
            );
            return { value: defaultValue, fromAI: false, reason: 'AI unavailable, using default' };
        }
    }
};

module.exports = AIFailureHandler;

/**
 * AI Logger - Production-ready logging for AI services
 * Replaces console.log with structured logging
 * 
 * Features:
 * - Structured logging with log levels
 * - Distributed tracing support (OpenTelemetry compatible)
 * - Trace ID propagation
 * - Span tracking for AI operations
 * 
 * Part of Stability Excellence - Phase 2.2
 */

import { v4 as uuidv4 } from 'uuid';

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

// ============================================================================
// Distributed Tracing Support
// ============================================================================

/**
 * Trace Context for distributed tracing
 * Compatible with W3C Trace Context and OpenTelemetry
 */
class TraceContext {
    constructor(traceId = null, spanId = null, parentSpanId = null) {
        this.traceId = traceId || TraceContext.generateTraceId();
        this.spanId = spanId || TraceContext.generateSpanId();
        this.parentSpanId = parentSpanId;
        this.startTime = Date.now();
        this.attributes = {};
        this.events = [];
    }

    static generateTraceId() {
        // 32 hex characters (128 bits) - W3C Trace Context format
        return uuidv4().replace(/-/g, '');
    }

    static generateSpanId() {
        // 16 hex characters (64 bits) - W3C Trace Context format
        return uuidv4().replace(/-/g, '').substring(0, 16);
    }

    setAttribute(key, value) {
        this.attributes[key] = value;
        return this;
    }

    addEvent(name, attributes = {}) {
        this.events.push({
            name,
            timestamp: Date.now(),
            attributes
        });
        return this;
    }

    getDuration() {
        return Date.now() - this.startTime;
    }

    toJSON() {
        return {
            traceId: this.traceId,
            spanId: this.spanId,
            parentSpanId: this.parentSpanId,
            duration: this.getDuration(),
            attributes: this.attributes,
            events: this.events
        };
    }

    // W3C Trace Context header format
    toTraceparent() {
        return `00-${this.traceId}-${this.spanId}-01`;
    }

    static fromTraceparent(header) {
        if (!header) return null;
        const parts = header.split('-');
        if (parts.length !== 4) return null;
        return new TraceContext(parts[1], parts[2]);
    }
}

/**
 * Active spans storage (AsyncLocalStorage-like pattern)
 */
const activeSpans = new Map();
let currentTraceContext = null;

// Get log level from environment (default: INFO in production, DEBUG in development)
const getCurrentLevel = () => {
    const env = process.env.NODE_ENV || 'development';
    const configuredLevel = process.env.AI_LOG_LEVEL?.toUpperCase();

    if (configuredLevel && LOG_LEVELS[configuredLevel] !== undefined) {
        return LOG_LEVELS[configuredLevel];
    }

    return env === 'production' ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG;
};

const formatMessage = (level, component, message, data = null, traceContext = null) => {
    const timestamp = new Date().toISOString();
    const traceInfo = traceContext
        ? ` [trace:${traceContext.traceId.substring(0, 8)}] [span:${traceContext.spanId}]`
        : '';
    const base = `[${timestamp}] [${level}] [AI:${component}]${traceInfo} ${message}`;

    if (data && process.env.NODE_ENV !== 'production') {
        return `${base} ${JSON.stringify(data)}`;
    }

    return base;
};

const aiLogger = {
    currentLevel: getCurrentLevel(),

    // Get current trace context
    getTraceContext() {
        return currentTraceContext;
    },

    // Set current trace context
    setTraceContext(context) {
        currentTraceContext = context;
    },

    debug(component, message, data = null) {
        if (this.currentLevel <= LOG_LEVELS.DEBUG) {
            console.log(formatMessage('DEBUG', component, message, data, currentTraceContext));
        }
    },

    info(component, message, data = null) {
        if (this.currentLevel <= LOG_LEVELS.INFO) {
            console.log(formatMessage('INFO', component, message, data, currentTraceContext));
        }
    },

    warn(component, message, data = null) {
        if (this.currentLevel <= LOG_LEVELS.WARN) {
            console.warn(formatMessage('WARN', component, message, data, currentTraceContext));
        }
    },

    error(component, message, error = null) {
        if (this.currentLevel <= LOG_LEVELS.ERROR) {
            const errorData = error instanceof Error
                ? { message: error.message, stack: error.stack }
                : error;
            console.error(formatMessage('ERROR', component, message, errorData, currentTraceContext));
        }
    },

    // Specialized AI logging
    pipeline(action, data = null) {
        this.info('Pipeline', action, data);
    },

    rag(action, data = null) {
        this.info('RAG', action, data);
    },

    tool(toolName, status, data = null) {
        this.info('MCP', `${toolName}: ${status}`, data);
    },

    cache(action, hit = true) {
        this.debug('Cache', `${action}: ${hit ? 'HIT' : 'MISS'}`);
    },

    audit(action, data) {
        // Always log audit events (security-critical)
        console.log(formatMessage('AUDIT', 'Audit', action, data, currentTraceContext));
    },

    // ========================================================================
    // Distributed Tracing Methods
    // ========================================================================

    /**
     * Start a new trace
     * @param {string} operationName - Name of the operation being traced
     * @param {Object} attributes - Initial span attributes
     * @returns {TraceContext} The new trace context
     */
    startTrace(operationName, attributes = {}) {
        const context = new TraceContext();
        context.setAttribute('operation', operationName);
        Object.entries(attributes).forEach(([k, v]) => context.setAttribute(k, v));

        currentTraceContext = context;
        activeSpans.set(context.spanId, context);

        this.debug('Tracing', `Started trace: ${operationName}`, {
            traceId: context.traceId,
            spanId: context.spanId
        });

        return context;
    },

    /**
     * Start a child span within current trace
     * @param {string} operationName - Name of the span
     * @param {Object} attributes - Span attributes
     * @returns {TraceContext} The child span context
     */
    startSpan(operationName, attributes = {}) {
        const parentContext = currentTraceContext;
        const context = new TraceContext(
            parentContext?.traceId,
            TraceContext.generateSpanId(),
            parentContext?.spanId
        );

        context.setAttribute('operation', operationName);
        Object.entries(attributes).forEach(([k, v]) => context.setAttribute(k, v));

        currentTraceContext = context;
        activeSpans.set(context.spanId, context);

        this.debug('Tracing', `Started span: ${operationName}`, {
            traceId: context.traceId,
            spanId: context.spanId,
            parentSpanId: context.parentSpanId
        });

        return context;
    },

    /**
     * End a span and record its duration
     * @param {TraceContext} context - The span context to end
     * @param {string} status - 'OK' or 'ERROR'
     * @param {Object} finalAttributes - Additional attributes to record
     */
    endSpan(context, status = 'OK', finalAttributes = {}) {
        if (!context) return;

        context.setAttribute('status', status);
        context.setAttribute('duration_ms', context.getDuration());
        Object.entries(finalAttributes).forEach(([k, v]) => context.setAttribute(k, v));

        activeSpans.delete(context.spanId);

        // Restore parent context if exists
        if (context.parentSpanId && activeSpans.has(context.parentSpanId)) {
            currentTraceContext = activeSpans.get(context.parentSpanId);
        } else if (activeSpans.size > 0) {
            // Get any remaining span
            currentTraceContext = activeSpans.values().next().value;
        } else {
            currentTraceContext = null;
        }

        this.debug('Tracing', `Ended span: ${context.attributes.operation}`, {
            traceId: context.traceId,
            spanId: context.spanId,
            duration: context.getDuration(),
            status
        });

        // Record to persistence if enabled
        if (process.env.TRACING_PERSIST === 'true') {
            this._persistSpan(context);
        }

        return context;
    },

    /**
     * Record an event within the current span
     * @param {string} name - Event name
     * @param {Object} attributes - Event attributes
     */
    recordEvent(name, attributes = {}) {
        if (currentTraceContext) {
            currentTraceContext.addEvent(name, attributes);
            this.debug('Tracing', `Event: ${name}`, attributes);
        }
    },

    /**
     * Add attribute to current span
     * @param {string} key - Attribute key
     * @param {any} value - Attribute value
     */
    setAttribute(key, value) {
        if (currentTraceContext) {
            currentTraceContext.setAttribute(key, value);
        }
    },

    /**
     * Execute a function within a traced span
     * @param {string} operationName - Name of the operation
     * @param {Function} fn - Function to execute
     * @param {Object} attributes - Initial span attributes
     * @returns {Promise<any>} Result of the function
     */
    async withSpan(operationName, fn, attributes = {}) {
        const span = this.startSpan(operationName, attributes);
        try {
            const result = await fn(span);
            this.endSpan(span, 'OK');
            return result;
        } catch (error) {
            span.setAttribute('error', true);
            span.setAttribute('error.message', error.message);
            this.endSpan(span, 'ERROR', { error: error.message });
            throw error;
        }
    },

    /**
     * Get W3C traceparent header for propagation
     * @returns {string|null} Traceparent header value
     */
    getTraceparent() {
        return currentTraceContext?.toTraceparent() || null;
    },

    /**
     * Set trace context from incoming traceparent header
     * @param {string} traceparent - W3C traceparent header
     */
    setTraceparentContext(traceparent) {
        const context = TraceContext.fromTraceparent(traceparent);
        if (context) {
            currentTraceContext = context;
            activeSpans.set(context.spanId, context);
        }
    },

    /**
     * Persist span to database (for analysis)
     * @private
     */
    _persistSpan(context) {
        // This can be extended to write to a database or external tracing service
        // For now, just log in a parseable format
        const spanData = {
            type: 'AI_TRACE_SPAN',
            ...context.toJSON(),
            timestamp: new Date().toISOString()
        };

        // In production, send to tracing backend (Jaeger, Zipkin, etc.)
        if (process.env.NODE_ENV === 'production') {
            // Could POST to tracing collector here
            console.log(JSON.stringify(spanData));
        }
    },

    /**
     * Get all active spans (for debugging)
     * @returns {Array} Active span contexts
     */
    getActiveSpans() {
        return Array.from(activeSpans.values()).map(s => s.toJSON());
    },

    /**
     * Clear all spans (for testing)
     */
    clearSpans() {
        activeSpans.clear();
        currentTraceContext = null;
    }
};

export { aiLogger, LOG_LEVELS, TraceContext };

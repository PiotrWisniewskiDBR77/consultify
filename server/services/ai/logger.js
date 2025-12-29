/**
 * AI Logger - Production-ready logging for AI services
 * Replaces console.log with structured logging
 */

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

// Get log level from environment (default: INFO in production, DEBUG in development)
const getCurrentLevel = () => {
    const env = process.env.NODE_ENV || 'development';
    const configuredLevel = process.env.AI_LOG_LEVEL?.toUpperCase();

    if (configuredLevel && LOG_LEVELS[configuredLevel] !== undefined) {
        return LOG_LEVELS[configuredLevel];
    }

    return env === 'production' ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG;
};

const formatMessage = (level, component, message, data = null) => {
    const timestamp = new Date().toISOString();
    const base = `[${timestamp}] [${level}] [AI:${component}] ${message}`;

    if (data && process.env.NODE_ENV !== 'production') {
        return `${base} ${JSON.stringify(data)}`;
    }

    return base;
};

const aiLogger = {
    currentLevel: getCurrentLevel(),

    debug(component, message, data = null) {
        if (this.currentLevel <= LOG_LEVELS.DEBUG) {
            console.log(formatMessage('DEBUG', component, message, data));
        }
    },

    info(component, message, data = null) {
        if (this.currentLevel <= LOG_LEVELS.INFO) {
            console.log(formatMessage('INFO', component, message, data));
        }
    },

    warn(component, message, data = null) {
        if (this.currentLevel <= LOG_LEVELS.WARN) {
            console.warn(formatMessage('WARN', component, message, data));
        }
    },

    error(component, message, error = null) {
        if (this.currentLevel <= LOG_LEVELS.ERROR) {
            const errorData = error instanceof Error
                ? { message: error.message, stack: error.stack }
                : error;
            console.error(formatMessage('ERROR', component, message, errorData));
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
        console.log(formatMessage('AUDIT', 'Audit', action, data));
    }
};

module.exports = { aiLogger, LOG_LEVELS };

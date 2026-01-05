/**
 * AI Logger
 * Centralized logging for AI services
 */

export const aiLogger = {
    info: (...args) => console.log('[AI]', ...args),
    error: (...args) => console.error('[AI ERROR]', ...args),
    warn: (...args) => console.warn('[AI WARN]', ...args),
    debug: (...args) => console.debug('[AI DEBUG]', ...args)
};

export default aiLogger;

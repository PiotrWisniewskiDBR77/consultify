/**
 * PII Redactor Utility
 * Step 14: Governance, Security & Enterprise Controls
 * 
 * Redacts personally identifiable information from audit logs and exports.
 * Ensures SOC2/ISO compliance for data privacy.
 */

const DEFAULT_PII_FIELDS = [
    'email',
    'name',
    'first_name',
    'firstName',
    'last_name',
    'lastName',
    'password',
    'token',
    'secret',
    'api_key',
    'apiKey',
    'access_token',
    'accessToken',
    'refresh_token',
    'refreshToken',
    'bearer',
    'authorization',
    'phone',
    'phone_number',
    'ssn',
    'credit_card',
    'creditCard'
];

const REDACTION_PLACEHOLDER = '[REDACTED]';

/**
 * Email regex pattern
 * Matches standard email formats
 */
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

/**
 * JWT/Bearer token regex pattern
 * Matches Bearer tokens and JWT-like strings
 */
const TOKEN_REGEX = /\b(Bearer\s+)?[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\b/gi;

/**
 * Deep clone helper
 */
const deepClone = (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(deepClone);
    return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [k, deepClone(v)])
    );
};

/**
 * Check if a field name matches PII fields (case-insensitive)
 */
const isPiiField = (fieldName, fieldsToRedact) => {
    const lowerField = fieldName.toLowerCase();
    return fieldsToRedact.some(pii => lowerField.includes(pii.toLowerCase()));
};

const PiiRedactor = {
    DEFAULT_PII_FIELDS,
    REDACTION_PLACEHOLDER,

    /**
     * Redact PII fields from an object (deep)
     * @param {Object} obj - Object to redact
     * @param {Array<string>} fieldsToRedact - Optional custom fields to redact
     * @returns {Object} - Redacted copy of the object
     */
    redact: (obj, fieldsToRedact = DEFAULT_PII_FIELDS) => {
        if (obj === null || obj === undefined) return obj;
        if (typeof obj !== 'object') {
            // For string values, redact emails and tokens
            if (typeof obj === 'string') {
                return PiiRedactor.redactEmails(PiiRedactor.redactTokens(obj));
            }
            return obj;
        }

        const redacted = deepClone(obj);
        PiiRedactor._redactRecursive(redacted, fieldsToRedact);
        return redacted;
    },

    /**
     * Internal recursive redaction
     */
    _redactRecursive: (obj, fieldsToRedact) => {
        if (obj === null || typeof obj !== 'object') return;

        for (const key of Object.keys(obj)) {
            const value = obj[key];

            if (isPiiField(key, fieldsToRedact)) {
                obj[key] = REDACTION_PLACEHOLDER;
            } else if (typeof value === 'string') {
                // Redact inline emails and tokens
                obj[key] = PiiRedactor.redactEmails(PiiRedactor.redactTokens(value));
            } else if (Array.isArray(value)) {
                value.forEach((item, idx) => {
                    if (typeof item === 'object' && item !== null) {
                        PiiRedactor._redactRecursive(item, fieldsToRedact);
                    } else if (typeof item === 'string') {
                        value[idx] = PiiRedactor.redactEmails(PiiRedactor.redactTokens(item));
                    }
                });
            } else if (typeof value === 'object' && value !== null) {
                PiiRedactor._redactRecursive(value, fieldsToRedact);
            }
        }
    },

    /**
     * Redact email addresses in text
     * @param {string} text - Text to process
     * @returns {string} - Text with emails redacted
     */
    redactEmails: (text) => {
        if (typeof text !== 'string') return text;
        return text.replace(EMAIL_REGEX, REDACTION_PLACEHOLDER);
    },

    /**
     * Redact JWT/Bearer tokens in text
     * @param {string} text - Text to process
     * @returns {string} - Text with tokens redacted
     */
    redactTokens: (text) => {
        if (typeof text !== 'string') return text;
        return text.replace(TOKEN_REGEX, REDACTION_PLACEHOLDER);
    },

    /**
     * Redact specific keys from an object (shallow)
     * @param {Object} obj - Object to redact
     * @param {Array<string>} keys - Keys to redact
     * @returns {Object} - Redacted copy
     */
    redactKeys: (obj, keys) => {
        if (obj === null || typeof obj !== 'object') return obj;
        const redacted = { ...obj };
        keys.forEach(key => {
            if (key in redacted) {
                redacted[key] = REDACTION_PLACEHOLDER;
            }
        });
        return redacted;
    },

    /**
     * Create a safe snapshot for audit logging
     * @param {Object} data - Data to snapshot
     * @returns {string} - JSON string with PII redacted
     */
    createAuditSnapshot: (data) => {
        const redacted = PiiRedactor.redact(data);
        return JSON.stringify(redacted);
    }
};

module.exports = PiiRedactor;

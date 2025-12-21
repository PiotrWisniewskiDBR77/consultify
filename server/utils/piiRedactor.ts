/**
 * PII Redactor Utility
 * Step 14: Governance, Security & Enterprise Controls
 * 
 * Redacts personally identifiable information from audit logs and exports.
 * Ensures SOC2/ISO compliance for data privacy.
 */

export const DEFAULT_PII_FIELDS = [
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
] as const;

export const REDACTION_PLACEHOLDER = '[REDACTED]';

/**
 * Email regex pattern
 * Matches standard email formats
 */
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z9.-]+\.[A-Z|a-z]{2,}\b/g;

/**
 * JWT/Bearer token regex pattern
 * Matches Bearer tokens and JWT-like strings
 */
const TOKEN_REGEX = /\b(Bearer\s+)?[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\b/gi;

type RedactableValue = string | number | boolean | null | undefined | Record<string, unknown> | unknown[];

/**
 * Deep clone helper
 */
const deepClone = <T>(obj: T): T => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(deepClone) as unknown as T;
    return Object.fromEntries(
        Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, deepClone(v)])
    ) as T;
};

/**
 * Check if a field name matches PII fields (case-insensitive)
 */
const isPiiField = (fieldName: string, fieldsToRedact: readonly string[]): boolean => {
    const lowerField = fieldName.toLowerCase();
    return fieldsToRedact.some(pii => lowerField.includes(pii.toLowerCase()));
};

interface PiiRedactor {
    DEFAULT_PII_FIELDS: readonly string[];
    REDACTION_PLACEHOLDER: string;
    redact: <T>(obj: T, fieldsToRedact?: readonly string[]) => T;
    _redactRecursive: (obj: Record<string, unknown>, fieldsToRedact: readonly string[]) => void;
    redactEmails: (text: string) => string;
    redactTokens: (text: string) => string;
    redactKeys: <T extends Record<string, unknown>>(obj: T, keys: string[]) => T;
    createAuditSnapshot: (data: unknown) => string;
}

const PiiRedactor: PiiRedactor = {
    DEFAULT_PII_FIELDS,
    REDACTION_PLACEHOLDER,

    /**
     * Redact PII fields from an object (deep)
     */
    redact: <T>(obj: T, fieldsToRedact: readonly string[] = DEFAULT_PII_FIELDS): T => {
        if (obj === null || obj === undefined) return obj;
        if (typeof obj !== 'object') {
            // For string values, redact emails and tokens
            if (typeof obj === 'string') {
                return PiiRedactor.redactEmails(PiiRedactor.redactTokens(obj)) as T;
            }
            return obj;
        }

        const redacted = deepClone(obj);
        if (typeof redacted === 'object' && redacted !== null && !Array.isArray(redacted)) {
            PiiRedactor._redactRecursive(redacted as Record<string, unknown>, fieldsToRedact);
        }
        return redacted;
    },

    /**
     * Internal recursive redaction
     */
    _redactRecursive: (obj: Record<string, unknown>, fieldsToRedact: readonly string[]): void => {
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
                        PiiRedactor._redactRecursive(item as Record<string, unknown>, fieldsToRedact);
                    } else if (typeof item === 'string') {
                        value[idx] = PiiRedactor.redactEmails(PiiRedactor.redactTokens(item));
                    }
                });
            } else if (typeof value === 'object' && value !== null) {
                PiiRedactor._redactRecursive(value as Record<string, unknown>, fieldsToRedact);
            }
        }
    },

    /**
     * Redact email addresses in text
     */
    redactEmails: (text: string): string => {
        if (typeof text !== 'string') return text;
        return text.replace(EMAIL_REGEX, REDACTION_PLACEHOLDER);
    },

    /**
     * Redact JWT/Bearer tokens in text
     */
    redactTokens: (text: string): string => {
        if (typeof text !== 'string') return text;
        return text.replace(TOKEN_REGEX, REDACTION_PLACEHOLDER);
    },

    /**
     * Redact specific keys from an object (shallow)
     */
    redactKeys: <T extends Record<string, unknown>>(obj: T, keys: string[]): T => {
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
     */
    createAuditSnapshot: (data: unknown): string => {
        const redacted = PiiRedactor.redact(data);
        return JSON.stringify(redacted);
    }
};

export default PiiRedactor;


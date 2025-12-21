/**
 * Secrets Vault Service
 * Step 17: Integrations & Secrets Platform
 * 
 * Provides AES-256-GCM encryption for connector secrets.
 * Key is loaded from CONNECTOR_ENCRYPTION_KEY environment variable.
 */

const crypto = require('crypto');

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Get encryption key from environment.
 * Must be 32 bytes (64 hex characters) for AES-256.
 * @returns {Buffer} Encryption key
 */
function getEncryptionKey() {
    const keyHex = process.env.CONNECTOR_ENCRYPTION_KEY;

    // For development/testing, use a default key (NOT for production!)
    if (!keyHex) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('CONNECTOR_ENCRYPTION_KEY environment variable is required in production');
        }
        // Development fallback key (32 bytes = 64 hex chars)
        return Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex');
    }

    const key = Buffer.from(keyHex, 'hex');
    if (key.length !== 32) {
        throw new Error('CONNECTOR_ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
    }
    return key;
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * @param {string|Object} data - Data to encrypt (objects are JSON serialized)
 * @returns {string} Base64-encoded encrypted blob containing IV + AuthTag + Ciphertext
 */
function encrypt(data) {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    // Serialize objects to JSON
    const plaintext = typeof data === 'string' ? data : JSON.stringify(data);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    const authTag = cipher.getAuthTag();

    // Combine: IV (12 bytes) + AuthTag (16 bytes) + Ciphertext
    const combined = Buffer.concat([iv, authTag, encrypted]);

    return combined.toString('base64');
}

/**
 * Decrypt an encrypted blob.
 * @param {string} encryptedBlob - Base64-encoded encrypted data
 * @param {boolean} [parseJson=true] - Whether to parse result as JSON
 * @returns {string|Object} Decrypted data
 */
function decrypt(encryptedBlob, parseJson = true) {
    if (!encryptedBlob) {
        return null;
    }

    const key = getEncryptionKey();
    const combined = Buffer.from(encryptedBlob, 'base64');

    if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
        throw new Error('Invalid encrypted data: too short');
    }

    // Extract components
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    const result = decrypted.toString('utf8');

    if (parseJson) {
        try {
            return JSON.parse(result);
        } catch {
            return result;
        }
    }

    return result;
}

/**
 * Redact secrets for safe API responses.
 * Replaces all values with masked versions showing only last 4 characters.
 * @param {Object} secrets - Object containing secret values
 * @returns {Object} Redacted secrets object
 */
function redact(secrets) {
    if (!secrets || typeof secrets !== 'object') {
        return {};
    }

    const redacted = {};

    for (const [key, value] of Object.entries(secrets)) {
        if (typeof value === 'string' && value.length > 4) {
            redacted[key] = '****' + value.slice(-4);
        } else if (typeof value === 'string') {
            redacted[key] = '****';
        } else if (typeof value === 'object' && value !== null) {
            redacted[key] = redact(value);
        } else {
            redacted[key] = '****';
        }
    }

    return redacted;
}

/**
 * Validate that required secret fields are present.
 * @param {Object} secrets - Secrets object to validate
 * @param {string[]} requiredFields - List of required field names
 * @returns {{ valid: boolean, missing: string[] }}
 */
function validateSecrets(secrets, requiredFields = []) {
    if (!secrets || typeof secrets !== 'object') {
        return { valid: false, missing: requiredFields };
    }

    const missing = requiredFields.filter(field => !secrets[field]);

    return {
        valid: missing.length === 0,
        missing
    };
}

module.exports = {
    encrypt,
    decrypt,
    redact,
    validateSecrets,
    // Export for testing
    ALGORITHM,
    IV_LENGTH,
    AUTH_TAG_LENGTH
};

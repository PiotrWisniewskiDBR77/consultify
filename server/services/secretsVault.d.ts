declare namespace _default {
    export { encrypt };
    export { decrypt };
    export { redact };
    export { validateSecrets };
    export { ALGORITHM };
    export { IV_LENGTH };
    export { AUTH_TAG_LENGTH };
}
export default _default;
/**
 * Encrypt plaintext using AES-256-GCM.
 * @param {string|Object} data - Data to encrypt (objects are JSON serialized)
 * @returns {string} Base64-encoded encrypted blob containing IV + AuthTag + Ciphertext
 */
export function encrypt(data: string | Object): string;
/**
 * Decrypt an encrypted blob.
 * @param {string} encryptedBlob - Base64-encoded encrypted data
 * @param {boolean} [parseJson=true] - Whether to parse result as JSON
 * @returns {string|Object} Decrypted data
 */
export function decrypt(encryptedBlob: string, parseJson?: boolean): string | Object;
/**
 * Redact secrets for safe API responses.
 * Replaces all values with masked versions showing only last 4 characters.
 * @param {Object} secrets - Object containing secret values
 * @returns {Object} Redacted secrets object
 */
export function redact(secrets: Object): Object;
/**
 * Validate that required secret fields are present.
 * @param {Object} secrets - Secrets object to validate
 * @param {string[]} requiredFields - List of required field names
 * @returns {{ valid: boolean, missing: string[] }}
 */
export function validateSecrets(secrets: Object, requiredFields?: string[]): {
    valid: boolean;
    missing: string[];
};
export const ALGORITHM: "aes-256-gcm";
export const IV_LENGTH: 12;
export const AUTH_TAG_LENGTH: 16;
//# sourceMappingURL=secretsVault.d.ts.map
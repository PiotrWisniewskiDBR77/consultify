import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

describe('SecretsVault Service', () => {
    let secretsVault;

    beforeEach(async () => {
        vi.resetModules();
        // Clear env to use default dev key
        delete process.env.CONNECTOR_ENCRYPTION_KEY;
        secretsVault = require('../../server/services/secretsVault');
    });

    describe('Encryption/Decryption', () => {
        it('should encrypt and decrypt a string successfully', () => {
            const plaintext = 'my-secret-api-key-12345';
            const encrypted = secretsVault.encrypt(plaintext);

            expect(encrypted).toBeDefined();
            expect(encrypted).not.toBe(plaintext);
            expect(typeof encrypted).toBe('string');

            const decrypted = secretsVault.decrypt(encrypted, false);
            expect(decrypted).toBe(plaintext);
        });

        it('should encrypt and decrypt an object successfully', () => {
            const secrets = {
                api_token: 'xoxb-1234567890',
                webhook_url: 'https://hooks.slack.com/services/T00/B00/xxx'
            };

            const encrypted = secretsVault.encrypt(secrets);
            expect(encrypted).toBeDefined();

            const decrypted = secretsVault.decrypt(encrypted, true);
            expect(decrypted).toEqual(secrets);
        });

        it('should return null when decrypting null/undefined', () => {
            expect(secretsVault.decrypt(null)).toBeNull();
            expect(secretsVault.decrypt(undefined)).toBeNull();
        });

        it('should throw on invalid encrypted data', () => {
            expect(() => secretsVault.decrypt('invalid-base64!')).toThrow();
        });

        it('should produce different ciphertext for same plaintext (random IV)', () => {
            const plaintext = 'same-secret';
            const encrypted1 = secretsVault.encrypt(plaintext);
            const encrypted2 = secretsVault.encrypt(plaintext);

            expect(encrypted1).not.toBe(encrypted2);

            // But both should decrypt to same value
            expect(secretsVault.decrypt(encrypted1, false)).toBe(plaintext);
            expect(secretsVault.decrypt(encrypted2, false)).toBe(plaintext);
        });
    });

    describe('Redaction', () => {
        it('should redact string values showing only last 4 characters', () => {
            const secrets = {
                api_token: 'xoxb-1234567890-abcdef'
            };

            const redacted = secretsVault.redact(secrets);
            expect(redacted.api_token).toBe('****cdef');
        });

        it('should fully redact short strings', () => {
            const secrets = { short: 'abc' };
            const redacted = secretsVault.redact(secrets);
            expect(redacted.short).toBe('****');
        });

        it('should recursively redact nested objects', () => {
            const secrets = {
                oauth: {
                    client_id: 'client-12345',
                    client_secret: 'secret-67890'
                }
            };

            const redacted = secretsVault.redact(secrets);
            expect(redacted.oauth.client_id).toBe('****2345');
            expect(redacted.oauth.client_secret).toBe('****7890');
        });

        it('should return empty object for null/undefined', () => {
            expect(secretsVault.redact(null)).toEqual({});
            expect(secretsVault.redact(undefined)).toEqual({});
        });
    });

    describe('Validation', () => {
        it('should validate present fields as valid', () => {
            const secrets = { api_token: 'token123', domain: 'example.com' };
            const result = secretsVault.validateSecrets(secrets, ['api_token', 'domain']);

            expect(result.valid).toBe(true);
            expect(result.missing).toEqual([]);
        });

        it('should identify missing fields', () => {
            const secrets = { api_token: 'token123' };
            const result = secretsVault.validateSecrets(secrets, ['api_token', 'domain', 'email']);

            expect(result.valid).toBe(false);
            expect(result.missing).toContain('domain');
            expect(result.missing).toContain('email');
            expect(result.missing).not.toContain('api_token');
        });

        it('should handle null/undefined secrets', () => {
            const result = secretsVault.validateSecrets(null, ['api_token']);
            expect(result.valid).toBe(false);
            expect(result.missing).toEqual(['api_token']);
        });
    });
});

/**
 * SecretsVault Tests
 * 
 * Tests for secrets encryption and decryption service.
 */

const SecretsVault = require('../../../server/src/services/secretsVault');

describe('SecretsVault', () => {
    const originalEnv = process.env.CONNECTOR_ENCRYPTION_KEY;

    beforeEach(() => {
        // Set test encryption key
        process.env.CONNECTOR_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    });

    afterEach(() => {
        // Restore original env
        if (originalEnv) {
            process.env.CONNECTOR_ENCRYPTION_KEY = originalEnv;
        } else {
            delete process.env.CONNECTOR_ENCRYPTION_KEY;
        }
    });

    describe('encrypt', () => {
        it('should encrypt string data', () => {
            const plaintext = 'secret-api-key-12345';
            const encrypted = SecretsVault.encrypt(plaintext);

            expect(encrypted).toBeDefined();
            expect(typeof encrypted).toBe('string');
            expect(encrypted).not.toBe(plaintext);
        });

        it('should encrypt object data', () => {
            const data = { apiKey: 'secret', password: 'password123' };
            const encrypted = SecretsVault.encrypt(data);

            expect(encrypted).toBeDefined();
            expect(typeof encrypted).toBe('string');
        });

        it('should produce different output for same input (IV randomization)', () => {
            const plaintext = 'same-secret';
            const encrypted1 = SecretsVault.encrypt(plaintext);
            const encrypted2 = SecretsVault.encrypt(plaintext);

            // Should be different due to random IV
            expect(encrypted1).not.toBe(encrypted2);
        });

        it('should produce base64 encoded output', () => {
            const plaintext = 'test-secret';
            const encrypted = SecretsVault.encrypt(plaintext);

            // Base64 characters only
            expect(encrypted).toMatch(/^[A-Za-z0-9+/=]+$/);
        });
    });

    describe('decrypt', () => {
        it('should decrypt encrypted string', () => {
            const plaintext = 'secret-api-key-12345';
            const encrypted = SecretsVault.encrypt(plaintext);
            const decrypted = SecretsVault.decrypt(encrypted, false);

            expect(decrypted).toBe(plaintext);
        });

        it('should decrypt encrypted object', () => {
            const data = { apiKey: 'secret', password: 'password123' };
            const encrypted = SecretsVault.encrypt(data);
            const decrypted = SecretsVault.decrypt(encrypted);

            expect(decrypted).toEqual(data);
        });

        it('should parse JSON by default', () => {
            const data = { key: 'value' };
            const encrypted = SecretsVault.encrypt(data);
            const decrypted = SecretsVault.decrypt(encrypted);

            expect(typeof decrypted).toBe('object');
            expect(decrypted.key).toBe('value');
        });

        it('should return string when parseJson is false', () => {
            const plaintext = 'simple-string';
            const encrypted = SecretsVault.encrypt(plaintext);
            const decrypted = SecretsVault.decrypt(encrypted, false);

            expect(typeof decrypted).toBe('string');
            expect(decrypted).toBe(plaintext);
        });

        it('should return null for empty input', () => {
            const decrypted = SecretsVault.decrypt(null);

            expect(decrypted).toBeNull();
        });

        it('should throw error for invalid encrypted data', () => {
            expect(() => {
                SecretsVault.decrypt('invalid-base64-data');
            }).toThrow();
        });

        it('should throw error for tampered data', () => {
            const plaintext = 'secret';
            const encrypted = SecretsVault.encrypt(plaintext);
            const tampered = encrypted.slice(0, -5) + 'XXXXX';

            expect(() => {
                SecretsVault.decrypt(tampered);
            }).toThrow();
        });
    });

    describe('encrypt and decrypt roundtrip', () => {
        it('should handle complex nested objects', () => {
            const data = {
                apiKey: 'secret-key',
                config: {
                    host: 'api.example.com',
                    port: 443,
                    headers: {
                        'Authorization': 'Bearer token'
                    }
                },
                array: [1, 2, 3]
            };

            const encrypted = SecretsVault.encrypt(data);
            const decrypted = SecretsVault.decrypt(encrypted);

            expect(decrypted).toEqual(data);
        });

        it('should handle special characters', () => {
            const plaintext = 'secret!@#$%^&*()_+-=[]{}|;:,.<>?';
            const encrypted = SecretsVault.encrypt(plaintext);
            const decrypted = SecretsVault.decrypt(encrypted, false);

            expect(decrypted).toBe(plaintext);
        });

        it('should handle unicode characters', () => {
            const plaintext = 'secret-密钥-パスワード';
            const encrypted = SecretsVault.encrypt(plaintext);
            const decrypted = SecretsVault.decrypt(encrypted, false);

            expect(decrypted).toBe(plaintext);
        });

        it('should handle empty string', () => {
            const plaintext = '';
            const encrypted = SecretsVault.encrypt(plaintext);
            const decrypted = SecretsVault.decrypt(encrypted, false);

            expect(decrypted).toBe(plaintext);
        });
    });

    describe('encryption key handling', () => {
        it('should use environment variable when set', () => {
            const customKey = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
            process.env.CONNECTOR_ENCRYPTION_KEY = customKey;

            const plaintext = 'test';
            const encrypted = SecretsVault.encrypt(plaintext);
            const decrypted = SecretsVault.decrypt(encrypted, false);

            expect(decrypted).toBe(plaintext);
        });

        it('should throw error for invalid key length in production', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';
            process.env.CONNECTOR_ENCRYPTION_KEY = 'short-key';

            expect(() => {
                SecretsVault.encrypt('test');
            }).toThrow('CONNECTOR_ENCRYPTION_KEY must be 32 bytes');

            process.env.NODE_ENV = originalEnv;
        });

        it('should use default key in development when not set', () => {
            delete process.env.CONNECTOR_ENCRYPTION_KEY;
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';

            const plaintext = 'test';
            const encrypted = SecretsVault.encrypt(plaintext);
            const decrypted = SecretsVault.decrypt(encrypted, false);

            expect(decrypted).toBe(plaintext);

            process.env.NODE_ENV = originalEnv;
        });
    });
});












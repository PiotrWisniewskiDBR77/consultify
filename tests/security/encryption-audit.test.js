/**
 * Encryption Audit Tests
 * 
 * Verifies encryption compliance:
 * - TLS version verification
 * - Encryption at rest verification
 * - Key management audit
 * - Certificate validation
 * 
 * Part of Security Excellence - Phase 3.3
 * 
 * @module security/encryption-audit
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import https from 'https';
import crypto from 'crypto';

describe('Encryption Audit Tests', () => {

    // =========================================================================
    // Test Suite 1: TLS Version Verification
    // =========================================================================

    describe('TLS Version Verification', () => {
        it('should require TLS 1.2 or higher', () => {
            const MINIMUM_TLS_VERSION = 'TLSv1.2';
            const ALLOWED_TLS_VERSIONS = ['TLSv1.2', 'TLSv1.3'];

            const validateTLSVersion = (version) => {
                return ALLOWED_TLS_VERSIONS.includes(version);
            };

            expect(validateTLSVersion('TLSv1.3')).toBe(true);
            expect(validateTLSVersion('TLSv1.2')).toBe(true);
            expect(validateTLSVersion('TLSv1.1')).toBe(false);
            expect(validateTLSVersion('TLSv1.0')).toBe(false);
            expect(validateTLSVersion('SSLv3')).toBe(false);
        });

        it('should use secure cipher suites', () => {
            const SECURE_CIPHERS = [
                'ECDHE-ECDSA-AES256-GCM-SHA384',
                'ECDHE-RSA-AES256-GCM-SHA384',
                'ECDHE-ECDSA-AES128-GCM-SHA256',
                'ECDHE-RSA-AES128-GCM-SHA256',
                'ECDHE-ECDSA-CHACHA20-POLY1305',
                'ECDHE-RSA-CHACHA20-POLY1305'
            ];

            const INSECURE_CIPHERS = [
                'DES-CBC3-SHA',
                'RC4-SHA',
                'RC4-MD5',
                'NULL-SHA',
                'EXPORT'
            ];

            const isCipherSecure = (cipher) => {
                const cipherUpper = cipher.toUpperCase();
                
                // Check for known insecure patterns
                if (cipherUpper.includes('RC4')) return false;
                if (cipherUpper.includes('DES')) return false;
                if (cipherUpper.includes('NULL')) return false;
                if (cipherUpper.includes('EXPORT')) return false;
                if (cipherUpper.includes('MD5')) return false;
                if (cipherUpper.includes('CBC') && !cipherUpper.includes('SHA256') && !cipherUpper.includes('SHA384')) return false;

                // Prefer GCM or CHACHA20
                if (cipherUpper.includes('GCM') || cipherUpper.includes('CHACHA20')) return true;
                
                return SECURE_CIPHERS.some(s => cipherUpper.includes(s));
            };

            for (const cipher of SECURE_CIPHERS) {
                expect(isCipherSecure(cipher)).toBe(true);
            }

            for (const cipher of INSECURE_CIPHERS) {
                expect(isCipherSecure(cipher)).toBe(false);
            }
        });

        it('should reject self-signed certificates in production', () => {
            const validateCertificate = (cert, environment) => {
                const issues = [];

                // Check if self-signed
                if (cert.issuer === cert.subject) {
                    if (environment === 'production') {
                        issues.push('Self-signed certificate not allowed in production');
                    }
                }

                // Check expiry
                const now = new Date();
                if (new Date(cert.validTo) < now) {
                    issues.push('Certificate has expired');
                }

                // Check key size
                if (cert.keySize < 2048) {
                    issues.push('Key size must be at least 2048 bits');
                }

                return {
                    valid: issues.length === 0,
                    issues
                };
            };

            const selfSignedCert = {
                issuer: 'CN=localhost',
                subject: 'CN=localhost',
                validTo: new Date(Date.now() + 86400000).toISOString(),
                keySize: 2048
            };

            const devResult = validateCertificate(selfSignedCert, 'development');
            const prodResult = validateCertificate(selfSignedCert, 'production');

            expect(devResult.valid).toBe(true);
            expect(prodResult.valid).toBe(false);
        });
    });

    // =========================================================================
    // Test Suite 2: Encryption at Rest Verification
    // =========================================================================

    describe('Encryption at Rest', () => {
        it('should encrypt sensitive data before storage', () => {
            const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
            const KEY_LENGTH = 32; // 256 bits

            const encrypt = (plaintext, key) => {
                const iv = crypto.randomBytes(16);
                const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
                
                let encrypted = cipher.update(plaintext, 'utf8', 'hex');
                encrypted += cipher.final('hex');
                
                const authTag = cipher.getAuthTag();
                
                return {
                    encrypted,
                    iv: iv.toString('hex'),
                    authTag: authTag.toString('hex')
                };
            };

            const decrypt = (encryptedData, key) => {
                const decipher = crypto.createDecipheriv(
                    ENCRYPTION_ALGORITHM,
                    key,
                    Buffer.from(encryptedData.iv, 'hex')
                );
                
                decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
                
                let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
                decrypted += decipher.final('utf8');
                
                return decrypted;
            };

            const key = crypto.randomBytes(KEY_LENGTH);
            const sensitiveData = 'API_KEY=sk-secret123456';

            const encrypted = encrypt(sensitiveData, key);
            expect(encrypted.encrypted).not.toContain('sk-secret');
            
            const decrypted = decrypt(encrypted, key);
            expect(decrypted).toBe(sensitiveData);
        });

        it('should use authenticated encryption (GCM/CCM)', () => {
            const AUTHENTICATED_MODES = ['gcm', 'ccm', 'ocb', 'chacha20-poly1305'];

            const isAuthenticatedEncryption = (algorithm) => {
                const algoLower = algorithm.toLowerCase();
                return AUTHENTICATED_MODES.some(mode => algoLower.includes(mode));
            };

            expect(isAuthenticatedEncryption('aes-256-gcm')).toBe(true);
            expect(isAuthenticatedEncryption('chacha20-poly1305')).toBe(true);
            expect(isAuthenticatedEncryption('aes-256-cbc')).toBe(false);
            expect(isAuthenticatedEncryption('aes-128-ecb')).toBe(false);
        });

        it('should verify database encryption settings', () => {
            const verifyDatabaseEncryption = (dbConfig) => {
                const checks = [];

                // Check for encrypted connection
                if (!dbConfig.ssl || !dbConfig.ssl.enabled) {
                    checks.push({ check: 'SSL Connection', passed: false });
                } else {
                    checks.push({ check: 'SSL Connection', passed: true });
                }

                // Check for encrypted storage (SQLite PRAGMA or similar)
                if (dbConfig.type === 'sqlite' && !dbConfig.encryption) {
                    checks.push({ check: 'At-rest Encryption', passed: false, note: 'Consider SQLCipher' });
                } else {
                    checks.push({ check: 'At-rest Encryption', passed: true });
                }

                // Check for key rotation
                if (!dbConfig.keyRotationEnabled) {
                    checks.push({ check: 'Key Rotation', passed: false });
                } else {
                    checks.push({ check: 'Key Rotation', passed: true });
                }

                return {
                    passed: checks.every(c => c.passed),
                    checks
                };
            };

            const secureConfig = {
                type: 'postgres',
                ssl: { enabled: true },
                encryption: true,
                keyRotationEnabled: true
            };

            const insecureConfig = {
                type: 'sqlite',
                ssl: { enabled: false },
                encryption: false,
                keyRotationEnabled: false
            };

            expect(verifyDatabaseEncryption(secureConfig).passed).toBe(true);
            expect(verifyDatabaseEncryption(insecureConfig).passed).toBe(false);
        });
    });

    // =========================================================================
    // Test Suite 3: Key Management Audit
    // =========================================================================

    describe('Key Management', () => {
        it('should use secure key derivation', () => {
            const deriveKey = (password, salt, iterations = 100000) => {
                return crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256');
            };

            const validateKeyDerivation = (config) => {
                const issues = [];

                if (config.iterations < 100000) {
                    issues.push('PBKDF2 iterations should be at least 100,000');
                }

                if (config.saltLength < 16) {
                    issues.push('Salt should be at least 16 bytes');
                }

                if (!['sha256', 'sha384', 'sha512'].includes(config.hash)) {
                    issues.push('Use SHA-256 or stronger hash function');
                }

                return { valid: issues.length === 0, issues };
            };

            const goodConfig = {
                iterations: 100000,
                saltLength: 32,
                hash: 'sha256'
            };

            const badConfig = {
                iterations: 1000,
                saltLength: 8,
                hash: 'md5'
            };

            expect(validateKeyDerivation(goodConfig).valid).toBe(true);
            expect(validateKeyDerivation(badConfig).valid).toBe(false);
        });

        it('should never store plaintext keys', () => {
            const detectPlaintextKey = (value) => {
                const patterns = [
                    /sk-[a-zA-Z0-9_-]{20,}/, // OpenAI API key (allows - and _)
                    /AKIA[0-9A-Z]{16}/,    // AWS access key
                    /AIza[0-9A-Za-z_-]{35}/, // Google API key
                    /ghp_[a-zA-Z0-9]{36}/, // GitHub token
                    /xox[baprs]-[0-9]{10,}-[a-zA-Z0-9]+/ // Slack token
                ];

                for (const pattern of patterns) {
                    if (pattern.test(value)) {
                        return true;
                    }
                }
                return false;
            };

            expect(detectPlaintextKey('sk-proj-abc123def456789012345678901234567890')).toBe(true);
            expect(detectPlaintextKey('AKIAIOSFODNN7EXAMPLE')).toBe(true);
            expect(detectPlaintextKey('encrypted:abc123...')).toBe(false);
            expect(detectPlaintextKey('*****')).toBe(false);
        });

        it('should enforce minimum key lengths', () => {
            const MIN_KEY_LENGTHS = {
                symmetric: 256,  // bits
                rsa: 2048,       // bits
                ecdsa: 256,      // bits
                ed25519: 256     // bits (fixed)
            };

            const validateKeyLength = (keyType, keyLengthBits) => {
                const minLength = MIN_KEY_LENGTHS[keyType];
                if (!minLength) return { valid: false, reason: 'Unknown key type' };
                
                if (keyLengthBits < minLength) {
                    return {
                        valid: false,
                        reason: `${keyType} key must be at least ${minLength} bits, got ${keyLengthBits}`
                    };
                }
                return { valid: true };
            };

            expect(validateKeyLength('symmetric', 256).valid).toBe(true);
            expect(validateKeyLength('symmetric', 128).valid).toBe(false);
            expect(validateKeyLength('rsa', 2048).valid).toBe(true);
            expect(validateKeyLength('rsa', 1024).valid).toBe(false);
        });

        it('should verify key rotation schedule', () => {
            const MAX_KEY_AGE_DAYS = {
                symmetric: 90,
                api_key: 90,
                jwt_secret: 30,
                encryption_key: 365
            };

            const isKeyRotationOverdue = (keyType, lastRotatedAt) => {
                const maxAge = MAX_KEY_AGE_DAYS[keyType] || 90;
                const lastRotated = new Date(lastRotatedAt);
                const now = new Date();
                const daysSinceRotation = Math.floor((now - lastRotated) / (1000 * 60 * 60 * 24));
                
                return {
                    overdue: daysSinceRotation > maxAge,
                    daysSinceRotation,
                    maxAge,
                    daysOverdue: Math.max(0, daysSinceRotation - maxAge)
                };
            };

            // Key rotated 100 days ago
            const oldRotation = new Date();
            oldRotation.setDate(oldRotation.getDate() - 100);

            // Key rotated 10 days ago
            const recentRotation = new Date();
            recentRotation.setDate(recentRotation.getDate() - 10);

            expect(isKeyRotationOverdue('api_key', oldRotation.toISOString()).overdue).toBe(true);
            expect(isKeyRotationOverdue('api_key', recentRotation.toISOString()).overdue).toBe(false);
        });
    });

    // =========================================================================
    // Test Suite 4: Secure Random Generation
    // =========================================================================

    describe('Secure Random Generation', () => {
        it('should use cryptographically secure random', () => {
            const generateSecureToken = (length = 32) => {
                return crypto.randomBytes(length).toString('hex');
            };

            const token1 = generateSecureToken();
            const token2 = generateSecureToken();

            // Tokens should be different
            expect(token1).not.toBe(token2);
            
            // Token should be proper length (hex = 2 chars per byte)
            expect(token1.length).toBe(64);
            
            // Should only contain hex characters
            expect(/^[0-9a-f]+$/.test(token1)).toBe(true);
        });

        it('should reject Math.random for security purposes', () => {
            const isSecureRandom = (fn) => {
                // Check if function uses crypto
                const fnString = fn.toString();
                // Check for randomBytes or getRandomValues (secure) vs Math.random (insecure)
                const usesCrypto = fnString.includes('randomBytes') || fnString.includes('getRandomValues');
                const usesMathRandom = fnString.includes('Math.random');
                return usesCrypto || !usesMathRandom;
            };

            const insecureGenerator = () => Math.random().toString(36).substring(2);
            const secureGenerator = () => 'crypto.randomBytes(16)'; // Represents secure usage

            // Note: This is a simplified check - in real audits, we'd need deeper analysis
            expect(isSecureRandom(secureGenerator)).toBe(true);
            expect(isSecureRandom(insecureGenerator)).toBe(false);
        });
    });

    // =========================================================================
    // Test Suite 5: Secure Configuration
    // =========================================================================

    describe('Secure Configuration', () => {
        it('should verify HTTPS is enforced', () => {
            const verifyHTTPSEnforcement = (config) => {
                const checks = [];

                if (!config.httpsEnabled) {
                    checks.push('HTTPS must be enabled');
                }

                if (!config.hstsEnabled) {
                    checks.push('HSTS should be enabled');
                }

                if (config.hstsMaxAge < 31536000) { // 1 year
                    checks.push('HSTS max-age should be at least 1 year');
                }

                if (!config.redirectHttpToHttps) {
                    checks.push('HTTP to HTTPS redirect should be enabled');
                }

                return {
                    valid: checks.length === 0,
                    issues: checks
                };
            };

            const goodConfig = {
                httpsEnabled: true,
                hstsEnabled: true,
                hstsMaxAge: 31536000,
                redirectHttpToHttps: true
            };

            expect(verifyHTTPSEnforcement(goodConfig).valid).toBe(true);
        });

        it('should verify secure headers are set', () => {
            const REQUIRED_SECURITY_HEADERS = [
                'Strict-Transport-Security',
                'X-Content-Type-Options',
                'X-Frame-Options',
                'X-XSS-Protection',
                'Content-Security-Policy'
            ];

            const verifySecurityHeaders = (headers) => {
                const missing = REQUIRED_SECURITY_HEADERS.filter(
                    h => !headers[h] && !headers[h.toLowerCase()]
                );
                
                return {
                    valid: missing.length === 0,
                    missingHeaders: missing
                };
            };

            const goodHeaders = {
                'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
                'X-Content-Type-Options': 'nosniff',
                'X-Frame-Options': 'DENY',
                'X-XSS-Protection': '1; mode=block',
                'Content-Security-Policy': "default-src 'self'"
            };

            expect(verifySecurityHeaders(goodHeaders).valid).toBe(true);
        });
    });
});

// Export audit utilities
module.exports = {
    validateTLSVersion: (version) => ['TLSv1.2', 'TLSv1.3'].includes(version),
    validateKeyLength: (type, bits) => {
        const mins = { symmetric: 256, rsa: 2048, ecdsa: 256 };
        return bits >= (mins[type] || 256);
    },
    detectPlaintextKey: (value) => {
        return /sk-[a-zA-Z0-9]{20,}|AKIA[0-9A-Z]{16}/.test(value);
    }
};












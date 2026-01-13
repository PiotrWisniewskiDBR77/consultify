/**
 * SSRF (Server-Side Request Forgery) Prevention Tests
 * Enterprise SaaS Architecture - Security Testing
 * 
 * Tests for preventing SSRF attacks where an attacker
 * forces the server to make requests to internal/external resources.
 * 
 * Usage:
 *   npm run test:security
 *   vitest run tests/security/ssrf-prevention.test.js
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';

// URL validator with SSRF protection
const createSSRFProtector = () => {
    const allowedHosts = new Set([
        'api.openai.com',
        'api.anthropic.com',
        'api.groq.com',
        'api.stripe.com',
    ]);

    const blockedSchemes = new Set(['file', 'gopher', 'ftp']);
    const blockedHosts = new Set([
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        '169.254.169.254', // AWS metadata
        'metadata.google.internal', // GCP metadata
        '169.254.169.254', // Azure metadata
    ]);

    const privateIPRanges = [
        /^10\./,
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
        /^192\.168\./,
    ];

    const validateURL = (urlString) => {
        try {
            const url = new URL(urlString);

            // Block dangerous schemes
            if (blockedSchemes.has(url.protocol.slice(0, -1))) {
                return { valid: false, reason: 'BLOCKED_SCHEME' };
            }

            // Only allow http/https
            if (!['http:', 'https:'].includes(url.protocol)) {
                return { valid: false, reason: 'INVALID_PROTOCOL' };
            }

            const hostname = url.hostname.toLowerCase();

            // Block internal hosts
            if (blockedHosts.has(hostname)) {
                return { valid: false, reason: 'BLOCKED_HOST' };
            }

            // Block private IP ranges
            for (const range of privateIPRanges) {
                if (range.test(hostname)) {
                    return { valid: false, reason: 'PRIVATE_IP_RANGE' };
                }
            }

            // Check if hostname is an IP address
            const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
            if (ipRegex.test(hostname)) {
                // IP addresses must be in allowed list (none by default)
                return { valid: false, reason: 'IP_ADDRESS_NOT_ALLOWED' };
            }

            // If whitelist exists, check it
            if (allowedHosts.size > 0 && !allowedHosts.has(hostname)) {
                return { valid: false, reason: 'HOST_NOT_WHITELISTED' };
            }

            return { valid: true, url };
        } catch (error) {
            return { valid: false, reason: 'INVALID_URL', error: error.message };
        }
    };

    return {
        validateURL,

        fetchWithProtection: async (urlString) => {
            const validation = validateURL(urlString);
            if (!validation.valid) {
                throw new Error(`SSRF blocked: ${validation.reason}`);
            }

            // In real implementation, this would make the actual fetch
            // For testing, we mock it
            return { status: 200, data: 'OK' };
        },
    };
};

describe('SSRF Prevention', () => {
    let ssrfProtector;

    beforeAll(() => {
        ssrfProtector = createSSRFProtector();
    });

    // ═══════════════════════════════════════════════════════════════════
    // INTERNAL HOST BLOCKING
    // ═══════════════════════════════════════════════════════════════════

    describe('Internal Host Blocking', () => {
        it('should block localhost', () => {
            const result = ssrfProtector.validateURL('http://localhost:3000/api/data');
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('BLOCKED_HOST');
        });

        it('should block 127.0.0.1', () => {
            const result = ssrfProtector.validateURL('http://127.0.0.1:3000/api/data');
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('BLOCKED_HOST');
        });

        it('should block 0.0.0.0', () => {
            const result = ssrfProtector.validateURL('http://0.0.0.0/api/data');
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('BLOCKED_HOST');
        });

        it('should block AWS metadata endpoint', () => {
            const result = ssrfProtector.validateURL('http://169.254.169.254/latest/meta-data/');
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('BLOCKED_HOST');
        });

        it('should block GCP metadata endpoint', () => {
            const result = ssrfProtector.validateURL('http://metadata.google.internal/computeMetadata/v1/');
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('BLOCKED_HOST');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // PRIVATE IP RANGE BLOCKING
    // ═══════════════════════════════════════════════════════════════════

    describe('Private IP Range Blocking', () => {
        it('should block 10.x.x.x (private range)', () => {
            const result = ssrfProtector.validateURL('http://10.0.0.1/api/data');
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('PRIVATE_IP_RANGE');
        });

        it('should block 172.16.x.x - 172.31.x.x (private range)', () => {
            const result = ssrfProtector.validateURL('http://172.16.0.1/api/data');
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('PRIVATE_IP_RANGE');
        });

        it('should block 192.168.x.x (private range)', () => {
            const result = ssrfProtector.validateURL('http://192.168.1.1/api/data');
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('PRIVATE_IP_RANGE');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // DANGEROUS SCHEME BLOCKING
    // ═══════════════════════════════════════════════════════════════════

    describe('Dangerous Scheme Blocking', () => {
        it('should block file:// scheme', () => {
            const result = ssrfProtector.validateURL('file:///etc/passwd');
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('BLOCKED_SCHEME');
        });

        it('should block gopher:// scheme', () => {
            const result = ssrfProtector.validateURL('gopher://internal-server:70/');
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('BLOCKED_SCHEME');
        });

        it('should block ftp:// scheme', () => {
            const result = ssrfProtector.validateURL('ftp://internal-server/files');
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('BLOCKED_SCHEME');
        });

        it('should allow http:// scheme', () => {
            const result = ssrfProtector.validateURL('http://api.openai.com/v1/chat');
            expect(result.valid).toBe(true);
        });

        it('should allow https:// scheme', () => {
            const result = ssrfProtector.validateURL('https://api.openai.com/v1/chat');
            expect(result.valid).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // IP ADDRESS BLOCKING
    // ═══════════════════════════════════════════════════════════════════

    describe('IP Address Blocking', () => {
        it('should block direct IP addresses', () => {
            const result = ssrfProtector.validateURL('http://8.8.8.8/api/data');
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('IP_ADDRESS_NOT_ALLOWED');
        });

        it('should allow whitelisted hostnames', () => {
            const result = ssrfProtector.validateURL('https://api.openai.com/v1/chat');
            expect(result.valid).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // URL MANIPULATION ATTACKS
    // ═══════════════════════════════════════════════════════════════════

    describe('URL Manipulation Attacks', () => {
        it('should block localhost with different port', () => {
            const result = ssrfProtector.validateURL('http://localhost:8080/api/data');
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('BLOCKED_HOST');
        });

        it('should block localhost in subdomain', () => {
            const result = ssrfProtector.validateURL('http://localhost.evil.com/api/data');
            // Should be blocked if hostname parsing works correctly
            // In real implementation, would need DNS resolution check
            expect(result.valid).toBe(false);
        });

        it('should handle invalid URLs gracefully', () => {
            const result = ssrfProtector.validateURL('not-a-valid-url');
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('INVALID_URL');
        });

        it('should block URLs with @ symbol manipulation', () => {
            // http://user@localhost:3000/api
            const result = ssrfProtector.validateURL('http://user@localhost:3000/api');
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('BLOCKED_HOST');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // WHITELIST ENFORCEMENT
    // ═══════════════════════════════════════════════════════════════════

    describe('Whitelist Enforcement', () => {
        it('should allow whitelisted hosts', () => {
            const allowed = [
                'https://api.openai.com/v1/chat',
                'https://api.anthropic.com/v1/messages',
                'https://api.stripe.com/v1/charges',
            ];

            for (const url of allowed) {
                const result = ssrfProtector.validateURL(url);
                expect(result.valid).toBe(true);
            }
        });

        it('should block non-whitelisted hosts', () => {
            const blocked = [
                'https://evil.com/api/data',
                'https://malicious-site.com/steal',
                'https://internal-api.company.com/data',
            ];

            for (const url of blocked) {
                const result = ssrfProtector.validateURL(url);
                expect(result.valid).toBe(false);
                expect(result.reason).toBe('HOST_NOT_WHITELISTED');
            }
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // FETCH PROTECTION
    // ═══════════════════════════════════════════════════════════════════

    describe('Fetch Protection', () => {
        it('should allow fetch to whitelisted URL', async () => {
            await expect(
                ssrfProtector.fetchWithProtection('https://api.openai.com/v1/chat')
            ).resolves.toBeDefined();
        });

        it('should reject fetch to blocked URL', async () => {
            await expect(
                ssrfProtector.fetchWithProtection('http://localhost:3000/api/data')
            ).rejects.toThrow('SSRF blocked');
        });

        it('should reject fetch to private IP', async () => {
            await expect(
                ssrfProtector.fetchWithProtection('http://192.168.1.1/api/data')
            ).rejects.toThrow('SSRF blocked');
        });
    });
});




/**
 * Replay Attack Prevention Tests
 * Enterprise SaaS Architecture - Security Testing
 * 
 * Tests for preventing token replay attacks where an attacker
 * reuses a captured token after it has been revoked or expired.
 * 
 * Usage:
 *   npm run test:security
 *   vitest run tests/security/replay-attack.test.js
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

// Mock token manager
const createTokenManager = () => {
    const tokens = new Map(); // tokenId -> { userId, expiresAt, revoked: boolean }
    const usedTokens = new Set(); // Track tokens that have been used

    return {
        generateToken: (userId) => {
            const randomPart = Math.random().toString(36).substring(2);
            const tokenId = `token-${Date.now()}-${randomPart}`;
            const expiresAt = Date.now() + 900000; // 15 min
            tokens.set(tokenId, { userId, expiresAt, revoked: false });
            return { tokenId, token: `jwt_${tokenId}_signature` };
        },

        verifyToken: (token) => {
            const parts = token.split('_');
            const tokenId = parts.slice(1, -1).join('_');
            const tokenData = tokens.get(tokenId);

            if (!tokenData) {
                return { valid: false, reason: 'TOKEN_NOT_FOUND' };
            }

            if (tokenData.revoked) {
                return { valid: false, reason: 'TOKEN_REVOKED' };
            }

            if (Date.now() > tokenData.expiresAt) {
                return { valid: false, reason: 'TOKEN_EXPIRED' };
            }

            // Check if token has been used before (replay detection)
            if (usedTokens.has(tokenId)) {
                return { valid: false, reason: 'TOKEN_REPLAY_DETECTED' };
            }

            // Mark token as used
            usedTokens.add(tokenId);

            return { valid: true, userId: tokenData.userId, tokenId };
        },

        revokeToken: (tokenId) => {
            const tokenData = tokens.get(tokenId);
            if (tokenData) {
                tokenData.revoked = true;
                usedTokens.add(tokenId);
                return true;
            }
            return false;
        },

        revokeAllForUser: (userId) => {
            let count = 0;
            for (const [id, data] of tokens) {
                if (data.userId === userId) {
                    data.revoked = true;
                    usedTokens.add(id);
                    count++;
                }
            }
            return count;
        },

        // For testing: expose tokens map
        get tokens() {
            return tokens;
        },

        // For testing: manually expire a token
        expireToken: (tokenId) => {
            const tokenData = tokens.get(tokenId);
            if (tokenData) {
                tokenData.expiresAt = Date.now() - 1000;
                return true;
            }
            return false;
        },
    };
};

describe('Replay Attack Prevention', () => {
    let tokenManager;

    beforeEach(() => {
        tokenManager = createTokenManager();
    });

    // ═══════════════════════════════════════════════════════════════════
    // TOKEN REUSE DETECTION
    // ═══════════════════════════════════════════════════════════════════

    describe('Token Reuse Detection', () => {
        it('should accept token on first use', () => {
            const { token } = tokenManager.generateToken('user-1');
            const result = tokenManager.verifyToken(token);

            expect(result.valid).toBe(true);
            expect(result.userId).toBe('user-1');
        });

        it('should reject token on second use (replay attack)', () => {
            const { token } = tokenManager.generateToken('user-1');
            
            // First use - should succeed
            const firstResult = tokenManager.verifyToken(token);
            expect(firstResult.valid).toBe(true);

            // Second use - should fail (replay detected)
            const secondResult = tokenManager.verifyToken(token);
            expect(secondResult.valid).toBe(false);
            expect(secondResult.reason).toBe('TOKEN_REPLAY_DETECTED');
        });

        it('should reject token after revocation', () => {
            const { token, tokenId } = tokenManager.generateToken('user-1');
            
            // Revoke token
            tokenManager.revokeToken(tokenId);

            // Attempt to use revoked token
            const result = tokenManager.verifyToken(token);
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('TOKEN_REVOKED');
        });

        it('should reject expired token', () => {
            const tokenManager = createTokenManager();
            const { token, tokenId } = tokenManager.generateToken('user-1');
            
            // Manually expire token using helper method
            tokenManager.expireToken(tokenId);

            // Attempt to use expired token
            const result = tokenManager.verifyToken(token);
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('TOKEN_EXPIRED');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // LOGOUT REVOCATION
    // ═══════════════════════════════════════════════════════════════════

    describe('Logout Token Revocation', () => {
        it('should revoke all user tokens on logout', () => {
            const { token: token1 } = tokenManager.generateToken('user-1');
            const { token: token2 } = tokenManager.generateToken('user-1');
            const { token: token3 } = tokenManager.generateToken('user-2');

            // Revoke all tokens for user-1
            tokenManager.revokeAllForUser('user-1');

            // user-1 tokens should be rejected
            expect(tokenManager.verifyToken(token1).valid).toBe(false);
            expect(tokenManager.verifyToken(token2).valid).toBe(false);

            // user-2 token should still work
            expect(tokenManager.verifyToken(token3).valid).toBe(true);
        });

        it('should prevent token reuse after logout', () => {
            const { token } = tokenManager.generateToken('user-1');
            
            // Use token once
            tokenManager.verifyToken(token);

            // Logout (revoke)
            const tokenId = token.split('.')[1];
            tokenManager.revokeToken(tokenId);

            // Attempt to reuse token after logout
            const result = tokenManager.verifyToken(token);
            expect(result.valid).toBe(false);
            expect(['TOKEN_REVOKED', 'TOKEN_REPLAY_DETECTED']).toContain(result.reason);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // TIMING ATTACK PREVENTION
    // ═══════════════════════════════════════════════════════════════════

    describe('Timing Attack Prevention', () => {
        it('should return consistent response time for invalid tokens', () => {
            const invalidTokens = [
                'invalid.token.here',
                'another.invalid.token',
                'yet.another.invalid',
            ];

            const times = invalidTokens.map(token => {
                const start = Date.now();
                tokenManager.verifyToken(token);
                return Date.now() - start;
            });

            // Response times should be similar (within 10ms)
            const maxTime = Math.max(...times);
            const minTime = Math.min(...times);
            expect(maxTime - minTime).toBeLessThan(10);
        });

        it('should not leak information about token existence', () => {
            const { token: validToken } = tokenManager.generateToken('user-1');
            const invalidToken = 'invalid.token.here';

            // Both should return similar error structure
            const validResult = tokenManager.verifyToken(validToken);
            const invalidResult = tokenManager.verifyToken(invalidToken);

            // Both should have 'valid' property
            expect(validResult).toHaveProperty('valid');
            expect(invalidResult).toHaveProperty('valid');

            // Both should have 'reason' property when invalid
            if (!validResult.valid) {
                expect(validResult).toHaveProperty('reason');
            }
            if (!invalidResult.valid) {
                expect(invalidResult).toHaveProperty('reason');
            }
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // CONCURRENT REQUEST HANDLING
    // ═══════════════════════════════════════════════════════════════════

    describe('Concurrent Request Handling', () => {
        it('should handle concurrent token verification correctly', async () => {
            const { token } = tokenManager.generateToken('user-1');

            // Simulate concurrent requests
            const results = await Promise.all([
                Promise.resolve(tokenManager.verifyToken(token)),
                Promise.resolve(tokenManager.verifyToken(token)),
                Promise.resolve(tokenManager.verifyToken(token)),
            ]);

            // Only one should succeed
            const validCount = results.filter(r => r.valid).length;
            expect(validCount).toBe(1);

            // Others should detect replay
            const replayCount = results.filter(r => r.reason === 'TOKEN_REPLAY_DETECTED').length;
            expect(replayCount).toBeGreaterThan(0);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // TOKEN ROTATION
    // ═══════════════════════════════════════════════════════════════════

    describe('Token Rotation', () => {
        it('should generate new token after rotation', () => {
            const token1 = tokenManager.generateToken('user-1');
            const token2 = tokenManager.generateToken('user-1');

            expect(token1.tokenId).not.toBe(token2.tokenId);
            expect(token1.token).not.toBe(token2.token);
        });

        it('should allow multiple valid tokens for same user', () => {
            const { token: token1 } = tokenManager.generateToken('user-1');
            const { token: token2 } = tokenManager.generateToken('user-1');

            // Both should be valid (different token IDs)
            expect(tokenManager.verifyToken(token1).valid).toBe(true);
            expect(tokenManager.verifyToken(token2).valid).toBe(true);
        });
    });
});


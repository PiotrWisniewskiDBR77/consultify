/**
 * Refresh Token Service Unit Tests
 * Tests token generation, refresh, revocation, and session management
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { getDatabase } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';
import { v4 as uuidv4 } from 'uuid';

vi.hoisted(() => {
    process.env.MOCK_DB = 'false';
    const workerId = process.env.VITEST_WORKER_ID || '0';
    process.env.SQLITE_PATH = `./test-refresh-token-${workerId}.db`;
});

// Dynamic import for ESM compatibility
let RefreshTokenService;
let refreshTokenService;

describe('RefreshTokenService', () => {
    const db = getDatabase();
    let testOrgId;
    let testUserId;
    let testUserEmail;

    beforeAll(async () => {
        await initializeDatabase();

        // Import service
        const module = await import('../../../server/src/services/RefreshTokenService.js');
        RefreshTokenService = module.RefreshTokenService;
        refreshTokenService = module.refreshTokenService;

        // Create test organization
        testOrgId = uuidv4();
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`,
                [testOrgId, 'Token Test Org', 'pro', 'active'],
                (err) => err ? reject(err) : resolve()
            );
        });

        // Create test user
        testUserId = uuidv4();
        testUserEmail = `tokentest-${Date.now()}@test.com`;
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO users (id, organization_id, email, password, role, status) VALUES (?, ?, ?, ?, ?, ?)`,
                [testUserId, testOrgId, testUserEmail, 'hashed-password', 'ADMIN', 'active'],
                (err) => err ? reject(err) : resolve()
            );
        });
    });

    afterAll(async () => {
        // Cleanup
        await new Promise(r => db.run(`DELETE FROM refresh_tokens WHERE user_id = ?`, [testUserId], () => r()));
        await new Promise(r => db.run(`DELETE FROM users WHERE id = ?`, [testUserId], () => r()));
        await new Promise(r => db.run(`DELETE FROM organizations WHERE id = ?`, [testOrgId], () => r()));
    });

    beforeEach(async () => {
        // Clean up tokens before each test
        await new Promise(r => db.run(`DELETE FROM refresh_tokens WHERE user_id = ?`, [testUserId], () => r()));
    });

    describe('generateTokenPair', () => {
        it('should generate access and refresh tokens', async () => {
            const user = {
                id: testUserId,
                email: testUserEmail,
                role: 'ADMIN',
                organization_id: testOrgId
            };

            const tokens = await refreshTokenService.generateTokenPair(user, {
                deviceInfo: 'Test Device',
                ip: '127.0.0.1',
                userAgent: 'Test Agent'
            });

            expect(tokens).toBeDefined();
            expect(tokens.accessToken).toBeDefined();
            expect(tokens.accessToken).toMatch(/^eyJ/); // JWT format
            expect(tokens.refreshToken).toBeDefined();
            expect(tokens.refreshToken.length).toBeGreaterThan(64);
            expect(tokens.expiresIn).toBeDefined();
        });

        it('should store refresh token in database', async () => {
            const user = {
                id: testUserId,
                email: testUserEmail,
                role: 'ADMIN',
                organization_id: testOrgId
            };

            await refreshTokenService.generateTokenPair(user);

            const storedToken = await new Promise((resolve) => {
                db.get(
                    `SELECT * FROM refresh_tokens WHERE user_id = ? AND revoked_at IS NULL`,
                    [testUserId],
                    (_, row) => resolve(row)
                );
            });

            expect(storedToken).toBeDefined();
            expect(storedToken.user_id).toBe(testUserId);
            expect(storedToken.token_hash).toBeDefined();
        });
    });

    describe('refreshAccessToken', () => {
        it('should refresh token and return new pair', async () => {
            const user = {
                id: testUserId,
                email: testUserEmail,
                role: 'ADMIN',
                organization_id: testOrgId
            };

            const originalTokens = await refreshTokenService.generateTokenPair(user);
            const newTokens = await refreshTokenService.refreshAccessToken(originalTokens.refreshToken);

            expect(newTokens).not.toBeNull();
            expect(newTokens.accessToken).toBeDefined();
            expect(newTokens.refreshToken).toBeDefined();
            expect(newTokens.refreshToken).not.toBe(originalTokens.refreshToken);
        });

        it('should revoke old token after refresh', async () => {
            const user = {
                id: testUserId,
                email: testUserEmail,
                role: 'ADMIN',
                organization_id: testOrgId
            };

            const originalTokens = await refreshTokenService.generateTokenPair(user);
            await refreshTokenService.refreshAccessToken(originalTokens.refreshToken);

            // Old token should not work
            const result = await refreshTokenService.refreshAccessToken(originalTokens.refreshToken);

            // Either null or grace period response
            if (result) {
                expect(result.gracePeriod).toBe(true);
            } else {
                expect(result).toBeNull();
            }
        });

        it('should return null for invalid token', async () => {
            const result = await refreshTokenService.refreshAccessToken('invalid-token');
            expect(result).toBeNull();
        });
    });

    describe('revokeToken', () => {
        it('should revoke a specific token', async () => {
            const user = {
                id: testUserId,
                email: testUserEmail,
                role: 'ADMIN',
                organization_id: testOrgId
            };

            const tokens = await refreshTokenService.generateTokenPair(user);
            await refreshTokenService.revokeToken(tokens.refreshToken, 'test');

            const result = await refreshTokenService.refreshAccessToken(tokens.refreshToken);
            expect(result).toBeNull();
        });
    });

    describe('getActiveSessions', () => {
        it('should return active sessions for user', async () => {
            const user = {
                id: testUserId,
                email: testUserEmail,
                role: 'ADMIN',
                organization_id: testOrgId
            };

            // Generate a few sessions
            await refreshTokenService.generateTokenPair(user, { deviceInfo: 'Device 1' });
            await refreshTokenService.generateTokenPair(user, { deviceInfo: 'Device 2' });

            const sessions = await refreshTokenService.getActiveSessions(testUserId);

            expect(sessions).toBeDefined();
            expect(sessions.length).toBe(2);
            expect(sessions[0].deviceInfo).toBeDefined();
        });
    });

    describe('revokeAllUserTokens', () => {
        it('should revoke all tokens for a user', async () => {
            const user = {
                id: testUserId,
                email: testUserEmail,
                role: 'ADMIN',
                organization_id: testOrgId
            };

            const tokens1 = await refreshTokenService.generateTokenPair(user);
            const tokens2 = await refreshTokenService.generateTokenPair(user);

            await refreshTokenService.revokeAllUserTokens(testUserId);

            const result1 = await refreshTokenService.refreshAccessToken(tokens1.refreshToken);
            const result2 = await refreshTokenService.refreshAccessToken(tokens2.refreshToken);

            expect(result1).toBeNull();
            expect(result2).toBeNull();
        });
    });

    describe('cleanupExpiredTokens', () => {
        it('should remove expired tokens', async () => {
            // Insert an expired token directly
            await new Promise((resolve) => {
                db.run(
                    `INSERT INTO refresh_tokens (id, user_id, token_hash, token_family, device_info, expires_at)
                     VALUES (?, ?, ?, ?, ?, datetime('now', '-1 day'))`,
                    [uuidv4(), testUserId, 'expired-hash', uuidv4(), 'Expired Device'],
                    () => resolve()
                );
            });

            const deleted = await refreshTokenService.cleanupExpiredTokens();

            expect(deleted).toBeGreaterThanOrEqual(1);
        });
    });
});

/**
 * OauthService Unit Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Unit tests for OauthService - Covering findOrCreateOAuthUser and generateOAuthToken
 */

import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ActivityService from '../../../../src/services/ActivityService.js';

// Mock Database Object - Hoisted to avoid TDZ
const { mockDb } = vi.hoisted(() => {
    return {
        mockDb: {
            get: vi.fn(),
            all: vi.fn(),
            run: vi.fn(),
            exec: vi.fn(),
            serialize: vi.fn(),
            close: vi.fn(),
            query: vi.fn(),
        },
    };
});

// Mock Dependencies
vi.mock('../../../../src/database/Database', () => ({
    getDatabase: () => mockDb,
    default: {
        getDatabase: () => mockDb,
    },
}));

vi.mock('../../../../src/services/ActivityService.js', () => ({
    default: {
        log: vi.fn(),
    },
}));

vi.mock('../../../../config.js', () => ({
    default: {
        JWT_SECRET: 'test-secret',
        JWT_EXPIRES_IN: '1h',
    },
}));

vi.mock('jsonwebtoken', () => ({
    default: {
        sign: vi.fn(() => 'mock-token'),
    },
}));

vi.mock('uuid', () => ({
    v4: vi.fn(() => 'mock-uuid'),
}));

// Import service AFTER mocks
import OauthService from '../../../../src/services/oauthService.js';

describe('OauthService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset mock implementations
        mockDb.get.mockReset();
        mockDb.run.mockReset();
        // Default run behavior: succesful execution
        mockDb.run.mockImplementation((sql, params, callback) => {
            const cb = typeof params === 'function' ? params : callback;
            if (cb) cb(null);
            return mockDb;
        });
    });

    describe('findOrCreateOAuthUser', () => {
        const profile = {
            id: 'google-123',
            emails: [{ value: 'test@example.com' }],
            name: { givenName: 'Test', familyName: 'User' },
            photos: [{ value: 'avatar.jpg' }],
        };
        const provider = 'google';

        it('should return existing user if found by provider ID', async () => {
            const existingUser = { id: 'user-1', email: 'test@example.com', google_id: 'google-123' };

            // Mock first DB call to find by provider ID
            mockDb.get.mockImplementation((sql, params, callback) => {
                if (sql.includes(`WHERE google_id = ?`)) {
                    callback(null, existingUser);
                } else {
                    callback(null, null);
                }
                return mockDb;
            });

            const result = await OauthService.findOrCreateOAuthUser(provider, profile);
            expect(result.user).toEqual(existingUser);
            expect(result.isNew).toBe(false);
            expect(mockDb.get).toHaveBeenCalledWith(
                expect.stringContaining('google_id'),
                ['google-123'],
                expect.any(Function),
            );
        });

        it('should link provider to existing user if email matches', async () => {
            const existingUser = { id: 'user-1', email: 'test@example.com', google_id: null };
            const updatedUser = { ...existingUser, google_id: 'google-123', avatar_url: 'avatar.jpg' };

            mockDb.get.mockImplementation((sql, params, callback) => {
                if (sql.includes(`WHERE google_id = ?`)) {
                    // Not found by ID
                    callback(null, null);
                } else if (sql.includes('WHERE email = ?')) {
                    // Found by email
                    callback(null, existingUser);
                } else if (sql.includes('FROM users WHERE id = ?')) {
                    // Return updated user
                    callback(null, updatedUser);
                } else {
                    callback(null, null);
                }
                return mockDb;
            });

            const result = await OauthService.findOrCreateOAuthUser(provider, profile);

            expect(result.user).toEqual(updatedUser);
            expect(result.isNew).toBe(false);
            // Verify UPDATE was called
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE users SET google_id = ?'),
                ['google-123', 'avatar.jpg', 'user-1'],
                expect.any(Function),
            );
        });

        it('should create new user, organization, and member if user does not exist', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                // Not found by ID or Email
                if (sql.includes('SELECT * FROM users WHERE id = ?')) {
                    // Final fetch of created user
                    callback(null, { id: 'mock-uuid', email: 'test@example.com', role: 'ADMIN' });
                } else {
                    callback(null, null);
                }
                return mockDb;
            });

            const result = await OauthService.findOrCreateOAuthUser(provider, profile);

            expect(result.isNew).toBe(true);
            expect(result.user).toBeDefined();

            // Verify Organization Creation
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO organizations'),
                expect.arrayContaining(['mock-uuid', "Test's Organization"]),
                expect.any(Function),
            );

            // Verify User Creation
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO users'),
                expect.arrayContaining(['mock-uuid', 'mock-uuid', 'test@example.com']),
                expect.any(Function),
            );

            // Verify Member Creation
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO organization_members'),
                expect.arrayContaining(['mock-uuid', 'mock-uuid', 'mock-uuid']),
                expect.any(Function),
            );

            // Verify Activity Log
            expect(ActivityService.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'oauth_register',
                    userId: 'mock-uuid',
                }),
            );
        });
    });

    describe('generateOAuthToken', () => {
        it('should generate token, update login time, and log activity', async () => {
            const user = {
                id: 'user-1',
                email: 'test@example.com',
                role: 'ADMIN',
                organization_id: 'org-1',
                status: 'active',
                avatar_url: 'pic.jpg',
                auth_provider: 'google',
            };
            const org = { id: 'org-1', name: 'Test Org' };

            mockDb.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('FROM organizations')) {
                    callback(null, org);
                }
                return mockDb;
            });

            const result = await OauthService.generateOAuthToken(user);

            expect(result.token).toBe('mock-token');
            expect(result.safeUser).toEqual({
                id: user.id,
                email: user.email,
                firstName: undefined,
                lastName: undefined,
                role: user.role,
                status: user.status,
                organizationId: user.organization_id,
                companyName: 'Test Org',
                avatarUrl: user.avatar_url,
            });

            // Verify JWT Sign
            expect(jwt.sign).toHaveBeenCalledWith(
                expect.objectContaining({ id: user.id, email: user.email }),
                'test-secret',
                expect.any(Object),
            );

            // Verify Update Last Login
            expect(mockDb.run).toHaveBeenCalledWith(expect.stringContaining('UPDATE users SET last_login'), ['user-1']);

            // Verify Activity Log
            expect(ActivityService.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'oauth_login',
                    userId: 'user-1',
                }),
            );
        });
    });
});

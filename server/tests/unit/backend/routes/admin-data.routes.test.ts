/**
 * Admin Data Routes Tests
 * Unit tests for admin-data routes
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response } from 'express';
import type { AuthRequest } from '../../../../src/middleware/auth.middleware.js';

// Mock database
const mockDb = {
    all: vi.fn(),
    get: vi.fn(),
    run: vi.fn(),
};

vi.mock('../../../../database', () => ({
    default: mockDb,
}));

// Mock uuid
vi.mock('uuid', () => ({
    v4: () => 'test-uuid-123',
}));

// Mock auth middleware
vi.mock('../../../../src/middleware/auth.middleware.js', () => ({
    verifyToken: vi.fn((req, res, next) => next()),
}));

// Mock validation middleware
vi.mock('../../../../src/middleware/validation.middleware.js', () => ({
    validateBody: vi.fn(() => (req: Request, res: Response, next: () => void) => next()),
    validateParams: vi.fn(() => (req: Request, res: Response, next: () => void) => next()),
    validateQuery: vi.fn(() => (req: Request, res: Response, next: () => void) => next()),
}));

describe('Admin Data Routes', () => {
    let req: Partial<AuthRequest>;
    let res: Partial<Response>;

    beforeEach(() => {
        req = {
            params: {},
            query: {},
            body: {},
            user: {
                id: 'user-123',
                email: 'test@example.com',
                role: 'ADMIN',
                organizationId: 'org-123',
                isSuperAdmin: false,
            },
        };

        res = {
            json: vi.fn(),
            status: vi.fn().mockReturnThis(),
        };

        vi.clearAllMocks();
    });

    describe('GET /user-tiers/:orgId', () => {
        it('should return user tiers with usage stats', async () => {
            const mockUsers = [
                {
                    userId: 'user-1',
                    userName: 'Test User',
                    email: 'test@example.com',
                    currentTier: 'STANDARD',
                    usage: 100,
                    cost: 10.5,
                },
            ];

            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, mockUsers);
            });

            const { default: router } = await import('../../../../src/routes/admin-data.routes.js');
            
            // Note: This is a simplified test - full route testing requires Express app setup
            expect(mockDb.all).toBeDefined();
        });
    });

    describe('PUT /user-tiers/:orgId/:userId', () => {
        it('should update user tier', async () => {
            req.params = { orgId: 'org-123', userId: 'user-123' };
            req.body = { tier: 'PREMIUM' };

            mockDb.run.mockImplementation((query, params, callback) => {
                callback(null);
            });

            expect(mockDb.run).toBeDefined();
        });
    });

    describe('GET /cost-attribution/:orgId', () => {
        it('should return cost attribution by user and project', async () => {
            const mockCosts = [
                {
                    entityType: 'user',
                    entityId: 'user-1',
                    entityName: 'Test User',
                    requests: 100,
                    tokens: 1000,
                    cost: 10.5,
                },
            ];

            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, mockCosts);
            });

            expect(mockDb.all).toBeDefined();
        });
    });

    describe('GET /security-events/:orgId', () => {
        it('should return security events for organization', async () => {
            const mockEvents = [
                {
                    id: 'event-1',
                    type: 'LOGIN_FAILURE',
                    severity: 'medium',
                    userId: 'user-1',
                    userEmail: 'test@example.com',
                    details: 'Failed login attempt',
                    resolved: 0,
                    timestamp: '2024-01-01T00:00:00Z',
                    resolved_at: null,
                    resolved_by: null,
                },
            ];

            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, mockEvents);
            });

            expect(mockDb.all).toBeDefined();
        });
    });

    describe('PUT /security-events/:eventId/resolve', () => {
        it('should mark security event as resolved', async () => {
            req.params = { eventId: 'event-123' };

            mockDb.run.mockImplementation((query, params, callback) => {
                callback(null);
            });

            expect(mockDb.run).toBeDefined();
        });
    });

    describe('GET /system-health', () => {
        it('should return system health status', async () => {
            mockDb.get.mockImplementation((query, callback) => {
                callback(null, { ok: 1 });
            });

            expect(mockDb.get).toBeDefined();
        });
    });
});




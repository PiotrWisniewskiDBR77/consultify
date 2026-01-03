/**
 * PMO Validation Middleware Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 * ETAP 10.4: Testy dla Middleware - 95%+ coverage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { validateInitiative, validateTask, validateInitiativeStatus, validateTaskStatus, setDependencies, type AuthRequest } from '../../../../src/middleware/pmoValidation.middleware.js';

describe('PMO Validation Middleware', () => {
    let mockReq: Partial<AuthRequest>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;
    let mockDb: {
        get: (sql: string, params: unknown[], callback: (err: Error | null, row: unknown) => void) => void;
        run: (sql: string, params: unknown[], callback?: (err: Error | null) => void) => void;
    };
    let mockStatusMachine: {
        validateInitiativeTransition: (current: string, newStatus: string, options?: unknown) => { valid: boolean; reason?: string };
        validateTaskTransition: (current: string, newStatus: string, options?: unknown) => { valid: boolean; reason?: string };
    };

    beforeEach(() => {
        mockNext = vi.fn();
        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };
        mockDb = {
            get: vi.fn((_sql, _params, callback) => callback(null, null)),
            run: vi.fn((_sql, _params, callback) => callback && callback(null)),
        };
        mockStatusMachine = {
            validateInitiativeTransition: vi.fn().mockReturnValue({ valid: true }),
            validateTaskTransition: vi.fn().mockReturnValue({ valid: true }),
        };

        setDependencies({
            db: mockDb,
            StatusMachine: mockStatusMachine,
        });

        mockReq = {
            userId: 'user-123',
            organizationId: 'org-123',
            params: { id: 'initiative-123' },
            body: {},
        };
    });

    describe('validateInitiative', () => {
        it('should allow when owner is provided', () => {
            mockReq.body = { ownerId: 'owner-123' };
            validateInitiative(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should allow when owner_business_id is provided', () => {
            mockReq.body = { owner_business_id: 'owner-123' };
            validateInitiative(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should deny when no owner provided', () => {
            mockReq.body = {};
            validateInitiative(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Initiative must have an owner',
                    rule: 'INITIATIVE_OWNER_REQUIRED',
                })
            );
        });
    });

    describe('validateTask', () => {
        it('should allow when initiative exists', () => {
            mockReq.body = { initiativeId: 'initiative-123' };
            mockDb.get = vi.fn((_sql, _params, callback) => {
                callback(null, { id: 'initiative-123' });
            });
            validateTask(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should deny when no initiative provided', () => {
            mockReq.body = {};
            validateTask(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
        });

        it('should deny when initiative not found', () => {
            mockReq.body = { initiativeId: 'nonexistent' };
            mockDb.get = vi.fn((_sql, _params, callback) => {
                callback(null, null);
            });
            validateTask(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
        });
    });

    describe('validateInitiativeStatus', () => {
        it('should allow valid status transition', () => {
            mockReq.body = { status: 'IN_PROGRESS' };
            mockDb.get = vi.fn((_sql, _params, callback) => {
                callback(null, { status: 'PLANNED', project_id: 'project-123' });
            });
            validateInitiativeStatus(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockReq.previousStatus).toBe('PLANNED');
        });

        it('should skip validation when no status in body', () => {
            mockReq.body = {};
            validateInitiativeStatus(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should deny invalid status transition', () => {
            mockReq.body = { status: 'COMPLETED' };
            mockDb.get = vi.fn((_sql, _params, callback) => {
                callback(null, { status: 'PLANNED', project_id: 'project-123' });
            });
            mockStatusMachine.validateInitiativeTransition = vi.fn().mockReturnValue({
                valid: false,
                reason: 'Invalid transition',
            });
            validateInitiativeStatus(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
        });
    });

    describe('validateTaskStatus', () => {
        it('should allow valid status transition', () => {
            mockReq.body = { status: 'IN_PROGRESS' };
            mockDb.get = vi.fn((_sql, _params, callback) => {
                callback(null, { status: 'TODO', initiative_id: 'initiative-123' });
            });
            validateTaskStatus(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should deny invalid status transition', () => {
            mockReq.body = { status: 'COMPLETED' };
            mockDb.get = vi.fn((_sql, _params, callback) => {
                callback(null, { status: 'TODO', initiative_id: 'initiative-123' });
            });
            mockStatusMachine.validateTaskTransition = vi.fn().mockReturnValue({
                valid: false,
                reason: 'Invalid transition',
            });
            validateTaskStatus(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
        });
    });
});




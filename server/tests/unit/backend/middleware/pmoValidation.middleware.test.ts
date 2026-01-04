/**
 * PMO Validation Middleware Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 * ETAP 10.4: Testy dla Middleware - 95%+ coverage
 */

import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    type AuthRequest,
    setDependencies,
    validateInitiative,
    validateInitiativeStatus,
    validateTask,
    validateTaskStatus,
} from '../../../../src/middleware/pmoValidation.middleware.js';

// Use hoisted mock for DbPromise
const { mockGet, mockRun } = vi.hoisted(() => {
    return {
        mockGet: vi.fn(),
        mockRun: vi.fn(),
    };
});

vi.mock('../../../../src/utils/DbPromise.js', () => ({
    get: mockGet,
    run: mockRun,
}));

describe('PMO Validation Middleware', () => {
    let mockReq: Partial<AuthRequest>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;
    let mockStatusMachine: {
        validateInitiativeTransition: (
            current: string,
            newStatus: string,
            options?: unknown,
        ) => { valid: boolean; reason?: string };
        validateTaskTransition: (
            current: string,
            newStatus: string,
            options?: unknown,
        ) => { valid: boolean; reason?: string };
    };

    beforeEach(() => {
        mockNext = vi.fn();
        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };

        mockGet.mockReset();
        mockRun.mockReset();
        mockGet.mockResolvedValue(null);

        mockStatusMachine = {
            validateInitiativeTransition: vi.fn().mockReturnValue({ valid: true }),
            validateTaskTransition: vi.fn().mockReturnValue({ valid: true }),
        };

        setDependencies({
            // db dependency is mocked via module mock
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
                }),
            );
        });
    });

    describe('validateTask', () => {
        it('should allow when initiative exists', async () => {
            mockReq.body = { initiativeId: 'initiative-123' };
            mockGet.mockResolvedValue({ id: 'initiative-123' });

            await validateTask(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should deny when no initiative provided', async () => {
            mockReq.body = {};
            await validateTask(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
        });

        it('should deny when initiative not found', async () => {
            mockReq.body = { initiativeId: 'nonexistent' };
            mockGet.mockResolvedValue(null);

            await validateTask(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
        });
    });

    describe('validateInitiativeStatus', () => {
        it('should allow valid status transition', async () => {
            mockReq.body = { status: 'IN_PROGRESS' };
            mockGet.mockResolvedValue({ status: 'PLANNED', project_id: 'project-123' });

            await validateInitiativeStatus(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockReq.previousStatus).toBe('PLANNED');
        });

        it('should skip validation when no status in body', async () => {
            mockReq.body = {};
            await validateInitiativeStatus(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should deny invalid status transition', async () => {
            mockReq.body = { status: 'COMPLETED' };
            mockGet.mockResolvedValue({ status: 'PLANNED', project_id: 'project-123' });

            mockStatusMachine.validateInitiativeTransition = vi.fn().mockReturnValue({
                valid: false,
                reason: 'Invalid transition',
            });
            await validateInitiativeStatus(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
        });
    });

    describe('validateTaskStatus', () => {
        it('should allow valid status transition', async () => {
            mockReq.body = { status: 'IN_PROGRESS' };
            mockGet.mockResolvedValue({ status: 'TODO', initiative_id: 'initiative-123' });

            await validateTaskStatus(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should deny invalid status transition', async () => {
            mockReq.body = { status: 'COMPLETED' };
            mockGet.mockResolvedValue({ status: 'TODO', initiative_id: 'initiative-123' });

            mockStatusMachine.validateTaskTransition = vi.fn().mockReturnValue({
                valid: false,
                reason: 'Invalid transition',
            });
            await validateTaskStatus(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
        });
    });
});




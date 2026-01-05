/**
 * Async Handler Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 * ETAP 10.3: Testy dla Utils Layer - 100% coverage
 */

import { describe, expect, it, vi } from 'vitest';

import type { AuthenticatedRequest, NextFunction, Response } from '../../../../src/types/index.js';
import { asyncHandler, createAsyncHandler } from '../../../../src/utils/asyncHandler.js';

describe('asyncHandler', () => {
    let mockReq: Partial<AuthenticatedRequest>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
        mockReq = {};
        mockRes = {
            json: vi.fn(),
            status: vi.fn().mockReturnThis(),
            headersSent: false,
        };
        mockNext = vi.fn();
    });

    describe('asyncHandler', () => {
        it('should wrap async function and catch errors', async () => {
            const asyncFn = vi.fn().mockRejectedValue(new Error('Test error'));
            const wrapped = asyncHandler(asyncFn);

            await wrapped(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

            expect(asyncFn).toHaveBeenCalled();
            expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
        });

        it('should pass through successful async function', async () => {
            const asyncFn = vi.fn().mockResolvedValue(undefined);
            const wrapped = asyncHandler(asyncFn);

            await wrapped(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

            expect(asyncFn).toHaveBeenCalled();
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should handle sync function that throws', async () => {
            const syncFn = vi.fn().mockImplementation(() => {
                throw new Error('Sync error');
            });
            const wrapped = asyncHandler(syncFn as any);

            await wrapped(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

            expect(syncFn).toHaveBeenCalled();
            expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
        });

        it('should handle sync function successfully', async () => {
            const syncFn = vi.fn().mockReturnValue(undefined);
            const wrapped = asyncHandler(syncFn as any);

            await wrapped(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

            expect(syncFn).toHaveBeenCalled();
            expect(mockNext).not.toHaveBeenCalled();
        });
    });

    describe('createAsyncHandler', () => {
        it('should return result as JSON when result is defined', async () => {
            const result = { data: 'test' };
            const asyncFn = vi.fn().mockResolvedValue(result);
            const wrapped = createAsyncHandler(asyncFn);

            await wrapped(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

            expect(asyncFn).toHaveBeenCalled();
            expect(mockRes.json).toHaveBeenCalledWith(result);
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should not send response if result is undefined', async () => {
            const asyncFn = vi.fn().mockResolvedValue(undefined);
            const wrapped = createAsyncHandler(asyncFn);

            await wrapped(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

            expect(asyncFn).toHaveBeenCalled();
            expect(mockRes.json).not.toHaveBeenCalled();
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should not send response if headers already sent', async () => {
            mockRes.headersSent = true;
            const result = { data: 'test' };
            const asyncFn = vi.fn().mockResolvedValue(result);
            const wrapped = createAsyncHandler(asyncFn);

            await wrapped(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

            expect(asyncFn).toHaveBeenCalled();
            expect(mockRes.json).not.toHaveBeenCalled();
        });

        it('should catch errors and pass to next', async () => {
            const asyncFn = vi.fn().mockRejectedValue(new Error('Test error'));
            const wrapped = createAsyncHandler(asyncFn);

            await wrapped(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

            expect(asyncFn).toHaveBeenCalled();
            expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
            expect(mockRes.json).not.toHaveBeenCalled();
        });
    });
});

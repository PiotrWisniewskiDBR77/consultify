/**
 * AuditLogService Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuditLogService } from '../../../src/services/AuditLogService.js';
import type { IDatabase } from '../../../src/database/IDatabase.js';

describe('AuditLogService', () => {
    let mockDb: IDatabase;
    let service: AuditLogService;

    beforeEach(() => {
        mockDb = {
            get: vi.fn(),
            all: vi.fn(),
            run: vi.fn(),
            exec: vi.fn(),
            serialize: vi.fn(),
            close: vi.fn(),
            query: vi.fn(),
        } as unknown as IDatabase;

        service = new AuditLogService(mockDb);
    });

    it('should be instantiable', () => {
        expect(service).toBeInstanceOf(AuditLogService);
    });

    it('should have createLog method', () => {
        expect(typeof service.createLog).toBe('function');
    });

    it('should have getLogs method', () => {
        expect(typeof service.getLogs).toBe('function');
    });
});





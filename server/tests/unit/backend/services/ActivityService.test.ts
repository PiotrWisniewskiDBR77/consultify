/**
 * ActivityService Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ActivityService } from '../../../src/services/ActivityService.js';
import type { IDatabase } from '../../../src/database/IDatabase.js';

describe('ActivityService', () => {
    let mockDb: IDatabase;
    let service: ActivityService;

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

        service = new ActivityService(mockDb);
    });

    it('should be instantiable', () => {
        expect(service).toBeInstanceOf(ActivityService);
    });

    it('should have log method', () => {
        expect(typeof service.log).toBe('function');
    });

    it('should have getRecent method', () => {
        expect(typeof service.getRecent).toBe('function');
    });

    it('should have getByOrganization method', () => {
        expect(typeof service.getByOrganization).toBe('function');
    });
});

